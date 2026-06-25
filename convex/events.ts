import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAdmin, requireMember, memberFromToken } from './auth'
import { createNotification } from './notify'

const rsvpStatus = v.union(v.literal('going'), v.literal('interested'))

// 행사 목록 — 참석/관심 집계 + (로그인 시) 내 RSVP 상태 동봉.
export const list = query({
  args: {
    kind: v.optional(v.union(v.literal('event'), v.literal('sponsor'))),
    token: v.optional(v.string()),
  },
  handler: async (ctx, { kind, token }) => {
    let events = await ctx.db.query('events').order('desc').collect()
    if (kind) events = events.filter((e) => e.kind === kind)
    const me = await memberFromToken(ctx, token)
    // 행사별 by_event 인덱스 조회 — 전체 eventRsvps 풀스캔을 피해 RSVP 누적에도 확장.
    return await Promise.all(
      events.map(async (e) => {
        const forEvent = await ctx.db
          .query('eventRsvps')
          .withIndex('by_event', (q) => q.eq('eventId', e._id))
          .collect()
        return {
          ...e,
          goingCount: forEvent.filter((r) => r.status === 'going').length,
          interestedCount: forEvent.filter((r) => r.status === 'interested')
            .length,
          myRsvp: me
            ? (forEvent.find((r) => r.memberId === me._id)?.status ?? null)
            : null,
        }
      }),
    )
  },
})

// 행사 참석 의사 설정/해제. status='none'이면 해제. 활성 회원·예정 행사만.
export const rsvp = mutation({
  args: {
    token: v.string(),
    eventId: v.id('events'),
    status: v.union(rsvpStatus, v.literal('none')),
  },
  handler: async (ctx, { token, eventId, status }) => {
    const me = await requireMember(ctx, token)
    if (me.status !== 'active') {
      throw new Error('운영진 승인 후 참석 의사를 표시할 수 있습니다.')
    }
    const event = await ctx.db.get(eventId)
    if (!event) throw new Error('행사를 찾을 수 없습니다.')
    if (event.status !== 'upcoming') {
      throw new Error('종료된 행사에는 참석 의사를 표시할 수 없습니다.')
    }
    const forEvent = await ctx.db
      .query('eventRsvps')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect()
    const mine = forEvent.find((r) => r.memberId === me._id)
    if (status === 'none') {
      if (mine) await ctx.db.delete(mine._id)
    } else if (mine) {
      if (mine.status !== status) await ctx.db.patch(mine._id, { status })
    } else {
      await ctx.db.insert('eventRsvps', {
        eventId,
        memberId: me._id,
        status,
        createdAt: Date.now(),
      })
    }
    return null
  },
})

// 행사 상세 — 참석/관심 명단(연락처 미포함) + (로그인 시) 내 RSVP.
export const get = query({
  args: { id: v.id('events'), token: v.optional(v.string()) },
  handler: async (ctx, { id, token }) => {
    const event = await ctx.db.get(id)
    if (!event) return null
    const me = await memberFromToken(ctx, token)
    const rsvps = await ctx.db
      .query('eventRsvps')
      .withIndex('by_event', (q) => q.eq('eventId', id))
      .collect()
    const going: Array<{
      _id: string
      name: string
      company?: string
      cohort?: string
      university?: string
    }> = []
    const interested: typeof going = []
    for (const r of rsvps) {
      const m = await ctx.db.get(r.memberId)
      if (!m) continue // 탈퇴/삭제된 회원은 명단에서 제외
      const summary = {
        _id: m._id as string,
        name: m.name,
        company: m.company,
        cohort: m.cohort,
        university: m.university,
      }
      if (r.status === 'going') going.push(summary)
      else interested.push(summary)
    }
    const byName = (a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name, 'ko')
    going.sort(byName)
    interested.sort(byName)
    return {
      ...event,
      going,
      interested,
      goingCount: going.length,
      interestedCount: interested.length,
      myRsvp: me
        ? (rsvps.find((r) => r.memberId === me._id)?.status ?? null)
        : null,
    }
  },
})

export const create = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    kind: v.union(v.literal('event'), v.literal('sponsor')),
    body: v.string(),
    date: v.optional(v.string()),
    place: v.optional(v.string()),
    host: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.token)
    const title = args.title.trim()
    if (title.length < 2) throw new Error('제목을 입력해주세요.')
    const eventId = await ctx.db.insert('events', {
      title,
      kind: args.kind,
      body: args.body,
      date: args.date,
      place: args.place,
      host: args.host,
      status: 'upcoming',
      createdAt: Date.now(),
    })
    // 새 행사/후원을 전체 활성 회원에게 알림 (등록한 운영진 본인 제외)
    const members = await ctx.db
      .query('members')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect()
    const kindLabel = args.kind === 'sponsor' ? '후원' : '행사'
    for (const m of members) {
      if (m._id === admin._id) continue
      await createNotification(ctx, m._id, {
        type: 'event.created',
        title: `새 ${kindLabel}: ${title}`,
        body: args.date ? `일자: ${args.date}` : undefined,
        link: '/events',
        refId: eventId,
      })
    }
    return eventId
  },
})

// 운영진: 행사 상태 토글 (upcoming ↔ done)
export const setStatus = mutation({
  args: {
    token: v.string(),
    id: v.id('events'),
    status: v.union(v.literal('upcoming'), v.literal('done')),
  },
  handler: async (ctx, { token, id, status }) => {
    await requireAdmin(ctx, token)
    await ctx.db.patch(id, { status })
    return null
  },
})
