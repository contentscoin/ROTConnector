import { useState } from 'react'
import { useQuery } from 'convex/react'
import { History } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Avatar, Badge, Card, Chip, EmptyState, SkeletonList } from '../ui'
import { auditActionLabel, auditActionTone, timeAgo } from '../../lib/format'

// 운영진 감사 로그 — 회원 승인/상태변경/운영진 토글 등 운영 행위의 불변 기록.
// api.admin.auditLogs 구독. action 필터는 서버측 단일 액션 필터.
type ActionFilter =
  | 'all'
  | 'member.approve'
  | 'member.activate'
  | 'member.setPending'
  | 'member.suspend'
  | 'admin.grant'
  | 'admin.revoke'

const filters: { key: ActionFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'member.approve', label: '회원 승인' },
  { key: 'member.activate', label: '활성 전환' },
  { key: 'member.setPending', label: '대기 전환' },
  { key: 'member.suspend', label: '계정 정지' },
  { key: 'admin.grant', label: '운영진 지정' },
  { key: 'admin.revoke', label: '운영진 해제' },
]

export function AdminAudit({ token }: { token: string }) {
  const [action, setAction] = useState<ActionFilter>('all')
  const rows = useAuditLogs(token, action)

  return (
    <div className="space-y-4">
      {/* 액션 필터 칩 */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {filters.map((f) => (
          <Chip
            key={f.key}
            active={action === f.key}
            onClick={() => setAction(f.key)}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      {rows === undefined ? (
        <SkeletonList count={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<History className="size-10" />}
          title="기록이 없습니다"
          description="해당 조건의 운영 기록이 아직 없습니다."
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <Card key={r._id} className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Avatar name={r.actorName} size="sm" />
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-navy-900">
                  {r.actorName}
                </p>
                <span className="shrink-0 text-xs text-navy-400">
                  {timeAgo(r.createdAt)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-10">
                <Badge className={auditActionTone[r.action] ?? 'bg-navy-100 text-navy-600'}>
                  {auditActionLabel[r.action] ?? r.action}
                </Badge>
                {r.targetName && (
                  <span className="text-sm text-navy-700">
                    <span className="text-navy-300">→ </span>
                    {r.targetName}
                  </span>
                )}
              </div>
              {r.detail && (
                <p className="pl-10 text-xs text-navy-500">{r.detail}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// useQuery 래퍼 — 응답 형태를 명시(연락처 등 민감정보 미포함).
type AuditLogRow = {
  _id: string
  actorId: string
  actorName: string
  action: string
  targetId: string | null
  targetName: string | null
  detail: string | null
  createdAt: number
}

function useAuditLogs(
  token: string,
  action: ActionFilter,
): AuditLogRow[] | undefined {
  return useQuery(
    api.admin.auditLogs,
    action === 'all' ? { token } : { token, action },
  ) as AuditLogRow[] | undefined
}
