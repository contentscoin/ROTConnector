import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import {
  buildMemberSearchText,
  buildRequestSearchText,
  memberProfileScore,
  normalizeCohort,
} from './util'
import {
  applyConnectionDelta,
  applyContributionDelta,
  applyMatchDelta,
  applyMemberDelta,
  applyRequestDelta,
  applyRsvpDelta,
  bumpUnread,
} from './rollup'

// 백필/재계산 1회 처리 문서 수 — 한 뮤테이션의 읽기·쓰기 수를 고정한다.
// 남으면 스케줄러로 자기 자신을 이어 호출한다(회원 수와 무관하게 완주).
const BATCH = 200

// 일회성 백필: 기존 회원의 cohort 표기("학군 35기" 등)를 숫자 문자열로 정규화.
// 실행: npx convex run migrations:normalizeCohorts
export const normalizeCohorts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query('members').collect()
    let updated = 0
    for (const m of members) {
      const normalized = normalizeCohort(m.cohort)
      if (normalized !== m.cohort) {
        await ctx.db.patch(m._id, { cohort: normalized })
        // 기수는 검색 텍스트·기수 빈도 롤업에 모두 반영된다
        const after = await ctx.db.get(m._id)
        if (after) {
          await ctx.db.patch(m._id, {
            searchText: buildMemberSearchText(after),
          })
          const refreshed = await ctx.db.get(m._id)
          if (refreshed) await applyMemberDelta(ctx, m, refreshed)
        }
        updated++
      }
    }
    return { total: members.length, updated }
  },
})

// 프로덕션 최초 운영진 부트스트랩. members.setAdmin은 기존 운영진(requireAdmin)을
// 요구하므로 시드를 돌리지 않은 prod에서는 첫 운영진을 만들 수 없는 닭-달걀 문제가 있다.
// 대상자가 먼저 phone으로 계정을 클레임한 뒤 운영자가 1회 실행:
//   npx convex run migrations:promoteAdmin '{"phone":"01012345678"}'
// internalMutation이라 클라이언트에서 호출 불가. 대상 회원을 active 운영진으로 승격.
export const promoteAdmin = internalMutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const member = await ctx.db
      .query('members')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first()
    if (!member) {
      throw new Error(
        `해당 전화번호로 클레임된 회원이 없습니다: ${phone}. 먼저 계정을 클레임하세요.`,
      )
    }
    const already = member.isAdmin && member.status === 'active'
    if (!already) {
      await ctx.db.patch(member._id, { isAdmin: true, status: 'active' })
      // 상태 전이는 활성 회원 기준 집계(counters/facetCounts)를 바꾼다
      const after = await ctx.db.get(member._id)
      if (after) await applyMemberDelta(ctx, member, after)
    }
    return {
      ok: true,
      alreadyAdmin: already,
      memberId: member._id,
      name: member.name,
    }
  },
})

// 빈 DB 최초 운영진 부트스트랩 — promoteAdmin은 기존 회원을 요구하므로
// (회원 등록은 운영진만 가능해 빈 prod에선 클레임할 계정 자체가 없음)
// phone으로 upsert: 없으면 active 운영진으로 생성, 있으면 승격.
//   npx convex run migrations:bootstrapAdmin '{"name":"홍길동","phone":"01012345678"}' --prod
export const bootstrapAdmin = internalMutation({
  args: { name: v.string(), phone: v.string() },
  handler: async (ctx, { name, phone }) => {
    const cleanName = name.trim()
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (cleanName.length < 2) throw new Error('이름을 입력하세요.')
    if (!/^01\d{8,9}$/.test(cleanPhone)) {
      throw new Error('휴대폰 번호 형식이 올바르지 않습니다 (숫자만, 01로 시작).')
    }
    const existing = await ctx.db
      .query('members')
      .withIndex('by_phone', (q) => q.eq('phone', cleanPhone))
      .first()
    if (existing) {
      const already = existing.isAdmin && existing.status === 'active'
      if (!already) {
        await ctx.db.patch(existing._id, { isAdmin: true, status: 'active' })
        const after = await ctx.db.get(existing._id)
        if (after) await applyMemberDelta(ctx, existing, after)
      }
      return { ok: true, created: false, memberId: existing._id, name: existing.name }
    }
    const doc = {
      name: cleanName,
      phone: cleanPhone,
      industry: [],
      helpOffer: [],
      helpNeed: [],
      links: [],
      isAdmin: true,
      status: 'active' as const,
      contributionScore: 0,
      createdAt: Date.now(),
    }
    const memberId = await ctx.db.insert('members', {
      ...doc,
      // 검색 인덱스·집계용 비정규화 필드를 처음부터 채운다
      searchText: buildMemberSearchText(doc),
      profileScore: memberProfileScore(doc),
      acceptedConnections: 0,
      unreadNotifications: 0,
    })
    const created = await ctx.db.get(memberId)
    if (created) await applyMemberDelta(ctx, null, created)
    return { ok: true, created: true, memberId, name: cleanName }
  },
})

