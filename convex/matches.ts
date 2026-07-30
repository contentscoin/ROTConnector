import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { matchStatus, contributionType } from './schema'
import { requireAdmin } from './auth'
import { createNotification } from './notify'
import {
  applyContributionDelta,
  applyMatchDelta,
  applyRequestDelta,
} from './rollup'

// 알림 제목용 요청 제목 축약 (긴 제목이 알림을 망치지 않도록)
function shortTitle(title: string): string {
  return title.length > 40 ? `${title.slice(0, 40)}…` : title
}

// 기여 적립 + 회원 점수 가산 (내부 헬퍼). refId에 matchId를 넣어 롤백 추적.
async function award(
  ctx: MutationCtx,
  memberId: Id<'members'>,
  type: 'intro' | 'consult' | 'sponsor' | 'event' | 'onboarding',
  points: number,
  refId?: string,
  note?: string,
) {
  // 점수 정합성: 음수/과도값 방지
  points = Math.max(0, Math.min(1000, Math.round(points)))
  if (points === 0) return
  await ctx.db.insert('contributions', {
    memberId,
    type,
    points,
    refId,
    note,
    createdAt: Date.now(),
  })
  const member = await ctx.db.get(memberId)
  if (member) {
    await ctx.db.patch(memberId, {
      contributionScore: member.contributionScore + points,
    })
  }
  // 운영진 통계용 기여 롤업 (전체 contributions 스캔 제거)
  await applyContributionDelta(ctx, type, points, 1)
}

// 특정 매칭에 적립된 기여를 역적립(롤백). remove(done 매칭) 시 점수 고립 방지.
// by_ref 인덱스로 해당 매칭의 기여만 읽는다 — 회원의 기여 전체를 훑지 않는다.
async function rollbackMatchContributions(ctx: MutationCtx, match: Doc<'matches'>) {
  const contribs = await ctx.db
    .query('contributions')
    .withIndex('by_ref', (q) => q.eq('refId', match._id as string))
    .collect()
  for (const c of contribs) {
    await ctx.db.delete(c._id)
    const member = await ctx.db.get(c.memberId)
    if (member) {
      await ctx.db.patch(c.memberId, {
        contributionScore: Math.max(0, member.contributionScore - c.points),
      })
    }
    await applyContributionDelta(ctx, c.type, -c.points, -1)
  }
}

// 매칭 변동 후 요청 상태를 매칭 현황에서 재계산. closed(종료)는 terminal이라 건드리지 않음.
async function recomputeRequestStatus(
  ctx: MutationCtx,
  requestId: Id<'requests'>,
) {
  const req = await ctx.db.get(requestId)
  if (!req || req.status === 'closed') return
  const matches = await ctx.db
    .query('matches')
    .withIndex('by_request', (q) => q.eq('requestId', requestId))
    .collect()
  let next: Doc<'requests'>['status']
  if (matches.some((m) => m.status === 'done')) next = 'connected'
  else if (matches.length > 0) next = 'matching'
  else next = 'open'
  if (next !== req.status) {
    await ctx.db.patch(requestId, { status: next })
    const after = await ctx.db.get(requestId)
    // 요청 상태별 카운터 유지 (운영진 퍼널 집계를 O(1)로)
    if (after) await applyRequestDelta(ctx, req, after)
  }
}

// 특정 요청의 매칭 목록 (helper/broker 요약 포함)
export const listByRequest = query({
  args: { requestId: v.id('requests') },
  handler: async (ctx, { requestId }) => {
    const matches = await ctx.db
      .query('matches')
      .withIndex('by_request', (q) => q.eq('requestId', requestId))
      .order('desc')
      .collect()
    return Promise.all(
      matches.map(async (m) => {
        const helper = await ctx.db.get(m.helperId)
        const broker = m.brokeredBy ? await ctx.db.get(m.brokeredBy) : null
        return {
          ...m,
          helper: helper
            ? { _id: helper._id, name: helper.name, company: helper.company }
            : null,
          broker: broker ? { _id: broker._id, name: broker.name } : null,
        }
      }),
    )
  },
})

// 운영진: helper를 요청에 제안 → 요청 상태 재계산(matching)
export const propose = mutation({
  args: {
    token: v.string(),
    requestId: v.id('requests'),
    helperId: v.id('members'),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, requestId, helperId, note }) => {
    const admin = await requireAdmin(ctx, token)
    const req = await ctx.db.get(requestId)
    if (!req) throw new Error('요청을 찾을 수 없습니다.')
    if (req.status === 'closed') {
      throw new Error('종료된 요청에는 회원을 연결할 수 없습니다.')
    }
    if (helperId === req.authorId) {
      throw new Error('요청 작성자 본인은 연결 대상이 될 수 없습니다.')
    }
    const helper = await ctx.db.get(helperId)
    if (!helper || helper.status !== 'active') {
      throw new Error('유효한 활성 회원만 연결할 수 있습니다.')
    }
    // 동일 (요청, helper) 중복 매칭 차단 → 중복 기여 적립 방지.
    // by_request_helper 복합 인덱스 단건 조회 (요청의 매칭 전체를 훑지 않는다)
    const duplicate = await ctx.db
      .query('matches')
      .withIndex('by_request_helper', (q) =>
        q.eq('requestId', requestId).eq('helperId', helperId),
      )
      .first()
    if (duplicate) {
      throw new Error('이미 이 요청에 연결된 회원입니다.')
    }
    const matchId = await ctx.db.insert('matches', {
      requestId,
      helperId,
      brokeredBy: admin._id,
      status: 'proposed',
      note,
      createdAt: Date.now(),
    })
    await recomputeRequestStatus(ctx, requestId)
    const t = shortTitle(req.title)
    const link = `/requests/${requestId}`
    // 헬퍼: 도움 제공자로 매칭됨
    await createNotification(ctx, helperId, {
      type: 'match.proposed',
      title: '도움 제공자로 매칭됐어요',
      body: `'${t}' 요청에 운영진이 회원님을 연결했어요.`,
      link,
      refId: matchId,
    })
    // 작성자: 내 요청에 도움 제공자가 연결됨
    await createNotification(ctx, req.authorId, {
      type: 'request.matched',
      title: `${helper.name}님이 도움 제공자로 연결됐어요`,
      body: `'${t}' 요청의 매칭이 시작됐어요.`,
      link,
      refId: matchId,
    })
    return matchId
  },
})

