import { v } from 'convex/values'
import { query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
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

// 운영진 회원 관리: 검색·상태 필터. 운영진 응답이므로 phone 포함.
export const members = query({
  args: {
    token: v.string(),
    q: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { token, q, status }) => {
    await requireAdmin(ctx, token)
    let rows = await ctx.db.query('members').collect()
    if (status) {
      rows = rows.filter((m) => m.status === status)
    }
    const needle = q?.trim().toLowerCase()
    if (needle) {
      rows = rows.filter((m) =>
        [
          m.name,
          m.company ?? '',
          m.phone,
          m.cohort ?? '',
          m.university ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    }
    return rows
      .sort(
        (a, b) =>
          // active 우선 → 기여점수 desc → 이름(ko)
          (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) ||
          b.contributionScore - a.contributionScore ||
          a.name.localeCompare(b.name, 'ko'),
      )
      .map((m) => ({
        _id: m._id,
        name: m.name,
        phone: m.phone,
        cohort: m.cohort,
        university: m.university,
        company: m.company,
        title: m.title,
        region: m.region,
        industry: m.industry,
        helpOffer: m.helpOffer,
        helpNeed: m.helpNeed,
        intro: m.intro,
        products: m.products,
        customers: m.customers,
        status: m.status,
        isAdmin: m.isAdmin,
        contributionScore: m.contributionScore,
        createdAt: m.createdAt,
      }))
  },
})

// 운영진 통계: 회원/기수/학교/업종/지역/요청/매칭/교류/기여 집계.
export const analytics = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token)
    const [members, requests, matches, contributions, connections] =
      await Promise.all([
        ctx.db.query('members').collect(),
        ctx.db.query('requests').collect(),
        ctx.db.query('matches').collect(),
        ctx.db.query('contributions').collect(),
        ctx.db.query('connections').collect(),
      ])

    const now = new Date()
    const curYear = now.getFullYear()
    const curMonth = now.getMonth()
    const active = members.filter((m) => m.status === 'active')

    // 빈도 집계 → count desc → key(ko) 정렬, 상위 N
    const tally = (
      keys: Iterable<string>,
      limit: number,
    ): Array<{ key: string; count: number }> => {
      const map = new Map<string, number>()
      for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1)
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
        .slice(0, limit)
        .map(([key, count]) => ({ key, count }))
    }

    // 기수: 정규화된 숫자 기수만, count desc → 동률 시 기수 숫자 desc
    const cohortMap = new Map<string, number>()
    for (const m of active) {
      if (m.cohort && /^\d+$/.test(m.cohort)) {
        cohortMap.set(m.cohort, (cohortMap.get(m.cohort) ?? 0) + 1)
      }
    }
    const cohorts = [...cohortMap.entries()]
      .sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))
      .map(([key, count]) => ({ key, count }))

    const universities = tally(
      active.filter((m) => m.university).map((m) => m.university as string),
      10,
    )
    const industries = tally(
      active.flatMap((m) => m.industry),
      8,
    )
    const regions = tally(
      active.filter((m) => m.region).map((m) => m.region as string),
      8,
    )

    const byReqStatus = (s: string) =>
      requests.filter((r) => r.status === s).length

    // 교류 집계: 응답완료(accepted+declined) 중 accepted 비율
    const pending = connections.filter((c) => c.status === 'pending').length
    const accepted = connections.filter((c) => c.status === 'accepted').length
    const declined = connections.filter((c) => c.status === 'declined').length
    const responded = accepted + declined
    const acceptRate = responded ? Math.round((accepted / responded) * 100) : 0

    // 기여: 타입별 건수·합계, points desc
    const contribMap = new Map<string, { count: number; points: number }>()
    let totalPoints = 0
    for (const c of contributions) {
      const e = contribMap.get(c.type) ?? { count: 0, points: 0 }
      e.count += 1
      e.points += c.points
      contribMap.set(c.type, e)
      totalPoints += c.points
    }
    const byType = [...contribMap.entries()]
      .map(([type, v]) => ({ type, count: v.count, points: v.points }))
      .sort((a, b) => b.points - a.points)

    // 교류 활동: accepted connections의 from/to 양쪽 모두 +1, count desc 상위 5
    const connectorCount = new Map<string, number>()
    for (const c of connections) {
      if (c.status !== 'accepted') continue
      connectorCount.set(
        c.fromId as string,
        (connectorCount.get(c.fromId as string) ?? 0) + 1,
      )
      connectorCount.set(
        c.toId as string,
        (connectorCount.get(c.toId as string) ?? 0) + 1,
      )
    }
    const memberById = new Map(members.map((m) => [m._id as string, m]))
    const topConnectors = [...connectorCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([memberId, count]) => ({
        memberId,
        name: memberById.get(memberId)?.name ?? '(알 수 없음)',
        count,
      }))

    // 프로필 완성률 평균 (active). src/lib/profile.ts와 동일한 9개 필드 기준.
    const completeness = (m: (typeof active)[number]): number => {
      const checks = [
        !!m.intro?.trim(),
        !!m.company?.trim(),
        !!m.title?.trim(),
        !!m.region?.trim(),
        m.industry.length > 0,
        m.helpOffer.length > 0,
        m.helpNeed.length > 0,
        !!m.cohort?.trim(),
        !!m.university?.trim(),
      ]
      const done = checks.filter(Boolean).length
      return Math.round((done / checks.length) * 100)
    }
    const avgCompletion = active.length
      ? Math.round(
          active.reduce((sum, m) => sum + completeness(m), 0) / active.length,
        )
      : 0

    return {
      members: {
        total: members.length,
        active: active.length,
        pending: members.filter((m) => m.status === 'pending').length,
        suspended: members.filter((m) => m.status === 'suspended').length,
        newThisMonth: members.filter((m) => {
          const d = new Date(m.createdAt)
          return d.getFullYear() === curYear && d.getMonth() === curMonth
        }).length,
      },
      cohorts,
      universities,
      industries,
      regions,
      requests: {
        total: requests.length,
        open: byReqStatus('open'),
        matching: byReqStatus('matching'),
        connected: byReqStatus('connected'),
        closed: byReqStatus('closed'),
      },
      matchesDone: new Set(
        matches.filter((m) => m.status === 'done').map((m) => m.requestId),
      ).size,
      exchange: {
        total: connections.length,
        pending,
        accepted,
        declined,
        acceptRate,
      },
      contributions: { totalPoints, byType },
      topConnectors,
      avgCompletion,
    }
  },
})

