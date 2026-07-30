import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { memberFromToken, requireMember, requireAdmin } from './auth'
import {
  buildMemberSearchText,
  memberProfileScore,
  normalizeCohort,
  normalizeTags,
  termsOverlap,
} from './util'
import {
  COUNTER,
  applyMemberDelta,
  facetCount,
  readCounter,
  topFacets,
} from './rollup'
import { recordAudit } from './audit'
import { createNotification } from './notify'

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

const linkValidator = v.object({ label: v.string(), url: v.string() })

/**
 * 공개 디렉토리용 projection.
 * phone(=로그인 자격증명)은 절대 공개 응답에 포함하지 않는다.
 * searchText/profileScore 등 내부 비정규화 필드도 노출하지 않는다.
 * 전체 PII(phone)는 본인(auth.me) 또는 운영진(admin.*) 경로에서만 노출.
 */
function toPublicMember(m: Doc<'members'>) {
  return {
    _id: m._id,
    _creationTime: m._creationTime,
    name: m.name,
    cohort: m.cohort,
    university: m.university,
    company: m.company,
    title: m.title,
    industry: m.industry,
    region: m.region,
    intro: m.intro,
    products: m.products,
    customers: m.customers,
    helpOffer: m.helpOffer,
    helpNeed: m.helpNeed,
    links: m.links,
    isAdmin: m.isAdmin,
    status: m.status,
    contributionScore: m.contributionScore,
    createdAt: m.createdAt,
  }
}

// 자유 텍스트 입력 검증 한도
const MAX = {
  short: 100, // 이름/회사/직함/기수/학교/지역
  line: 200, // 주요 제품/고객 한 줄 소개
  intro: 2000,
  arr: 30, // 태그 배열 길이
  item: 60, // 태그 1개 길이
  links: 12,
  url: 500,
}

// 추천 후보 풀 크기 — 전체 회원 스캔 대신 검색·인덱스로 이만큼만 읽고 점수화한다.
const CANDIDATE_POOL = 60
// 인덱스 기반 보조 후보(동기·동문·같은 지역) 상한
const CANDIDATE_PEERS = 20
// 운영진 선택 UI(기여 적립·헬퍼 지정)용 후보 상한
const PICKER_LIMIT = 50

// 링크 URL 스킴 화이트리스트 (javascript: 등 저장형 XSS 차단)
function assertSafeLinks(links: { label: string; url: string }[]) {
  if (links.length > MAX.links) throw new Error('링크는 최대 12개까지 가능합니다.')
  for (const l of links) {
    const url = l.url.trim()
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('링크 URL은 http:// 또는 https:// 로 시작해야 합니다.')
    }
    if (url.length > MAX.url || l.label.length > MAX.short) {
      throw new Error('링크 길이가 너무 깁니다.')
    }
  }
}

