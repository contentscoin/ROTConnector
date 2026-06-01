import { Link } from 'react-router-dom'
import { MapPin, Clock, Award, ChevronRight } from 'lucide-react'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { Avatar, Badge, Card } from './ui'
import {
  requestStatusLabel,
  requestStatusTone,
  urgencyLabel,
  urgencyTone,
  timeAgo,
} from '../lib/format'

type Author = {
  _id: Id<'members'>
  name: string
  company?: string
  cohort?: string
} | null

export type RequestItem = Doc<'requests'> & { author: Author }

// 상태별 좌측 액센트 바 색상
const statusBar: Record<string, string> = {
  open: 'bg-navy-500',
  matching: 'bg-gold-500',
  connected: 'bg-emerald-500',
  closed: 'bg-navy-200',
}

export function RequestCard({ req }: { req: RequestItem }) {
  return (
    <Link to={`/requests/${req._id}`} className="press block">
      <Card className="relative overflow-hidden p-4 pl-5 hover:shadow-soft">
        <span
          className={`absolute inset-y-0 left-0 w-1.5 ${statusBar[req.status] ?? 'bg-navy-300'}`}
        />
        <div className="mb-1.5 flex items-center gap-2">
          <Badge className={requestStatusTone[req.status]}>
            {requestStatusLabel[req.status]}
          </Badge>
          <span className="text-xs font-medium text-navy-400">
            {req.category}
          </span>
          {req.urgency === 'high' && (
            <span className={`ml-auto text-xs font-bold ${urgencyTone.high}`}>
              ● {urgencyLabel.high}
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 leading-snug font-bold text-navy-900">
          {req.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-navy-500">{req.body}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-navy-400">
          <span className="font-medium text-navy-600">
            {req.author?.name ?? '알 수 없음'}
            {req.author?.company ? ` · ${req.author.company}` : ''}
          </span>
          {req.region && (
            <span className="flex items-center gap-0.5">
              <MapPin className="size-3" />
              {req.region}
            </span>
          )}
          <span className="ml-auto flex items-center gap-0.5">
            <Clock className="size-3" />
            {timeAgo(req.createdAt)}
          </span>
        </div>
      </Card>
    </Link>
  )
}

export function MemberCard({ member }: { member: Doc<'members'> }) {
  return (
    <Link to={`/members/${member._id}`} className="press block">
      <Card className="flex items-center gap-3.5 p-3.5 hover:shadow-soft">
        <Avatar name={member.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold text-navy-900">
              {member.name}
            </span>
            {member.cohort && (
              <span className="shrink-0 text-xs text-navy-400">
                {member.cohort}
              </span>
            )}
            {member.contributionScore > 0 && (
              <span className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full bg-gold-400/20 px-1.5 py-0.5 text-[11px] font-bold text-gold-600">
                <Award className="size-3" />
                {member.contributionScore}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-navy-500">
            {[member.title, member.company].filter(Boolean).join(' · ') ||
              '소개 미작성'}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {member.industry.slice(0, 3).map((i) => (
              <span
                key={i}
                className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-600"
              >
                {i}
              </span>
            ))}
            {member.region && (
              <span className="flex items-center gap-0.5 text-[11px] text-navy-400">
                <MapPin className="size-3" />
                {member.region}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-navy-300" />
      </Card>
    </Link>
  )
}
