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
    status: v.union(
      v.literal('active'),
      v.literal('pending'),
      v.literal('suspended'),
    ),
    contributionScore: v.number(),
    createdAt: v.number(),
  })
    .index('by_phone', ['phone'])
    .index('by_status', ['status']),

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
  })
    .index('by_status', ['status'])
    .index('by_author', ['authorId']),

  matches: defineTable({
    requestId: v.id('requests'),
    helperId: v.id('members'),
    brokeredBy: v.optional(v.id('members')), // 중개한 운영진
    status: matchStatus,
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_request', ['requestId'])
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
    .index('by_to', ['toId']),

  contributions: defineTable({
    memberId: v.id('members'),
    type: contributionType,
    points: v.number(),
    refId: v.optional(v.string()), // 관련 request/match id
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_member', ['memberId']),

  events: defineTable({
    title: v.string(),
    kind: v.union(v.literal('event'), v.literal('sponsor')),
    date: v.optional(v.string()),
    place: v.optional(v.string()),
    body: v.string(),
    host: v.optional(v.string()),
    status: v.union(v.literal('upcoming'), v.literal('done')),
    createdAt: v.number(),
  }),

  // 행사/후원 참석 의사 (RSVP). 회원당 행사별 1건.
  eventRsvps: defineTable({
    eventId: v.id('events'),
    memberId: v.id('members'),
    status: v.union(v.literal('going'), v.literal('interested')), // 참석 / 관심
    createdAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_member', ['memberId']),

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
  }).index('by_user', ['userId']),

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
    .index('by_created', ['createdAt']),

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
})
