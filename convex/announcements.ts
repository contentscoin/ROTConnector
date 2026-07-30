import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireMember } from './auth'

const categoryValidator = v.union(
  v.literal('notice'),
  v.literal('promotion'),
  v.literal('bizroom'),
)

// 상단 고정글 노출 상한 (운영진이 고정하는 공지 수는 소수)
const PINNED_LIMIT = 10

type Announcement = Doc<'announcements'>


// author 요약 첨부
async function withAuthor(ctx: QueryCtx, item: Announcement) {
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
}

/**
 * 공지/홍보/비즈룸 목록 — 커서 페이지네이션 (활성 글만, 최신순).
 *
 * 1000명 기준 설계: 예전에는 전체 게시글을 collect한 뒤 메모리에서 status/category를
 * 걸러 pinned 우선 정렬했다. 이제 status 선행 복합 인덱스로 페이지 단위로만 읽는다.
 * 상단 고정글은 단일 인덱스로 '고정 우선 + 최신순'을 동시에 만족시킬 수 없으므로
 * 별도 쿼리(pinned)로 분리하고, 이 목록에서는 고정글을 제외한다.
 */
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, { paginationOpts, category }) => {
    const result = category
      ? await ctx.db
          .query('announcements')
          .withIndex('by_status_category_created', (q) =>
            q.eq('status', 'active').eq('category', category),
          )
          .order('desc')
          .paginate(paginationOpts)
      : await ctx.db
          .query('announcements')
          .withIndex('by_status_created', (q) => q.eq('status', 'active'))
          .order('desc')
          .paginate(paginationOpts)
    const page = await Promise.all(
      result.page.filter((item) => !item.pinned).map((item) => withAuthor(ctx, item)),
    )
    return { ...result, page }
  },
})

// 상단 고정글 (활성). by_status_pinned_created 인덱스에서 최신순 소수만.
export const pinned = query({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }) => {
    const rows = await ctx.db
      .query('announcements')
      .withIndex('by_status_pinned_created', (q) =>
        q.eq('status', 'active').eq('pinned', true),
      )
      .order('desc')
      .take(PINNED_LIMIT)
    const filtered = category ? rows.filter((r) => r.category === category) : rows
    return await Promise.all(filtered.map((item) => withAuthor(ctx, item)))
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
