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
