import { v } from 'convex/values'
import { mutation, internalMutation, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { requireAdmin, requireMember, memberFromToken } from './auth'
import { createNotification } from './notify'

const rsvpStatus = v.union(v.literal('going'), v.literal('interested'))

// 팬아웃 알림 페이지 크기 — 한 트랜잭션의 쓰기·스케줄 수 상한.
// 푸시(FCM) 활성 시 회원당 insert 1 + 예약 1이라 실효 상한은 2×BATCH.
const FANOUT_BATCH = 100

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
    // 비활성(정지·대기 전환) 회원의 RSVP는 집계에서 제외 — 상세 명단과 동일 정책.
    // 회원 상태는 쿼리 내 캐시로 중복 조회 방지.
    const activeCache = new Map<Id<'members'>, boolean>()
    const isActiveMember = async (memberId: Id<'members'>) => {
      const cached = activeCache.get(memberId)
      if (cached !== undefined) return cached
      const m = await ctx.db.get(memberId)
      const active = m?.status === 'active'
      activeCache.set(memberId, active)
      return active
    }
    // 행사별 by_event 인덱스 조회 — 전체 eventRsvps 풀스캔을 피해 RSVP 누적에도 확장.
    return await Promise.all(
      events.map(async (e) => {
        const forEvent = await ctx.db
          .query('eventRsvps')
          .withIndex('by_event', (q) => q.eq('eventId', e._id))
          .collect()
        const counted = (
          await Promise.all(
            forEvent.map(async (r) => ({
              r,
              active: await isActiveMember(r.memberId),
            })),
          )
        )
          .filter((x) => x.active)
          .map((x) => x.r)
        return {
          ...e,
          goingCount: counted.filter((r) => r.status === 'going').length,
          interestedCount: counted.filter((r) => r.status === 'interested')
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
      // 탈퇴/삭제 + 비활성(정지·대기 전환) 회원은 명단·집계에서 제외 — 디렉토리와 동일 정책
      if (!m || m.status !== 'active') continue
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
    // 새 행사/후원 알림은 스케줄러 팬아웃으로 분리 — 회원 수와 무관하게
    // 등록 뮤테이션은 즉시 완료되고, 알림 삽입은 페이지 단위로 이어진다.
    await ctx.scheduler.runAfter(0, internal.events.fanoutCreated, {
      eventId,
      actorId: admin._id,
      cursor: null,
    })
    return eventId
  },
})

// 새 행사 알림 팬아웃 — 활성 회원을 FANOUT_BATCH명씩 처리하고 남으면 자기 재예약.
// 등록한 운영진 본인은 제외. 도중에 행사가 삭제되면 중단.
export const fanoutCreated = internalMutation({
  args: {
    eventId: v.id('events'),
    actorId: v.id('members'),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { eventId, actorId, cursor }) => {
    const event = await ctx.db.get(eventId)
    if (!event) return null
    const kindLabel = event.kind === 'sponsor' ? '후원' : '행사'
    const { page, isDone, continueCursor } = await ctx.db
      .query('members')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .paginate({ cursor, numItems: FANOUT_BATCH })
    for (const m of page) {
      if (m._id === actorId) continue
      try {
        await createNotification(ctx, m._id, {
          type: 'event.created',
          title: `새 ${kindLabel}: ${event.title}`,
          body: event.date ? `일자: ${event.date}` : undefined,
          link: '/events',
          refId: eventId,
        })
      } catch (e) {
        // 개별 수신자 실패가 페이지·후속 체인을 중단시키지 않도록 격리
        // (스케줄된 뮤테이션은 예외 시 재시도되지 않음 — 나머지 수신자 보호가 우선)
        console.error('[events.fanoutCreated] 알림 실패', m._id, e)
      }
    }
    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.events.fanoutCreated, {
        eventId,
        actorId,
        cursor: continueCursor,
      })
    }
    return null
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
