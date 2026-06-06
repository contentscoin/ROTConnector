import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireMember, requireAdmin } from './auth'

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
    company: m.company,
    title: m.title,
    industry: m.industry,
    region: m.region,
    intro: m.intro,
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
  short: 100, // 이름/회사/직함/기수/지역
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
    includePending: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { token, q, industry, region, helpOffer, includePending },
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
    return m ? toPublicMember(m) : null
  },
})

// 필터용 메타: 업종/지역/도움분야 distinct
export const facets = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query('members').collect()
    const industries = new Set<string>()
    const regions = new Set<string>()
    const helpCount = new Map<string, number>()
    for (const m of members) {
      if (m.status !== 'active') continue
      m.industry.forEach((i) => industries.add(i))
      if (m.region) regions.add(m.region)
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
      helpOffers,
      total: members.filter((m) => m.status === 'active').length,
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
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    industry: v.optional(v.array(v.string())),
    region: v.optional(v.string()),
    intro: v.optional(v.string()),
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
    const existing = await ctx.db
      .query('members')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .unique()
    if (existing) throw new Error('이미 등록된 휴대폰 번호입니다.')
    return await ctx.db.insert('members', {
      name,
      phone,
      cohort: args.cohort,
      company: args.company,
      title: args.title,
      industry: args.industry ?? [],
      region: args.region,
      intro: args.intro,
      helpOffer: args.helpOffer ?? [],
      helpNeed: args.helpNeed ?? [],
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
      company: v.optional(v.string()),
      title: v.optional(v.string()),
      industry: v.optional(v.array(v.string())),
      region: v.optional(v.string()),
      intro: v.optional(v.string()),
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
    for (const key of ['company', 'title', 'cohort', 'region'] as const) {
      const val = patch[key]
      if (val !== undefined && val.length > MAX.short) {
        throw new Error('입력값이 너무 깁니다.')
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
