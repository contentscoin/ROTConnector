import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { memberFromToken, requireMember } from './auth'

const LIST_LIMIT = 50

// 내 알림 목록 (최신순 상위 50). 비로그인 시 빈 목록.
export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return []
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .order('desc')
      .take(LIST_LIMIT)
    return rows.map((n) => ({
      _id: n._id,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      read: n.read,
      createdAt: n.createdAt,
    }))
  },
})

// 안 읽은 알림 수 (헤더 벨 뱃지). 비로그인 0.
export const unreadCount = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return 0
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .collect()
    return rows.reduce((sum, n) => sum + (n.read ? 0 : 1), 0)
  },
})

// 알림 1건 읽음 처리 (본인 알림만).
export const markRead = mutation({
  args: { token: v.string(), notificationId: v.id('notifications') },
  handler: async (ctx, { token, notificationId }) => {
    const me = await requireMember(ctx, token)
    const n = await ctx.db.get(notificationId)
    if (!n || n.userId !== me._id) throw new Error('알림을 찾을 수 없습니다.')
    if (!n.read) await ctx.db.patch(notificationId, { read: true })
    return null
  },
})

// 내 알림 전체 읽음 처리.
export const markAllRead = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await requireMember(ctx, token)
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .collect()
    for (const n of rows) {
      if (!n.read) await ctx.db.patch(n._id, { read: true })
    }
    return null
  },
})
