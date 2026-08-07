import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requestStatus } from './schema'
import { memberFromToken, requireMember } from './auth'
import { buildRequestSearchText, normalizeTags } from './util'
import { applyRequestDelta, topFacets } from './rollup'
import { isLegacyList, legacyTake } from './lib/legacyList'

// 태그 자동완성으로 노출할 빈도 상위 개수
const TAG_SUGGESTIONS = 15

// 작성자 요약을 붙여서 반환
async function withAuthor(ctx: QueryCtx, req: Doc<'requests'>) {
  const author = await ctx.db.get(req.authorId)
  return {
    ...req,
    author: author
      ? {
          _id: author._id,
          name: author.name,
          company: author.company,
          cohort: author.cohort,
        }
      : null,
  }
}

// 요청 문서 변경 후 검색 텍스트 캐시를 최종 문서 기준으로 재계산.
async function refreshRequestSearch(
  ctx: MutationCtx,
  requestId: Id<'requests'>,
): Promise<void> {
  const r = await ctx.db.get(requestId)
  if (!r) return
  await ctx.db.patch(requestId, { searchText: buildRequestSearchText(r) })
}

/**
 * 도움요청 피드 — 커서 페이지네이션.
 *
 * 1000명 기준 설계: 한 번에 읽는 문서 수를 요청 페이지 크기로 고정한다.
 *  - q(자유 텍스트): requests.searchText 전문 인덱스 + filterFields(status/category)
 *  - status/category: 각각 by_status / by_category 인덱스
 * 인덱스는 prefix 하나만 쓰므로 남은 조건은 페이지 안에서 걸러낸다.
 * 공개 피드에는 활성 회원의 요청만 노출하므로 작성자 상태도 페이지 내에서 확정한다
 * (페이지가 부분적으로 비어도 loadMore로 이어진다).
 */
export const list = query({
  args: {
    // optional: 구 번들(useQuery)은 paginationOpts 없이 호출한다 → 배열 반환
    paginationOpts: v.optional(paginationOptsValidator),
    status: v.optional(requestStatus),
    category: v.optional(v.string()),
    q: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, status, category, q }) => {
    const needle = q?.trim()
    const legacy = isLegacyList(paginationOpts)

    const buildBase = () => {
      if (needle) {
        return ctx.db.query('requests').withSearchIndex('search_text', (s) => {
          let b = s.search('searchText', needle)
          if (status) b = b.eq('status', status)
          if (category) b = b.eq('category', category)
          return b
        })
      }
      if (status) {
        return ctx.db
          .query('requests')
          .withIndex('by_status', (qq) => qq.eq('status', status))
          .order('desc')
      }
      if (category) {
        return ctx.db
          .query('requests')
          .withIndex('by_category', (qq) => qq.eq('category', category))
          .order('desc')
      }
      return ctx.db.query('requests').order('desc')
    }

    const refine = (page: Doc<'requests'>[]) => {
      let rows = page
      if (status && needle) rows = rows.filter((r) => r.status === status)
      if (category && !needle) rows = rows.filter((r) => r.category === category)
      return rows
    }

    const enrich = async (page: Doc<'requests'>[]) => {
      const withAuthors = await Promise.all(
        page.map(async (r) => ({ r, author: await ctx.db.get(r.authorId) })),
      )
      // 정지·미승인 작성자 글은 디렉토리와 동일하게 제외
      return withAuthors
        .filter(({ author }) => author?.status === 'active')
        .map(({ r, author }) => ({
          ...r,
          author: author
            ? {
                _id: author._id,
                name: author.name,
                company: author.company,
                cohort: author.cohort,
              }
            : null,
        }))
    }

    if (legacy) {
      const rows = refine(await buildBase().take(legacyTake()))
      return await enrich(rows)
    }

    const result = await buildBase().paginate(paginationOpts)
    return { ...result, page: await enrich(refine(result.page)) }
  },
})

export const get = query({
  args: { id: v.id('requests') },
  handler: async (ctx, { id }) => {
    const req = await ctx.db.get(id)
    if (!req) return null
    return await withAuthor(ctx, req)
  },
})

// 내가 올린 요청 (본인 소유 레코드 — 인덱스 조회 비용이 전체 회원 수와 무관)
export const mine = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await memberFromToken(ctx, token)
    if (!me) return []
    return await ctx.db
      .query('requests')
      .withIndex('by_author', (q) => q.eq('authorId', me._id))
      .order('desc')
      .collect()
  },
})

