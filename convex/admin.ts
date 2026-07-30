import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireAdmin } from './auth'
import { COUNTER, monthKey, readCounters, topFacets } from './rollup'

/**
 * 운영진 화면 집계 (1000명 기준 설계).
 *
 * 이전 구현은 dashboard/analytics에서 members·requests·matches·contributions·
 * connections를 전부 `.collect()`했다. 회원 1000명 + 파생 레코드 규모에서는
 * 한 쿼리가 읽는 문서 수가 Convex 한도에 가까워지고 응답도 선형으로 느려진다.
 * 그래서 수치는 counters/facetCounts 롤업(convex/rollup.ts)에서 단건 조회로 읽고,
 * 목록은 인덱스 take(N) 또는 커서 페이지네이션으로 상한을 고정한다.
 */

// 처리 대기 요청은 상태별로 이만큼만 (오래된 순 — 운영진 처리 큐)
const PENDING_REQUESTS_PER_STATUS = 25
// 승인 대기 회원 노출 상한
const PENDING_MEMBERS_LIMIT = 50
// 교류 모니터링 최신 목록 상한 (상태별로 나눠 읽고 합쳐서 자름)
const RECENT_CONNECTIONS = 40
// CSV 내보내기 한 페이지 크기 (클라이언트가 커서로 이어 받는다)
const EXPORT_PAGE = 200
// 프로필 미작성 리마인드 대상 상한
const INCOMPLETE_LIMIT = 20
// 프로필 '미작성'으로 보는 완성률 상한 (src/lib/profile.ts 기준과 동일)
const INCOMPLETE_THRESHOLD = 60

// 운영진 목록/CSV용 회원 요약 (phone 포함 — 운영진 응답 전용)
function toAdminMember(m: Doc<'members'>) {
  return {
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
  }
}

// 운영진 대시보드 집계 — 수치는 counters, 목록은 인덱스 take(N).
export const dashboard = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token)
    const counts = await readCounters(ctx, [
      COUNTER.membersTotal,
      COUNTER.membersActive,
      COUNTER.membersPending,
      COUNTER.requestsTotal,
      COUNTER.matchesDone,
      'requests.open',
      'requests.matching',
      'requests.connected',
    ] as const)

    // 처리 대기(open/matching) — 상태별 인덱스에서 오래된 순으로 앞에서만 읽는다
    const [openReqs, matchingReqs] = await Promise.all([
      ctx.db
        .query('requests')
        .withIndex('by_status', (q) => q.eq('status', 'open'))
        .order('asc')
        .take(PENDING_REQUESTS_PER_STATUS),
      ctx.db
        .query('requests')
        .withIndex('by_status', (q) => q.eq('status', 'matching'))
        .order('asc')
        .take(PENDING_REQUESTS_PER_STATUS),
    ])
    const pendingRequests = await Promise.all(
      [...openReqs, ...matchingReqs]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(async (r) => {
          const [author, reqMatches] = await Promise.all([
            ctx.db.get(r.authorId),
            ctx.db
              .query('matches')
              .withIndex('by_request', (q) => q.eq('requestId', r._id))
              .collect(),
          ])
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

    const pendingMemberDocs = await ctx.db
      .query('members')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .order('desc')
      .take(PENDING_MEMBERS_LIMIT)

    return {
      stats: {
        totalMembers: counts[COUNTER.membersTotal],
        activeMembers: counts[COUNTER.membersActive],
        pendingMembers: counts[COUNTER.membersPending],
        openRequests: counts['requests.open'],
        matchingRequests: counts['requests.matching'],
        connectedRequests: counts['requests.connected'],
        totalRequests: counts[COUNTER.requestsTotal],
        totalConnections: counts[COUNTER.matchesDone],
      },
      pendingRequests,
      pendingMembers: pendingMemberDocs.map((m) => ({
        _id: m._id,
        name: m.name,
        phone: m.phone,
        company: m.company,
      })),
    }
  },
})

/**
 * 운영진 회원 관리 — 커서 페이지네이션.
 * q(검색어)는 members.searchText 전문 인덱스를 쓴다. 단 운영진은 전화번호로도
 * 찾아야 하므로(searchText에는 phone을 넣지 않는다) 숫자만 입력된 검색어는
 * by_phone 인덱스 단건 조회로 처리한다.
 */
