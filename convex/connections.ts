import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { memberFromToken, requireMember, enforceRateLimit } from './auth'
import { createNotification } from './notify'

/**
 * 회원 간 1:1 교류 신청 (커피챗·협업 제안 등).
 * phone(연락처)은 accepted 상태의 상대방에게만 공개한다 —
 * 공개 응답 phone 제외 원칙의 명시적 예외 경로.
 * declined 이력은 재신청을 허용한다(statusWith에서 null 취급).
 */

// 입력 한도
const MESSAGE_MIN = 5
const MESSAGE_MAX = 500
const TOPIC_MAX = 30
// 거절당한 상대에게 재신청 가능해지기까지의 쿨다운 (괴롭힘 방지)
const DECLINED_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

// 상대방 요약 projection (phone 제외 — accepted 시 별도 phone 필드로만 공개)
function toOtherSummary(m: Doc<'members'>) {
  return {
    _id: m._id,
    name: m.name,
    cohort: m.cohort,
    university: m.university,
    company: m.company,
    title: m.title,
    region: m.region,
  }
}

// 교류 신청 보내기
export const request = mutation({
  args: {
    token: v.string(),
    toId: v.id('members'),
    message: v.string(),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, { token, toId, message, topic }) => {
    const me = await requireMember(ctx, token)
    if (me.status !== 'active') {
      throw new Error('운영진 승인 후 교류를 신청할 수 있습니다.')
    }
    if (toId === me._id) {
      throw new Error('본인에게는 교류를 신청할 수 없습니다.')
    }
    const target = await ctx.db.get(toId)
    if (!target || target.status !== 'active') {
      throw new Error('활성 회원에게만 교류를 신청할 수 있습니다.')
    }
    const msg = message.trim()
    if (msg.length < MESSAGE_MIN || msg.length > MESSAGE_MAX) {
      throw new Error('신청 메시지는 5자 이상 500자 이하로 입력해주세요.')
    }
    const cleanTopic = topic?.trim() || undefined
    if (cleanTopic !== undefined && cleanTopic.length > TOPIC_MAX) {
      throw new Error('교류 주제는 30자 이하로 입력해주세요.')
    }
    // 양방향 중복 차단: pending/accepted 존재 시 거부 (declined 이력은 재신청 허용)
    const mySent = await ctx.db
      .query('connections')
      .withIndex('by_from', (q) => q.eq('fromId', me._id))
      .collect()
    const myReceived = await ctx.db
      .query('connections')
      .withIndex('by_to', (q) => q.eq('toId', me._id))
      .collect()
    const outgoing = mySent.filter((c) => c.toId === toId)
    const incoming = myReceived.filter((c) => c.fromId === toId)
    if ([...outgoing, ...incoming].some((c) => c.status === 'accepted')) {
      throw new Error('이미 연결된 회원입니다.')
    }
    if (outgoing.some((c) => c.status === 'pending')) {
      throw new Error('이미 신청 대기중입니다.')
    }
    if (incoming.some((c) => c.status === 'pending')) {
      throw new Error(
        '상대 회원이 이미 교류를 신청했습니다. 받은 신청에서 응답해주세요.',
      )
    }
    // 거절 직후 재신청 차단 (declined 이력은 쿨다운 경과 후에만 재신청 허용)
    const lastDeclined = outgoing
      .filter((c) => c.status === 'declined')
      .sort((a, b) => (b.respondedAt ?? 0) - (a.respondedAt ?? 0))[0]
    if (
      lastDeclined &&
      Date.now() - (lastDeclined.respondedAt ?? lastDeclined.createdAt) <
        DECLINED_COOLDOWN_MS
    ) {
      throw new Error('거절된 신청은 7일이 지난 뒤 다시 보낼 수 있습니다.')
    }
    // 스팸 방지: 회원당 신청 빈도 제한 (auth의 슬라이딩 윈도우 재사용)
    await enforceRateLimit(
      ctx,
      `connect:${me._id}`,
      '교류 신청이 너무 잦습니다. 잠시 후 다시 시도해주세요.',
    )
    const connectionId = await ctx.db.insert('connections', {
      fromId: me._id,
      toId,
      message: msg,
      topic: cleanTopic,
      status: 'pending',
      createdAt: Date.now(),
    })
    // 수신자에게 교류 신청 알림
    await createNotification(ctx, toId, {
      type: 'connection.request',
      title: `${me.name}님이 교류를 신청했어요`,
      body: cleanTopic ? `주제: ${cleanTopic}` : undefined,
      link: '/connections',
      refId: connectionId,
    })
    return connectionId
  },
})