// 특정 회원이 올린 요청 (공개)
export const byAuthor = query({
  args: { memberId: v.id('members') },
  handler: async (ctx, { memberId }) => {
    return await ctx.db
      .query('requests')
      .withIndex('by_author', (q) => q.eq('authorId', memberId))
      .order('desc')
      .collect()
  },
})

export const create = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    body: v.string(),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
    region: v.optional(v.string()),
    urgency: v.optional(
      v.union(v.literal('low'), v.literal('normal'), v.literal('high')),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx, args.token)
    const title = args.title.trim()
    const body = args.body.trim()
    if (title.length < 2) throw new Error('제목을 입력해주세요.')
    if (body.length < 5) throw new Error('상세 내용을 5자 이상 입력해주세요.')
    const doc = {
      authorId: me._id,
      title,
      body,
      category: args.category,
      tags: normalizeTags(args.tags ?? []),
      region: args.region,
      urgency: args.urgency ?? 'normal',
      status: 'open' as const,
      createdAt: Date.now(),
    }
    const requestId = await ctx.db.insert('requests', {
      ...doc,
      searchText: buildRequestSearchText(doc),
    })
    const created = await ctx.db.get(requestId)
    if (created) await applyRequestDelta(ctx, null, created)
    return requestId
  },
})

// 요청 태그 자동완성 풀 — facetCounts 롤업의 빈도 상위 N개 (요청 수와 무관하게 고정 비용)
export const tagSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const tags = await topFacets(ctx, 'requestTag', TAG_SUGGESTIONS)
    return tags.map((t) => t.key)
  },
})

// 요청 수정 (작성자 또는 운영진, open 상태일 때만)
export const update = mutation({
  args: {
    token: v.string(),
    requestId: v.id('requests'),
    title: v.string(),
    body: v.string(),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
    region: v.optional(v.string()),
    urgency: v.optional(
      v.union(v.literal('low'), v.literal('normal'), v.literal('high')),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireMember(ctx, args.token)
    const req = await ctx.db.get(args.requestId)
    if (!req) throw new Error('요청을 찾을 수 없습니다.')
    if (req.authorId !== me._id && !me.isAdmin) {
      throw new Error('작성자 또는 운영진만 수정할 수 있습니다.')
    }
    if (req.status !== 'open') {
      throw new Error('접수 상태의 요청만 수정할 수 있습니다.')
    }
    const title = args.title.trim()
    const body = args.body.trim()
    if (title.length < 2) throw new Error('제목을 입력해주세요.')
    if (body.length < 5) throw new Error('상세 내용을 5자 이상 입력해주세요.')
    await ctx.db.patch(args.requestId, {
      title,
      body,
      category: args.category,
      tags: normalizeTags(args.tags ?? []),
      region: args.region,
      urgency: args.urgency ?? 'normal',
    })
    // 검색 텍스트 + 태그/분류 빈도 롤업을 최종 문서 기준으로 갱신
    await refreshRequestSearch(ctx, args.requestId)
    const after = await ctx.db.get(args.requestId)
    if (after) await applyRequestDelta(ctx, req, after)
    return args.requestId
  },
})

// 상태 변경 (작성자 또는 운영진)
export const setStatus = mutation({
  args: {
    token: v.string(),
    requestId: v.id('requests'),
    status: requestStatus,
  },
  handler: async (ctx, { token, requestId, status }) => {
    const me = await requireMember(ctx, token)
    const req = await ctx.db.get(requestId)
    if (!req) throw new Error('요청을 찾을 수 없습니다.')
    if (req.authorId !== me._id && !me.isAdmin) {
      throw new Error('작성자 또는 운영진만 상태를 변경할 수 있습니다.')
    }
    // 작성자(비운영진)는 open↔closed 토글만. 운영진이 설정한 매칭중/연결완료를
    // 임의로 되돌리거나 매칭 단계로 점프할 수 없다.
    if (!me.isAdmin) {
      const allowed = req.status === 'open' || req.status === 'closed'
      const target = status === 'open' || status === 'closed'
      if (!allowed || !target) {
        throw new Error("'매칭중'·'연결완료'는 운영진만 변경할 수 있습니다.")
      }
    }
    if (status === req.status) return null
    await ctx.db.patch(requestId, { status })
    const after = await ctx.db.get(requestId)
    if (after) await applyRequestDelta(ctx, req, after)
    return null
  },
})
