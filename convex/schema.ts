import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// 도움요청/매칭/기여 상태 리터럴
export const requestStatus = v.union(
  v.literal('open'), // 접수
  v.literal('matching'), // 매칭중
  v.literal('connected'), // 연결완료
  v.literal('closed'), // 종료
)

export const matchStatus = v.union(
  v.literal('proposed'), // 제안
  v.literal('accepted'), // 수락
  v.literal('connected'), // 연결됨
  v.literal('done'), // 완료
)

// 회원 간 1:1 교류 신청 상태
export const connectionStatus = v.union(
  v.literal('pending'), // 대기
  v.literal('accepted'), // 수락
  v.literal('declined'), // 거절
)

export const contributionType = v.union(
  v.literal('intro'), // 소개 기여
  v.literal('consult'), // 상담 기여
  v.literal('sponsor'), // 후원 기여
  v.literal('event'), // 행사 운영 기여
  v.literal('onboarding'), // 신규회원 온보딩 기여
)

export const memberStatus = v.union(
  v.literal('active'),
  v.literal('pending'),
  v.literal('suspended'),
)

// facetCounts.field — 롤업으로 유지하는 집계 축.
// 회원 프로필 축(업종/도움/지역/기수/학교)과 요청 축(태그/분류)을 한 테이블에 담는다.
export const facetField = v.union(
  v.literal('industry'),
  v.literal('helpOffer'),
  v.literal('helpNeed'),
  v.literal('region'),
  v.literal('cohort'),
  v.literal('university'),
  v.literal('requestTag'),
  v.literal('requestCategory'),
)

