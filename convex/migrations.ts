import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { normalizeCohort } from './util'

// 일회성 백필: 기존 회원의 cohort 표기("학군 35기" 등)를 숫자 문자열로 정규화.
// 실행: npx convex run migrations:normalizeCohorts
export const normalizeCohorts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query('members').collect()
    let updated = 0
    for (const m of members) {
      const normalized = normalizeCohort(m.cohort)
      if (normalized !== m.cohort) {
        await ctx.db.patch(m._id, { cohort: normalized })
        updated++
      }
    }
    return { total: members.length, updated }
  },
})

// 프로덕션 최초 운영진 부트스트랩. members.setAdmin은 기존 운영진(requireAdmin)을
// 요구하므로 시드를 돌리지 않은 prod에서는 첫 운영진을 만들 수 없는 닭-달걀 문제가 있다.
// 대상자가 먼저 phone으로 계정을 클레임한 뒤 운영자가 1회 실행:
//   npx convex run migrations:promoteAdmin '{"phone":"01012345678"}'
// internalMutation이라 클라이언트에서 호출 불가. 대상 회원을 active 운영진으로 승격.
export const promoteAdmin = internalMutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const member = await ctx.db
      .query('members')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first()
    if (!member) {
      throw new Error(
        `해당 전화번호로 클레임된 회원이 없습니다: ${phone}. 먼저 계정을 클레임하세요.`,
      )
    }
    const already = member.isAdmin && member.status === 'active'
    if (!already) {
      await ctx.db.patch(member._id, { isAdmin: true, status: 'active' })
    }
    return {
      ok: true,
      alreadyAdmin: already,
      memberId: member._id,
      name: member.name,
    }
  },
})

// 빈 DB 최초 운영진 부트스트랩 — promoteAdmin은 기존 회원을 요구하므로
// (회원 등록은 운영진만 가능해 빈 prod에선 클레임할 계정 자체가 없음)
// phone으로 upsert: 없으면 active 운영진으로 생성, 있으면 승격.
//   npx convex run migrations:bootstrapAdmin '{"name":"홍길동","phone":"01012345678"}' --prod
export const bootstrapAdmin = internalMutation({
  args: { name: v.string(), phone: v.string() },
  handler: async (ctx, { name, phone }) => {
    const cleanName = name.trim()
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (cleanName.length < 2) throw new Error('이름을 입력하세요.')
    if (!/^01\d{8,9}$/.test(cleanPhone)) {
      throw new Error('휴대폰 번호 형식이 올바르지 않습니다 (숫자만, 01로 시작).')
    }
    const existing = await ctx.db
      .query('members')
      .withIndex('by_phone', (q) => q.eq('phone', cleanPhone))
      .first()
    if (existing) {
      const already = existing.isAdmin && existing.status === 'active'
      if (!already) {
        await ctx.db.patch(existing._id, { isAdmin: true, status: 'active' })
      }
      return { ok: true, created: false, memberId: existing._id, name: existing.name }
    }
    const memberId = await ctx.db.insert('members', {
      name: cleanName,
      phone: cleanPhone,
      industry: [],
      helpOffer: [],
      helpNeed: [],
      links: [],
      isAdmin: true,
      status: 'active',
      contributionScore: 0,
      createdAt: Date.now(),
    })
    return { ok: true, created: true, memberId, name: cleanName }
  },
})

// 데모/시드 데이터 전체 삭제 — 실서비스 오픈 전 prod 초기화용.
// 오실행 방지를 위해 confirm: "WIPE" 필수. 모든 앱 테이블의 전 행을 삭제한다.
//   npx convex run migrations:wipeDemoData '{"confirm":"WIPE"}' --prod
export const wipeDemoData = internalMutation({
  args: { confirm: v.literal('WIPE') },
  handler: async (ctx) => {
    const tables = [
      'members',
      'requests',
      'matches',
      'connections',
      'contributions',
      'events',
      'eventRsvps',
      'notifications',
      'auditLogs',
      'sessions',
      'rateLimits',
      'pushTokens',
    ] as const
    const deleted: Record<string, number> = {}
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect()
      for (const row of rows) await ctx.db.delete(row._id)
      deleted[table] = rows.length
    }
    return { ok: true, deleted }
  },
})
