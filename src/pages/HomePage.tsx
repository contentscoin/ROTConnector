import { Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import {
  PlusCircle,
  Search,
  Briefcase,
  CalendarDays,
  Award,
  ChevronRight,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { Card, Spinner } from '../components/ui'
import { RequestCard } from '../components/cards'
import { formatDate } from '../lib/format'

const actions = [
  { to: '/requests/new', label: '도움요청 등록', icon: PlusCircle },
  { to: '/members', label: '회원 찾기', icon: Search },
  { to: '/me', label: '내 사업 소개', icon: Briefcase },
  { to: '/events', label: '행사·후원 보기', icon: CalendarDays },
]

export function HomePage() {
  const requests = useQuery(api.requests.list, {})
  const leaders = useQuery(api.contributions.leaderboard, { limit: 5 })
  const events = useQuery(api.events.list, {})

  const recent = requests
    ?.filter((r) => r.status === 'open' || r.status === 'matching')
    .slice(0, 4)
  const upcoming = events?.filter((e) => e.status === 'upcoming').slice(0, 2)

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="rounded-3xl bg-gradient-to-br from-navy-800 to-navy-950 p-6 text-white">
        <h1 className="text-2xl leading-snug font-extrabold tracking-tight">
          선후배의 신뢰를
          <br />
          비즈니스 연결로.
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-navy-100/80">
          알비연 링크는 ROTC 비즈니스연합회 회원의 도움요청·사업소개·행사·후원·협업
          기회를 한곳에 정리합니다.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {actions.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-3 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20"
            >
              <Icon className="size-4.5 text-gold-400" />
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* 최근 도움요청 */}
      <section>
        <SectionHeader title="최근 도움요청" to="/requests" />
        {recent === undefined ? (
          <CenterSpinner />
        ) : recent.length === 0 ? (
          <Card className="p-5 text-center text-sm text-navy-400">
            아직 등록된 도움요청이 없습니다.
          </Card>
        ) : (
          <div className="space-y-2.5">
            {recent.map((r) => (
              <RequestCard key={r._id} req={r} />
            ))}
          </div>
        )}
      </section>

      {/* 기여 랭킹 */}
      <section>
        <SectionHeader title="기여 랭킹" />
        <Card className="divide-y divide-navy-50 p-1">
          {leaders === undefined ? (
            <CenterSpinner />
          ) : (
            leaders.map((m, i) => (
              <Link
                key={m._id}
                to={`/members/${m._id}`}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                    i < 3
                      ? 'bg-gold-400/30 text-gold-600'
                      : 'bg-navy-50 text-navy-400'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-semibold text-navy-800">
                  {m.name}
                  {m.company && (
                    <span className="ml-1.5 text-xs font-normal text-navy-400">
                      {m.company}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-gold-600">
                  <Award className="size-3.5" />
                  {m.contributionScore}
                </span>
              </Link>
            ))
          )}
        </Card>
      </section>

      {/* 다가오는 행사 */}
      {upcoming && upcoming.length > 0 && (
        <section>
          <SectionHeader title="다가오는 행사·후원" to="/events" />
          <div className="space-y-2.5">
            {upcoming.map((e) => (
              <Link key={e._id} to="/events" className="block">
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-navy-800 text-white">
                    <CalendarDays className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy-900">{e.title}</p>
                    <p className="text-xs text-navy-400">
                      {[formatDate(e.date), e.place].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-navy-300" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-extrabold text-navy-900">{title}</h2>
      {to && (
        <Link
          to={to}
          className="flex items-center text-sm font-semibold text-navy-500"
        >
          전체보기
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  )
}

function CenterSpinner() {
  return (
    <div className="flex justify-center py-6">
      <Spinner />
    </div>
  )
}
