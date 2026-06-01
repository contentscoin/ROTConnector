import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  Home,
  Users,
  Handshake,
  UserRound,
  ShieldCheck,
  LogIn,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useSession } from '../lib/session'
import { cn } from '../lib/utils'
import { Avatar } from './ui'

type Tab = {
  to: string
  label: string
  icon: typeof Home
  adminOnly?: boolean
}

const tabs: Tab[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/members', label: '회원', icon: Users },
  { to: '/requests', label: '요청', icon: Handshake },
  { to: '/me', label: '내 정보', icon: UserRound },
  { to: '/admin', label: '운영', icon: ShieldCheck, adminOnly: true },
]

export function Layout({ children }: { children: ReactNode }) {
  const { member, isAdmin } = useSession()
  const { pathname } = useLocation()
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin)

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-navy-50">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-navy-100 bg-white/90 px-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-navy-800 text-xs font-black text-gold-400">
            ROT
          </span>
          <span className="text-[15px] font-extrabold tracking-tight text-navy-900">
            알비연 링크
          </span>
        </Link>
        {member ? (
          <Link to="/me" className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy-700">
              {member.name}
            </span>
            <Avatar name={member.name} size="sm" />
          </Link>
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
      <main className="flex-1 px-4 pt-4 pb-32">{children}</main>

      {/* Bottom Nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[480px] items-stretch border-t border-navy-100 bg-white/95 px-2 pt-1.5 backdrop-blur">
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
                  'flex items-center justify-center rounded-full px-4 py-0.5 transition-colors',
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
