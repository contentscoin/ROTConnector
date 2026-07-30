import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, internalMutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { requireAdmin, requireMember, memberFromToken } from './auth'
import { createNotification, pushEnabled } from './notify'
import { applyRsvpDelta, eventRsvpKey, readCounter } from './rollup'

const rsvpStatus = v.union(v.literal('going'), v.literal('interested'))

// 팬아웃 알림 페이지 크기 — 한 트랜잭션의 쓰기·스케줄 수 상한.
// 푸시는 페이지당 1건의 배치 액션으로 묶으므로(push.sendBatch) 회원 수만큼
// 액션이 늘어나지 않는다. 1000명 기준 = 10페이지 × 액션 1개.
const FANOUT_BATCH = 100

// 참석/관심 명단 노출 상한 (상태별). 1000명 행사에서도 읽는 문서 수를 고정한다.
// 총 인원은 counters 롤업에서 별도로 읽으므로 명단만 잘린다.
const ROSTER_LIMIT = 60

// 행사별 참석/관심 수 (counters 롤업 — 행사 RSVP 수와 무관하게 단건 조회 2번)
async function rsvpCounts(ctx: QueryCtx, eventId: Id<'events'>) {
  const [goingCount, interestedCount] = await Promise.all([
    readCounter(ctx, eventRsvpKey(eventId, 'going')),
    readCounter(ctx, eventRsvpKey(eventId, 'interested')),
  ])
  return { goingCount, interestedCount }
}

// 내 RSVP 단건 (by_event_member 인덱스 — 행사 RSVP 전량 스캔 방지)
async function myRsvpFor(
  ctx: QueryCtx,
  eventId: Id<'events'>,
  memberId: Id<'members'> | null,
) {
  if (!memberId) return null
  const row = await ctx.db
    .query('eventRsvps')
    .withIndex('by_event_member', (q) =>
      q.eq('eventId', eventId).eq('memberId', memberId),
    )
    .unique()
  return row?.status ?? null
}

/**
 * 행사 목록 — 커서 페이지네이션.
 * 참석/관심 수는 행사별 counters 단건 조회, 내 RSVP는 by_event_member 단건 조회라
 * 페이지당 읽는 문서 수가 (행사 수 × 3)으로 고정된다.
 */
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    kind: v.optional(v.union(v.literal('event'), v.literal('sponsor'))),
    token: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, kind, token }) => {
    const result = kind
      ? await ctx.db
          .query('events')
          .withIndex('by_kind', (q) => q.eq('kind', kind))
          .order('desc')
          .paginate(paginationOpts)
      : await ctx.db.query('events').order('desc').paginate(paginationOpts)
    const me = await memberFromToken(ctx, token)
    const page = await Promise.all(
      result.page.map(async (e) => ({
        ...e,
        ...(await rsvpCounts(ctx, e._id)),
        myRsvp: await myRsvpFor(ctx, e._id, me?._id ?? null),
      })),
    )
    return { ...result, page }
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
    // 내 RSVP 단건 조회 (행사 전체 RSVP를 훑지 않는다)
    const mine = await ctx.db
      .query('eventRsvps')
      .withIndex('by_event_member', (q) =>
        q.eq('eventId', eventId).eq('memberId', me._id),
      )
      .unique()
    if (status === 'none') {
      if (mine) {
        await ctx.db.delete(mine._id)
        await applyRsvpDelta(ctx, eventId, mine.status, null)
      }
    } else if (mine) {
      if (mine.status !== status) {
        await ctx.db.patch(mine._id, { status })
        await applyRsvpDelta(ctx, eventId, mine.status, status)
      }
    } else {
      await ctx.db.insert('eventRsvps', {
        eventId,
        memberId: me._id,
        status,
        createdAt: Date.now(),
      })
      await applyRsvpDelta(ctx, eventId, null, status)
    }
    return null
  },
})

/**
 * 행사 상세 — 참석/관심 명단(연락처 미포함) + (로그인 시) 내 RSVP.
 * 총 인원은 counters, 명단은 by_event_status 인덱스에서 상태별 ROSTER_LIMIT명까지.
 * 명단이 잘렸으면 rosterCapped=true (UI가 "외 N명"으로 표기).
 */
export const get = query({
  args: { id: v.id('events'), token: v.optional(v.string()) },
  handler: async (ctx, { id, token }) => {
    const event = await ctx.db.get(id)
    if (!event) return null
    const me = await memberFromToken(ctx, token)
    const roster = async (status: 'going' | 'interested') => {
      const rows = await ctx.db
        .query('eventRsvps')
        .withIndex('by_event_status', (q) =>
          q.eq('eventId', id).eq('status', status),
        )
        .order('desc')
        .take(ROSTER_LIMIT)
      const people = []
      for (const r of rows) {
        const m = await ctx.db.get(r.memberId)
        // 탈퇴/삭제 + 비활성(정지·대기 전환) 회원은 명단에서 제외 — 디렉토리와 동일 정책
        if (!m || m.status !== 'active') continue
        people.push({
          _id: m._id as string,
          name: m.name,
          company: m.company,
          cohort: m.cohort,
          university: m.university,
        })
      }
      people.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      return { people, capped: rows.length >= ROSTER_LIMIT }
    }
    const [going, interested, counts] = await Promise.all([
      roster('going'),
      roster('interested'),
      rsvpCounts(ctx, id),
    ])
    return {
      ...event,
      going: going.people,
      interested: interested.people,
      rosterCapped: going.capped || interested.capped,
      ...counts,
      myRsvp: await myRsvpFor(ctx, id, me?._id ?? null),
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
// 푸시는 페이지 전체를 push.sendBatch 한 건으로 묶어 OAuth 토큰을 재사용한다.
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
    const title = `새 ${kindLabel}: ${event.title}`
    const body = event.date ? `일자: ${event.date}` : undefined
    const recipients: Id<'members'>[] = []
    for (const m of page) {
      if (m._id === actorId) continue
      try {
        await createNotification(
          ctx,
          m._id,
          {
            type: 'event.created',
            title,
            body,
            link: '/events',
            refId: eventId,
          },
          // 푸시는 아래에서 배치 1건으로 예약 — 회원마다 액션을 띄우지 않는다
          { skipPush: true },
        )
        recipients.push(m._id)
      } catch (e) {
        // 개별 수신자 실패가 페이지·후속 체인을 중단시키지 않도록 격리
        // (스케줄된 뮤테이션은 예외 시 재시도되지 않음 — 나머지 수신자 보호가 우선)
        console.error('[events.fanoutCreated] 알림 실패', m._id, e)
      }
    }
    if (recipients.length > 0 && pushEnabled()) {
      await ctx.scheduler.runAfter(0, internal.push.sendBatch, {
        userIds: recipients,
        title,
        body,
        link: '/events',
      })
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
