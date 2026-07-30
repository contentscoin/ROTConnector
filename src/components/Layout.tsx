import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  Home,
  Users,
  Handshake,
  ArrowLeftRight,
  UserRound,
  ShieldCheck,
  LogIn,
  Bell,
  Megaphone,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useSession } from '../lib/session'
import { cn } from '../lib/utils'
import { Avatar } from './ui'

type Tab = {
  to: string
  label: string
  icon: typeof Home
  adminOnly?: boolean
  memberOnly?: boolean
}

const tabs: Tab[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/members', label: '회원', icon: Users },
  { to: '/requests', label: '요청', icon: Handshake },
  { to: '/community', label: '커뮤니티', icon: Megaphone },
  { to: '/connections', label: '교류', icon: ArrowLeftRight, memberOnly: true },
  { to: '/me', label: '내 정보', icon: UserRound },
  { to: '/admin', label: '운영', icon: ShieldCheck, adminOnly: true },
]

export function Layout({ children }: { children: ReactNode }) {
  const { token, member, isAdmin } = useSession()
  const { pathname } = useLocation()
  const visibleTabs = tabs.filter(
    (t) => (!t.adminOnly || isAdmin) && (!t.memberOnly || member),
  )
  // 받은 교류 신청 대기 수 (교류 탭 뱃지)
  const pendingCount = useQuery(
    api.connections.pendingReceivedCount,
    token ? { token } : 'skip',
  )
  // 안 읽은 알림 수 (헤더 벨 뱃지)
  const unreadCount = useQuery(
    api.notifications.unreadCount,
    token ? { token } : 'skip',
  )

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-navy-50">
      {/* Skip to content (accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-navy-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문으로 건너뛰기
      </a>

      {/* Header */}
      <header className="glass sticky top-0 z-20 flex h-14 items-center justify-between border-b border-navy-100 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="알비연 링크 홈으로">
          <span className="flex size-7 items-center justify-center rounded-lg bg-navy-800 text-xs font-black text-gold-400">
            ROT
          </span>
          <span className="text-[15px] font-extrabold tracking-tight text-navy-900">
            알비연 링크
          </span>
        </Link>
        {member ? (
          <div className="flex items-center gap-1.5">
            <Link
              to="/notifications"
              aria-label="알림"
              className="relative flex size-9 items-center justify-center rounded-full text-navy-700 transition-colors hover:bg-navy-100"
            >
              <Bell className="size-[22px]" strokeWidth={2} />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount! > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link to="/me" className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy-700">
                {member.name}
              </span>
              <Avatar name={member.name} size="sm" />
            </Link>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 rounded-full bg-navy-100 px-3 py-1.5 text-sm font-semibold text-navy-700"
          >
            <LogIn className="size-4" />
            로그인
          </Link>
        )}
      </header>

      {/* Content */}
      <main id="main-content" className="flex-1 px-4 pt-4 pb-32">{children}</main>

      {/* Bottom Nav */}
      <nav
        className="glass safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[480px] items-stretch border-t border-navy-100 px-2 pt-1.5"
        aria-label="메인 내비게이션"
      >
        {visibleTabs.map(({ to, label, icon: Icon }) => {
          const active =
            to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              <span
                className={cn(
                  'relative flex items-center justify-center rounded-full px-4 py-0.5 transition-colors',
                  active ? 'bg-navy-100' : 'bg-transparent',
                )}
              >
                <Icon
                  className={cn(
                    'size-6 transition-colors',
                    active ? 'text-navy-800' : 'text-navy-500',
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                {to === '/connections' && (pendingCount ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 rounded-full bg-red-500 text-white text-[10px] min-w-4 h-4 px-1 flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'text-[11px] font-medium',
                  active ? 'text-navy-800' : 'text-navy-500',
                )}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