export default defineSchema({
  members: defineTable({
    name: v.string(),
    cohort: v.optional(v.string()), // 기수 (normalizeCohort로 숫자만 저장: "37기"→"37")
    university: v.optional(v.string()), // 출신 학교(학군단)
    phone: v.string(), // 클레임/연락 식별자
    company: v.optional(v.string()),
    title: v.optional(v.string()), // 직함
    industry: v.array(v.string()), // 업종 태그
    region: v.optional(v.string()),
    intro: v.optional(v.string()), // 사업 소개
    products: v.optional(v.string()), // 주요 제품/서비스 한 줄
    customers: v.optional(v.string()), // 주요 고객/거래 대상 한 줄
    helpOffer: v.array(v.string()), // 줄 수 있는 도움
    helpNeed: v.array(v.string()), // 필요한 도움
    links: v.array(v.object({ label: v.string(), url: v.string() })),
    isAdmin: v.boolean(),
    status: memberStatus,
    contributionScore: v.number(),
    createdAt: v.number(),
    // ── 아래는 1000명 기준 확장을 위한 비정규화(denormalized) 필드 ──
    // 전문 검색용 결합 텍스트 (buildMemberSearchText). phone은 절대 포함하지 않는다
    // — 검색어로 전화번호를 넣어 회원을 특정하는 역질의를 막기 위함.
    // 기존 행 호환을 위해 optional. 백필: migrations:backfillMemberSearch
    searchText: v.optional(v.string()),
    // 프로필 완성률 0~100 (src/lib/profile.ts와 동일한 9개 필드 기준).
    // 평균 완성률·미작성 회원 추출을 풀스캔 없이 인덱스로 처리하기 위한 캐시.
    profileScore: v.optional(v.number()),
    // 수락된 교류 수 (topConnectors·myStats용). connections 쓰기 시 증감.
    acceptedConnections: v.optional(v.number()),
    // 안 읽은 알림 수 (헤더 뱃지). notifications 쓰기 시 증감.
    unreadNotifications: v.optional(v.number()),
  })
    .index('by_phone', ['phone'])
    .index('by_status', ['status'])
    // 디렉토리는 항상 status='active' 위에서 걸리므로 status 선행 복합 인덱스.
    // 정렬 키(contributionScore)를 인덱스 마지막에 붙여 커서 페이지네이션에서도
    // '기여 점수 desc' 순서를 서버가 보장한다 (메모리 정렬 불필요).
    .index('by_status_score', ['status', 'contributionScore'])
    .index('by_status_region', ['status', 'region', 'contributionScore'])
    .index('by_status_cohort', ['status', 'cohort', 'contributionScore'])
    .index('by_status_university', ['status', 'university', 'contributionScore'])
    // 교류 활동 상위 회원 (admin.analytics topConnectors) — take(N)로 해결.
    .index('by_status_connections', ['status', 'acceptedConnections'])
    // 프로필 미작성 회원 (운영진 리마인드 대상) — 오름차순 take(N).
    .index('by_status_profile', ['status', 'profileScore'])
    // 자유 텍스트 검색. 배열 필드(업종·도움분야)도 searchText에 포함시켜
    // 인덱스로 원소 단위 조회가 불가한 한계를 우회한다. 정확 일치는 페이지 내에서 확정.
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['status', 'region', 'cohort', 'university'],
    }),

  requests: defineTable({
    authorId: v.id('members'),
    title: v.string(),
    body: v.string(),
    category: v.string(), // 분류 (예: 투자, 영업, 채용, 법률, 마케팅...)
    tags: v.array(v.string()),
    region: v.optional(v.string()),
    urgency: v.union(v.literal('low'), v.literal('normal'), v.literal('high')),
    status: requestStatus,
    createdAt: v.number(),
    // 전문 검색용 결합 텍스트 (title+body+category+tags). 백필: migrations:backfillRequestSearch
    searchText: v.optional(v.string()),
  })
    .index('by_status', ['status'])
    .index('by_author', ['authorId'])
    .index('by_category', ['category'])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['status', 'category'],
    }),

  matches: defineTable({
    requestId: v.id('requests'),
    helperId: v.id('members'),
    brokeredBy: v.optional(v.id('members')), // 중개한 운영진
    status: matchStatus,
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_request', ['requestId'])
    .index('by_request_helper', ['requestId', 'helperId'])
    .index('by_helper', ['helperId']),

  // 회원 간 1:1 교류 신청. phone은 accepted 상태의 상대방에게만 공개.
  connections: defineTable({
    fromId: v.id('members'),
    toId: v.id('members'),
    message: v.string(),
    topic: v.optional(v.string()), // 교류 주제 (커피챗/협업 제안 등)
    status: connectionStatus,
    respondedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_from', ['fromId'])
    .index('by_to', ['toId'])
    // 특정 상대와의 교류 존재 여부를 O(1)로 (중복 신청 차단·프로필 버튼 상태).
    .index('by_from_to', ['fromId', 'toId'])
    .index('by_to_from', ['toId', 'fromId'])
    // 방향별 상태 필터 (연결 탭·대기 뱃지)
    .index('by_from_status', ['fromId', 'status'])
    .index('by_to_status', ['toId', 'status'])
    // 운영진 교류 모니터링 (상태별 최신순)
    .index('by_status_created', ['status', 'createdAt']),

  contributions: defineTable({
    memberId: v.id('members'),
    type: contributionType,
    points: v.number(),
    refId: v.optional(v.string()), // 관련 request/match id
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_member', ['memberId'])
    // 매칭 롤백 시 해당 매칭의 기여만 역적립 (회원 전체 기여 스캔 방지)
    .index('by_ref', ['refId']),

  events: defineTable({
    title: v.string(),
    kind: v.union(v.literal('event'), v.literal('sponsor')),
    date: v.optional(v.string()),
    place: v.optional(v.string()),
    body: v.string(),
    host: v.optional(v.string()),
    status: v.union(v.literal('upcoming'), v.literal('done')),
    createdAt: v.number(),
  }).index('by_kind', ['kind']),

  // 행사/후원 참석 의사 (RSVP). 회원당 행사별 1건.
  eventRsvps: defineTable({
    eventId: v.id('events'),
    memberId: v.id('members'),
    status: v.union(v.literal('going'), v.literal('interested')), // 참석 / 관심
    createdAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_member', ['memberId'])
    // 내 RSVP 단건 조회 (행사 목록/상세에서 회원당 1건) — 행사별 전량 스캔 방지
    .index('by_event_member', ['eventId', 'memberId'])
    // 참석/관심 명단을 상태별로 앞에서 N명만 (1000명 행사에서도 읽는 문서 수 고정)
    .index('by_event_status', ['eventId', 'status']),

  // FCM 디바이스 토큰 (푸시 알림). 회원당 여러 기기 가능. 토큰은 기기별 고유.
  pushTokens: defineTable({
    memberId: v.id('members'),
    token: v.string(),
    platform: v.union(
      v.literal('web'),
      v.literal('ios'),
      v.literal('android'),
    ),
    createdAt: v.number(),
  })
    .index('by_member', ['memberId'])
    .index('by_token', ['token']),

  // 인앱 알림센터. 회원에게 도달하는 이벤트(교류 신청/수락, 가입 승인 등)를 영속.
  notifications: defineTable({
    userId: v.id('members'), // 수신자
    type: v.string(), // connection.request | connection.accepted | member.approved
    title: v.string(),
    body: v.optional(v.string()),
    link: v.optional(v.string()), // 탭 시 이동할 앱 경로
    refId: v.optional(v.string()), // 관련 connection/request id
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    // 안 읽은 알림만 골라 일괄 읽음 처리 (전체 알림 스캔 방지)
    .index('by_user_read', ['userId', 'read']),

  // 운영진 행위 감사 로그 (불변 기록). actorName/targetName은 행위 시점 스냅샷 —
  // 대상 회원이 이후 개명/삭제돼도 당시 기록을 보존하기 위함.
  auditLogs: defineTable({
    actorId: v.id('members'), // 행위자(운영진)
    actorName: v.string(),
    action: v.string(), // member.approve | member.activate | member.setPending | member.suspend | admin.grant | admin.revoke
    targetId: v.optional(v.id('members')), // 대상 회원
    targetName: v.optional(v.string()),
    detail: v.optional(v.string()), // 부가 설명
    createdAt: v.number(),
  })
    .index('by_created', ['createdAt'])
    .index('by_target', ['targetId']),

  // 공지/홍보/비즈룸 게시판
  announcements: defineTable({
    authorId: v.id('members'),
    title: v.string(),
    body: v.string(),
    category: v.union(
      v.literal('notice'), // 공지
      v.literal('promotion'), // 홍보
      v.literal('bizroom'), // 비즈룸
    ),
    pinned: v.boolean(),
    status: v.union(v.literal('active'), v.literal('archived')),
    createdAt: v.number(),
  })
    .index('by_category', ['category', 'createdAt'])
    .index('by_created', ['createdAt'])
    // 커서 페이지네이션용: 활성 글만 최신순 / 분류별 최신순 / 고정글 분리 조회
    .index('by_status_created', ['status', 'createdAt'])
    .index('by_status_category_created', ['status', 'category', 'createdAt'])
    .index('by_status_pinned_created', ['status', 'pinned', 'createdAt']),

  // 파일럿 경량 세션 (phone 클레임). Phase 2에 Convex Auth로 교체.
  sessions: defineTable({
    token: v.string(),
    memberId: v.id('members'),
    createdAt: v.number(),
  }).index('by_token', ['token']),

  // 로그인 브루트포스 완화용 슬라이딩 윈도우 카운터 (key=login:<phone>)
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),
  }).index('by_key', ['key']),

  // ── 집계 롤업 (1000명 기준) ──
  // 대시보드/통계 수치를 테이블 전체 스캔으로 구하지 않기 위한 유지 카운터.
  // 쓰기 경로(convex/rollup.ts)에서 증감하고 읽기는 by_key 단건 조회로 끝난다.
  // key 예: members.active, requests.open, connections.accepted,
  //        contributions.points.total, members.new.2026-06
  counters: defineTable({
    key: v.string(),
    value: v.number(),
  }).index('by_key', ['key']),

  // 필터 칩·통계용 값별 빈도 롤업 (활성 회원 기준).
  // 배열 필드(업종/도움분야)의 distinct 목록도 여기서 나오므로 회원 테이블을
  // 훑지 않고 상위 N개를 by_field_count 인덱스로 바로 읽는다.
  facetCounts: defineTable({
    field: facetField,
    value: v.string(),
    count: v.number(),
  })
    .index('by_field_value', ['field', 'value'])
    .index('by_field_count', ['field', 'count']),
})
