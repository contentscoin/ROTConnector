import { Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import {
  PlusCircle,
  Search,
  Briefcase,
  CalendarDays,
  Award,
  ChevronRight,
  UserPlus,
  GraduationCap,
  School,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { Badge, Card, Spinner } from '../components/ui'
import { RequestCard, MemberCard } from '../components/cards'
import { formatCohort, formatDate } from '../lib/format'
import { useSession } from '../lib/session'
import { profileCompleteness } from '../lib/profile'

const actions = [
  { to: '/requests/new', label: '도움요청 등록', icon: PlusCircle },
  { to: '/members', label: '회원 찾기', icon: Search },
  { to: '/me', label: '내 사업 소개', icon: Briefcase },
  { to: '/events', label: '행사·후원 보기', icon: CalendarDays },
]

export function HomePage() {
  const { token, member } = useSession()
  const requests = useQuery(api.requests.list, {})
  const leaders = useQuery(api.contributions.leaderboard, { limit: 5 })
  const events = useQuery(api.events.list, {})
  const recommended = useQuery(
    api.members.recommendForMember,
    token ? { token } : 'skip',
  )
  const facets = useQuery(api.members.facets, {})
  // 내 동기·동문 수 (본인 제외 active 기준)
  const peers = useQuery(api.members.peerCounts, token ? { token } : 'skip')

  const recent = requests
    ?.filter((r) => r.status === 'open' || r.status === 'matching')
    .slice(0, 4)
  const upcoming = events?.filter((e) => e.status === 'upcoming').slice(0, 2)
  const completeness = member ? profileCompleteness(member) : null

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-navy-800 to-navy-950 px-6 pt-7 pb-7 text-white shadow-soft">
        <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-gold-400 ring-1 ring-white/10">
            ROTC 비즈니스연합회
          </span>
          <h1 className="mt-3 text-[26px] leading-snug font-extrabold tracking-tight">
            선후배의 신뢰를
            <br />
            비즈니스 연결로.
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-navy-100/80">
            도움요청·사업소개·행사·후원·협업 기회를 한곳에.
          </p>
          {/* 커뮤니티 통계 한 줄 */}
          {facets && (
            <p className="mt-2 text-xs font-semibold text-gold-400/90">
              회원 {facets.total}명 · {facets.cohorts.length}개 기수 ·{' '}
              {facets.universities.length}개 학교
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {actions.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="press flex items-center gap-2.5 rounded-2xl bg-white/10 px-3.5 py-3 text-sm font-semibold ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-white/15"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4.5 text-gold-400" />
                </span>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 프로필 완성 넛지 (로그인·미완성 시) */}
      {completeness && completeness.percent < 100 && (
        <Link to="/me" className="press block">
          <Card className="flex items-center gap-3 p-4 hover:shadow-soft">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/20 text-gold-600">
              <UserPlus className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-navy-900">
                프로필을 완성해 주세요 · {completeness.percent}%
              </p>
              <p className="truncate text-xs text-navy-500">
                {completeness.missing
                  .slice(0, 3)
                  .map((f) => f.label)
                  .join(' · ')}{' '}
                추가하면 더 잘 연결됩니다
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-navy-300" />
          </Card>
        </Link>
      )}

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

      {/* 내 동기·동문 (로그인 + 기수/학교 입력 시) */}
      {member &&
        peers &&
        (peers.cohortCount > 0 || peers.universityCount > 0 ? (
          <section>
            <SectionHeader title="내 동기·동문" />
            <div className="grid grid-cols-2 gap-2.5">
              {peers.cohort && peers.cohortCount > 0 && (
                <Link
                  to={`/members?cohort=${encodeURIComponent(peers.cohort)}`}
                  className={`press block ${
                    peers.university && peers.universityCount > 0
                      ? ''
                      : 'col-span-2'
                  }`}
                >
                  <Card className="h-full p-4 hover:shadow-soft">
                    <div className="mb-1.5 flex size-9 items-center justify-center rounded-xl bg-navy-100 text-navy-700">
                      <GraduationCap className="size-5" />
                    </div>
                    <p className="text-lg font-extrabold text-navy-900">
                      {peers.cohortCount}명
                    </p>
                    <p className="text-xs font-medium text-navy-400">
                      {formatCohort(peers.cohort)} 동기
                    </p>
                  </Card>
                </Link>
              )}
              {peers.university && peers.universityCount > 0 && (
                <Link
                  to={`/members?university=${encodeURIComponent(peers.university)}`}
                  className={`press block ${
                    peers.cohort && peers.cohortCount > 0 ? '' : 'col-span-2'
                  }`}
                >
                  <Card className="h-full p-4 hover:shadow-soft">
                    <div className="mb-1.5 flex size-9 items-center justify-center rounded-xl bg-gold-400/20 text-gold-600">
                      <School className="size-5" />
                    </div>
                    <p className="text-lg font-extrabold text-navy-900">
                      {peers.universityCount}명
                    </p>
                    <p className="text-xs font-medium text-navy-400">
                      {peers.university} 동문
                    </p>
                  </Card>
                </Link>
              )}
            </div>
          </section>
        ) : !peers.cohort && !peers.university ? (
          // 기수·학교 미입력 넛지 (입력했는데 동기 0명이면 미표시)
          <section>
            <SectionHeader title="내 동기·동문" />
            <Link to="/me" className="press block">
              <Card className="flex items-center gap-3 p-4 hover:shadow-soft">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-700">
                  <GraduationCap className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-navy-900">동기·동문 찾기</p>
                  <p className="text-xs text-navy-500">
                    프로필에 기수·학교를 입력하면 동기·동문을 찾아드립니다
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-navy-300" />
              </Card>
            </Link>
          </section>
        ) : null)}

      {/* 추천 회원 (내 필요/업종 기반) */}
      {recommended && recommended.length > 0 && (
        <section>
          <SectionHeader title="추천 회원" to="/members" />
          <div className="space-y-2.5">
            {recommended.map((r) => (
              <div key={r.member._id} className="relative">
                {/* 동기/동문 매칭 뱃지 (recommendForMember 가중치 반영) */}
                {(r.cohortMatch || r.universityMatch) && (
                  <div className="absolute -top-2 right-3 z-10 flex gap-1">
                    {r.cohortMatch && (
                      <Badge className="bg-navy-800 text-white shadow-sm">
                        동기
                      </Badge>
                    )}
                    {r.universityMatch && (
                      <Badge className="bg-gold-400/90 text-navy-900 shadow-sm">
                        동문
                      </Badge>
                    )}
                  </div>
                )}
                <MemberCard member={r.member} />
              </div>
            ))}
          </div>
        </section>
      )}

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
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-navy-50"
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
              <Link key={e._id} to="/events" className="press block">
                <Card className="flex items-center gap-3 p-4 hover:shadow-soft">
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
