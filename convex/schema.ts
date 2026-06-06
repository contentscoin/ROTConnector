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
    cohort: v.optional(v.string()), // 기수
    phone: v.string(), // 클레임/연락 식별자
    company: v.optional(v.string()),
    title: v.optional(v.string()), // 직함
    industry: v.array(v.string()), // 업종 태그
    region: v.optional(v.string()),
    intro: v.optional(v.string()), // 사업 소개
    helpOffer: v.array(v.string()), // 줄 수 있는 도움
    helpNeed: v.array(v.string()), // 필요한 도움
    links: v.array(v.object({ label: v.string(), url: v.string() })),
    isAdmin: v.boolean(),
    status: v.union(v.literal('active'), v.literal('pending')),
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
