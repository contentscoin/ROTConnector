import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { contributionType } from './schema'
import { requireAdmin } from './auth'

export const byMember = query({
  args: { memberId: v.id('members') },
  handler: async (ctx, { memberId }) => {
    return await ctx.db
      .query('contributions')
      .withIndex('by_member', (q) => q.eq('memberId', memberId))
      .order('desc')
      .collect()
  },
})

// 기여 랭킹 (상위 N)
export const leaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    // by_status 인덱스로 활성 회원만 조회 (전체 스캔 방지)
    const members = await ctx.db
      .query('members')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect()
    return members
      .sort((a, b) => b.contributionScore - a.contributionScore)
      .slice(0, limit ?? 10)
      .map((m) => ({
        _id: m._id,
        name: m.name,
        company: m.company,
        cohort: m.cohort,
        contributionScore: m.contributionScore,
      }))
  },
})

// 운영진: 수동 기여 적립 (후원/행사/온보딩 등 매칭과 무관한 기여)
export const award = mutation({
  args: {
    token: v.string(),
    memberId: v.id('members'),
    type: contributionType,
    points: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, memberId, type, points, note }) => {
    await requireAdmin(ctx, token)
    const pts = Math.round(points)
    if (pts < 1 || pts > 1000) {
      throw new Error('기여 점수는 1~1000 사이여야 합니다.')
    }
    await ctx.db.insert('contributions', {
      memberId,
      type,
      points: pts,
      note,
      createdAt: Date.now(),
    })
    const member = await ctx.db.get(memberId)
    if (member) {
      await ctx.db.patch(memberId, {
        contributionScore: member.contributionScore + pts,
      })
    }
    return null
  },
})
