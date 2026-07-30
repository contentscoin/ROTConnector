import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { memberFromToken, requireMember } from './auth'
import { bumpUnread } from './rollup'

// '모두 읽음' 1회 처리 상한. 남으면 클라이언트가 다시 눌러 이어서 처리한다
// (한 뮤테이션의 쓰기 수를 고정하기 위한 상한).
const MARK_ALL_LIMIT = 500

/**
 * 내 알림 목록 — 커서 페이지네이션 (by_user 인덱스 최신순).
 * 비로그인 시 빈 페이지. 알림은 회원 활동에 따라 무한히 누적되므로
 * 고정 take(50)이 아니라 loadMore로 이어 받는다.
 */
export const list = query({
  args: {
    token: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { token, paginationOpts }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) {
      return { page: [], isDone: true, continueCursor: '' }
    }
    const result = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .order('desc')
      .paginate(paginationOpts)
    return {
      ...result,
      page: result.page.map((n) => ({
        _id: n._id,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
        read: n.read,
        createdAt: n.createdAt,
      })),
    }
  },
})

/**
 * 안 읽은 알림 수 (헤더 벨 뱃지). 비로그인 0.
 * members.unreadNotifications 카운터 단건 조회 — 알림 누적량과 무관하게 O(1).
 * 백필 전(undefined) 회원은 by_user_read 인덱스로 즉시 계산한다.
 */
export const unreadCount = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return 0
    if (me.unreadNotifications !== undefined) return me.unreadNotifications
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) => q.eq('userId', me._id).eq('read', false))
      .take(MARK_ALL_LIMIT)
    return rows.length
  },
})

// 알림 1건 읽음 처리 (본인 알림만).
export const markRead = mutation({
  args: { token: v.string(), notificationId: v.id('notifications') },
  handler: async (ctx, { token, notificationId }) => {
    const me = await requireMember(ctx, token)
    const n = await ctx.db.get(notificationId)
    if (!n || n.userId !== me._id) throw new Error('알림을 찾을 수 없습니다.')
    if (!n.read) {
      await ctx.db.patch(notificationId, { read: true })
      await bumpUnread(ctx, me._id, -1)
    }
    return null
  },
})

// 내 알림 전체 읽음 처리. by_user_read 인덱스로 안 읽은 것만 골라 읽는다.
// 반환값 remaining>0이면 상한에 걸려 남은 알림이 있다는 뜻.
export const markAllRead = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await requireMember(ctx, token)
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) => q.eq('userId', me._id).eq('read', false))
      .take(MARK_ALL_LIMIT)
    for (const n of rows) await ctx.db.patch(n._id, { read: true })
    await bumpUnread(ctx, me._id, -rows.length)
    return { marked: rows.length, remaining: rows.length === MARK_ALL_LIMIT }
  },
})
