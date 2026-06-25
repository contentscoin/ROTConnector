import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import {
  ChevronLeft,
  CalendarDays,
  MapPin,
  Building2,
  HandCoins,
  Check,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useSession } from '../lib/session'
import {
  Avatar,
  Badge,
  Card,
  LoadingScreen,
  SectionHeader,
  ShareButton,
} from '../components/ui'
import { formatCohort, formatDate } from '../lib/format'
import { errorMessage } from '../lib/utils'

type Attendee = {
  _id: string
  name: string
  company?: string
  cohort?: string
  university?: string
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const eventId = id as Id<'events'>
  const { token, member } = useSession()
  const event = useQuery(
    api.events.get,
    token ? { id: eventId, token } : { id: eventId },
  )
  const rsvpEvent = useMutation(api.events.rsvp)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (event === undefined) return <LoadingScreen />
  if (event === null)
    return (
      <div className="py-10 text-center text-navy-400">
        행사를 찾을 수 없습니다.
        <div className="mt-3">
          <Link to="/events" className="font-semibold text-navy-700 underline">
            행사 목록으로
          </Link>
        </div>
      </div>
    )

  const isSponsor = event.kind === 'sponsor'
  const canRsvp = event.status === 'upcoming' && member?.status === 'active'

  async function onRsvp(next: 'going' | 'interested') {
    if (!token || event === null || event === undefined) return
    setError(null)
    setBusy(true)
    try {
      await rsvpEvent({
        token,
        eventId,
        status: event.myRsvp === next ? 'none' : next,
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Link
        to="/events"
        className="inline-flex items-center gap-1 text-sm font-semibold text-navy-500"
      >
        <ChevronLeft className="size-4" />
        행사 · 후원
      </Link>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={
              isSponsor
                ? 'bg-gold-400/30 text-gold-600'
                : 'bg-navy-100 text-navy-700'
            }
          >
            {isSponsor ? (
              <HandCoins className="mr-1 size-3" />
            ) : (
              <CalendarDays className="mr-1 size-3" />
            )}
            {isSponsor ? '후원' : '행사'}
          </Badge>
          {event.status === 'upcoming' ? (
            <Badge className="bg-emerald-100 text-emerald-700">예정</Badge>
          ) : (
            <Badge className="bg-navy-100 text-navy-400">종료</Badge>
          )}
          <ShareButton
            title={`${event.title} · 알비연 링크`}
            text={`[${isSponsor ? '후원' : '행사'}] ${event.title}`}
            label=""
            className="ml-auto h-8 px-2"
          />
        </div>

        <h1 className="text-xl font-extrabold text-navy-900">{event.title}</h1>
        <p className="leading-relaxed whitespace-pre-wrap text-[15px] text-navy-700">
          {event.body}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-navy-50 pt-3 text-sm text-navy-500">
          {event.date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatDate(event.date)}
            </span>
          )}
          {event.place && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {event.place}
            </span>
          )}
          {event.host && (
            <span className="flex items-center gap-1.5">
              <Building2 className="size-4" />
              {event.host}
            </span>
          )}
        </div>

        {/* 참석/관심 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-navy-50 pt-4">
          {canRsvp ? (
            <>
              <button
                onClick={() => onRsvp('going')}
                disabled={busy}
                className={`press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  event.myRsvp === 'going'
                    ? 'bg-navy-800 text-white'
                    : 'border border-navy-200 bg-white text-navy-600'
                }`}
              >
                <Check className="size-4" /> 참석 {event.goingCount}
              </button>
              <button
                onClick={() => onRsvp('interested')}
                disabled={busy}
                className={`press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  event.myRsvp === 'interested'
                    ? 'bg-gold-500 text-white'
                    : 'border border-navy-200 bg-white text-navy-600'
                }`}
              >
                <Star className="size-4" /> 관심 {event.interestedCount}
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-navy-400">
              <Users className="size-4" />
              참석 {event.goingCount} · 관심 {event.interestedCount}
            </span>
          )}
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </Card>

      <AttendeeGroup title="참석" icon={Check} people={event.going} />
      <AttendeeGroup title="관심" icon={Star} people={event.interested} />
    </div>
  )
}

// 참석/관심 회원 명단 (연락처 미노출, 탭하면 회원 상세로)
function AttendeeGroup({
  title,
  icon: Icon,
  people,
}: {
  title: string
  icon: LucideIcon
  people: Attendee[]
}) {
  if (people.length === 0) return null
  return (
    <section>
      <SectionHeader
        title={`${title} ${people.length}`}
        icon={<Icon className="size-4" />}
      />
      <div className="space-y-2">
        {people.map((p) => {
          const sub = [formatCohort(p.cohort), p.company || p.university]
            .filter(Boolean)
            .join(' · ')
          return (
            <Link key={p._id} to={`/members/${p._id}`} className="press block">
              <Card className="flex items-center gap-3 p-3 lift hover:border-navy-200 hover:shadow-soft">
                <Avatar name={p.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy-900">
                    {p.name}
                  </p>
                  {sub && (
                    <p className="truncate text-xs text-navy-400">{sub}</p>
                  )}
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
