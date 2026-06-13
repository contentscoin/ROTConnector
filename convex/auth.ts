import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

/**
 * 파일럿 등급 인증.
 * 운영진이 등록한 회원 phone으로 본인 프로필을 claim → 세션 토큰 발급.
 * 이 파일 하나로 인증을 격리한다. Phase 2: Convex Auth(Password/OTP)/카카오 OAuth로 교체.
 */

// 세션 수명 (30일). 만료된 토큰은 무효 처리.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
// 로그인 레이트리밋: 10분 윈도우당 최대 8회.
const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 8

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

// 토큰으로 회원 조회 (없거나 만료면 null)
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
  // 만료 검사 (QueryCtx라 삭제는 불가 — null 반환으로 무효화)
  if (Date.now() - session.createdAt > SESSION_TTL_MS) return null
  const member = await ctx.db.get(session.memberId)
  // 정지(suspended) 계정은 인증 자체를 무효화 — 모든 보호 경로(requireMember/
  // requireAdmin/me)에서 로그아웃 상태로 취급되어 쓰기·교류·조회가 차단된다.
  if (member?.status === 'suspended') return null
  return member
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

// 슬라이딩 윈도우 레이트리밋. 한도 초과 시 throw.
// 키별 공용 헬퍼 — login:<phone> 외에 connect:<memberId>(교류 신청 스팸 방지)에서도 재사용.
export async function enforceRateLimit(
  ctx: MutationCtx,
  key: string,
  message = '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
): Promise<void> {
  const now = Date.now()
  const existing = await ctx.db
    .query('rateLimits')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique()
  if (!existing || now - existing.windowStart > LOGIN_WINDOW_MS) {
    if (existing) {
      await ctx.db.patch(existing._id, { count: 1, windowStart: now })
    } else {
      await ctx.db.insert('rateLimits', { key, count: 1, windowStart: now })
    }
    return
  }
  if (existing.count >= LOGIN_MAX_ATTEMPTS) {
    throw new Error(message)
  }
  await ctx.db.patch(existing._id, { count: existing.count + 1 })
}

// phone으로 본인 프로필 claim → 세션 토큰
export const login = mutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const normalized = normalizePhone(phone)
    if (normalized.length < 9) {
      throw new Error('올바른 휴대폰 번호를 입력해주세요.')
    }
    // phone당 브루트포스 완화 (공개 디렉토리에서 phone projection이 제거됐어도 방어심층)
    await enforceRateLimit(
      ctx,
      `login:${normalized}`,
      '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    )
    const member = await ctx.db
      .query('members')
      .withIndex('by_phone', (q) => q.eq('phone', normalized))
      .unique()
    if (!member) {
      throw new Error(
        '등록된 회원이 아닙니다. 알비연 운영진에게 가입을 요청해주세요.',
      )
    }
    // 정지된 계정은 토큰 재발급 차단
    if (member.status === 'suspended') {
      throw new Error('정지된 계정입니다. 운영진에게 문의해주세요.')
    }
    const token = await createSession(ctx, member._id)
    // isAdmin은 응답에 싣지 않는다(열거 시 관리자 여부 노출 방지). 클라이언트는 auth.me로 조회.
    return { token }
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
