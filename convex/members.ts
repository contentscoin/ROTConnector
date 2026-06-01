import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireMember, requireAdmin } from './auth'

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

const linkValidator = v.object({ label: v.string(), url: v.string() })

// 회원 디렉토리 (검색·필터). 파일럿 규모(≤300)에 맞춰 메모리 필터.
export const list = query({
  args: {
    q: v.optional(v.string()),
    industry: v.optional(v.string()),
    region: v.optional(v.string()),
    includePending: v.optional(v.boolean()),
  },
  handler: async (ctx, { q, industry, region, includePending }) => {
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
    return members.sort(
      (a, b) =>
        b.contributionScore - a.contributionScore ||
        a.name.localeCompare(b.name, 'ko'),
    )
  },
})

export const get = query({
  args: { id: v.id('members') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

// 필터용 메타: 업종/지역 distinct
export const facets = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query('members').collect()
    const industries = new Set<string>()
    const regions = new Set<string>()
    for (const m of members) {
      m.industry.forEach((i) => industries.add(i))
      if (m.region) regions.add(m.region)
    }
    return {
      industries: [...industries].sort((a, b) => a.localeCompare(b, 'ko')),
      regions: [...regions].sort((a, b) => a.localeCompare(b, 'ko')),
      total: members.length,
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
