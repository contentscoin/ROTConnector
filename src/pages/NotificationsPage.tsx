import { useState } from 'react'
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
import {
  enableWebPush,
  pushConfigured,
  pushPermissionGranted,
  pushSupported,
} from '../lib/push'

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
  const registerPush = useMutation(api.push.register)

  const hasUnread = (rows ?? []).some((n) => !n.read)

  // 웹 푸시: 설정·지원되고 아직 권한 허용 전일 때만 진입점 노출
  const [pushOn, setPushOn] = useState(() => pushPermissionGranted())
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const showPushBanner =
    pushConfigured && pushSupported() && !pushOn && !!token

  async function onEnablePush() {
    if (!token) return
    setPushBusy(true)
    setPushError(null)
    try {
      const fcmToken = await enableWebPush()
      if (!fcmToken) {
        setPushError('알림 권한이 거부되었거나 지원하지 않는 브라우저예요.')
        return
      }
      await registerPush({ token, fcmToken, platform: 'web' })
      setPushOn(true)
    } catch {
      setPushError('알림 설정 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setPushBusy(false)
    }
  }

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

      {/* 웹 푸시 켜기 (Firebase 설정·브라우저 지원·권한 미허용 시) */}
      {showPushBanner && (
        <Card className="flex items-center gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-700">
            <Bell className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-navy-900">
              브라우저 푸시 알림 켜기
            </p>
            <p className="text-xs text-navy-500">
              앱을 닫아도 교류·매칭·행사 소식을 받아보세요.
            </p>
            {pushError && (
              <p className="mt-1 text-xs text-red-600">{pushError}</p>
            )}
          </div>
          <Button size="sm" loading={pushBusy} onClick={onEnablePush}>
            켜기
          </Button>
        </Card>
      )}

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