// 받은 신청에 응답 (수락/거절). toId 본인만, pending 상태만.
export const respond = mutation({
  args: {
    token: v.string(),
    connectionId: v.id('connections'),
    accept: v.boolean(),
  },
  handler: async (ctx, { token, connectionId, accept }) => {
    const me = await requireMember(ctx, token)
    const conn = await ctx.db.get(connectionId)
    if (!conn) throw new Error('교류 신청을 찾을 수 없습니다.')
    if (conn.toId !== me._id) {
      throw new Error('신청을 받은 본인만 응답할 수 있습니다.')
    }
    if (conn.status !== 'pending') {
      throw new Error('이미 응답한 신청입니다.')
    }
    await ctx.db.patch(connectionId, {
      status: accept ? 'accepted' : 'declined',
      respondedAt: Date.now(),
    })
    // 수락 시 신청자에게 알림 (거절은 알리지 않음 — 거절 통보의 부담 회피)
    if (accept) {
      await createNotification(ctx, conn.fromId, {
        type: 'connection.accepted',
        title: `${me.name}님이 교류 신청을 수락했어요`,
        body: '이제 서로의 연락처를 확인할 수 있어요.',
        link: '/connections',
        refId: conn._id,
      })
    }
    return null
  },
})

// 보낸 신청 취소. fromId 본인만, pending 상태만 삭제.
export const cancel = mutation({
  args: { token: v.string(), connectionId: v.id('connections') },
  handler: async (ctx, { token, connectionId }) => {
    const me = await requireMember(ctx, token)
    const conn = await ctx.db.get(connectionId)
    if (!conn) throw new Error('교류 신청을 찾을 수 없습니다.')
    if (conn.fromId !== me._id) {
      throw new Error('신청을 보낸 본인만 취소할 수 있습니다.')
    }
    if (conn.status !== 'pending') {
      throw new Error('대기중인 신청만 취소할 수 있습니다.')
    }
    await ctx.db.delete(connectionId)
    return null
  },
})

// 내 교류함: 받은/보낸 신청 각 최신순. 비로그인 null.
export const mine = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return null
    // 상대 요약 + (accepted 한정) 연락처를 합친 목록 항목
    const toItem = async (c: Doc<'connections'>, otherId: Doc<'members'>['_id']) => {
      const other = await ctx.db.get(otherId)
      if (!other) return null // 상대 레코드가 사라진 항목은 목록에서 제외
      return {
        _id: c._id,
        status: c.status,
        message: c.message,
        topic: c.topic,
        createdAt: c.createdAt,
        respondedAt: c.respondedAt,
        other: toOtherSummary(other),
        // 연락처는 수락된 교류에서만 상호 공개
        phone: c.status === 'accepted' ? other.phone : undefined,
      }
    }
    const receivedDocs = await ctx.db
      .query('connections')
      .withIndex('by_to', (q) => q.eq('toId', me._id))
      .order('desc')
      .collect()
    const sentDocs = await ctx.db
      .query('connections')
      .withIndex('by_from', (q) => q.eq('fromId', me._id))
      .order('desc')
      .collect()
    const received = []
    for (const c of receivedDocs) {
      const item = await toItem(c, c.fromId)
      if (item) received.push(item)
    }
    const sent = []
    for (const c of sentDocs) {
      const item = await toItem(c, c.toId)
      if (item) sent.push(item)
    }
    return { received, sent }
  },
})

// 특정 회원과의 교류 상태 (프로필 화면 버튼 상태용).
// declined은 null 취급해 재신청을 허용한다.
export const statusWith = query({
  args: { token: v.optional(v.string()), memberId: v.id('members') },
  handler: async (ctx, { token, memberId }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return null
    if (memberId === me._id) return null
    const sent = await ctx.db
      .query('connections')
      .withIndex('by_from', (q) => q.eq('fromId', me._id))
      .collect()
    const received = await ctx.db
      .query('connections')
      .withIndex('by_to', (q) => q.eq('toId', me._id))
      .collect()
    const candidates = [
      ...sent
        .filter((c) => c.toId === memberId)
        .map((c) => ({ c, direction: 'sent' as const })),
      ...received
        .filter((c) => c.fromId === memberId)
        .map((c) => ({ c, direction: 'received' as const })),
    ].filter(({ c }) => c.status !== 'declined')
    if (candidates.length === 0) return null
    // accepted 우선, 같은 상태면 최신 우선
    candidates.sort(
      (a, b) =>
        (b.c.status === 'accepted' ? 1 : 0) -
          (a.c.status === 'accepted' ? 1 : 0) || b.c.createdAt - a.c.createdAt,
    )
    const { c, direction } = candidates[0]
    // 연락처는 수락된 교류에서만 공개
    let phone: string | undefined
    if (c.status === 'accepted') {
      const other = await ctx.db.get(memberId)
      phone = other?.phone
    }
    return {
      _id: c._id,
      direction,
      // declined은 위에서 걸러져 pending/accepted만 남는다
      status: c.status as 'pending' | 'accepted',
      message: c.message,
      topic: c.topic,
      createdAt: c.createdAt,
      phone,
    }
  },
})

// 받은 신청 중 대기중 개수 (탭 뱃지용). 비로그인 0.
export const pendingReceivedCount = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return 0
    const received = await ctx.db
      .query('connections')
      .withIndex('by_to', (q) => q.eq('toId', me._id))
      .collect()
    return received.filter((c) => c.status === 'pending').length
  },
})
