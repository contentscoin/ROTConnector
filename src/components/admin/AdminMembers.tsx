import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import {
  Search,
  X,
  Users,
  Phone,
  Gauge,
  Award,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Badge, Button, Card, Chip, EmptyState, Input, SkeletonList } from '../ui'
import { formatCohort } from '../../lib/format'
import { profileCompleteness } from '../../lib/profile'
import { errorMessage } from '../../lib/utils'

// 상태 필터 칩 (전체 = undefined)
const STATUS_FILTERS = [
  { key: undefined, label: '전체' },
  { key: 'active', label: '활성' },
  { key: 'pending', label: '대기' },
  { key: 'suspended', label: '비활성' },
] as const

// 상태별 뱃지 라벨·톤
const statusBadge: Record<string, { label: string; tone: string }> = {
  active: { label: '활성', tone: 'bg-emerald-100 text-emerald-700' },
  pending: { label: '대기', tone: 'bg-gold-400/30 text-gold-600' },
  suspended: { label: '비활성', tone: 'bg-navy-100 text-navy-400' },
}

export function AdminMembers({ token }: { token: string }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string | undefined>(undefined)

  const members = useQuery(api.admin.members, {
    token,
    q: q.trim() || undefined,
    status,
  })

  const setStatusMut = useMutation(api.members.setStatus)
  const setAdminMut = useMutation(api.members.setAdmin)

  // 버튼별 처리 상태(memberId:action) — 같은 행의 다른 버튼끼리 독립 로딩
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSetStatus(
    memberId: Id<'members'>,
    next: 'active' | 'suspended',
  ) {
    setError(null)
    setBusyKey(`${memberId}:status`)
    try {
      await setStatusMut({ token, memberId, status: next })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyKey(null)
    }
  }

  async function onToggleAdmin(memberId: Id<'members'>, isAdmin: boolean) {
    setError(null)
    setBusyKey(`${memberId}:admin`)
    try {
      // 현재값 반전 — 본인 권한 회수는 서버가 throw하므로 에러 박스로 노출
      await setAdminMut({ token, memberId, isAdmin: !isAdmin })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* 검색 */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-navy-400" />
        <Input
          className="pl-10"
          placeholder="이름, 회사, 전화, 기수, 학교 검색"
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
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.label}
            active={status === f.key}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      {/* 공통 에러 박스 */}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 목록 */}
      {members === undefined ? (
        <SkeletonList count={6} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users className="size-10" />}
          title="회원이 없습니다"
          description="다른 키워드나 상태 필터로 다시 찾아보세요."
        />
      ) : (
        <>
          <p className="text-sm font-medium text-navy-400">
            {members.length}명
          </p>
          <div className="space-y-2.5">
            {members.map((m) => (
              <MemberRow
                key={m._id}
                member={m}
                busyKey={busyKey}
                onSetStatus={onSetStatus}
                onToggleAdmin={onToggleAdmin}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 운영진 회원 목록 항목 타입 (api.admin.members 반환 — phone 포함)
type AdminMember = FunctionReturnType<typeof api.admin.members>[number]

function MemberRow({
  member: m,
  busyKey,
  onSetStatus,
  onToggleAdmin,
}: {
  member: AdminMember
  busyKey: string | null
  onSetStatus: (id: Id<'members'>, next: 'active' | 'suspended') => void
  onToggleAdmin: (id: Id<'members'>, isAdmin: boolean) => void
}) {
  const badge = statusBadge[m.status] ?? statusBadge.pending
  const subline = [formatCohort(m.cohort), m.university, m.company]
    .filter(Boolean)
    .join(' · ')
  const completeness = profileCompleteness(m)

  // 상태 변경 버튼: pending→승인(active), active→비활성화(suspended), suspended→활성화(active)
  const statusAction =
    m.status === 'pending'
      ? { label: '승인', next: 'active' as const }
      : m.status === 'active'
        ? { label: '비활성화', next: 'suspended' as const }
        : { label: '활성화', next: 'active' as const }

  return (
    <Card className="p-4 lift hover:border-navy-200 hover:shadow-soft">
      {/* 헤더: 이름 + 상태/운영진 뱃지 */}
      <div className="flex items-center gap-2">
        <span className="truncate font-bold text-navy-900">{m.name}</span>
        <Badge className={badge.tone}>{badge.label}</Badge>
        {m.isAdmin && (
          <Badge className="bg-navy-800 text-white">운영진</Badge>
        )}
      </div>

      {/* 서브라인 */}
      {subline && (
        <p className="mt-1 truncate text-sm text-navy-500">{subline}</p>
      )}

      {/* 메타: 전화 · 완성률 · 기여 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-400">
        {m.phone && (
          <span className="flex items-center gap-1">
            <Phone className="size-3" />
            {m.phone}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Gauge className="size-3" />
          완성률 {completeness.percent}%
        </span>
        <span className="flex items-center gap-1">
          <Award className="size-3" />
          기여 {m.contributionScore}
        </span>
      </div>

      {/* 액션 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link to={`/members/${m._id}`}>
          <Button variant="secondary" size="sm">
            <ExternalLink className="size-3.5" />
            프로필 보기
          </Button>
        </Link>
        <Button
          variant="primary"
          size="sm"
          loading={busyKey === `${m._id}:status`}
          disabled={busyKey !== null}
          onClick={() => onSetStatus(m._id, statusAction.next)}
        >
          {statusAction.label}
        </Button>
        <Button
          variant={m.isAdmin ? 'ghost' : 'secondary'}
          size="sm"
          loading={busyKey === `${m._id}:admin`}
          disabled={busyKey !== null}
          onClick={() => onToggleAdmin(m._id, m.isAdmin)}
        >
          <ShieldCheck className="size-3.5" />
          {m.isAdmin ? '운영진 해제' : '운영진 지정'}
        </Button>
      </div>
    </Card>
  )
}