export const members = query({
  args: {
    token: v.string(),
    paginationOpts: paginationOptsValidator,
    q: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { token, paginationOpts, q, status }) => {
    await requireAdmin(ctx, token)
    const needle = q?.trim()
    const memberStatus = status as Doc<'members'>['status'] | undefined

    // 숫자만 입력 → 전화번호 완전일치 조회 (by_phone 인덱스 단건).
    // 부분 일치는 인덱스로 처리할 수 없어 지원하지 않는다 — 전체 번호를 입력해야 한다.
    if (needle && /^\d{9,}$/.test(needle)) {
      const hit = await ctx.db
        .query('members')
        .withIndex('by_phone', (qq) => qq.eq('phone', needle))
        .unique()
      const page =
        hit && (!memberStatus || hit.status === memberStatus)
          ? [toAdminMember(hit)]
          : []
      return { page, isDone: true, continueCursor: '' }
    }

    let result
    if (needle) {
      result = await ctx.db
        .query('members')
        .withSearchIndex('search_text', (s) => {
          const b = s.search('searchText', needle)
          return memberStatus ? b.eq('status', memberStatus) : b
        })
        .paginate(paginationOpts)
    } else if (memberStatus) {
      result = await ctx.db
        .query('members')
        .withIndex('by_status_score', (qq) => qq.eq('status', memberStatus))
        .order('desc')
        .paginate(paginationOpts)
    } else {
      // 상태 무관: 기여 점수 desc가 아니라 최신 등록순 — 인덱스 없이도 커서로 안전
      result = await ctx.db.query('members').order('desc').paginate(paginationOpts)
    }
    return { ...result, page: result.page.map(toAdminMember) }
  },
})

/**
 * 운영진 통계 — 전부 롤업/인덱스 기반.
 *  - 회원/요청/교류/기여 수치: counters 단건 조회
 *  - 기수·학교·업종·지역 분포: facetCounts 상위 N (빈도 인덱스 역순)
 *  - 평균 완성률: members.profileScoreSum / members.active
 *  - 활발한 교류 회원: by_status_connections 인덱스 desc take(5)
 * matchesDone은 '완료된 매칭 건수' — 이전 구현의 '완료 매칭을 가진 요청 수'와
 * 요청 1건에 완료 매칭이 여러 건인 경우에만 달라진다(롤업으로 O(1) 유지).
 */
export const analytics = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token)
    const thisMonth = `members.new.${monthKey(Date.now())}`
    const counts = await readCounters(ctx, [
      COUNTER.membersTotal,
      COUNTER.membersActive,
      COUNTER.membersPending,
      COUNTER.membersSuspended,
      COUNTER.profileScoreSum,
      COUNTER.requestsTotal,
      COUNTER.matchesDone,
      COUNTER.connectionsTotal,
      COUNTER.contributionPointsTotal,
      thisMonth,
      'requests.open',
      'requests.matching',
      'requests.connected',
      'requests.closed',
      'connections.pending',
      'connections.accepted',
      'connections.declined',
    ] as const)

    const [cohortFacets, universities, industries, regions] = await Promise.all([
      topFacets(ctx, 'cohort', 60),
      topFacets(ctx, 'university', 10),
      topFacets(ctx, 'industry', 8),
      topFacets(ctx, 'region', 8),
    ])
    // 기수: 정규화된 숫자 기수만, count desc → 동률 시 기수 숫자 desc
    const cohorts = cohortFacets
      .filter((f) => /^\d+$/.test(f.key))
      .sort((a, b) => b.count - a.count || Number(b.key) - Number(a.key))

    // 기여: 타입별 건수·합계 (타입 리터럴이 고정 5종이라 카운터 키도 고정)
    const contributionTypes = [
      'intro',
      'consult',
      'sponsor',
      'event',
      'onboarding',
    ] as const
    const contribCounters = await readCounters(
      ctx,
      contributionTypes.flatMap((t) => [
        `contributions.points.${t}`,
        `contributions.count.${t}`,
      ]) as `contributions.${string}`[],
    )
    const byType = contributionTypes
      .map((type) => ({
        type,
        count: contribCounters[`contributions.count.${type}`] ?? 0,
        points: contribCounters[`contributions.points.${type}`] ?? 0,
      }))
      .filter((t) => t.count > 0 || t.points > 0)
      .sort((a, b) => b.points - a.points)

    // 활발한 교류 회원 — 회원 문서의 acceptedConnections 캐시를 인덱스로 정렬
    const connectors = await ctx.db
      .query('members')
      .withIndex('by_status_connections', (q) => q.eq('status', 'active'))
      .order('desc')
      .take(5)
    const topConnectors = connectors
      .filter((m) => (m.acceptedConnections ?? 0) > 0)
      .map((m) => ({
        memberId: m._id as string,
        name: m.name,
        count: m.acceptedConnections ?? 0,
      }))

    const active = counts[COUNTER.membersActive]
    const accepted = counts['connections.accepted']
    const declined = counts['connections.declined']
    const responded = accepted + declined

    return {
      members: {
        total: counts[COUNTER.membersTotal],
        active,
        pending: counts[COUNTER.membersPending],
        suspended: counts[COUNTER.membersSuspended],
        newThisMonth: counts[thisMonth],
      },
      cohorts,
      universities,
      industries,
      regions,
      requests: {
        total: counts[COUNTER.requestsTotal],
        open: counts['requests.open'],
        matching: counts['requests.matching'],
        connected: counts['requests.connected'],
        closed: counts['requests.closed'],
      },
      matchesDone: counts[COUNTER.matchesDone],
      exchange: {
        total: counts[COUNTER.connectionsTotal],
        pending: counts['connections.pending'],
        accepted,
        declined,
        acceptRate: responded ? Math.round((accepted / responded) * 100) : 0,
      },
      contributions: {
        totalPoints: counts[COUNTER.contributionPointsTotal],
        byType,
      },
      topConnectors,
      avgCompletion: active
        ? Math.round(counts[COUNTER.profileScoreSum] / active)
        : 0,
    }
  },
})