// 데모/시드 데이터 전체 삭제 — 실서비스 오픈 전 prod 초기화용.
// 오실행 방지를 위해 confirm: "WIPE" 필수. 모든 앱 테이블의 전 행을 삭제한다.
//   npx convex run migrations:wipeDemoData '{"confirm":"WIPE"}' --prod
export const wipeDemoData = internalMutation({
  args: { confirm: v.literal('WIPE') },
  handler: async (ctx) => {
    const tables = [
      'members',
      'requests',
      'matches',
      'connections',
      'contributions',
      'events',
      'eventRsvps',
      'notifications',
      'announcements',
      'auditLogs',
      'sessions',
      'rateLimits',
      'pushTokens',
      // 집계 롤업도 함께 비운다 — 원본이 사라진 뒤 수치만 남으면 대시보드가 거짓말을 한다
      'counters',
      'facetCounts',
    ] as const
    const deleted: Record<string, number> = {}
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect()
      for (const row of rows) await ctx.db.delete(row._id)
      deleted[table] = rows.length
    }
    return { ok: true, deleted }
  },
})

/* ─────────────── 1000명 기준 확장 백필 ─────────────── */

/**
 * 회원/요청 전문 검색 텍스트 + 프로필 완성률 캐시 백필.
 * searchIndex('search_text')는 members.searchText / requests.searchText를 대상으로 하므로
 * 기존 행에 이 필드가 없으면 검색 결과에 잡히지 않는다. 스키마 배포 직후 1회 실행:
 *   npx convex run migrations:backfillSearchText --prod
 * BATCH개씩 처리하고 남으면 자기 자신을 재예약한다(cursor는 내부용).
 */
export const backfillSearchText = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    phase: v.optional(v.union(v.literal('members'), v.literal('requests'))),
  },
  handler: async (ctx, { cursor, phase }) => {
    const current = phase ?? 'members'
    if (current === 'members') {
      const { page, isDone, continueCursor } = await ctx.db
        .query('members')
        .paginate({ cursor: cursor ?? null, numItems: BATCH })
      for (const m of page) {
        await ctx.db.patch(m._id, {
          searchText: buildMemberSearchText(m),
          profileScore: memberProfileScore(m),
          // 롤업 재계산(rebuildRollups)이 실제 값을 채우기 전 기본값
          acceptedConnections: m.acceptedConnections ?? 0,
          unreadNotifications: m.unreadNotifications ?? 0,
        })
      }
      await ctx.scheduler.runAfter(0, internal.migrations.backfillSearchText, {
        cursor: isDone ? null : continueCursor,
        phase: isDone ? 'requests' : 'members',
      })
      return { phase: 'members', processed: page.length, done: isDone }
    }
    const { page, isDone, continueCursor } = await ctx.db
      .query('requests')
      .paginate({ cursor: cursor ?? null, numItems: BATCH })
    for (const r of page) {
      await ctx.db.patch(r._id, { searchText: buildRequestSearchText(r) })
    }
    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillSearchText, {
        cursor: continueCursor,
        phase: 'requests',
      })
    }
    return { phase: 'requests', processed: page.length, done: isDone }
  },
})

// rebuildRollups가 순서대로 훑는 테이블. members가 먼저여야 회원 문서의
// acceptedConnections/unreadNotifications 캐시가 0으로 초기화된 뒤 채워진다.
const REBUILD_PHASES = [
  'reset',
  'members',
  'requests',
  'connections',
  'matches',
  'contributions',
  'eventRsvps',
  'notifications',
] as const

type RebuildPhase = (typeof REBUILD_PHASES)[number]

/**
 * counters / facetCounts 전량 재계산.
 *
 * 대시보드·통계·필터 칩은 쓰기 시 증감하는 롤업을 읽는다(convex/rollup.ts).
 * 스키마 배포 직후(롤업이 비어 있을 때)와 값이 어긋난 경우 1회 실행:
 *   npx convex run migrations:rebuildRollups '{"confirm":"REBUILD"}' --prod
 * reset 단계에서 counters/facetCounts를 비우고, 이후 테이블별로 BATCH개씩
 * apply*Delta(null, doc)를 다시 적용하며 스케줄러로 이어 달린다.
 */
