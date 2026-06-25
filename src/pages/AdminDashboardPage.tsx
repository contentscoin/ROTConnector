import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useSession } from '../lib/session'
import { Chip, LoadingScreen } from '../components/ui'
import { AdminOverview } from '../components/admin/AdminOverview'
import { AdminMembers } from '../components/admin/AdminMembers'
import { AdminConnections } from '../components/admin/AdminConnections'
import { AdminAnalytics } from '../components/admin/AdminAnalytics'
import { AdminAudit } from '../components/admin/AdminAudit'

type Tab = 'overview' | 'members' | 'connections' | 'analytics' | 'audit'

const tabs: { key: Tab; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'members', label: '회원' },
  { key: 'connections', label: '교류' },
  { key: 'analytics', label: '통계' },
  { key: 'audit', label: '기록' },
]

export function AdminDashboardPage() {
  const { token } = useSession()
  const [tab, setTab] = useState<Tab>('overview')
  // 셸은 대시보드를 구독해 '회원' 탭에 승인 대기 카운트 뱃지를 노출
  const data = useQuery(api.admin.dashboard, token ? { token } : 'skip')

  if (!token) return <LoadingScreen />

  const pendingMembers = data?.stats.pendingMembers ?? 0

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-navy-900">운영진 콘솔</h1>

      {/* 세그먼트 탭 */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map((t) => (
          <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            <span className="inline-flex items-center gap-1.5">
              {t.label}
              {t.key === 'members' && pendingMembers > 0 && (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
                  {pendingMembers}
                </span>
              )}
            </span>
          </Chip>
        ))}
      </div>

      {/* 활성 탭만 마운트 */}
      {tab === 'overview' && <AdminOverview token={token} />}
      {tab === 'members' && <AdminMembers token={token} />}
      {tab === 'connections' && <AdminConnections token={token} />}
      {tab === 'analytics' && <AdminAnalytics token={token} />}
      {tab === 'audit' && <AdminAudit token={token} />}
    </div>
  )
}
