import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { memberProfileScore } from './util'

/**
 * 집계 롤업 (1000명 기준 설계).
 *
 * 대시보드·통계·필터 칩 수치를 테이블 전체 `.collect()`로 구하면 읽는 문서 수가
 * 회원 수와 함께 선형으로 늘어나 Convex 쿼리 한도(스캔 문서/바이트)에 걸린다.
 * 그래서 "쓰기 시 증감, 읽기는 단건 조회" 원칙으로 바꾼다.
 *
 *  - counters:    스칼라 집계 (회원/요청/교류/매칭/기여 카운트, 점수 합계)
 *  - facetCounts: 값별 빈도 (업종·도움분야·지역·기수·학교·요청태그)
 *
 * 모든 증감은 이 파일의 헬퍼를 통해서만 수행한다. 값이 어긋난 경우
 * `npx convex run migrations:rebuildRollups '{"confirm":"REBUILD"}'` 로 전량 재계산.
 */

export type FacetField = Doc<'facetCounts'>['field']

/* ─────────────── counters ─────────────── */

export const COUNTER = {
  membersTotal: 'members.total',
  membersActive: 'members.active',
  membersPending: 'members.pending',
  membersSuspended: 'members.suspended',
  // 활성 회원 profileScore 합계 — 평균 완성률 = 합계 / members.active
  profileScoreSum: 'members.profileScoreSum',
  requestsTotal: 'requests.total',
  matchesDone: 'matches.done',
  connectionsTotal: 'connections.total',
  contributionPointsTotal: 'contributions.points.total',
} as const