/**
 * 회원 디렉토리 (검색·필터) — 커서 페이지네이션.
 *
 * 1000명 기준 설계: 한 번에 읽는 문서 수를 요청 페이지 크기로 고정한다.
 *  - q(자유 텍스트): searchIndex `search_text` + filterFields(status/region/cohort/university)
 *  - 업종/도움분야(배열 필드): Convex 인덱스로 원소 조회가 불가하므로 태그를
 *    searchText에 포함시켜 검색으로 후보를 좁히고, 정확 일치는 페이지 안에서 확정
 *  - 지역/기수/학교: status 선행 복합 인덱스 (정렬 키 contributionScore 포함)
 *  - 무필터: by_status_score — 기여 점수 desc 정렬을 인덱스가 보장
 * 여러 필터가 겹치면 가장 선별력이 높은 축 하나를 인덱스/검색으로 쓰고 나머지는
 * 페이지 내에서 걸러낸다(페이지가 부분적으로 비어도 loadMore로 이어진다).
 * phone 등 비공개 필드는 toPublicMember projection으로 제거해 반환.
 */
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    q: v.optional(v.string()),
    industry: v.optional(v.string()),
    region: v.optional(v.string()),
    helpOffer: v.optional(v.string()),
    cohort: v.optional(v.string()),
    university: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { paginationOpts, industry, region, helpOffer, cohort, university } =
      args
    const needle = args.q?.trim()
    // 자유 텍스트가 없어도 태그 필터가 있으면 태그를 검색어로 사용
    const searchTerm = needle || industry || helpOffer || undefined

    let result
    if (searchTerm) {
      result = await ctx.db
        .query('members')
        .withSearchIndex('search_text', (s) => {
          let b = s.search('searchText', searchTerm).eq('status', 'active')
          if (region) b = b.eq('region', region)
          if (cohort) b = b.eq('cohort', cohort)
          if (university) b = b.eq('university', university)
          return b
        })
        .paginate(paginationOpts)
    } else if (region) {
      result = await ctx.db
        .query('members')
        .withIndex('by_status_region', (q) =>
          q.eq('status', 'active').eq('region', region),
        )
        .order('desc')
        .paginate(paginationOpts)
    } else if (cohort) {
      result = await ctx.db
        .query('members')
        .withIndex('by_status_cohort', (q) =>
          q.eq('status', 'active').eq('cohort', cohort),
        )
        .order('desc')
        .paginate(paginationOpts)
    } else if (university) {
      result = await ctx.db
        .query('members')
        .withIndex('by_status_university', (q) =>
          q.eq('status', 'active').eq('university', university),
        )
        .order('desc')
        .paginate(paginationOpts)
    } else {
      result = await ctx.db
        .query('members')
        .withIndex('by_status_score', (q) => q.eq('status', 'active'))
        .order('desc')
        .paginate(paginationOpts)
    }

    // 인덱스/검색으로 좁히지 못한 나머지 조건은 페이지 안에서 확정
    let page = result.page
    if (industry) page = page.filter((m) => m.industry.includes(industry))
    if (helpOffer) page = page.filter((m) => m.helpOffer.includes(helpOffer))
    if (searchTerm) {
      if (region) page = page.filter((m) => m.region === region)
      if (cohort) page = page.filter((m) => m.cohort === cohort)
      if (university) page = page.filter((m) => m.university === university)
    }
    return { ...result, page: page.map(toPublicMember) }
  },
})

// 운영진 선택 UI(기여 적립 대상·헬퍼 지정)용 경량 후보 목록.
// 1000명 전체를 <Select>에 담지 않도록 검색어 기반 상위 50명만 반환.
export const picker = query({
  args: { token: v.string(), q: v.optional(v.string()) },
  handler: async (ctx, { token, q }) => {
    await requireAdmin(ctx, token)
    const needle = q?.trim()
    const rows = needle
      ? await ctx.db
          .query('members')
          .withSearchIndex('search_text', (s) =>
            s.search('searchText', needle).eq('status', 'active'),
          )
          .take(PICKER_LIMIT)
      : await ctx.db
          .query('members')
          .withIndex('by_status_score', (qq) => qq.eq('status', 'active'))
          .order('desc')
          .take(PICKER_LIMIT)
    return rows.map((m) => ({
      _id: m._id,
      name: m.name,
      company: m.company,
      cohort: m.cohort,
    }))
  },
})

export const get = query({
  args: { id: v.id('members') },
  handler: async (ctx, { id }) => {
    const m = await ctx.db.get(id)
    // 미승인(pending) 회원은 list와 동일하게 비공개
    if (!m || m.status !== 'active') return null
    return toPublicMember(m)
  },
})

// 필터용 메타: 업종/지역/도움분야/기수/학교 distinct.
// facetCounts 롤업에서 상위 N개만 읽으므로 회원 수와 무관하게 비용이 고정.
const FACET_LIMIT = {
  industry: 40,
  region: 30,
  cohort: 60,
  university: 40,
  helpOffer: 12, // 칩으로 노출하는 빈도 상위 도움분야
}

