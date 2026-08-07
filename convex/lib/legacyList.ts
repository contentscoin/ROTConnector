import type { PaginationOptions } from 'convex/server'

/**
 * 구 프론트(useQuery + 배열 응답)와 신 프론트(usePaginatedQuery) 동시 호환.
 *
 * 페이지네이션 리팩터(0fb1f75) 이후 Convex만 먼저 배포되고 Vercel 프로덕션
 * 번들이  lagged 하면 `requests:list` 등이 paginationOpts 없이 호출되어
 * Server Error → ErrorBoundary로 전 화면이 죽는다. paginationOpts 가 없으면
 * 레거시 모드로 보고 상한만큼 take 한 배열을 반환한다.
 */
export const LEGACY_LIST_LIMIT = 100

export function isLegacyList(
  paginationOpts: PaginationOptions | undefined,
): paginationOpts is undefined {
  return paginationOpts === undefined
}

export function legacyTake(limit?: number): number {
  const n = limit ?? LEGACY_LIST_LIMIT
  return Math.min(Math.max(n, 1), LEGACY_LIST_LIMIT)
}
