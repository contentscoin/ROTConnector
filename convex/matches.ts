import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { matchStatus, contributionType } from './schema'
import { requireAdmin } from './auth'

// 기여 적립 + 회원 점수 가산 (내부 헬퍼)
async function award(
  ctx: MutationCtx,
  memberId: Id<'members'>,
  type: 'intro' | 'consult' | 'sponsor' | 'event' | 'onboarding',
  points: number,
  refId?: string,
  note?: string,
) {
  // 점수 정합성: 음수/과도값 방지
  points = Math.max(0, Math.min(1000, Math.round(points)))
  if (points === 0) return
  await ctx.db.insert('contributions', {
    memberId,
    type,
    points,
    refId,
    note,
    createdAt: Date.now(),
  })
  const member = await ctx.db.get(memberId)
  if (member) {
    await ctx.db.patch(memberId, {
      contributionScore: member.contributionScore + points,
    })
  }
}

// 특정 요청의 매칭 목록 (helper/broker 요약 포함)
export const listByRequest = query({
  args: { requestId: v.id('requests') },
  handler: async (ctx, { requestId }) => {
    const matches = await ctx.db
      .query('matches')
      .withIndex('by_request', (q) => q.eq('requestId', requestId))
      .order('desc')
      .collect()
    return Promise.all(
      matches.map(async (m) => {
        const helper = await ctx.db.get(m.helperId)
        const broker = m.brokeredBy ? await ctx.db.get(m.brokeredBy) : null
        return {
          ...m,
          helper: helper
            ? { _id: helper._id, name: helper.name, company: helper.company }
            : null,
          broker: broker ? { _id: broker._id, name: broker.name } : null,
        }
      }),
    )
  },
})

// 운영진: helper를 요청에 제안 → 요청 상태 matching
export const propose = mutation({
  args: {
    token: v.string(),
    requestId: v.id('requests'),
    helperId: v.id('members'),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, requestId, helperId, note }) => {
    const admin = await requireAdmin(ctx, token)
    const req = await ctx.db.get(requestId)
    if (!req) throw new Error('요청을 찾을 수 없습니다.')
    const matchId = await ctx.db.insert('matches', {
      requestId,
      helperId,
      brokeredBy: admin._id,
      status: 'proposed',
      note,
      createdAt: Date.now(),
    })
    if (req.status === 'open') {
      await ctx.db.patch(requestId, { status: 'matching' })
    }
    return matchId
  },
})

export const setStatus = mutation({
  args: { token: v.string(), matchId: v.id('matches'), status: matchStatus },
  handler: async (ctx, { token, matchId, status }) => {
    await requireAdmin(ctx, token)
    await ctx.db.patch(matchId, { status })
    return null
  },
})

// 운영진: 연결 완료 → 매칭 done, 요청 connected, 기여 적립
export const complete = mutation({
  args: {
    token: v.string(),
    matchId: v.id('matches'),
    helperPoints: v.optional(v.number()),
    brokerPoints: v.optional(v.number()),
    contribution: v.optional(contributionType),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.token)
    const match = await ctx.db.get(args.matchId)
    if (!match) throw new Error('매칭을 찾을 수 없습니다.')
    // 멱등성: 이미 완료된 매칭에 중복 적립 방지
    if (match.status === 'done') throw new Error('이미 완료된 매칭입니다.')
    await ctx.db.patch(args.matchId, { status: 'done' })
    await ctx.db.patch(match.requestId, { status: 'connected' })

    const helperPoints = args.helperPoints ?? 10
    await award(
      ctx,
      match.helperId,
      args.contribution ?? 'consult',
      helperPoints,
      match.requestId,
      '연결 완료',
    )
    const brokerId = match.brokeredBy ?? admin._id
    const brokerPoints = args.brokerPoints ?? 5
    if (brokerPoints > 0) {
      await award(ctx, brokerId, 'intro', brokerPoints, match.requestId, '중개')
    }
    return null
  },
})

export const remove = mutation({
  args: { token: v.string(), matchId: v.id('matches') },
  handler: async (ctx, { token, matchId }) => {
    await requireAdmin(ctx, token)
    await ctx.db.delete(matchId)
    return null
  },
})