export const facets = query({
  args: {},
  handler: async (ctx) => {
    const [industries, regions, cohorts, universities, helpOffers, total] =
      await Promise.all([
        topFacets(ctx, 'industry', FACET_LIMIT.industry),
        topFacets(ctx, 'region', FACET_LIMIT.region),
        topFacets(ctx, 'cohort', FACET_LIMIT.cohort),
        topFacets(ctx, 'university', FACET_LIMIT.university),
        topFacets(ctx, 'helpOffer', FACET_LIMIT.helpOffer),
        readCounter(ctx, COUNTER.membersActive),
      ])
    const byName = (a: { key: string }, b: { key: string }) =>
      a.key.localeCompare(b.key, 'ko')
    return {
      industries: industries.map((f) => f.key).sort((a, b) => a.localeCompare(b, 'ko')),
      regions: regions.map((f) => f.key).sort((a, b) => a.localeCompare(b, 'ko')),
      // 필터 칩은 정규화된 숫자 기수만 노출 (자유 표기 주입 방지), 최신 기수 우선
      cohorts: cohorts
        .filter((f) => /^\d{1,3}$/.test(f.key))
        .sort((a, b) => Number(b.key) - Number(a.key))
        .map((f) => f.key),
      universities: universities.sort(byName).map((f) => f.key),
      // 도움분야는 빈도 상위 12개만 (topFacets가 이미 빈도 desc)
      helpOffers: helpOffers.map((f) => f.key),
      total,
    }
  },
})

// 입력 자동완성용 태그 풀 (업종/도움 분야). 빈도순 상위를 노출해 파편화 완화.
export const tagPool = query({
  args: {},
  handler: async (ctx) => {
    const [industries, offers, needs] = await Promise.all([
      topFacets(ctx, 'industry', 40),
      topFacets(ctx, 'helpOffer', 40),
      topFacets(ctx, 'helpNeed', 40),
    ])
    // 줄 수 있는 도움/필요한 도움은 같은 어휘 풀을 공유 — 빈도 합산 후 상위 40개
    const merged = new Map<string, number>()
    for (const f of [...offers, ...needs]) {
      merged.set(f.key, (merged.get(f.key) ?? 0) + f.count)
    }
    return {
      industries: industries.map((f) => f.key),
      helps: [...merged.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
        .slice(0, 40)
        .map(([t]) => t),
    }
  },
})

// 추천 후보 수집 — 전체 활성 회원 스캔 대신 검색 인덱스 + 인덱스 take(N)로 제한.
async function candidatePool(
  ctx: QueryCtx,
  terms: string[],
  peers: { region?: string; cohort?: string; university?: string },
): Promise<Doc<'members'>[]> {
  const pool = new Map<string, Doc<'members'>>()
  const add = (rows: Doc<'members'>[]) => {
    for (const m of rows) pool.set(m._id as string, m)
  }
  const query = terms
    .map((t) => t.trim())
    .filter(Boolean)
    .join(' ')
  if (query) {
    add(
      await ctx.db
        .query('members')
        .withSearchIndex('search_text', (s) =>
          s.search('searchText', query).eq('status', 'active'),
        )
        .take(CANDIDATE_POOL),
    )
  }
  const { region, cohort, university } = peers
  if (region) {
    add(
      await ctx.db
        .query('members')
        .withIndex('by_status_region', (q) =>
          q.eq('status', 'active').eq('region', region),
        )
        .order('desc')
        .take(CANDIDATE_PEERS),
    )
  }
  if (cohort) {
    add(
      await ctx.db
        .query('members')
        .withIndex('by_status_cohort', (q) =>
          q.eq('status', 'active').eq('cohort', cohort),
        )
        .order('desc')
        .take(CANDIDATE_PEERS),
    )
  }
  if (university) {
    add(
      await ctx.db
        .query('members')
        .withIndex('by_status_university', (q) =>
          q.eq('status', 'active').eq('university', university),
        )
        .order('desc')
        .take(CANDIDATE_PEERS),
    )
  }
  return [...pool.values()]
}

// 요청에 적합한 추천 helper (운영진 매칭 보조). category/tags/region ↔ helpOffer/industry/region 점수화.
export const recommendForRequest = query({
  args: {
    token: v.optional(v.string()),
    requestId: v.id('requests'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, requestId, limit }) => {
    await requireAdmin(ctx, token) // 운영진 매칭 보조 — 서버측 게이트
    const req = await ctx.db.get(requestId)
    if (!req) return []
    const matches = await ctx.db
      .query('matches')
      .withIndex('by_request', (q) => q.eq('requestId', requestId))
      .collect()
    const excluded = new Set<string>([
      req.authorId as string,
      ...matches.map((m) => m.helperId as string),
    ])
    const reqTerms = [req.category, ...req.tags]
    const members = await candidatePool(ctx, reqTerms, { region: req.region })
    return members
      .filter((m) => !excluded.has(m._id as string))
      .map((m) => {
        const overlap = termsOverlap(reqTerms, [...m.helpOffer, ...m.industry])
        const regionMatch = !!req.region && m.region === req.region
        // 점수: 태그 겹침이 주, 지역/기여는 보조 가중(정렬용)
        const score =
          overlap * 10 +
          (regionMatch ? 5 : 0) +
          Math.min(m.contributionScore, 50) * 0.1
        return { member: toPublicMember(m), score, overlap, regionMatch }
      })
      // 관련성 게이트: 태그 겹침 또는 지역 일치만 추천(순수 기여점수 패딩 제외)
      .filter((s) => s.overlap > 0 || s.regionMatch)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit ?? 5)
  },
})

