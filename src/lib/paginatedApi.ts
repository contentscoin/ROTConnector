import type { PaginatedQueryReference } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * 서버 list 쿼리는 구 번들(useQuery, 배열 응답) 호환을 위해
 * `paginationOpts`를 optional로 둔다. usePaginatedQuery 타입은 필수라서
 * 신 클라이언트 전용으로 단언한다 — 런타임에는 항상 paginationOpts를 넘긴다.
 */
export const paginatedApi = {
  requestsList: api.requests.list as unknown as PaginatedQueryReference,
  eventsList: api.events.list as unknown as PaginatedQueryReference,
  membersList: api.members.list as unknown as PaginatedQueryReference,
  announcementsList: api.announcements.list as unknown as PaginatedQueryReference,
}
