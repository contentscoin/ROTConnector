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
