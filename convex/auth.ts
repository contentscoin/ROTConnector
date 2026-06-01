import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

/**
 * 파일럿 등급 인증.
 * 운영진이 등록한 회원 phone으로 본인 프로필을 claim → 세션 토큰 발급.
 * 이 파일 하나로 인증을 격리한다. Phase 2: Convex Auth(Password/OTP)/카카오 OAuth로 교체.
 */

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

// 토큰으로 회원 조회 (없으면 null)
export async function memberFromToken(
  ctx: QueryCtx,
  token: string | undefined | null,
): Promise<Doc<'members'> | null> {
  if (!token) return null
  const session = await ctx.db
    .query('sessions')
    .withIndex('by_token', (q) => q.eq('token', token))
    .unique()
  if (!session) return null
  return await ctx.db.get(session.memberId)
}

// 로그인 필수 (mutation/query 공용). 실패 시 throw.
export async function requireMember(
  ctx: QueryCtx,
  token: string | undefined | null,
): Promise<Doc<'members'>> {
  const member = await memberFromToken(ctx, token)
  if (!member) throw new Error('로그인이 필요합니다.')
  return member
}

// 운영진 권한 필수
export async function requireAdmin(
  ctx: QueryCtx,
  token: string | undefined | null,
): Promise<Doc<'members'>> {
  const member = await requireMember(ctx, token)
  if (!member.isAdmin) throw new Error('운영진 권한이 필요합니다.')
  return member
}

async function createSession(
  ctx: MutationCtx,
  memberId: Id<'members'>,
): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID()
  await ctx.db.insert('sessions', {
    token,
    memberId,
    createdAt: Date.now(),
  })
  return token
}

// phone으로 본인 프로필 claim → 세션 토큰
export const login = mutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const normalized = normalizePhone(phone)
    if (normalized.length < 9) {
      throw new Error('올바른 휴대폰 번호를 입력해주세요.')
    }
    const member = await ctx.db
      .query('members')
      .withIndex('by_phone', (q) => q.eq('phone', normalized))
      .unique()
    if (!member) {
      throw new Error(
        '등록된 회원이 아닙니다. 알비연 운영진에게 가입을 요청해주세요.',
      )
    }
    const token = await createSession(ctx, member._id)
    return { token, memberId: member._id, isAdmin: member.isAdmin }
  },
})

// 현재 로그인 회원
export const me = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    return await memberFromToken(ctx, token)
  },
})

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique()
    if (session) await ctx.db.delete(session._id)
    return null
  },
})
