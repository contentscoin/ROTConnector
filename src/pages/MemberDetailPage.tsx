import { useState, type FormEvent, type ReactNode } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import {
  MapPin,
  Award,
  ExternalLink,
  ArrowUpRight,
  HandHeart,
  HelpCircle,
  ChevronLeft,
  MessageCircle,
  Phone,
  UserPlus,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  LoadingScreen,
  ShareButton,
  Skeleton,
  Textarea,
} from '../components/ui'
import { RequestCard } from '../components/cards'
import { contributionLabel, formatCohort, timeAgo } from '../lib/format'
import { errorMessage, safeUrl } from '../lib/utils'
import { useSession } from '../lib/session'

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
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="press -ml-1 flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
          >
            <ChevronLeft className="size-5" />
          </button>
          <ShareButton
            title={`${member.name} · 알비연 링크`}
            text={`${member.name}${member.company ? ` (${member.company})` : ''} 님의 프로필`}
            className="border-white/20 bg-white/10 text-white hover:bg-white/15"
          />
        </div>
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
            {(member.cohort || member.university) && (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white/90">
                {[formatCohort(member.cohort), member.university]
                  .filter(Boolean)
                  .join(' · ')}
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

      {/* 소개 / 사업 / 업종 / 링크 */}
      {(member.intro ||
        member.products ||
        member.customers ||
        member.industry.length > 0 ||
        member.links.length > 0) && (
        <Card className="space-y-4 p-5">
          {member.intro && (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-navy-700">
              {member.intro}
            </p>
          )}
          {(member.products || member.customers) && (
            <div className="space-y-3">
              {member.products && (
                <IntroRow label="주요 제품/서비스" value={member.products} />
              )}
              {member.customers && (
                <IntroRow label="주요 고객" value={member.customers} />
              )}
            </div>
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
              {member.links.map((l, idx) => {
                const href = safeUrl(l.url)
                // 안전하지 않은 스킴(javascript: 등)은 클릭 불가 텍스트로 표기
                if (!href)
                  return (
                    <span
                      key={idx}
                      className="flex items-center gap-1.5 text-sm font-semibold text-navy-300"
                    >
                      <ExternalLink className="size-4" />
                      {l.label || l.url}
                    </span>
                  )
                return (
                  <a
                    key={idx}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-semibold text-navy-600"
                  >
                    <ExternalLink className="size-4" />
                    {l.label || l.url}
                  </a>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* 교류 신청 CTA */}
      <ConnectCta profileId={member._id} profileName={member.name} />

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
        교류를 신청하거나, 운영진 중개가 필요하면 도움요청을 올려보세요
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

// 소개 카드 내 라벨+텍스트 행 (주요 제품/서비스, 주요 고객)
function IntroRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-navy-400">{label}</span>
      <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-navy-700">
        {value}
      </p>
    </div>
  )
}

// 교류 신청 topic 프리셋 (단일 선택)
const topicPresets = ['커피챗', '협업 제안', '소개 요청', '기타']

/* ---------- 교류 신청 CTA ----------
 * 비로그인 → 로그인 유도 / 본인 프로필 → 미표시 /
 * 그 외에는 statusWith 결과에 따라 신청 폼·대기중·받은 신청·연결됨으로 분기.
 */
function ConnectCta({
  profileId,
  profileName,
}: {
  profileId: Id<'members'>
  profileName: string
}) {
  const { token, member: me, isLoading } = useSession()
  const status = useQuery(
    api.connections.statusWith,
    token ? { token, memberId: profileId } : 'skip',
  )
  const requestMutation = useMutation(api.connections.request)
  const respondMutation = useMutation(api.connections.respond)
  const cancelMutation = useMutation(api.connections.cancel)

  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<
    'request' | 'accept' | 'decline' | 'cancel' | null
  >(null)
  const [error, setError] = useState('')
  const [justSent, setJustSent] = useState(false)

  async function onRequest(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    const trimmed = message.trim()
    if (trimmed.length < 5) {
      setError('인사말을 5자 이상 입력해 주세요.')
      return
    }
    setError('')
    setBusy('request')
    try {
      await requestMutation({
        token,
        toId: profileId,
        message: trimmed,
        topic: topic ?? undefined,
      })
      // 성공 → 폼 접고 성공 문구 (statusWith가 반응형으로 '대기중' 카드로 전환)
      setOpen(false)
      setMessage('')
      setTopic(null)
      setJustSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function onRespond(accept: boolean) {
    if (!token || !status) return
    setError('')
    setBusy(accept ? 'accept' : 'decline')
    try {
      await respondMutation({ token, connectionId: status._id, accept })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function onCancel() {
    if (!token || !status) return
    if (!window.confirm('교류 신청을 취소할까요?')) return
    setError('')
    setBusy('cancel')
    try {
      await cancelMutation({ token, connectionId: status._id })
      setJustSent(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  // 비로그인 → 로그인 유도
  if (!token) {
    return (
      <Card className="p-4 text-center">
        <p className="text-sm text-navy-600">
          로그인하면 {profileName} 님에게 교류를 신청할 수 있습니다.
        </p>
        <Link
          to="/login"
          className="press mt-3 flex h-11 items-center justify-center rounded-xl bg-navy-800 text-[15px] font-semibold text-white"
        >
          로그인하고 교류 신청하기
        </Link>
      </Card>
    )
  }

  // 본인 프로필이면 미표시
  if (me && me._id === profileId) return null
  // 세션·상태 로딩 중 — CTA 자리를 스켈레톤으로 고정해 레이아웃 점프 방지
  if (isLoading || status === undefined) {
    return (
      <Card className="p-4">
        <Skeleton className="h-11 w-full rounded-xl" />
      </Card>
    )
  }

  const errorEl = error ? (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
      {error}
    </p>
  ) : null

  // 교류 이력 없음(declined 포함) → 접이식 신청 폼
  if (status === null) {
    return (
      <Card className="space-y-3 p-4">
        {!open ? (
          <Button
            className="w-full"
            onClick={() => {
              setOpen(true)
              setError('')
            }}
          >
            <UserPlus className="size-4.5" />
            {profileName} 님에게 교류 신청
          </Button>
        ) : (
          <form onSubmit={onRequest} className="space-y-3">
            <p className="font-bold text-navy-800">교류 신청</p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {topicPresets.map((t) => (
                <Chip
                  key={t}
                  active={topic === t}
                  onClick={() => setTopic(topic === t ? null : t)}
                >
                  {t}
                </Chip>
              ))}
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="안녕하세요, 어떤 이야기를 나누고 싶은지 간단히 적어주세요. (5자 이상)"
              maxLength={500}
            />
            {errorEl}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                접기
              </Button>
              <Button
                type="submit"
                className="flex-1"
                loading={busy === 'request'}
              >
                교류 신청
              </Button>
            </div>
          </form>
        )}
        <p className="text-center text-xs text-navy-400">
          상대가 수락하면 서로 연락처가 공개됩니다.
        </p>
      </Card>
    )
  }

  // 내가 보낸 신청 대기중
  if (status.direction === 'sent' && status.status === 'pending') {
    return (
      <Card className="space-y-3 p-4">
        {justSent && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            교류 신청을 보냈습니다.
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-navy-800">교류 신청 대기중</p>
            <p className="mt-0.5 text-xs text-navy-400">
              상대가 수락하면 서로 연락처가 공개됩니다.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'cancel'}
            onClick={onCancel}
          >
            신청 취소
          </Button>
        </div>
        {errorEl}
      </Card>
    )
  }

  // 상대가 나에게 보낸 신청 대기중
  if (status.direction === 'received' && status.status === 'pending') {
    return (
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <p className="flex-1 font-bold text-navy-800">
            나에게 교류를 신청했습니다
          </p>
          {status.topic && (
            <Badge className="bg-gold-400/20 text-gold-600">
              {status.topic}
            </Badge>
          )}
        </div>
        <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm whitespace-pre-wrap text-navy-700">
          {status.message}
        </p>
        {errorEl}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            loading={busy === 'accept'}
            disabled={busy !== null}
            onClick={() => onRespond(true)}
          >
            수락
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            loading={busy === 'decline'}
            disabled={busy !== null}
            onClick={() => onRespond(false)}
          >
            거절
          </Button>
        </div>
      </Card>
    )
  }

  // 연결 완료 → 연락처 공개
  if (status.status === 'accepted') {
    return (
      <Card className="space-y-3 p-4">
        <div>
          <p className="font-bold text-emerald-700">연결된 회원입니다</p>
          <p className="mt-0.5 text-xs text-navy-400">
            교류가 수락되어 서로 연락처가 공개되었습니다.
          </p>
        </div>
        {status.phone ? (
          <div className="flex gap-2">
            <a
              href={`tel:${status.phone}`}
              className="press flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-navy-800 text-sm font-semibold text-white"
            >
              <Phone className="size-4" />
              전화
            </a>
            <a
              href={`sms:${status.phone}`}
              className="press flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-navy-200 bg-white text-sm font-semibold text-navy-700"
            >
              <MessageCircle className="size-4" />
              문자
            </a>
          </div>
        ) : (
          <p className="text-xs text-navy-400">등록된 연락처가 없습니다.</p>
        )}
      </Card>
    )
  }

  return null
}