// 홈 '추천 회원': 내 helpNeed/industry ↔ 상대 helpOffer/industry 매칭 + 동기·동문 가중.
export const recommendForMember = query({
  args: { token: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { token, limit }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return []
    const myTerms = [...me.helpNeed, ...me.industry]
    // 매칭 신호(태그·지역·기수·학교)가 전혀 없으면 추천 불가
    if (myTerms.length === 0 && !me.region && !me.cohort && !me.university) {
      return []
    }
    const members = await candidatePool(ctx, myTerms, {
      region: me.region,
      cohort: me.cohort,
      university: me.university,
    })
    return members
      .filter((m) => m._id !== me._id)
      .map((m) => {
        const overlap = termsOverlap(myTerms, [...m.helpOffer, ...m.industry])
        const regionMatch = !!me.region && m.region === me.region
        const cohortMatch = !!me.cohort && m.cohort === me.cohort
        const universityMatch = !!me.university && m.university === me.university
        const score =
          overlap * 10 +
          (regionMatch ? 3 : 0) +
          (cohortMatch ? 4 : 0) + // 동기 가중
          (universityMatch ? 3 : 0) + // 동문 가중
          Math.min(m.contributionScore, 50) * 0.1
        return {
          member: toPublicMember(m),
          score,
          overlap,
          regionMatch,
          cohortMatch,
          universityMatch,
        }
      })
      // 관련성 게이트: 태그 겹침·지역·동기·동문 중 하나라도 일치해야 추천(순수 기여점수 패딩 제외)
      .filter(
        (s) => s.overlap > 0 || s.regionMatch || s.cohortMatch || s.universityMatch,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit ?? 5)
  },
})