export const rebuildRollups = internalMutation({
  args: {
    confirm: v.literal('REBUILD'),
    phase: v.optional(v.union(...REBUILD_PHASES.map((p) => v.literal(p)))),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { phase, cursor }) => {
    const current: RebuildPhase = phase ?? 'reset'
    const next = (p: RebuildPhase, c: string | null) =>
      ctx.scheduler.runAfter(0, internal.migrations.rebuildRollups, {
        confirm: 'REBUILD' as const,
        phase: p,
        cursor: c,
      })
    const advance = (isDone: boolean, continueCursor: string) => {
      if (!isDone) return next(current, continueCursor)
      const i = REBUILD_PHASES.indexOf(current)
      const after = REBUILD_PHASES[i + 1]
      return after ? next(after, null) : Promise.resolve()
    }

    if (current === 'reset') {
      // 롤업 테이블만 비운다 (원본 데이터는 건드리지 않는다)
      for (const table of ['counters', 'facetCounts'] as const) {
        const rows = await ctx.db.query(table).take(BATCH * 5)
        for (const row of rows) await ctx.db.delete(row._id)
        if (rows.length === BATCH * 5) {
          await next('reset', null) // 남았으면 reset 단계를 한 번 더
          return { phase: current, done: false }
        }
      }
      await next('members', null)
      return { phase: current, done: true }
    }

    if (current === 'members') {
      const { page, isDone, continueCursor } = await ctx.db
        .query('members')
        .paginate({ cursor: cursor ?? null, numItems: BATCH })
      for (const m of page) {
        // 회원 문서의 파생 캐시를 먼저 0/재계산으로 되돌린다
        await ctx.db.patch(m._id, {
          searchText: buildMemberSearchText(m),
          profileScore: memberProfileScore(m),
          acceptedConnections: 0,
          unreadNotifications: 0,
        })
        const fresh = await ctx.db.get(m._id)
        if (fresh) await applyMemberDelta(ctx, null, fresh)
      }
      await advance(isDone, continueCursor)
      return { phase: current, processed: page.length, done: isDone }
    }

    if (current === 'requests') {
      const { page, isDone, continueCursor } = await ctx.db
        .query('requests')
        .paginate({ cursor: cursor ?? null, numItems: BATCH })
      for (const r of page) {
        await ctx.db.patch(r._id, { searchText: buildRequestSearchText(r) })
        await applyRequestDelta(ctx, null, r)
      }
      await advance(isDone, continueCursor)
      return { phase: current, processed: page.length, done: isDone }
    }

    if (current === 'connections') {
      const { page, isDone, continueCursor } = await ctx.db
        .query('connections')
        .paginate({ cursor: cursor ?? null, numItems: BATCH })
      for (const c of page) await applyConnectionDelta(ctx, null, c)
      await advance(isDone, continueCursor)
      return { phase: current, processed: page.length, done: isDone }
    }

    if (current === 'matches') {
      const { page, isDone, continueCursor } = await ctx.db
        .query('matches')
        .paginate({ cursor: cursor ?? null, numItems: BATCH })
      for (const m of page) await applyMatchDelta(ctx, null, m)
      await advance(isDone, continueCursor)
      return { phase: current, processed: page.length, done: isDone }
    }

    if (current === 'contributions') {
      const { page, isDone, continueCursor } = await ctx.db
        .query('contributions')
        .paginate({ cursor: cursor ?? null, numItems: BATCH })
      for (const c of page) {
        await applyContributionDelta(ctx, c.type, c.points, 1)
      }
      await advance(isDone, continueCursor)
      return { phase: current, processed: page.length, done: isDone }
    }

    if (current === 'eventRsvps') {
      const { page, isDone, continueCursor } = await ctx.db
        .query('eventRsvps')
        .paginate({ cursor: cursor ?? null, numItems: BATCH })
      for (const r of page) {
        await applyRsvpDelta(ctx, r.eventId, null, r.status)
      }
      await advance(isDone, continueCursor)
      return { phase: current, processed: page.length, done: isDone }
    }

    // notifications: 안 읽은 알림만 회원별 카운터에 반영
    const { page, isDone, continueCursor } = await ctx.db
      .query('notifications')
      .paginate({ cursor: cursor ?? null, numItems: BATCH })
    for (const n of page) {
      if (!n.read) await bumpUnread(ctx, n.userId, 1)
    }
    await advance(isDone, continueCursor)
    return { phase: current, processed: page.length, done: isDone }
  },
})
