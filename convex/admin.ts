import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireAdmin } from './auth'

// 운영진 대시보드 집계
export const dashboard = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token)
    const [members, requests, matches] = await Promise.all([
      ctx.db.query('members').collect(),
      ctx.db.query('requests').collect(),
      ctx.db.query('matches').collect(),
    ])

    const byStatus = (s: string) => requests.filter((r) => r.status === s).length

    // 처리 대기 (open/matching) — 작성자 요약 포함, 오래된 순
    const pendingRequests = await Promise.all(
      requests
        .filter((r) => r.status === 'open' || r.status === 'matching')
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(async (r) => {
          const author = await ctx.db.get(r.authorId)
          const reqMatches = matches.filter((m) => m.requestId === r._id)
          return {
            _id: r._id,
            title: r.title,
            category: r.category,
            status: r.status,
            urgency: r.urgency,
            createdAt: r.createdAt,
            authorName: author?.name ?? '(알 수 없음)',
            matchCount: reqMatches.length,
          }
        }),
    )

    return {
      stats: {
        totalMembers: members.length,
        activeMembers: members.filter((m) => m.status === 'active').length,
        pendingMembers: members.filter((m) => m.status === 'pending').length,
        openRequests: byStatus('open'),
        matchingRequests: byStatus('matching'),
        connectedRequests: byStatus('connected'),
        totalRequests: requests.length,
        totalConnections: new Set(
          matches.filter((m) => m.status === 'done').map((m) => m.requestId),
        ).size,
      },
      pendingRequests,
      pendingMembers: members
        .filter((m) => m.status === 'pending')
        .map((m) => ({ _id: m._id, name: m.name, phone: m.phone, company: m.company })),
    }
  },
})