// 내 활동 통계 (프로필 페이지용). 모두 본인 소유 레코드라 회원 수와 무관하게 비용이 고정.
export const myStats = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return null

    // 교류: accepted 건수 — 회원 문서의 캐시 사용.
    // 백필 전(undefined) 회원은 방향별 status 인덱스로 즉시 계산.
    let acceptedConnections = me.acceptedConnections
    if (acceptedConnections === undefined) {
      const [from, to] = await Promise.all([
        ctx.db
          .query('connections')
          .withIndex('by_from_status', (q) =>
            q.eq('fromId', me._id).eq('status', 'accepted'),
          )
          .collect(),
        ctx.db
          .query('connections')
          .withIndex('by_to_status', (q) =>
            q.eq('toId', me._id).eq('status', 'accepted'),
          )
          .collect(),
      ])
      acceptedConnections = from.length + to.length
    }

    // 내 도움요청 수
    const myRequests = await ctx.db
      .query('requests')
      .withIndex('by_author', (q) => q.eq('authorId', me._id))
      .collect()

    // helper로서 완료된 매칭 수 (status=done)
    const myMatches = await ctx.db
      .query('matches')
      .withIndex('by_helper', (q) => q.eq('helperId', me._id))
      .collect()
    const helperDone = myMatches.filter((m) => m.status === 'done').length

    // 기여 breakdown
    const contributions = await ctx.db
      .query('contributions')
      .withIndex('by_member', (q) => q.eq('memberId', me._id))
      .collect()
    const contribByType = new Map<string, number>()
    let totalPoints = 0
    for (const c of contributions) {
      contribByType.set(c.type, (contribByType.get(c.type) ?? 0) + c.points)
      totalPoints += c.points
    }

    return {
      acceptedConnections,
      requestsPosted: myRequests.length,
      helperDone,
      totalPoints,
      contribByType: Object.fromEntries(contribByType),
    }
  },
})

// 동기·동문 수 (본인 제외 active). facetCounts 롤업에서 값별 빈도를 바로 읽는다.
export const peerCounts = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return null
    const self = me.status === 'active' ? 1 : 0 // 본인 제외
    const [cohortCount, universityCount] = await Promise.all([
      me.cohort ? facetCount(ctx, 'cohort', me.cohort) : Promise.resolve(0),
      me.university
        ? facetCount(ctx, 'university', me.university)
        : Promise.resolve(0),
    ])
    return {
      cohort: me.cohort,
      cohortCount: me.cohort ? Math.max(0, cohortCount - self) : 0,
      university: me.university,
      universityCount: me.university ? Math.max(0, universityCount - self) : 0,
    }
  },
})

// 회원 등록 (운영진). 수동 MVP의 핵심.
export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    phone: v.string(),
    cohort: v.optional(v.string()),
    university: v.optional(v.string()),
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    industry: v.optional(v.array(v.string())),
    region: v.optional(v.string()),
    intro: v.optional(v.string()),
    products: v.optional(v.string()),
    customers: v.optional(v.string()),
    helpOffer: v.optional(v.array(v.string())),
    helpNeed: v.optional(v.array(v.string())),
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token)
    const name = args.name.trim()
    const phone = normalizePhone(args.phone)
    if (name.length < 2) throw new Error('이름을 입력해주세요.')
    if (phone.length < 9) throw new Error('올바른 휴대폰 번호를 입력해주세요.')
    // 학교(학군단)·주요 제품/고객: trim 후 길이 검증, 빈 값은 미저장
    const university = args.university?.trim() || undefined
    if (university && university.length > MAX.short) {
      throw new Error('학교명이 너무 깁니다.')
    }
    const products = args.products?.trim() || undefined
    const customers = args.customers?.trim() || undefined
    if (
      (products && products.length > MAX.line) ||
      (customers && customers.length > MAX.line)
    ) {
      throw new Error('주요 제품/고객 소개는 200자 이내로 입력해주세요.')
    }
    const existing = await ctx.db
      .query('members')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .unique()
    if (existing) throw new Error('이미 등록된 휴대폰 번호입니다.')
    // update와 대칭: 태그 정규화 + 개수/길이 한도 검증
    const industry = normalizeTags(args.industry ?? [])
    const helpOffer = normalizeTags(args.helpOffer ?? [])
    const helpNeed = normalizeTags(args.helpNeed ?? [])
    for (const arr of [industry, helpOffer, helpNeed]) {
      if (arr.length > MAX.arr || arr.some((sx) => sx.length > MAX.item)) {
        throw new Error('태그 개수/길이가 한도를 초과했습니다.')
      }
    }
    const doc = {
      name,
      phone,
      cohort: normalizeCohort(args.cohort), // "37기" → "37"
      university,
      company: args.company,
      title: args.title,
      industry,
      region: args.region,
      intro: args.intro,
      products,
      customers,
      helpOffer,
      helpNeed,
      links: [],
      isAdmin: args.isAdmin ?? false,
      status: 'active' as const,
      contributionScore: 0,
      createdAt: Date.now(),
    }
    const memberId = await ctx.db.insert('members', {
      ...doc,
      // 검색 인덱스·집계용 비정규화 필드 (rollup과 함께 항상 같이 갱신)
      searchText: buildMemberSearchText(doc),
      profileScore: memberProfileScore(doc),
      acceptedConnections: 0,
      unreadNotifications: 0,
    })
    const created = await ctx.db.get(memberId)
    if (created) await applyMemberDelta(ctx, null, created)
    return memberId
  },
})

