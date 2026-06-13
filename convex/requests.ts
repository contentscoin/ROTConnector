import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requestStatus } from './schema'
import { memberFromToken, requireMember } from './auth'
import { normalizeTags } from './util'

// 작성자 요약을 붙여서 반환
async function withAuthor(ctx: QueryCtx, req: Doc<'requests'>) {
  const author = await ctx.db.get(req.authorId)
  return {
    ...req,
    author: author
      ? {
          _id: author._id,
          name: author.name,
          company: author.company,
          cohort: author.cohort,
        }
      : null,
  }
}

export const list = query({
  args: {
    status: v.optional(requestStatus),
    category: v.optional(v.string()),
    q: v.optional(v.string()),
  },
  handler: async (ctx, { status, category, q }) => {
    let requests: Doc<'requests'>[]
    if (status) {
      requests = await ctx.db
        .query('requests')
        .withIndex('by_status', (q) => q.eq('status', status))
        .order('desc')
        .collect()
    } else {
      requests = await ctx.db.query('requests').order('desc').collect()
    }
    if (category) {
      requests = requests.filter((r) => r.category === category)
    }
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase()
      requests = requests.filter((r) =>
        [r.title, r.body, r.category, ...r.tags]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    }
    const withAuthors = await Promise.all(
      requests.map(async (r) => ({ r, author: await ctx.db.get(r.authorId) })),
    )
    // 공개 피드에는 활성 회원의 요청만 노출 (정지·미승인 작성자 글은 디렉토리와 동일하게 제외)
    return withAuthors
      .filter(({ author }) => author?.status === 'active')
      .map(({ r, author }) => ({
        ...r,
        author: author
          ? {
              _id: author._id,
              name: author.name,
              company: author.company,
              cohort: author.cohort,
            }
          : null,
      }))
  },
})

export const get = query({
  args: { id: v.id('requests') },
  handler: async (ctx, { id }) => {
    const req = await ctx.db.get(id)
    if (!req) return null
    return await withAuthor(ctx, req)
  },
})

// 내가 올린 요청
export const mine = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return []
    return await ctx.db
      .query('requests')
      .withIndex('by_author', (q) => q.eq('authorId', me._id))
      .order('desc')
      .collect()
  },
})

// 특정 회원이 올린 요청 (공개)
export const byAuthor = query({
  args: { memberId: v.id('members') },
  handler: async (ctx, { memberId }) => {
    return await ctx.db
      .query('requests')
      .withIndex('by_author', (q) => q.eq('authorId', memberId))
      .order('desc')
      .collect()
  },
})

export const create = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    body: v.string(),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
    region: v.optional(v.string()),
    urgency: v.optional(
      v.union(v.literal('low'), v.literal('normal'), v.literal('high')),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx, args.token)
    const title = args.title.trim()
    const body = args.body.trim()
    if (title.length < 2) throw new Error('제목을 입력해주세요.')
    if (body.length < 5) throw new Error('상세 내용을 5자 이상 입력해주세요.')
    return await ctx.db.insert('requests', {
      authorId: me._id,
      title,
      body,
      category: args.category,
      tags: normalizeTags(args.tags ?? []),
      region: args.region,
      urgency: args.urgency ?? 'normal',
      status: 'open',
      createdAt: Date.now(),
    })
  },
})

// 요청 태그 자동완성 풀 (빈도 상위)
export const tagSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const requests = await ctx.db.query('requests').collect()
    const count = new Map<string, number>()
    for (const r of requests) {
      for (const t of r.tags) count.set(t, (count.get(t) ?? 0) + 1)
    }
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
      .slice(0, 15)
      .map(([t]) => t)
  },
})

// 상태 변경 (작성자 또는 운영진)
export const setStatus = mutation({
  args: {
    token: v.string(),
    requestId: v.id('requests'),
    status: requestStatus,
  },
  handler: async (ctx, { token, requestId, status }) => {
    const me = await requireMember(ctx, token)
    const req = await ctx.db.get(requestId)
    if (!req) throw new Error('요청을 찾을 수 없습니다.')
    if (req.authorId !== me._id && !me.isAdmin) {
      throw new Error('작성자 또는 운영진만 상태를 변경할 수 있습니다.')
    }
    // 작성자(비운영진)는 open↔closed 토글만. 운영진이 설정한 매칭중/연결완료를
    // 임의로 되돌리거나 매칭 단계로 점프할 수 없다.
    if (!me.isAdmin) {
      const allowed = req.status === 'open' || req.status === 'closed'
      const target = status === 'open' || status === 'closed'
      if (!allowed || !target) {
        throw new Error("'매칭중'·'연결완료'는 운영진만 변경할 수 있습니다.")
      }
    }
    if (status === req.status) return null
    await ctx.db.patch(requestId, { status })
    return null
  },
})
