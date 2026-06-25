import { useState } from 'react'
import { useQuery } from 'convex/react'
import { MessageSquare } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  SegmentedControl,
  SkeletonList,
  StatCard,
} from '../ui'
import {
  connectionStatusLabel,
  connectionStatusTone,
  formatCohort,
  timeAgo,
} from '../../lib/format'

// 운영진 교류 현황 — 중개 관찰용(phone 미노출). api.admin.connections 구독.
type StatusFilter = 'all' | 'pending' | 'accepted' | 'declined'

const filters: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'accepted', label: '연결됨' },
  { key: 'declined', label: '거절됨' },
]

export function AdminConnections({ token }: { token: string }) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const data = useAdminConnections(token, status)

  return (
    <div className="space-y-4">
      {/* 카운트 요약 */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="전체" value={data?.counts.total ?? '–'} />
        <StatCard label="대기" value={data?.counts.pending ?? '–'} />
        <StatCard label="연결됨" value={data?.counts.accepted ?? '–'} tone="emerald" />
        <StatCard label="거절됨" value={data?.counts.declined ?? '–'} />
      </div>

      {/* 상태 필터 */}
      <SegmentedControl
        value={status}
        onChange={setStatus}
        options={filters.map((f) => ({ value: f.key, label: f.label }))}
      />

      {data === undefined ? (
        <SkeletonList count={4} />
      ) : data.recent.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-10" />}
          title="교류 내역이 없습니다"
          description="해당 조건의 교류 신청이 아직 없습니다."
        />
      ) : (
        <div className="space-y-2.5">
          {data.recent.map((c) => (
            <Card key={c._id} className="space-y-3 p-4">
              {/* from → to 양측 */}
              <div className="flex items-center gap-2">
                <PersonMini person={c.from} />
                <span className="shrink-0 text-navy-300">→</span>
                <PersonMini person={c.to} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className={connectionStatusTone[c.status]}>
                  {connectionStatusLabel[c.status]}
                </Badge>
                {c.topic && (
                  <Badge className="bg-gold-400/20 text-gold-600">{c.topic}</Badge>
                )}
                <span className="ml-auto shrink-0 text-xs text-navy-400">
                  {timeAgo(c.createdAt)}
                </span>
              </div>

              {c.message && (
                <p className="line-clamp-2 rounded-lg bg-navy-50 px-3 py-2 text-sm whitespace-pre-wrap text-navy-700">
                  {c.message}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// 양측 회원 요약(이름 + 기수·학교 서브). phone 미노출.
function PersonMini({
  person,
}: {
  person: { name: string; cohort?: string; university?: string }
}) {
  const sub = [formatCohort(person.cohort), person.university]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Avatar name={person.name} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-navy-900">{person.name}</p>
        {sub && <p className="truncate text-xs text-navy-400">{sub}</p>}
      </div>
    </div>
  )
}

// useQuery 래퍼 — _generated 타입이 통합 전이라 응답 형태를 명시.
type AdminConnectionPerson = {
  _id: string
  name: string
  cohort?: string
  university?: string
}

type AdminConnectionItem = {
  _id: string
  status: 'pending' | 'accepted' | 'declined'
  topic?: string
  message?: string
  createdAt: number
  respondedAt?: number
  from: AdminConnectionPerson
  to: AdminConnectionPerson
}

type AdminConnectionsResult = {
  counts: { total: number; pending: number; accepted: number; declined: number }
  recent: AdminConnectionItem[]
}

function useAdminConnections(
  token: string,
  status: StatusFilter,
): AdminConnectionsResult | undefined {
  return useQuery(
    api.admin.connections,
    status === 'all' ? { token } : { token, status },
  ) as AdminConnectionsResult | undefined
}
