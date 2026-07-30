// 공용 헬퍼 (Convex 함수가 아닌 순수 유틸)

// 태그 정규화: trim·빈값 제거·대소문자 무시 중복 제거(첫 표기 유지).
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = raw.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

// 기수 정규화: "37기"/"37 기"/"제37기"/"학군 37기"/"37" → "37" (숫자만 저장, 표시는 formatCohort).
// 패턴 외 입력은 trim 원본 유지, 빈 문자열은 undefined.
export function normalizeCohort(s?: string): string | undefined {
  if (s === undefined) return undefined
  const t = s.trim()
  if (!t) return undefined
  const m = t.match(/^(?:학군\s*|제\s*)?(\d{1,3})\s*기?$/)
  return m ? m[1] : t
}

/**
 * 회원 전문 검색용 결합 텍스트.
 * Convex searchIndex는 단일 문자열 필드만 대상으로 하므로, 기존에 메모리에서
 * 훑던 필드(이름·회사·직함·소개·기수·학교·지역 + 배열 태그)를 하나로 합쳐 저장한다.
 * phone은 절대 포함하지 않는다 — 검색어로 전화번호를 넣어 회원을 특정하는
 * 역질의(공개 디렉토리 PII 유출)를 막기 위함.
 */
export function buildMemberSearchText(m: {
  name: string
  company?: string
  title?: string
  intro?: string
  products?: string
  customers?: string
  cohort?: string
  university?: string
  region?: string
  industry: string[]
  helpOffer: string[]
  helpNeed: string[]
}): string {
  return [
    m.name,
    m.company ?? '',
    m.title ?? '',
    m.intro ?? '',
    m.products ?? '',
    m.customers ?? '',
    m.cohort ?? '',
    m.university ?? '',
    m.region ?? '',
    ...m.industry,
    ...m.helpOffer,
    ...m.helpNeed,
  ]
    .join(' ')
    .trim()
}

// 요청 전문 검색용 결합 텍스트 (제목·본문·분류·태그).
export function buildRequestSearchText(r: {
  title: string
  body: string
  category: string
  tags: string[]
}): string {
  return [r.title, r.body, r.category, ...r.tags].join(' ').trim()
}

// 프로필 완성률 0~100. src/lib/profile.ts와 동일한 9개 필드 기준 —
// 평균 완성률/미작성 회원 추출을 인덱스로 처리하기 위해 members.profileScore에 캐시한다.
export function memberProfileScore(m: {
  intro?: string
  company?: string
  title?: string
  region?: string
  cohort?: string
  university?: string
  industry: string[]
  helpOffer: string[]
  helpNeed: string[]
}): number {
  const checks = [
    !!m.intro?.trim(),
    !!m.company?.trim(),
    !!m.title?.trim(),
    !!m.region?.trim(),
    m.industry.length > 0,
    m.helpOffer.length > 0,
    m.helpNeed.length > 0,
    !!m.cohort?.trim(),
    !!m.university?.trim(),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// 느슨한 토큰 매칭: 동일하거나 한쪽이 다른 쪽을 포함하면 일치(예: '투자' ⊂ '투자 유치').
// 1자 토큰은 부분문자열 오탐('법'⊂'방법')이 심해 정확일치만 인정.
export function termsOverlap(a: string[], b: string[]): number {
  const bb = b.map((s) => s.toLowerCase().trim()).filter(Boolean)
  let n = 0
  for (const raw of a) {
    const t = raw.toLowerCase().trim()
    if (!t) continue
    if (
      bb.some(
        (x) =>
          x === t ||
          (t.length >= 2 && x.includes(t)) ||
          (x.length >= 2 && t.includes(x)),
      )
    )
      n++
  }
  return n
}
