import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireMember } from './auth'

const categoryValidator = v.union(
  v.literal('notice'),
  v.literal('promotion'),
  v.literal('bizroom'),
)

// 공지/홍보/비즈룸 목록 (카테고리 필터, 최신순)
export const list = query({
  args: {
    category: v.optional(categoryValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { category, limit }) => {
    const take = Math.min(Math.max(limit ?? 30, 1), 100)
    let rows = await ctx.db
      .query('announcements')
      .withIndex('by_created')
      .order('desc')
      .collect()
    rows = rows.filter((r) => r.status === 'active')
    if (category) {
      rows = rows.filter((r) => r.category === category)
    }
    // pinned 상단 고정
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.createdAt - a.createdAt
    })
    const items = rows.slice(0, take)
    // author 요약 첨부
    return await Promise.all(
      items.map(async (item) => {
        const author = await ctx.db.get(item.authorId)
        return {
          _id: item._id,
          title: item.title,
          body: item.body,
          category: item.category,
          pinned: item.pinned,
          createdAt: item.createdAt,
          author: author
            ? { _id: author._id, name: author.name, company: author.company }
            : null,
        }
      }),
    )
  },
})

// 단건 조회
export const get = query({
  args: { id: v.id('announcements') },
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id)
    if (!item || item.status !== 'active') return null
    const author = await ctx.db.get(item.authorId)
    return {
      ...item,
      author: author
        ? { _id: author._id, name: author.name, company: author.company }
        : null,
    }
  },
})

// 작성: notice는 운영진만, promotion/bizroom은 로그인 회원 가능
export const create = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    body: v.string(),
    category: categoryValidator,
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, title, body, category, pinned }) => {
    const member = await requireMember(ctx, token)
    if (category === 'notice' && !member.isAdmin) {
      throw new Error('공지는 운영진만 작성할 수 있습니다.')
    }
    const trimTitle = title.trim()
    const trimBody = body.trim()
    if (!trimTitle || trimTitle.length > 200) {
      throw new Error('제목을 1~200자로 입력해주세요.')
    }
    if (!trimBody || trimBody.length > 5000) {
      throw new Error('내용을 1~5000자로 입력해주세요.')
    }
    // pinned는 운영진만 가능
    const isPinned = pinned && member.isAdmin ? true : false
    return await ctx.db.insert('announcements', {
      authorId: member._id,
      title: trimTitle,
      body: trimBody,
      category,
      pinned: isPinned,
      status: 'active',
      createdAt: Date.now(),
    })
  },
})

// 아카이브: 운영진 또는 작성자
export const archive = mutation({
  args: { token: v.string(), id: v.id('announcements') },
  handler: async (ctx, { token, id }) => {
    const member = await requireMember(ctx, token)
    const item = await ctx.db.get(id)
    if (!item) throw new Error('게시글을 찾을 수 없습니다.')
    if (item.authorId !== member._id && !member.isAdmin) {
      throw new Error('작성자 또는 운영진만 삭제할 수 있습니다.')
    }
    await ctx.db.patch(id, { status: 'archived' })
    return null
  },
})
