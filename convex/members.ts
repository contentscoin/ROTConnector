import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { memberFromToken, requireMember, requireAdmin } from './auth'
import { normalizeCohort, normalizeTags, termsOverlap } from './util'

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

const linkValidator = v.object({ label: v.string(), url: v.string() })

/**
 * 공개 디렉토리용 projection.
 * phone(=로그인 자격증명)은 절대 공개 응답에 포함하지 않는다.
 * 전체 PII(phone)는 본인(auth.me) 또는 운영진(admin.dashboard) 경로에서만 노출.
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

// 회원 디렉토리 (검색·필터). 파일럿 규모(≤300)에 맞춰 메모리 필터.
// phone 등 비공개 필드는 toPublicMember projection으로 제거해 반환.
export const list = query({
  args: {
    token: v.optional(v.string()),
    q: v.optional(v.string()),
    industry: v.optional(v.string()),
    region: v.optional(v.string()),
    helpOffer: v.optional(v.string()),
    cohort: v.optional(v.string()),
    university: v.optional(v.string()),
    includePending: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { token, q, industry, region, helpOffer, cohort, university, includePending },
  ) => {
    // pending(미승인) 회원 노출은 운영진 전용 — 비인증 우회 차단
    if (includePending) await requireAdmin(ctx, token)
    let members = await ctx.db.query('members').collect()
    if (!includePending) {
      members = members.filter((m) => m.status === 'active')
    }
    if (industry) {
      members = members.filter((m) => m.industry.includes(industry))
    }
    if (region) {
      members = members.filter((m) => m.region === region)
    }
    // 기수·학교는 정확 일치 필터 (저장 시 normalizeCohort로 정규화된 값 기준)
    if (cohort) {
      members = members.filter((m) => m.cohort === cohort)
    }
    if (university) {
      members = members.filter((m) => m.university === university)
    }
    if (helpOffer) {
      members = members.filter((m) => m.helpOffer.includes(helpOffer))
    }
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase()
      members = members.filter((m) =>
        [
          m.name,
          m.company ?? '',
          m.title ?? '',
          m.intro ?? '',
          m.cohort ?? '',
          ...m.industry,
          ...m.helpOffer,
          ...m.helpNeed,
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    }
    return members
      .sort(
        (a, b) =>
          b.contributionScore - a.contributionScore ||
          a.name.localeCompare(b.name, 'ko'),
      )
      .map(toPublicMember)
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

// 필터용 메타: 업종/지역/도움분야 distinct
export const facets = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query('members').collect()
    const industries = new Set<string>()
    const regions = new Set<string>()
    const cohorts = new Set<string>()
    const universities = new Set<string>()
    const helpCount = new Map<string, number>()
    for (const m of members) {
      if (m.status !== 'active') continue
      m.industry.forEach((i) => industries.add(i))
      if (m.region) regions.add(m.region)
      // 필터 칩은 정규화된 숫자 기수만 노출 (자유 표기 주입 방지)
      if (m.cohort && /^\d{1,3}$/.test(m.cohort)) cohorts.add(m.cohort)
      if (m.university) universities.add(m.university)
      m.helpOffer.forEach((h) => helpCount.set(h, (helpCount.get(h) ?? 0) + 1))
    }
    // 도움분야는 빈도 상위 12개만 칩으로 노출
    const helpOffers = [...helpCount.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
      .slice(0, 12)
      .map(([h]) => h)
    return {
      industries: [...industries].sort((a, b) => a.localeCompare(b, 'ko')),
      regions: [...regions].sort((a, b) => a.localeCompare(b, 'ko')),
      // 기수는 숫자 내림차순(최신 기수 우선), 비숫자 표기는 뒤로
      cohorts: [...cohorts].sort((a, b) => {
        const na = Number(a)
        const nb = Number(b)
        if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na
        if (Number.isFinite(na)) return -1
        if (Number.isFinite(nb)) return 1
        return a.localeCompare(b, 'ko')
      }),
      universities: [...universities].sort((a, b) => a.localeCompare(b, 'ko')),
      helpOffers,
      total: members.filter((m) => m.status === 'active').length,
    }
  },
})

// 입력 자동완성용 태그 풀 (업종/도움 분야). 빈도순으로 인기 캐논 태그를 노출해 파편화 완화.
export const tagPool = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query('members').collect()
    const industries = new Map<string, number>()
    const helps = new Map<string, number>()
    const bump = (mp: Map<string, number>, k: string) =>
      mp.set(k, (mp.get(k) ?? 0) + 1)
    for (const m of members) {
      if (m.status !== 'active') continue
      m.industry.forEach((i) => bump(industries, i))
      m.helpOffer.forEach((h) => bump(helps, h))
      m.helpNeed.forEach((h) => bump(helps, h))
    }
    const top = (mp: Map<string, number>) =>
      [...mp.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
        .slice(0, 40)
        .map(([t]) => t)
    return { industries: top(industries), helps: top(helps) }
  },
})

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
    const members = await ctx.db.query('members').collect()
    return members
      .filter((m) => m.status === 'active' && !excluded.has(m._id as string))
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
    const members = await ctx.db.query('members').collect()
    return members
      .filter((m) => m.status === 'active' && m._id !== me._id)
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

// 동기·동문 수 (본인 제외 active). 홈/프로필의 "내 동기 N명" 진입점용.
export const peerCounts = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return null
    const members = await ctx.db.query('members').collect()
    const peers = members.filter(
      (m) => m.status === 'active' && m._id !== me._id,
    )
    return {
      cohort: me.cohort,
      cohortCount: me.cohort
        ? peers.filter((m) => m.cohort === me.cohort).length
        : 0,
      university: me.university,
      universityCount: me.university
        ? peers.filter((m) => m.university === me.university).length
        : 0,
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
    return await ctx.db.insert('members', {
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
      status: 'active',
      contributionScore: 0,
      createdAt: Date.now(),
    })
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
    await ctx.db.patch(targetId, clean)
    return null
  },
})

// 운영진: pending 회원 승인
export const approve = mutation({
  args: { token: v.string(), memberId: v.id('members') },
  handler: async (ctx, { token, memberId }) => {
    await requireAdmin(ctx, token)
    await ctx.db.patch(memberId, { status: 'active' })
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
    await ctx.db.patch(memberId, { status })
    // suspended 전환 시 기존 세션은 memberFromToken에서 자동 무효화되어 별도 삭제 불필요
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
    await requireAdmin(ctx, token)
    const me = await memberFromToken(ctx, token)
    if (me && me._id === memberId && !isAdmin) {
      throw new Error('본인의 운영진 권한은 회수할 수 없습니다.')
    }
    await ctx.db.patch(memberId, { isAdmin })
    return null
  },
})
