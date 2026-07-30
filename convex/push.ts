import { v } from 'convex/values'
import {
  mutation,
  internalMutation,
  internalQuery,
  internalAction,
} from './_generated/server'
import type { ActionCtx } from './_generated/server'
import { internal } from './_generated/api'
import { requireMember } from './auth'

// Convex 런타임이 노출하는 환경변수 접근 (@types/node 미설치라 모듈 스코프로 선언).
declare const process: { env: Record<string, string | undefined> }

// 디바이스 플랫폼
const platform = v.union(
  v.literal('web'),
  v.literal('ios'),
  v.literal('android'),
)

/* ─────────────── 클라이언트 토큰 등록/해제 ─────────────── */

// 현재 로그인 회원의 FCM 디바이스 토큰 등록(업서트). token=세션, fcmToken=기기 토큰.
export const register = mutation({
  args: { token: v.string(), fcmToken: v.string(), platform },
  handler: async (ctx, { token, fcmToken, platform }) => {
    const me = await requireMember(ctx, token)
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', fcmToken))
      .first()
    if (existing) {
      // 기기 토큰이 다른 회원/플랫폼에 묶여 있으면 현재 회원으로 재배정
      if (existing.memberId !== me._id || existing.platform !== platform) {
        await ctx.db.patch(existing._id, {
          memberId: me._id,
          platform,
          createdAt: Date.now(),
        })
      }
    } else {
      await ctx.db.insert('pushTokens', {
        memberId: me._id,
        token: fcmToken,
        platform,
        createdAt: Date.now(),
      })
    }
    return null
  },
})

// 디바이스 토큰 해제 (로그아웃/알림 끄기).
export const unregister = mutation({
  args: { token: v.string(), fcmToken: v.string() },
  handler: async (ctx, { token, fcmToken }) => {
    await requireMember(ctx, token)
    const rows = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', fcmToken))
      .collect()
    for (const r of rows) await ctx.db.delete(r._id)
    return null
  },
})

/* ─────────────── 내부 발송 경로 ─────────────── */

// 수신자의 모든 디바이스 토큰 (internalAction에서 조회).
export const tokensForUser = internalQuery({
  args: { userId: v.id('members') },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('pushTokens')
      .withIndex('by_member', (q) => q.eq('memberId', userId))
      .collect()
    return rows.map((r) => r.token)
  },
})

// 여러 수신자의 디바이스 토큰을 한 번에 (배치 발송용 — 회원당 쿼리 왕복 방지).
export const tokensForUsers = internalQuery({
  args: { userIds: v.array(v.id('members')) },
  handler: async (ctx, { userIds }) => {
    const perUser = await Promise.all(
      userIds.map((userId) =>
        ctx.db
          .query('pushTokens')
          .withIndex('by_member', (q) => q.eq('memberId', userId))
          .collect(),
      ),
    )
    // 같은 기기가 중복 등록된 경우를 대비해 토큰 단위로 중복 제거
    return [...new Set(perUser.flat().map((r) => r.token))]
  },
})

// 무효/만료(UNREGISTERED) 토큰 정리.
export const removeToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const rows = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .collect()
    for (const r of rows) await ctx.db.delete(r._id)
    return null
  },
})

type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri: string
  project_id: string
}

// FCM_SERVICE_ACCOUNT 환경변수(서비스 계정 JSON)를 파싱. 미설정/오류 시 null → 발송 no-op.
function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT
  if (!raw) return null
  try {
    const sa = JSON.parse(raw)
    if (!sa.client_email || !sa.private_key || !sa.project_id) return null
    return {
      client_email: sa.client_email,
      private_key: sa.private_key,
      token_uri: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
      project_id: sa.project_id,
    }
  } catch {
    return null
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function strToBase64Url(str: string): string {
  return bytesToBase64Url(new TextEncoder().encode(str))
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'pkcs8',
    der.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

// 서비스 계정 JWT로 OAuth2 액세스 토큰 발급 (FCM HTTP v1 인증).
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = strToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = strToBase64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  )
  const unsigned = `${header}.${claims}`
  const key = await importPrivateKey(sa.private_key)
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${bytesToBase64Url(new Uint8Array(sig))}`
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`FCM OAuth 토큰 발급 실패: ${res.status}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('FCM OAuth 응답에 access_token 없음')
  return json.access_token
}

// 액세스 토큰 1개로 여러 기기 토큰에 동일 알림을 발송하는 공통 루프.
// FCM HTTP v1은 멀티캐스트를 지원하지 않아 토큰별 요청이 필요하지만,
// OAuth 토큰 발급(JWT 서명 + 토큰 엔드포인트 왕복)은 배치당 1회로 끝난다.
async function fanoutTokens(
  ctx: ActionCtx,
  sa: ServiceAccount,
  accessToken: string,
  tokens: string[],
  payload: { title: string; body?: string; link?: string },
): Promise<void> {
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  const { title, body, link } = payload
  for (const token of tokens) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, ...(body ? { body } : {}) },
            ...(link
              ? { webpush: { fcmOptions: { link } }, data: { link } }
              : {}),
          },
        }),
      })
      // 무효/만료 토큰은 정리 (UNREGISTERED=404, 잘못된 토큰=400)
      if (res.status === 404 || res.status === 400) {
        await ctx.runMutation(internal.push.removeToken, { token })
      }
    } catch (e) {
      console.error('[push] 발송 실패', e)
    }
  }
}

// 한 회원의 모든 기기에 푸시 발송. createNotification이 스케줄러로 호출.
// FCM 미설정(env 없음) 시 즉시 no-op — 인앱 알림은 영향 없음.
export const sendToUser = internalAction({
  args: {
    userId: v.id('members'),
    title: v.string(),
    body: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  handler: async (ctx, { userId, title, body, link }) => {
    const sa = readServiceAccount()
    if (!sa) return
    const tokens = await ctx.runQuery(internal.push.tokensForUser, { userId })
    if (tokens.length === 0) return
    let accessToken: string
    try {
      accessToken = await getAccessToken(sa)
    } catch (e) {
      console.error('[push] OAuth 실패', e)
      return
    }
    await fanoutTokens(ctx, sa, accessToken, tokens, { title, body, link })
  },
})

/**
 * 다수 수신자에게 동일 알림을 배치 발송 (행사 등록 팬아웃 등).
 *
 * 1000명 기준 설계: 이전에는 createNotification이 수신자마다 sendToUser 액션을
 * 예약해 회원 수만큼(=1000개) 액션이 뜨고 각각 OAuth 토큰을 새로 발급했다.
 * 이제 팬아웃 페이지(100명) 단위로 이 액션 1개만 예약되고, 토큰 발급도 1회다.
 */
export const sendBatch = internalAction({
  args: {
    userIds: v.array(v.id('members')),
    title: v.string(),
    body: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  handler: async (ctx, { userIds, title, body, link }) => {
    const sa = readServiceAccount()
    if (!sa || userIds.length === 0) return
    const tokens = await ctx.runQuery(internal.push.tokensForUsers, { userIds })
    if (tokens.length === 0) return
    let accessToken: string
    try {
      accessToken = await getAccessToken(sa)
    } catch (e) {
      console.error('[push] OAuth 실패', e)
      return
    }
    await fanoutTokens(ctx, sa, accessToken, tokens, { title, body, link })
  },
})
