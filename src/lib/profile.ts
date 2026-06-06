// 프로필 완성률 계산 (순수 util). 세션 회원(Doc) / 공개 projection 모두 호환.

type ProfileLike = {
  intro?: string
  company?: string
  title?: string
  region?: string
  industry: string[]
  helpOffer: string[]
  helpNeed: string[]
}

export type CompletenessField = { key: string; label: string; done: boolean }

const FIELDS: { key: string; label: string; check: (m: ProfileLike) => boolean }[] =
  [
    { key: 'intro', label: '사업 소개', check: (m) => !!m.intro?.trim() },
    { key: 'company', label: '회사', check: (m) => !!m.company?.trim() },
    { key: 'title', label: '직함', check: (m) => !!m.title?.trim() },
    { key: 'region', label: '지역', check: (m) => !!m.region?.trim() },
    { key: 'industry', label: '업종', check: (m) => m.industry.length > 0 },
    {
      key: 'helpOffer',
      label: '줄 수 있는 도움',
      check: (m) => m.helpOffer.length > 0,
    },
    {
      key: 'helpNeed',
      label: '필요한 도움',
      check: (m) => m.helpNeed.length > 0,
    },
  ]

export function profileCompleteness(m: ProfileLike): {
  percent: number
  fields: CompletenessField[]
  missing: CompletenessField[]
} {
  const fields = FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    done: f.check(m),
  }))
  const done = fields.filter((f) => f.done).length
  const percent = Math.round((done / fields.length) * 100)
  return { percent, fields, missing: fields.filter((f) => !f.done) }
}
