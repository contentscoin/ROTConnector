import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import {
  CalendarDays,
  MapPin,
  Building2,
  HandCoins,
  Plus,
  Check,
  Undo2,
  Star,
  Users,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  Badge,
  Button,
  Card,
  Disclosure,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  ShareButton,
  Spinner,
  Textarea,
} from '../components/ui'
import { formatDate } from '../lib/format'
import { useSession } from '../lib/session'
import { errorMessage } from '../lib/utils'

type Filter = 'all' | 'event' | 'sponsor'
const tabs: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'event', label: '행사' },
  { key: 'sponsor', label: '후원' },
]

const emptyForm = {
  title: '',
  kind: 'event' as 'event' | 'sponsor',
  date: '',
  place: '',
  host: '',
  body: '',
}

export function EventsPage() {
  const { token, member, isAdmin } = useSession()
  const [filter, setFilter] = useState<Filter>('all')
  const events = useQuery(api.events.list, {
    ...(filter === 'all' ? {} : { kind: filter }),
    ...(token ? { token } : {}),
  })
  const createEvent = useMutation(api.events.create)
  const setEventStatus = useMutation(api.events.setStatus)
  const rsvpEvent = useMutation(api.events.rsvp)
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  async function onToggle(id: Id<'events'>, status: 'upcoming' | 'done') {
    if (!token) return
    setActionError(null)
    setActionBusy(true)
    try {
      await setEventStatus({ token, id, status })
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setBusy(true)
    try {
      await createEvent({
        token,
        title: form.title.trim(),
        kind: form.kind,
        body: form.body.trim(),
        date: form.date || undefined,
        place: form.place.trim() || undefined,
        host: form.host.trim() || undefined,
      })
      setForm(emptyForm)
      setShowForm(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onRsvp(
    id: Id<'events'>,
    current: 'going' | 'interested' | null,
    next: 'going' | 'interested',
  ) {
    if (!token) return
    setActionError(null)
    setRsvpBusy(id)
    try {
      // 같은 항목 재클릭 시 해제(none)
      await rsvpEvent({
        token,
        eventId: id,
        status: current === next ? 'none' : next,
      })
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setRsvpBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="ROTC"
        title="행사 · 후원"
        icon={<CalendarDays className="size-5" />}
      />

      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {actionError}
        </p>
      )}

      {/* 운영진: 행사/후원 등록 */}
      {isAdmin && (
        <Disclosure
          title="행사 · 후원 등록"
          icon={<Plus className="size-4" />}
          open={showForm}
          onToggle={setShowForm}
        >
          <form onSubmit={onCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="제목" required>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </Field>
                <Field label="종류">
                  <Select
                    value={form.kind}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        kind: e.target.value as 'event' | 'sponsor',
                      })
                    }
                  >
                    <option value="event">행사</option>
                    <option value="sponsor">후원</option>
                  </Select>
                </Field>
                <Field label="일자">
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </Field>
                <Field label="장소">
                  <Input
                    value={form.place}
                    onChange={(e) => setForm({ ...form, place: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="주관">
                <Input
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                />
              </Field>
              <Field label="내용">
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </Field>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                loading={busy}
                disabled={!form.title.trim()}
              >
                등록
              </Button>
          </form>
        </Disclosure>
      )}

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={tabs.map((t) => ({ value: t.key, label: t.label }))}
      />

      {events === undefined ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-10" />}
          title="등록된 행사가 없습니다"
        />
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <Card
              key={e._id}
              className="p-5 lift hover:border-navy-200 hover:shadow-soft"
            >
              <div className="mb-2 flex items-center gap-2">
                <Badge
                  className={
                    e.kind === 'sponsor'
                      ? 'bg-gold-400/30 text-gold-600'
                      : 'bg-navy-100 text-navy-700'
                  }
                >
                  {e.kind === 'sponsor' ? (
                    <HandCoins className="mr-1 size-3" />
                  ) : (
                    <CalendarDays className="mr-1 size-3" />
                  )}
                  {e.kind === 'sponsor' ? '후원' : '행사'}
                </Badge>
                {e.status === 'upcoming' ? (
                  <Badge className="bg-emerald-100 text-emerald-700">예정</Badge>
                ) : (
                  <Badge className="bg-navy-100 text-navy-400">종료</Badge>
                )}
                <ShareButton
                  title={`${e.title} · 알비연 링크`}
                  text={`[${e.kind === 'sponsor' ? '후원' : '행사'}] ${e.title}`}
                  label=""
                  className="ml-auto h-8 px-2"
                />
              </div>
              <Link to={`/events/${e._id}`} className="press block">
                <h2 className="text-lg font-extrabold text-navy-900 hover:underline">
                  {e.title}
                </h2>
              </Link>
              <p className="mt-1.5 leading-relaxed whitespace-pre-wrap text-sm text-navy-600">
                {e.body}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-navy-50 pt-3 text-xs text-navy-400">
                {e.date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {formatDate(e.date)}
                  </span>
                )}
                {e.place && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {e.place}
                  </span>
                )}
                {e.host && (
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3.5" />
                    {e.host}
                  </span>
                )}
              </div>

              {/* 참석/관심 RSVP */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {e.status === 'upcoming' && member?.status === 'active' ? (
                  <>
                    <button
                      onClick={() => onRsvp(e._id, e.myRsvp, 'going')}
                      disabled={rsvpBusy === e._id}
                      className={`press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        e.myRsvp === 'going'
                          ? 'bg-navy-800 text-white'
                          : 'border border-navy-200 bg-white text-navy-600'
                      }`}
                    >
                      <Check className="size-4" /> 참석 {e.goingCount}
                    </button>
                    <button
                      onClick={() => onRsvp(e._id, e.myRsvp, 'interested')}
                      disabled={rsvpBusy === e._id}
                      className={`press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        e.myRsvp === 'interested'
                          ? 'bg-gold-500 text-white'
                          : 'border border-navy-200 bg-white text-navy-600'
                      }`}
                    >
                      <Star className="size-4" /> 관심 {e.interestedCount}
                    </button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-navy-400">
                    <Users className="size-3.5" />
                    참석 {e.goingCount} · 관심 {e.interestedCount}
                  </span>
                )}
              </div>

              {isAdmin && token && (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={actionBusy}
                    onClick={() =>
                      onToggle(
                        e._id,
                        e.status === 'upcoming' ? 'done' : 'upcoming',
                      )
                    }
                  >
                    {e.status === 'upcoming' ? (
                      <>
                        <Check className="size-4" />
                        종료 처리
                      </>
                    ) : (
                      <>
                        <Undo2 className="size-4" />
                        예정으로
                      </>
                    )}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
