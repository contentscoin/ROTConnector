import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requestStatus } from './schema'
import { memberFromToken, requireMember } from './auth'

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
  },
  handler: async (ctx, { status, category }) => {
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
    return Promise.all(requests.map((r) => withAuthor(ctx, r)))
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
      tags: args.tags ?? [],
      region: args.region,
      urgency: args.urgency ?? 'normal',
      status: 'open',
      createdAt: Date.now(),
    })
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
    // 게이밍 방지: '매칭중'·'연결완료'는 운영진만. 작성자는 '접수'/'종료'만.
    if (!me.isAdmin && (status === 'matching' || status === 'connected')) {
      throw new Error("'매칭중'·'연결완료'는 운영진만 변경할 수 있습니다.")
    }
    await ctx.db.patch(requestId, { status })
    return null
  },
})