// 프로필 수정 (본인 또는 운영진)
export const update = mutation({
  args: {
    token: v.string(),
    memberId: v.optional(v.id('members')),
    patch: v.object({
      name: v.optional(v.string()),
      cohort: v.optional(v.string()),
      university: v.optional(v.string()),
      company: v.optional(v.string()),
      title: v.optional(v.string()),
      industry: v.optional(v.array(v.string())),
      region: v.optional(v.string()),
      intro: v.optional(v.string()),
      products: v.optional(v.string()),
      customers: v.optional(v.string()),
      helpOffer: v.optional(v.array(v.string())),
      helpNeed: v.optional(v.array(v.string())),
      links: v.optional(v.array(linkValidator)),
    }),
  },
  handler: async (ctx, { token, memberId, patch }) => {
    const me = await requireMember(ctx, token)
    const targetId = memberId ?? me._id
    if (targetId !== me._id && !me.isAdmin) {
      throw new Error('본인 또는 운영진만 수정할 수 있습니다.')
    }
    // 입력 검증 (create와 동등 + 링크 XSS 차단)
    if (patch.name !== undefined && patch.name.trim().length < 2) {
      throw new Error('이름을 2자 이상 입력해주세요.')
    }
    if (patch.intro !== undefined && patch.intro.length > MAX.intro) {
      throw new Error('사업 소개가 너무 깁니다.')
    }
    for (const key of [
      'company',
      'title',
      'cohort',
      'university',
      'region',
    ] as const) {
      const val = patch[key]
      if (val !== undefined && val.length > MAX.short) {
        throw new Error('입력값이 너무 깁니다.')
      }
    }
    // 주요 제품/고객 한 줄 소개: trim 후 길이 검증
    for (const key of ['products', 'customers'] as const) {
      if (patch[key] === undefined) continue
      patch[key] = patch[key]!.trim()
      if (patch[key]!.length > MAX.line) {
        throw new Error('주요 제품/고객 소개는 200자 이내로 입력해주세요.')
      }
    }
    for (const key of ['industry', 'helpOffer', 'helpNeed'] as const) {
      const arr = patch[key]
      if (arr === undefined) continue
      if (arr.length > MAX.arr || arr.some((s) => s.length > MAX.item)) {
        throw new Error('태그 개수/길이가 한도를 초과했습니다.')
      }
    }
    if (patch.links !== undefined) assertSafeLinks(patch.links)
    // 태그 정규화 (파편화 완화)
    for (const key of ['industry', 'helpOffer', 'helpNeed'] as const) {
      if (patch[key] !== undefined) patch[key] = normalizeTags(patch[key])
    }
    // 기수 정규화: 저장 직전 "37기" → "37" (필터/동기 매칭 정합성)
    if (patch.cohort !== undefined) patch.cohort = normalizeCohort(patch.cohort)
    if (patch.university !== undefined) patch.university = patch.university.trim()
    // undefined 키 제거
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    )
    const before = await ctx.db.get(targetId)
    if (!before) throw new Error('회원을 찾을 수 없습니다.')
    await ctx.db.patch(targetId, clean)
    await refreshMemberDerived(ctx, targetId)
    const after = await ctx.db.get(targetId)
    if (after) await applyMemberDelta(ctx, before, after)
    return null
  },
})