// 운영진 교류 모니터링: 최신순 상위 40건 + 상태별 카운트. phone 미포함.
export const connections = query({
  args: { token: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { token, status }) => {
    await requireAdmin(ctx, token)
    const all = await ctx.db.query('connections').collect()
    const counts = {
      total: all.length,
      pending: all.filter((c) => c.status === 'pending').length,
      accepted: all.filter((c) => c.status === 'accepted').length,
      declined: all.filter((c) => c.status === 'declined').length,
    }
    let rows = all.sort((a, b) => b.createdAt - a.createdAt)
    if (status) {
      rows = rows.filter((c) => c.status === status)
    }
    const recent = await Promise.all(
      rows.slice(0, 40).map(async (c) => {
        const [from, to] = await Promise.all([
          ctx.db.get(c.fromId),
          ctx.db.get(c.toId),
        ])
        const summary = (m: Doc<'members'> | null) => ({
          _id: m?._id ?? null,
          name: m?.name ?? '(알 수 없음)',
          cohort: m?.cohort,
          university: m?.university,
        })
        return {
          _id: c._id,
          status: c.status,
          topic: c.topic,
          message: c.message,
          createdAt: c.createdAt,
          respondedAt: c.respondedAt,
          from: summary(from),
          to: summary(to),
        }
      }),
    )
    return { counts, recent }
  },
})

// 운영진 감사 로그: 최신순. action 필터 옵션. 불변 기록이라 읽기 전용.
export const auditLogs = query({
  args: {
    token: v.string(),
    action: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, action, limit }) => {
    await requireAdmin(ctx, token)
    const take = Math.min(Math.max(limit ?? 100, 1), 200)
    let rows = await ctx.db
      .query('auditLogs')
      .withIndex('by_created')
      .order('desc')
      .take(action ? 500 : take)
    if (action) rows = rows.filter((r) => r.action === action).slice(0, take)
    return rows.map((r) => ({
      _id: r._id,
      actorId: r.actorId,
      actorName: r.actorName,
      action: r.action,
      targetId: r.targetId ?? null,
      targetName: r.targetName ?? null,
      detail: r.detail ?? null,
      createdAt: r.createdAt,
    }))
  },
})
