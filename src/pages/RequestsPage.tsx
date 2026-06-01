import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { Plus, Inbox } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { Chip, EmptyState, SkeletonList } from '../components/ui'
import { RequestCard } from '../components/cards'

type StatusFilter = 'all' | 'open' | 'matching' | 'connected'

const filters: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'open', label: '접수' },
  { key: 'matching', label: '매칭중' },
  { key: 'connected', label: '연결완료' },
]

export function RequestsPage() {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const requests = useQuery(
    api.requests.list,
    filter === 'all' ? {} : { status: filter },
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy-900">도움요청</h1>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {filters.map((f) => (
          <Chip
            key={f.key}
            active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      {requests === undefined ? (
        <SkeletonList count={5} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-10" />}
          title="도움요청이 없습니다"
          description="첫 도움요청을 등록해보세요."
        />
      ) : (
        <div className="space-y-2.5">
          {requests.map((r) => (
            <RequestCard key={r._id} req={r} />
          ))}
        </div>
      )}

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