export const setStatus = mutation({
  args: { token: v.string(), matchId: v.id('matches'), status: matchStatus },
  handler: async (ctx, { token, matchId, status }) => {
    await requireAdmin(ctx, token)
    const match = await ctx.db.get(matchId)
    if (!match) throw new Error('매칭을 찾을 수 없습니다.')
    // 'done' 전이는 complete()로만 (기여 적립 보장). 또한 이미 done인 매칭은
    // setStatus로 되돌릴 수 없다 — 되돌리면 complete 멱등성 우회(중복 적립) +
    // 요청 상태 desync가 발생한다. done 취소는 remove(롤백 동반)로만.
    if (status === 'done' || match.status === 'done') {
      throw new Error("'완료' 처리는 완료 버튼으로, 취소는 삭제로만 가능합니다.")
    }
    await ctx.db.patch(matchId, { status })
    const after = await ctx.db.get(matchId)
    if (after) await applyMatchDelta(ctx, match, after)
    return null
  },
})

// 운영진: 연결 완료 → 매칭 done, 요청 connected, 기여 적립
export const complete = mutation({
  args: {
    token: v.string(),
    matchId: v.id('matches'),
    helperPoints: v.optional(v.number()),
    brokerPoints: v.optional(v.number()),
    contribution: v.optional(contributionType),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token)
    const match = await ctx.db.get(args.matchId)
    if (!match) throw new Error('매칭을 찾을 수 없습니다.')
    // 멱등성: 이미 완료된 매칭에 중복 적립 방지
    if (match.status === 'done') throw new Error('이미 완료된 매칭입니다.')
    const req = await ctx.db.get(match.requestId)
    if (!req) throw new Error('요청을 찾을 수 없습니다.')
    // 종료(closed) 요청은 되살리지 않음 — 상태 역행 차단
    if (req.status === 'closed') {
      throw new Error('종료된 요청입니다. 먼저 요청을 다시 여세요.')
    }
    await ctx.db.patch(args.matchId, { status: 'done' })
    const doneMatch = await ctx.db.get(args.matchId)
    // 완료 매칭 카운터 (+1) — 운영진 '중개 연결' 수치를 O(1)로
    if (doneMatch) await applyMatchDelta(ctx, match, doneMatch)

    const helperPoints = args.helperPoints ?? 10
    await award(
      ctx,
      match.helperId,
      args.contribution ?? 'consult',
      helperPoints,
      args.matchId,
      '연결 완료',
    )
    // broker 적립은 match.brokeredBy 기준으로만 (rollback이 동일 대상을 찾도록 대칭 유지)
    const brokerPoints = args.brokerPoints ?? 5
    if (match.brokeredBy && brokerPoints > 0) {
      await award(ctx, match.brokeredBy, 'intro', brokerPoints, args.matchId, '중개')
    }
    await recomputeRequestStatus(ctx, match.requestId)

    const t = shortTitle(req.title)
    const link = `/requests/${match.requestId}`
    const awardedHelper = Math.max(0, Math.min(1000, Math.round(helperPoints)))
    // 작성자: 요청 연결 완료
    await createNotification(ctx, req.authorId, {
      type: 'request.connected',
      title: '도움요청이 연결 완료됐어요 🎉',
      body: `'${t}' 요청의 연결이 완료 처리됐어요.`,
      link,
      refId: args.matchId,
    })
    // 헬퍼: 기여 적립 통보 (적립 점수가 있을 때만 점수 표기)
    await createNotification(ctx, match.helperId, {
      type: 'match.completed',
      title: '도움 주신 연결이 완료됐어요',
      body:
        awardedHelper > 0
          ? `'${t}' 연결 완료로 기여 +${awardedHelper}점이 적립됐어요.`
          : `'${t}' 연결이 완료 처리됐어요.`,
      link,
      refId: args.matchId,
    })
    return null
  },
})

export const remove = mutation({
  args: { token: v.string(), matchId: v.id('matches') },
  handler: async (ctx, { token, matchId }) => {
    await requireAdmin(ctx, token)
    const match = await ctx.db.get(matchId)
    if (!match) return null
    // done 매칭 삭제 시 적립 점수 롤백 (점수 고립/중복적립 방지)
    if (match.status === 'done') {
      await rollbackMatchContributions(ctx, match)
    }
    await ctx.db.delete(matchId)
    await applyMatchDelta(ctx, match, null)
    // 남은 매칭으로 요청 상태 재계산 (0건이면 open으로 환원)
    await recomputeRequestStatus(ctx, match.requestId)
    return null
  },
})
