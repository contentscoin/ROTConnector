import { Link } from 'react-router-dom'
import { MapPin, Clock, Award, ChevronRight, Check } from 'lucide-react'
import type { FunctionReturnType } from 'convex/server'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { Avatar, Badge, Card } from './ui'
import {
  requestStatusLabel,
  requestStatusTone,
  urgencyLabel,
  urgencyTone,
  timeAgo,
  formatCohort,
} from '../lib/format'
import { cn } from '../lib/utils'

// 공개 디렉토리 projection 타입 (phone 등 비공개 필드 제외).
// members.list는 레거시(배열) / 페이지네이션 유니온 — page 항목 타입을 쓴다.
type MembersListResult = FunctionReturnType<typeof api.members.list>
type PaginatedMembers = Extract<MembersListResult, { page: unknown }>
export type PublicMember = PaginatedMembers['page'][number]

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
      <Card className="lift relative overflow-hidden p-4 pl-5 hover:border-navy-200 hover:shadow-soft">
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

export function MemberCard({ member }: { member: PublicMember }) {
  // 기수·출신 학교 뱃지 (예: "37기 · 한양대", 둘 다 없으면 미표시)
  const cohortLine = [formatCohort(member.cohort), member.university]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link to={`/members/${member._id}`} className="press block">
      <Card className="lift flex items-center gap-3.5 p-3.5 hover:border-navy-200 hover:shadow-soft">
        <Avatar name={member.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold text-navy-900">
              {member.name}
            </span>
            {cohortLine && (
              <span className="shrink-0 text-xs text-navy-400">
                {cohortLine}
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

// 요청 라이프사이클 진행 스테퍼 (접수 → 매칭중 → 연결완료). closed는 별도 표기.
const STEPPER = [
  { key: 'open', label: '접수' },
  { key: 'matching', label: '매칭중' },
  { key: 'connected', label: '연결완료' },
] as const

export function RequestStepper({ status }: { status: Doc<'requests'>['status'] }) {
  if (status === 'closed') {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-navy-100 px-4 py-2.5 text-sm font-semibold text-navy-500">
        <span className="size-2 rounded-full bg-navy-400" />
        종료된 요청입니다
      </div>
    )
  }
  const current = STEPPER.findIndex((s) => s.key === status)
  return (
    <div className="flex items-center">
      {STEPPER.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  done && 'bg-navy-700 text-white',
                  active && 'bg-navy-800 text-white ring-4 ring-navy-100',
                  !done && !active && 'bg-navy-100 text-navy-400',
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-[11px] font-semibold whitespace-nowrap',
                  active || done ? 'text-navy-800' : 'text-navy-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPPER.length - 1 && (
              <span
                className={cn(
                  'mx-1 -mt-4 h-0.5 flex-1 rounded transition-colors',
                  i < current ? 'bg-navy-700' : 'bg-navy-100',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
