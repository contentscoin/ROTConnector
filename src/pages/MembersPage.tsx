import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { Search, X, Users, UserRoundPen, ChevronRight } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { Chip, EmptyState, Input, SkeletonList } from '../components/ui'
import { MemberCard } from '../components/cards'
import { useSession } from '../lib/session'

export function MembersPage() {
  const { member } = useSession()
  const [q, setQ] = useState('')
  const [industry, setIndustry] = useState<string | null>(null)
  const [region, setRegion] = useState<string | null>(null)

  const facets = useQuery(api.members.facets, {})
  const members = useQuery(api.members.list, {
    q: q || undefined,
    industry: industry || undefined,
    region: region || undefined,
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">회원 찾기</h1>
        <p className="text-sm text-navy-400">
          {facets ? `총 ${facets.total}명` : ' '}
        </p>
      </div>

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

      {/* 목록 */}
      {members === undefined ? (
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
    </div>
  )
}
