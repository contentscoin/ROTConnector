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
