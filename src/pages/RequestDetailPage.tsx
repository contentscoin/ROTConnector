import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import {
  ChevronLeft,
  MapPin,
  Clock,
  UserPlus,
  CheckCircle2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useSession } from '../lib/session'
import {
  Avatar,
  Badge,
  Button,
  Card,
  LoadingScreen,
  SectionHeader,
  Select,
  ShareButton,
} from '../components/ui'
import { RequestStepper } from '../components/cards'
import {
  matchStatusLabel,
  requestStatusLabel,
  requestStatusTone,
  urgencyLabel,
  urgencyTone,
  timeAgo,
} from '../lib/format'
import { errorMessage } from '../lib/utils'

const reqStatuses = ['open', 'matching', 'connected', 'closed'] as const

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const requestId = id as Id<'requests'>
  const { token, member, isAdmin } = useSession()
  const navigate = useNavigate()

  const req = useQuery(api.requests.get, { id: requestId })
  const matches = useQuery(api.matches.listByRequest, { requestId })
  const members = useQuery(api.members.list, isAdmin ? {} : 'skip')
  const recommended = useQuery(
    api.members.recommendForRequest,
    isAdmin && token ? { token, requestId } : 'skip',
  )

  const setReqStatus = useMutation(api.requests.setStatus)
  const propose = useMutation(api.matches.propose)
  const setMatchStatus = useMutation(api.matches.setStatus)
  const complete = useMutation(api.matches.complete)
  const removeMatch = useMutation(api.matches.remove)

  const [helperId, setHelperId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (req === undefined) return <LoadingScreen />
  if (req === null)
    return (
      <div className="py-10 text-center text-navy-400">
        요청을 찾을 수 없습니다.
        <div className="mt-3">
          <Link to="/requests" className="font-semibold text-navy-700 underline">
            요청 목록으로
          </Link>
        </div>
      </div>
    )

  const isAuthor = !!member && member._id === req.authorId
  // 작성자는 open/closed 상태일 때만 토글 가능 (운영진이 설정한 매칭중/연결완료는 못 되돌림)
  const authorCanEdit =
    isAuthor && (req.status === 'open' || req.status === 'closed')
  const canEditStatus = isAdmin || authorCanEdit
  // 작성자는 접수/종료만, 운영진은 전체
  const editableStatuses = isAdmin
    ? reqStatuses
    : (['open', 'closed'] as const)

  async function guard(fn: () => Promise<unknown>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-semibold text-navy-500"
        >
          <ChevronLeft className="size-4" />
          뒤로
        </button>
        <ShareButton
          title={`${req.title} · 알비연 링크`}
          text={`[도움요청] ${req.title}`}
        />
      </div>

      {/* 진행 단계 */}
      <RequestStepper status={req.status} />

      {/* 요청 본문 */}
      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <Badge className={requestStatusTone[req.status]}>
            {requestStatusLabel[req.status]}
          </Badge>
          <span className="text-xs font-medium text-navy-400">
            {req.category}
          </span>
          <span className={`ml-auto text-xs font-bold ${urgencyTone[req.urgency]}`}>
            {urgencyLabel[req.urgency]}
          </span>
        </div>
        <h1 className="text-xl font-extrabold text-navy-900">{req.title}</h1>
        <p className="mt-2 leading-relaxed whitespace-pre-wrap text-navy-700">
          {req.body}
        </p>

        {req.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {req.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs text-navy-500"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 border-t border-navy-50 pt-3 text-xs text-navy-400">
          {req.author && (
            <Link
              to={`/members/${req.author._id}`}
              className="font-semibold text-navy-600"
            >
              {req.author.name}
              {req.author.company ? ` · ${req.author.company}` : ''}
            </Link>
          )}
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

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 상태 변경 (작성자/운영진) */}
      {canEditStatus && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-bold text-navy-800">상태 변경</p>
          <div className="flex gap-2">
            {editableStatuses.map((s) => (
              <button
                key={s}
                disabled={busy || s === req.status}
                onClick={() =>
                  guard(() => setReqStatus({ token: token!, requestId, status: s }))
                }
                className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors disabled:opacity-100 ${
                  s === req.status
                    ? 'bg-navy-800 text-white'
                    : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                }`}
              >
                {requestStatusLabel[s]}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 매칭 현황 */}
      <section>
        <SectionHeader
          title="매칭 현황"
          action={
            matches && matches.length > 0 ? (
              <span className="text-sm font-bold text-navy-400">
                {matches.length}
              </span>
            ) : undefined
          }
        />

        {matches === undefined ? (
          <Card className="p-4 text-center text-sm text-navy-400">불러오는 중…</Card>
        ) : matches.length === 0 ? (
          <Card className="p-5 text-center text-sm text-navy-400">
            아직 연결된 회원이 없습니다.
            {isAdmin && ' 아래에서 회원을 연결해보세요.'}
          </Card>
        ) : (
          <div className="space-y-2.5">
            {matches.map((m) => (
              <Card key={m._id} className="p-4">
                <div className="flex items-center gap-3">
                  {m.helper && <Avatar name={m.helper.name} size="sm" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy-900">
                      {m.helper?.name ?? '알 수 없음'}
                      {m.helper?.company && (
                        <span className="ml-1.5 text-xs font-normal text-navy-400">
                          {m.helper.company}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-navy-400">
                      {m.broker ? `중개: ${m.broker.name} · ` : ''}
                      {timeAgo(m.createdAt)}
                    </p>
                  </div>
                  <Badge
                    className={
                      m.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-navy-100 text-navy-600'
                    }
                  >
                    {matchStatusLabel[m.status]}
                  </Badge>
                </div>
                {m.note && (
                  <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-600">
                    {m.note}
                  </p>
                )}

                {isAdmin && m.status !== 'done' && (
                  <div className="mt-3 flex items-center gap-2">
                    <Select
                      className="h-9 flex-1 py-0 text-sm"
                      value={m.status}
                      onChange={(e) =>
                        guard(() =>
                          setMatchStatus({
                            token: token!,
                            matchId: m._id,
                            status: e.target.value as
                              | 'proposed'
                              | 'accepted'
                              | 'connected'
                              | 'done',
                          }),
                        )
                      }
                    >
                      <option value="proposed">제안</option>
                      <option value="accepted">수락</option>
                      <option value="connected">연결됨</option>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() =>
                        guard(() => complete({ token: token!, matchId: m._id }))
                      }
                      disabled={busy}
                    >
                      <CheckCircle2 className="size-4" />
                      완료
                    </Button>
                    <button
                      onClick={() =>
                        guard(() => removeMatch({ token: token!, matchId: m._id }))
                      }
                      disabled={busy}
                      className="text-navy-300 hover:text-red-500"
                      aria-label="매칭 삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}

                {/* 완료된 매칭: 잘못 완료한 경우 취소(삭제) → 적립 점수 자동 회수 */}
                {isAdmin && m.status === 'done' && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => {
                        if (
                          !window.confirm(
                            '연결 완료를 취소하고 적립된 기여 점수를 회수합니다. 계속할까요?',
                          )
                        )
                          return
                        guard(() =>
                          removeMatch({ token: token!, matchId: m._id }),
                        )
                      }}
                      disabled={busy}
                      className="press inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-navy-400 hover:text-red-500"
                    >
                      <Undo2 className="size-3.5" />
                      완료 취소
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 운영진: 회원 연결 제안 */}
      {isAdmin && (
        <Card className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy-800">
            <UserPlus className="size-4" />
            회원 연결 (운영진)
          </p>
          <div className="space-y-2">
            {recommended && recommended.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-navy-500">
                  추천 회원 (요청과 매칭도 높은 순)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recommended.map((r) => (
                    <button
                      key={r.member._id}
                      type="button"
                      onClick={() => setHelperId(r.member._id)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        helperId === r.member._id
                          ? 'border-navy-800 bg-navy-800 text-white'
                          : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                      }`}
                    >
                      {r.member.name}
                      {r.member.company ? ` · ${r.member.company}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Select value={helperId} onChange={(e) => setHelperId(e.target.value)}>
              <option value="">연결할 회원 선택</option>
              {members?.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                  {m.company ? ` (${m.company})` : ''}
                </option>
              ))}
            </Select>
            <input
              className="w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-navy-500"
              placeholder="메모 (선택)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!helperId || busy}
              onClick={() =>
                guard(async () => {
                  await propose({
                    token: token!,
                    requestId,
                    helperId: helperId as Id<'members'>,
                    note: note || undefined,
                  })
                  setHelperId('')
                  setNote('')
                })
              }
            >
              연결 제안하기
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
