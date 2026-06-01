import { useState } from 'react'
import { useQuery } from 'convex/react'
import { CalendarDays, MapPin, Building2, HandCoins } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { Badge, Card, EmptyState, Spinner } from '../components/ui'
import { formatDate } from '../lib/format'

type Filter = 'all' | 'event' | 'sponsor'
const tabs: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'event', label: '행사' },
  { key: 'sponsor', label: '후원' },
]

export function EventsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const events = useQuery(
    api.events.list,
    filter === 'all' ? {} : { kind: filter },
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy-900">행사 · 후원</h1>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === t.key
                ? 'bg-navy-800 text-white'
                : 'bg-white text-navy-600 border border-navy-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
            <Card key={e._id} className="p-5">
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
                {e.status === 'upcoming' && (
                  <Badge className="bg-emerald-100 text-emerald-700">예정</Badge>
                )}
              </div>
              <h2 className="text-lg font-extrabold text-navy-900">{e.title}</h2>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
