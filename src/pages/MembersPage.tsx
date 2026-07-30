import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePaginatedQuery, useQuery } from 'convex/react'
import { Search, X, Users, UserRoundPen, ChevronRight } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import {
  Chip,
  EmptyState,
  Input,
  LoadMore,
  PageHeader,
  SkeletonList,
} from '../components/ui'
import { MemberCard } from '../components/cards'
import { formatCohort } from '../lib/format'
import { useSession } from '../lib/session'
import { useDebounce } from '../lib/useDebounce'

// 한 번에 받아오는 회원 수. 1000명 규모에서도 첫 화면 응답을 일정하게 유지한다.
const PAGE_SIZE = 20

export function MembersPage() {
  const { member } = useSession()
  // 기수·학교 필터는 URL 쿼리(?cohort=&university=)와 양방향 동기화 —
  // 홈 동기·동문 카드 딥링크 진입, 해제·새로고침·공유 모두 일관되게 동작
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const cohort = searchParams.get('cohort')
  const university = searchParams.get('university')
  const setUrlFilter = (key: 'cohort' | 'university', value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }
  const setCohort = (value: string | null) => setUrlFilter('cohort', value)
  const setUniversity = (value: string | null) =>
    setUrlFilter('university', value)
  const [industry, setIndustry] = useState<string | null>(null)
  const [region, setRegion] = useState<string | null>(null)
  const [helpOffer, setHelpOffer] = useState<string | null>(null)

  const debouncedQ = useDebounce(q, 300)

  const facets = useQuery(api.members.facets, {})
  // 1000명 기준: 디렉토리는 커서 페이지네이션으로 PAGE_SIZE명씩 받는다.
  // 검색어·필터가 바뀌면 인자가 바뀌어 usePaginatedQuery가 첫 페이지부터 다시 받는다
  // (300ms 디바운스는 그대로 유지 — 타이핑 중 매 글자마다 새 페이지를 받지 않는다).
  const {
    results: members,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.members.list,
    {
      q: debouncedQ || undefined,
      cohort: cohort || undefined,
      university: university || undefined,
      industry: industry || undefined,
      region: region || undefined,
      helpOffer: helpOffer || undefined,
    },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="디렉토리"
        title="회원 찾기"
        subtitle={facets ? `총 ${facets.total}명` : ' '}
        icon={<Users className="size-5" />}
      />

      {member && (
        <Link to="/me" className="press block">
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-navy-800 to-navy-700 px-4 py-3 text-white shadow-card">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <UserRoundPen className="size-4.5 text-gold-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">내 사업 소개 업데이트</p>
              <p className="truncate text-xs text-navy-100/75">
                프로필이 완성될수록 더 잘 연결됩니다
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-white/60" />
          </div>
        </Link>
      )}

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-navy-400" />
        <Input
          className="pl-10"
          placeholder="이름, 회사, 업종, 도움 키워드 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-400"
            aria-label="검색어 지우기"
          >
            <X className="size-4.5" />
          </button>
        )}
      </div>

      {/* 로그인 회원 퀵 칩 — 내 동기·동문 바로 찾기 */}
      {member && (member.cohort || member.university) && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {member.cohort && (
            <Chip
              active={cohort === member.cohort}
              onClick={() =>
                setCohort(
                  cohort === member.cohort ? null : (member.cohort ?? null),
                )
              }
            >
              내 동기 ({formatCohort(member.cohort)})
            </Chip>
          )}
          {member.university && (
            <Chip
              active={university === member.university}
              onClick={() =>
                setUniversity(
                  university === member.university
                    ? null
                    : (member.university ?? null),
                )
              }
            >
              {member.university} 동문
            </Chip>
          )}
        </div>
      )}

      {/* 기수 필터 */}
      {facets && facets.cohorts.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={!cohort} onClick={() => setCohort(null)}>
            전체 기수
          </Chip>
          {facets.cohorts.map((c) => (
            <Chip
              key={c}
              active={cohort === c}
              onClick={() => setCohort(cohort === c ? null : c)}
            >
              {formatCohort(c)}
            </Chip>
          ))}
        </div>
      )}

      {/* 학교 필터 */}
      {facets && facets.universities.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={!university} onClick={() => setUniversity(null)}>
            전체 학교
          </Chip>
          {facets.universities.map((u) => (
            <Chip
              key={u}
              active={university === u}
              onClick={() => setUniversity(university === u ? null : u)}
            >
              {u}
            </Chip>
          ))}
        </div>
      )}

      {/* 업종 필터 */}
      {facets && facets.industries.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={!industry} onClick={() => setIndustry(null)}>
            전체 업종
          </Chip>
          {facets.industries.map((i) => (
            <Chip
              key={i}
              active={industry === i}
              onClick={() => setIndustry(industry === i ? null : i)}
            >
              {i}
            </Chip>
          ))}
        </div>
      )}

      {/* 지역 필터 */}
      {facets && facets.regions.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={!region} onClick={() => setRegion(null)}>
            전체 지역
          </Chip>
          {facets.regions.map((r) => (
            <Chip
              key={r}
              active={region === r}
              onClick={() => setRegion(region === r ? null : r)}
            >
              {r}
            </Chip>
          ))}
        </div>
      )}

      {/* 도움분야 필터 ('누가 어떤 도움을 줄 수 있는가' — 핵심 가치제안) */}
      {facets && facets.helpOffers.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={!helpOffer} onClick={() => setHelpOffer(null)}>
            전체 도움분야
          </Chip>
          {facets.helpOffers.map((h) => (
            <Chip
              key={h}
              active={helpOffer === h}
              onClick={() => setHelpOffer(helpOffer === h ? null : h)}
            >
              {h}
            </Chip>
          ))}
        </div>
      )}

      {/* 목록 */}
      {status === 'LoadingFirstPage' ? (
        <SkeletonList count={6} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users className="size-10" />}
          title="검색 결과가 없습니다"
          description="다른 키워드나 필터로 다시 찾아보세요."
        />
      ) : (
        <div className="space-y-2.5">
          {members.map((m) => (
            <MemberCard key={m._id} member={m} />
          ))}
        </div>
      )}
      <LoadMore status={status} onLoadMore={loadMore} pageSize={PAGE_SIZE} />
    </div>
  )
}
