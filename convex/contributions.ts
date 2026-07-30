import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { contributionType } from './schema'
import { requireAdmin } from './auth'
import { applyContributionDelta } from './rollup'

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

/**
 * 기여 랭킹 (상위 N).
 * 1000명 기준 설계: by_status_score 인덱스는 (status, contributionScore) 순이라
 * 활성 회원을 점수 내림차순으로 앞에서 limit명만 읽는다 — 전체 회원 정렬 불필요.
 */
export const leaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? 10, 1), 50)
    const members = await ctx.db
      .query('members')
      .withIndex('by_status_score', (q) => q.eq('status', 'active'))
      .order('desc')
      .take(take)
    return members.map((m) => ({
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
    // 운영진 통계(누적 기여 점수·유형별 집계)를 롤업으로 유지 — 전체 스캔 제거
    await applyContributionDelta(ctx, type, pts, 1)
    return null
  },
})
