import type { ReactNode } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import {
  MapPin,
  Award,
  ExternalLink,
  ArrowUpRight,
  HandHeart,
  HelpCircle,
  ChevronLeft,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Avatar, Badge, Card, LoadingScreen } from '../components/ui'
import { RequestCard } from '../components/cards'
import { contributionLabel, timeAgo } from '../lib/format'

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const memberId = id as Id<'members'>
  const member = useQuery(api.members.get, { id: memberId })
  const requests = useQuery(api.requests.byAuthor, { memberId })
  const contributions = useQuery(api.contributions.byMember, { memberId })

  if (member === undefined) return <LoadingScreen />
  if (member === null)
    return (
      <div className="py-10 text-center text-navy-400">
        회원을 찾을 수 없습니다.
        <div className="mt-3">
          <Link to="/members" className="font-semibold text-navy-700 underline">
            회원 목록으로
          </Link>
        </div>
      </div>
    )

  return (
    <div className="space-y-5">
      {/* 히어로 헤더 */}
      <div className="-mx-4 -mt-4 rounded-b-[2rem] bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-3 pb-7 text-white shadow-soft">
        <button
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="press -ml-1 flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="mt-1 flex flex-col items-center text-center">
          <div className="rounded-full p-1 ring-2 ring-white/25">
            <Avatar name={member.name} size="lg" />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
            {member.name}
          </h1>
          <p className="mt-0.5 text-sm text-navy-100/80">
            {[member.title, member.company].filter(Boolean).join(' · ') ||
              '소개 미작성'}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {member.cohort && (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white/90">
                {member.cohort}
              </span>
            )}
            {member.isAdmin && (
              <span className="rounded-full bg-gold-400/25 px-2.5 py-1 text-xs font-bold text-gold-400">
                운영진
              </span>
            )}
            {member.region && (
              <span className="flex items-center gap-0.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90">
                <MapPin className="size-3" />
                {member.region}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-gold-400/25 px-2.5 py-1 text-xs font-bold text-gold-400">
              <Award className="size-3" />
              기여 {member.contributionScore}
            </span>
          </div>
        </div>
      </div>

      {/* 소개 / 업종 / 링크 */}
      {(member.intro ||
        member.industry.length > 0 ||
        member.links.length > 0) && (
        <Card className="space-y-4 p-5">
          {member.intro && (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-navy-700">
              {member.intro}
            </p>
          )}
          {member.industry.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {member.industry.map((i) => (
                <span
                  key={i}
                  className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-600"
                >
                  #{i}
                </span>
              ))}
            </div>
          )}
          {member.links.length > 0 && (
            <div className="space-y-1.5">
              {member.links.map((l, idx) => (
                <a
                  key={idx}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm font-semibold text-navy-600"
                >
                  <ExternalLink className="size-4" />
                  {l.label || l.url}
                </a>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 줄 수 있는 도움 / 필요한 도움 */}
      <div className="grid grid-cols-1 gap-3">
        <HelpBlock
          icon={<HandHeart className="size-4" />}
          title="줄 수 있는 도움"
          items={member.helpOffer}
          tone="text-emerald-600"
        />
        <HelpBlock
          icon={<HelpCircle className="size-4" />}
          title="필요한 도움"
          items={member.helpNeed}
          tone="text-navy-600"
        />
      </div>

      {/* 이 회원의 도움요청 */}
      {requests && requests.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-lg font-extrabold text-navy-900">
            올린 도움요청
          </h2>
          <div className="space-y-2.5">
            {requests.map((r) => (
              <RequestCard key={r._id} req={{ ...r, author: null }} />
            ))}
          </div>
        </section>
      )}

      {/* 기여 이력 */}
      {contributions && contributions.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-lg font-extrabold text-navy-900">
            기여 이력
          </h2>
          <Card className="divide-y divide-navy-50">
            {contributions.map((c) => (
              <div key={c._id} className="flex items-center gap-3 px-4 py-3">
                <Badge className="bg-gold-400/20 text-gold-600">
                  {contributionLabel[c.type]}
                </Badge>
                <span className="flex-1 truncate text-sm text-navy-600">
                  {c.note ?? ''}
                </span>
                <span className="text-xs text-navy-400">
                  {timeAgo(c.createdAt)}
                </span>
                <span className="text-sm font-bold text-gold-600">
                  +{c.points}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <p className="flex items-center justify-center gap-1 pt-2 text-xs text-navy-300">
        연결이 필요하면 운영진에게 요청하세요
        <ArrowUpRight className="size-3" />
      </p>
    </div>
  )
}

function HelpBlock({
  icon,
  title,
  items,
  tone,
}: {
  icon: ReactNode
  title: string
  items: string[]
  tone: string
}) {
  return (
    <Card className="p-4">
      <div className={`mb-2 flex items-center gap-1.5 font-bold ${tone}`}>
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-navy-300">등록된 항목이 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it}
              className="rounded-lg bg-navy-50 px-2.5 py-1 text-sm text-navy-700"
            >
              {it}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