// YYYY-MM 키 (신규 회원 월별 집계)
export function monthKey(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}`
}

export async function bumpCounter(
  ctx: MutationCtx,
  key: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return
  const row = await ctx.db
    .query('counters')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique()
  if (row) {
    // 음수로 내려가지 않도록 클램프 (백필 이전 데이터가 섞여도 표시가 깨지지 않게)
    await ctx.db.patch(row._id, { value: Math.max(0, row.value + delta) })
  } else {
    await ctx.db.insert('counters', { key, value: Math.max(0, delta) })
  }
}

export async function readCounter(ctx: QueryCtx, key: string): Promise<number> {
  const row = await ctx.db
    .query('counters')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique()
  return row?.value ?? 0
}

// 여러 카운터를 한 번에 (키별 by_key 단건 조회 — 읽는 문서 수 = 키 개수).
export async function readCounters<K extends string>(
  ctx: QueryCtx,
  keys: readonly K[],
): Promise<Record<K, number>> {
  const values = await Promise.all(keys.map((k) => readCounter(ctx, k)))
  return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<
    K,
    number
  >
}

/* ─────────────── facetCounts ─────────────── */

export async function bumpFacet(
  ctx: MutationCtx,
  field: FacetField,
  value: string,
  delta: number,
): Promise<void> {
  if (delta === 0 || !value) return
  const row = await ctx.db
    .query('facetCounts')
    .withIndex('by_field_value', (q) => q.eq('field', field).eq('value', value))
    .unique()
  if (!row) {
    if (delta > 0) await ctx.db.insert('facetCounts', { field, value, count: delta })
    return
  }
  const next = row.count + delta
  // 0 이하가 된 값은 삭제 — by_field_count 인덱스에 죽은 값이 남지 않게
  if (next <= 0) await ctx.db.delete(row._id)
  else await ctx.db.patch(row._id, { count: next })
}

// 빈도 상위 N개 (by_field_count 인덱스 역순 — 읽는 문서 수 = limit).
export async function topFacets(
  ctx: QueryCtx,
  field: FacetField,
  limit: number,
): Promise<Array<{ key: string; count: number }>> {
  const rows = await ctx.db
    .query('facetCounts')
    .withIndex('by_field_count', (q) => q.eq('field', field))
    .order('desc')
    .take(limit)
  return rows.map((r) => ({ key: r.value, count: r.count }))
}

export async function facetCount(
  ctx: QueryCtx,
  field: FacetField,
  value: string,
): Promise<number> {
  const row = await ctx.db
    .query('facetCounts')
    .withIndex('by_field_value', (q) => q.eq('field', field).eq('value', value))
    .unique()
  return row?.count ?? 0
}

/* ─────────────── members ─────────────── */

type MemberFacetSource = Pick<
  Doc<'members'>,
  'industry' | 'helpOffer' | 'helpNeed' | 'region' | 'cohort' | 'university'
>

// 회원 1명이 기여하는 (field, value) 목록. 활성 회원만 집계 대상.
function memberFacetPairs(m: MemberFacetSource): Array<[FacetField, string]> {
  const out: Array<[FacetField, string]> = []
  const push = (field: FacetField, values: string[]) => {
    const seen = new Set<string>()
    for (const raw of values) {
      const v = raw.trim()
      if (!v || seen.has(v)) continue
      seen.add(v)
      out.push([field, v])
    }
  }
  push('industry', m.industry)
  push('helpOffer', m.helpOffer)
  push('helpNeed', m.helpNeed)
  push('region', m.region ? [m.region] : [])
  push('cohort', m.cohort ? [m.cohort] : [])
  push('university', m.university ? [m.university] : [])
  return out
}

const statusCounterKey = (status: Doc<'members'>['status']) =>
  `members.${status}`

/**
 * 회원 롤업 반영. before=null → 생성, after=null → 삭제, 둘 다 있으면 수정.
 * 호출부는 반드시 insert/patch/delete **이후**에 호출한다(after는 최종 문서).
 */
export async function applyMemberDelta(
  ctx: MutationCtx,
  before: Doc<'members'> | null,
  after: Doc<'members'> | null,
): Promise<void> {
  // 상태가 그대로면 감소·증가를 왕복하지 않는다 (bumpCounter가 0에서 클램프하므로
  // 롤업 백필 전 상태에서 왕복하면 수치가 부풀 수 있다).
  if (before?.status !== after?.status) {
    if (before) await bumpCounter(ctx, statusCounterKey(before.status), -1)
    if (after) await bumpCounter(ctx, statusCounterKey(after.status), 1)
  }
  if (!before && after) {
    await bumpCounter(ctx, COUNTER.membersTotal, 1)
    await bumpCounter(ctx, `members.new.${monthKey(after.createdAt)}`, 1)
  }
  if (before && !after) await bumpCounter(ctx, COUNTER.membersTotal, -1)

  // 평균 완성률용 합계 (활성 회원만)
  const beforeScore =
    before && before.status === 'active'
      ? (before.profileScore ?? memberProfileScore(before))
      : 0
  const afterScore =
    after && after.status === 'active'
      ? (after.profileScore ?? memberProfileScore(after))
      : 0
  await bumpCounter(ctx, COUNTER.profileScoreSum, afterScore - beforeScore)

  // 필터 칩/통계용 값별 빈도 (활성 회원만) — 변화분만 증감
  const delta = new Map<string, number>()
  const encode = (field: FacetField, value: string) => `${field}\u0000${value}`
  if (before && before.status === 'active') {
    for (const [f, v] of memberFacetPairs(before)) {
      delta.set(encode(f, v), (delta.get(encode(f, v)) ?? 0) - 1)
    }
  }
  if (after && after.status === 'active') {
    for (const [f, v] of memberFacetPairs(after)) {
      delta.set(encode(f, v), (delta.get(encode(f, v)) ?? 0) + 1)
    }
  }
  for (const [key, d] of delta) {
    if (d === 0) continue
    const sep = key.indexOf('\u0000')
    await bumpFacet(
      ctx,
      key.slice(0, sep) as FacetField,
      key.slice(sep + 1),
      d,
    )
  }
}

/* ─────────────── requests ─────────────── */

const requestStatusKey = (status: Doc<'requests'>['status']) =>
  `requests.${status}`

export async function applyRequestDelta(
  ctx: MutationCtx,
  before: Doc<'requests'> | null,
  after: Doc<'requests'> | null,
): Promise<void> {
  if (before?.status !== after?.status) {
    if (before) await bumpCounter(ctx, requestStatusKey(before.status), -1)
    if (after) await bumpCounter(ctx, requestStatusKey(after.status), 1)
  }
  if (!before && after) await bumpCounter(ctx, COUNTER.requestsTotal, 1)
  if (before && !after) await bumpCounter(ctx, COUNTER.requestsTotal, -1)

  const delta = new Map<string, number>()
  const encode = (field: FacetField, value: string) => `${field}\u0000${value}`
  const collect = (r: Doc<'requests'>, sign: number) => {
    for (const t of new Set(r.tags.map((t) => t.trim()).filter(Boolean))) {
      delta.set(encode('requestTag', t), (delta.get(encode('requestTag', t)) ?? 0) + sign)
    }
    if (r.category) {
      const k = encode('requestCategory', r.category)
      delta.set(k, (delta.get(k) ?? 0) + sign)
    }
  }
  if (before) collect(before, -1)
  if (after) collect(after, 1)
  for (const [key, d] of delta) {
    if (d === 0) continue
    const sep = key.indexOf('\u0000')
    await bumpFacet(ctx, key.slice(0, sep) as FacetField, key.slice(sep + 1), d)
  }
}

/* ─────────────── connections ─────────────── */

const connectionStatusKey = (status: Doc<'connections'>['status']) =>
  `connections.${status}`

// 회원 문서의 acceptedConnections 캐시 증감 (topConnectors·myStats용)
async function bumpMemberConnections(
  ctx: MutationCtx,
  memberId: Id<'members'>,
  delta: number,
): Promise<void> {
  const m = await ctx.db.get(memberId)
  if (!m) return
  await ctx.db.patch(memberId, {
    acceptedConnections: Math.max(0, (m.acceptedConnections ?? 0) + delta),
  })
}

export async function applyConnectionDelta(
  ctx: MutationCtx,
  before: Doc<'connections'> | null,
  after: Doc<'connections'> | null,
): Promise<void> {
  if (before?.status !== after?.status) {
    if (before) await bumpCounter(ctx, connectionStatusKey(before.status), -1)
    if (after) await bumpCounter(ctx, connectionStatusKey(after.status), 1)
  }
  if (!before && after) await bumpCounter(ctx, COUNTER.connectionsTotal, 1)
  if (before && !after) await bumpCounter(ctx, COUNTER.connectionsTotal, -1)

  const wasAccepted = before?.status === 'accepted'
  const isAccepted = after?.status === 'accepted'
  if (wasAccepted === isAccepted) return
  const sign = isAccepted ? 1 : -1
  const doc = after ?? before!
  await bumpMemberConnections(ctx, doc.fromId, sign)
  await bumpMemberConnections(ctx, doc.toId, sign)
}

/* ─────────────── matches ─────────────── */

export async function applyMatchDelta(
  ctx: MutationCtx,
  before: Doc<'matches'> | null,
  after: Doc<'matches'> | null,
): Promise<void> {
  const wasDone = before?.status === 'done'
  const isDone = after?.status === 'done'
  if (wasDone !== isDone) {
    await bumpCounter(ctx, COUNTER.matchesDone, isDone ? 1 : -1)
  }
}

/* ─────────────── contributions ─────────────── */

export async function applyContributionDelta(
  ctx: MutationCtx,
  type: Doc<'contributions'>['type'],
  points: number,
  countDelta: number,
): Promise<void> {
  await bumpCounter(ctx, COUNTER.contributionPointsTotal, points)
  await bumpCounter(ctx, `contributions.points.${type}`, points)
  await bumpCounter(ctx, `contributions.count.${type}`, countDelta)
}

/* ─────────────── eventRsvps ─────────────── */

// 행사별 참석/관심 수 카운터 키. 행사 1건에 1000명이 RSVP해도
// 목록/상세는 이 단건 조회 2번으로 집계를 끝낸다.
export const eventRsvpKey = (
  eventId: Id<'events'>,
  status: Doc<'eventRsvps'>['status'],
) => `event.${eventId}.${status}`

export async function applyRsvpDelta(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  before: Doc<'eventRsvps'>['status'] | null,
  after: Doc<'eventRsvps'>['status'] | null,
): Promise<void> {
  if (before === after) return
  if (before) await bumpCounter(ctx, eventRsvpKey(eventId, before), -1)
  if (after) await bumpCounter(ctx, eventRsvpKey(eventId, after), 1)
}

/* ─────────────── notifications ─────────────── */

// 안 읽은 알림 수 캐시 증감 (헤더 뱃지를 O(1)로)
export async function bumpUnread(
  ctx: MutationCtx,
  memberId: Id<'members'>,
  delta: number,
): Promise<void> {
  const m = await ctx.db.get(memberId)
  if (!m) return
  await ctx.db.patch(memberId, {
    unreadNotifications: Math.max(0, (m.unreadNotifications ?? 0) + delta),
  })
}