// 프로필 미작성(완성률 60% 미만) 활성 회원 — 운영진 리마인드 대상.
// members.profileScore 캐시를 by_status_profile 인덱스 오름차순으로 앞에서만 읽는다.
export const incompleteMembers = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token)
    const rows = await ctx.db
      .query('members')
      .withIndex('by_status_profile', (q) => q.eq('status', 'active'))
      .order('asc')
      .take(INCOMPLETE_LIMIT)
    return rows
      .filter((m) => (m.profileScore ?? 0) < INCOMPLETE_THRESHOLD)
      .map(toAdminMember)
  },
})

// 운영진 교류 모니터링: 최신순 + 상태별 카운트(카운터). phone 미포함.
export const connections = query({
  args: { token: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { token, status }) => {
    await requireAdmin(ctx, token)
    const counters = await readCounters(ctx, [
      COUNTER.connectionsTotal,
      'connections.pending',
      'connections.accepted',
      'connections.declined',
    ] as const)
    const counts = {
      total: counters[COUNTER.connectionsTotal],
      pending: counters['connections.pending'],
      accepted: counters['connections.accepted'],
      declined: counters['connections.declined'],
    }

    // by_status_created 인덱스로 상태별 최신 N건만 읽고, '전체'는 3상태를 합쳐 정렬.
    // 읽는 문서 수는 상태 수 × RECENT_CONNECTIONS로 고정된다.
    const wanted: Doc<'connections'>['status'][] = status
      ? [status as Doc<'connections'>['status']]
      : ['pending', 'accepted', 'declined']
    const batches = await Promise.all(
      wanted.map((s) =>
        ctx.db
          .query('connections')
          .withIndex('by_status_created', (q) => q.eq('status', s))
          .order('desc')
          .take(RECENT_CONNECTIONS),
      ),
    )
    const rows = batches
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, RECENT_CONNECTIONS)

    const summary = (m: Doc<'members'> | null) => ({
      _id: m?._id ?? null,
      name: m?.name ?? '(알 수 없음)',
      cohort: m?.cohort,
      university: m?.university,
    })
    const recent = await Promise.all(
      rows.map(async (c) => {
        const [from, to] = await Promise.all([
          ctx.db.get(c.fromId),
          ctx.db.get(c.toId),
        ])
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

/**
 * 운영진 CSV 내보내기 — 커서 페이지 단위로 반환.
 * 전체 회원을 한 쿼리에 담으면 회원 수와 함께 응답이 무한히 커지므로,
 * 클라이언트가 cursor를 이어 넘기며 EXPORT_PAGE씩 받아 파일을 조립한다.
 */
export const memberSummary = query({
  args: { token: v.string(), cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { token, cursor }) => {
    await requireAdmin(ctx, token)
    const { page, isDone, continueCursor } = await ctx.db
      .query('members')
      .order('desc')
      .paginate({ cursor: cursor ?? null, numItems: EXPORT_PAGE })
    return {
      rows: page.map((m) => ({
        name: m.name,
        phone: m.phone,
        company: m.company ?? '',
        cohort: m.cohort ?? '',
        university: m.university ?? '',
        industry: m.industry.join(', '),
        region: m.region ?? '',
        status: m.status,
        contributionScore: m.contributionScore,
        createdAt: m.createdAt,
      })),
      isDone,
      continueCursor,
    }
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