// 프로필 필드 변경 후 검색 텍스트·완성률 캐시를 최종 문서 기준으로 재계산.
async function refreshMemberDerived(
  ctx: MutationCtx,
  memberId: Id<'members'>,
): Promise<void> {
  const m = await ctx.db.get(memberId)
  if (!m) return
  await ctx.db.patch(memberId, {
    searchText: buildMemberSearchText(m),
    profileScore: memberProfileScore(m),
  })
}

// 운영진: pending 회원 승인
export const approve = mutation({
  args: { token: v.string(), memberId: v.id('members') },
  handler: async (ctx, { token, memberId }) => {
    const me = await requireAdmin(ctx, token)
    const target = await ctx.db.get(memberId)
    if (!target) throw new Error('회원을 찾을 수 없습니다.')
    const wasInactive = target.status !== 'active'
    await ctx.db.patch(memberId, { status: 'active' })
    const after = await ctx.db.get(memberId)
    if (after) await applyMemberDelta(ctx, target, after)
    await recordAudit(ctx, me, 'member.approve', target)
    // 신규 승인일 때만 본인에게 알림 (이미 active면 중복 알림 방지)
    if (wasInactive) {
      await createNotification(ctx, memberId, {
        type: 'member.approved',
        title: '가입이 승인되었어요 🎉',
        body: '이제 교류 신청과 도움 요청 등 모든 기능을 이용할 수 있어요.',
        link: '/me',
      })
    }
    return null
  },
})

// 운영진: 회원 상태 변경 (활성/대기/정지). active만 노출하는 디렉토리에서 suspended는 자동 제외.
export const setStatus = mutation({
  args: {
    token: v.string(),
    memberId: v.id('members'),
    status: v.union(
      v.literal('active'),
      v.literal('pending'),
      v.literal('suspended'),
    ),
  },
  handler: async (ctx, { token, memberId, status }) => {
    const me = await requireAdmin(ctx, token)
    // 본인을 비활성/대기로 바꿔 스스로 락아웃되는 것을 차단 (마지막 운영진 보호)
    if (me._id === memberId && status !== 'active') {
      throw new Error('본인 계정은 비활성화할 수 없습니다.')
    }
    const target = await ctx.db.get(memberId)
    if (!target) throw new Error('회원을 찾을 수 없습니다.')
    if (target.status === status) return null // 변경 없음 — 로그 미기록
    await ctx.db.patch(memberId, { status })
    // 상태 전이는 활성 회원 기준 집계(facets/평균 완성률)를 바꾸므로 롤업 반영
    const after = await ctx.db.get(memberId)
    if (after) await applyMemberDelta(ctx, target, after)
    // suspended 전환 시 기존 세션은 memberFromToken에서 자동 무효화되어 별도 삭제 불필요
    const action =
      status === 'active'
        ? 'member.activate'
        : status === 'pending'
          ? 'member.setPending'
          : 'member.suspend'
    await recordAudit(ctx, me, action, target)
    return null
  },
})

// 운영진: 운영진 권한 부여/회수. 본인 권한 회수는 락아웃 방지를 위해 차단.
export const setAdmin = mutation({
  args: {
    token: v.string(),
    memberId: v.id('members'),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, { token, memberId, isAdmin }) => {
    const me = await requireAdmin(ctx, token)
    if (me._id === memberId && !isAdmin) {
      throw new Error('본인의 운영진 권한은 회수할 수 없습니다.')
    }
    const target = await ctx.db.get(memberId)
    if (!target) throw new Error('회원을 찾을 수 없습니다.')
    if (target.isAdmin === isAdmin) return null // 변경 없음 — 로그 미기록
    await ctx.db.patch(memberId, { isAdmin })
    await recordAudit(ctx, me, isAdmin ? 'admin.grant' : 'admin.revoke', target)
    return null
  },
})
