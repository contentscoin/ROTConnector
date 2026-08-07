import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePaginatedQuery } from 'convex/react'
import { Plus, Inbox, Search, X } from 'lucide-react'
import { paginatedApi } from '../lib/paginatedApi'
import {
  Chip,
  EmptyState,
  Input,
  LoadMore,
  PageHeader,
  SegmentedControl,
  SkeletonList,
} from '../components/ui'
import { RequestCard } from '../components/cards'
import { useSession } from '../lib/session'
import { useDebounce } from '../lib/useDebounce'

type StatusFilter = 'all' | 'open' | 'matching' | 'connected' | 'closed'

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'open', label: '접수' },
  { key: 'matching', label: '매칭중' },
  { key: 'connected', label: '연결완료' },
  { key: 'closed', label: '종료' },
]

const categories = [
  '투자',
  '영업',
  '채용',
  '법률',
  '세무/회계',
  '마케팅',
  '제휴',
  '해외',
  '부동산',
  '물류',
  '기타',
]

const urgencyRank: Record<string, number> = { high: 0, normal: 1, low: 2 }

// 한 번에 받아오는 요청 수 (커서 페이지네이션)
const PAGE_SIZE = 20

export function RequestsPage() {
  const { member } = useSession()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [sort, setSort] = useState<'recent' | 'urgent'>('recent')

  const debouncedQ = useDebounce(q, 300)

  // 1000명 기준: 피드는 커서 페이지네이션. 상태·분류·검색어가 바뀌면 첫 페이지부터 다시 받는다
  // (검색어는 300ms 디바운스 유지).
  const {
    results: requests,
    status: pageStatus,
    loadMore,
  } = usePaginatedQuery(
    paginatedApi.requestsList,
    {
      status: status === 'all' ? undefined : status,
      category: category || undefined,
      q: debouncedQ || undefined,
    },
    { initialNumItems: PAGE_SIZE },
  )

  // 서버는 createdAt desc 고정 → mine 필터 + 긴급도 정렬은 받아온 페이지 안에서.
  const visible = requests
    .filter((r) => !mineOnly || (member && r.authorId === member._id))
    .slice()
    .sort((a, b) =>
      sort === 'urgent'
        ? (urgencyRank[a.urgency] ?? 9) - (urgencyRank[b.urgency] ?? 9)
        : 0,
    )

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="회원 교류"
        title="도움요청"
        icon={<Inbox className="size-5" />}
      />

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-navy-400" />
        <Input
          className="pl-10"
          placeholder="제목, 내용, 태그 검색"
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

      {/* 상태 필터 */}
      <SegmentedControl
        value={status}
        onChange={setStatus}
        options={statusFilters.map((f) => ({ value: f.key, label: f.label }))}
      />

      {/* 카테고리 필터 */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={!category} onClick={() => setCategory(null)}>
          전체 분류
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c}
            active={category === c}
            onClick={() => setCategory(category === c ? null : c)}
          >
            {c}
          </Chip>
        ))}
      </div>

      {/* 내 요청 / 정렬 */}
      <div className="flex items-center justify-between">
        {member ? (
          <Chip active={mineOnly} onClick={() => setMineOnly((v) => !v)}>
            내 요청만
          </Chip>
        ) : (
          <span />
        )}
        <SegmentedControl
          className="w-auto"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: '최신순' },
            { value: 'urgent', label: '긴급순' },
          ]}
        />
      </div>

      {pageStatus === 'LoadingFirstPage' ? (
        <SkeletonList count={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-10" />}
          title="도움요청이 없습니다"
          description={
            mineOnly
              ? '아직 등록한 도움요청이 없습니다.'
              : '조건에 맞는 요청이 없습니다.'
          }
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((r) => (
            <RequestCard key={r._id} req={r} />
          ))}
        </div>
      )}

      <LoadMore status={pageStatus} onLoadMore={loadMore} pageSize={PAGE_SIZE} />

      {/* FAB (하단 중앙 고정) */}
      <Link
        to="/requests/new"
        className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy-800 px-5 py-3.5 font-bold text-white shadow-lg shadow-navy-900/25 active:bg-navy-950"
      >
        <Plus className="size-5" />
        도움요청 등록
      </Link>
    </div>
  )
}
