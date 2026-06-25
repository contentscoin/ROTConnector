import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import {
  Bell,
  ArrowLeftRight,
  CheckCircle2,
  BadgeCheck,
  Handshake,
  Sparkles,
  Award,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useSession } from '../lib/session'
import { Button, Card, EmptyState, SkeletonList } from '../components/ui'
import { timeAgo } from '../lib/format'

// 알림 타입별 아이콘/색 (convex/notify.ts NotificationType과 1:1)
const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  'connection.request': {
    icon: ArrowLeftRight,
    tone: 'bg-navy-100 text-navy-700',
  },
  'connection.accepted': {
    icon: CheckCircle2,
    tone: 'bg-emerald-100 text-emerald-700',
  },
  'member.approved': {
    icon: BadgeCheck,
    tone: 'bg-gold-400/30 text-gold-600',
  },
  'request.matched': {
    icon: Handshake,
    tone: 'bg-navy-100 text-navy-700',
  },
  'request.connected': {
    icon: CheckCircle2,
    tone: 'bg-emerald-100 text-emerald-700',
  },
  'match.proposed': {
    icon: Sparkles,
    tone: 'bg-gold-400/30 text-gold-600',
  },
  'match.completed': {
    icon: Award,
    tone: 'bg-gold-400/30 text-gold-600',
  },
  'event.created': {
    icon: CalendarDays,
    tone: 'bg-navy-100 text-navy-700',
  },
}

type NotificationRow = {
  _id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: number
}

export function NotificationsPage() {
  const { token } = useSession()
  const navigate = useNavigate()
  const rows = useQuery(
    api.notifications.list,
    token ? { token } : 'skip',
  ) as NotificationRow[] | undefined
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)

  const hasUnread = (rows ?? []).some((n) => !n.read)

  const open = (n: NotificationRow) => {
    if (!n.read && token) {
      void markRead({
        token,
        notificationId: n._id as Id<'notifications'>,
      }).catch(() => {})
    }
    if (n.link) navigate(n.link)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy-900">알림</h1>
        {hasUnread && token && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markAllRead({ token }).catch(() => {})}
          >
            모두 읽음
          </Button>
        )}
      </div>

      {rows === undefined ? (
        <SkeletonList count={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-10" />}
          title="알림이 없습니다"
          description="교류 신청·수락, 가입 승인 소식이 여기에 표시됩니다."
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map((n) => {
            const meta = ICONS[n.type] ?? {
              icon: Bell,
              tone: 'bg-navy-100 text-navy-600',
            }
            const Icon = meta.icon
            return (
              <Card
                key={n._id}
                onClick={() => open(n)}
                className={`press flex cursor-pointer items-start gap-3 p-4 ${
                  n.read ? '' : 'ring-1 ring-navy-200'
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
                >
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p
                      className={`min-w-0 flex-1 text-sm ${
                        n.read
                          ? 'font-medium text-navy-700'
                          : 'font-bold text-navy-900'
                      }`}
                    >
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" />
                    )}
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-navy-500">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-navy-400">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
