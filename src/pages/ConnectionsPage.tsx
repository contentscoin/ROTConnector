import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { Inbox, MessageCircle, Phone, Send, Users } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadMore,
  PageHeader,
  SegmentedControl,
  SkeletonList,
} from '../components/ui'
import {
  connectionStatusLabel,
  connectionStatusTone,
  formatCohort,
  timeAgo,
} from '../lib/format'
import { useSession } from '../lib/session'
import { errorMessage } from '../lib/utils'

type Segment = 'received' | 'sent' | 'connected'

type ConnectionOther = {
  _id: Id<'members'>
  name: string
  cohort?: string
  university?: string
  company?: string
  title?: string
  region?: string
}

type ConnectionItem = {
  _id: Id<'connections'>
  status: 'pending' | 'accepted' | 'declined'
  message: string
  topic?: string
  createdAt: number
  respondedAt?: number
  other: ConnectionOther
  phone?: string
}

const segments: { value: Segment; label: string }[] = [
  { value: 'received', label: '받은' },
  { value: 'sent', label: '보낸' },
  { value: 'connected', label: '연결' },
]

// 한 번에 받아오는 교류 건수 (커서 페이지네이션)
const PAGE_SIZE = 20

export function ConnectionsPage() {
  const { token } = useSession()
  const [segment, setSegment] = useState<Segment>('received')
  // 처리 중인 버튼 식별자: `${connectionId}:accept|decline|cancel`
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 1000명 기준: 받은/보낸 탭은 서버 인덱스 + 커서 페이지네이션.
  const inbox = usePaginatedQuery(
    api.connections.mine,
    token && segment !== 'connected'
      ? { token, box: segment as 'received' | 'sent' }
      : 'skip',
    { initialNumItems: PAGE_SIZE },
  )
  // '연결' 탭은 보낸/받은 양방향을 합쳐야 해 단일 커서로 이을 수 없다.
  // 서버가 방향별 상한까지 읽어 합쳐 주고 hasMore로 알린다(아래 안내 문구).
  const connectedData = useQuery(
    api.connections.connected,
    token && segment === 'connected' ? { token } : 'skip',
  )
  const respondMutation = useMutation(api.connections.respond)
  const cancelMutation = useMutation(api.connections.cancel)

  async function onRespond(id: Id<'connections'>, accept: boolean) {
    if (!token) return
    setError('')
    setBusyKey(`${id}:${accept ? 'accept' : 'decline'}`)
    try {
      await respondMutation({ token, connectionId: id, accept })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyKey(null)
    }
  }

  async function onCancel(id: Id<'connections'>) {
    if (!token) return
    if (!window.confirm('교류 신청을 취소할까요?')) return
    setError('')
    setBusyKey(`${id}:cancel`)
    try {
      await cancelMutation({ token, connectionId: id })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyKey(null)
    }
  }

  // 비로그인 → 로그인 유도
  if (!token) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="교류"
          subtitle="교류를 수락하면 서로 연락처가 공개됩니다."
          icon={<Users className="size-5" />}
        />
        <EmptyState
          icon={<Users className="size-10" />}
          title="로그인이 필요합니다"
          description="교류 신청을 보내고 받으려면 먼저 로그인해 주세요."
          action={
            <Link
              to="/login"
              className="press inline-flex h-11 items-center justify-center rounded-xl bg-navy-800 px-5 text-[15px] font-semibold text-white"
            >
              로그인
            </Link>
          }
        />
      </div>
    )
  }

  const items: ConnectionItem[] =
    segment === 'connected'
      ? ((connectedData?.items ?? []) as ConnectionItem[])
      : (inbox.results as ConnectionItem[])
  const loading =
    segment === 'connected'
      ? connectedData === undefined
      : inbox.status === 'LoadingFirstPage'

  return (
    <div className="space-y-4">
      <PageHeader
        title="교류"
        subtitle="교류를 수락하면 서로 연락처가 공개됩니다."
        icon={<Users className="size-5" />}
      />

      {/* 세그먼트 */}
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        options={segments}
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : items.length === 0 ? (
        segment === 'received' ? (
          <EmptyState
            icon={<Inbox className="size-10" />}
            title="아직 받은 교류 신청이 없습니다"
            description="프로필을 채워두면 교류 신청을 받을 가능성이 높아집니다."
          />
        ) : segment === 'sent' ? (
          <EmptyState
            icon={<Send className="size-10" />}
            title="아직 보낸 교류 신청이 없습니다"
            description="회원 목록에서 관심 있는 회원에게 교류를 신청해 보세요."
            action={
              <Link
                to="/members"
                className="press inline-flex h-10 items-center justify-center rounded-xl border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-700"
              >
                회원 둘러보기
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Users className="size-10" />}
            title="아직 연결된 회원이 없습니다"
            description="교류 신청이 수락되면 여기에서 연락처를 확인할 수 있습니다."
          />
        )
      ) : (
        <div className="space-y-2.5">
          {segment === 'received' &&
            items.map((c) => (
              <Card key={c._id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <PersonSummary other={c.other} />
                  <span className="shrink-0 text-xs text-navy-400">
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                {c.topic && (
                  <Badge className="bg-gold-400/20 text-gold-600">
                    {c.topic}
                  </Badge>
                )}
                <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm whitespace-pre-wrap text-navy-700">
                  {c.message}
                </p>
                {c.status === 'pending' ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      loading={busyKey === `${c._id}:accept`}
                      disabled={busyKey != null}
                      onClick={() => onRespond(c._id, true)}
                    >
                      수락
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      loading={busyKey === `${c._id}:decline`}
                      disabled={busyKey != null}
                      onClick={() => onRespond(c._id, false)}
                    >
                      거절
                    </Button>
                  </div>
                ) : (
                  // 받은 신청의 declined는 내가 거절한 것 — 방향에 맞춘 라벨
                  <Badge className={connectionStatusTone.declined}>거절함</Badge>
                )}
              </Card>
            ))}

          {segment === 'sent' &&
            items.map((c) => (
              <Card key={c._id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <PersonSummary other={c.other} />
                  <span className="shrink-0 text-xs text-navy-400">
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                {c.topic && (
                  <Badge className="bg-gold-400/20 text-gold-600">
                    {c.topic}
                  </Badge>
                )}
                <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm whitespace-pre-wrap text-navy-700">
                  {c.message}
                </p>
                {c.status === 'pending' ? (
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={connectionStatusTone.pending}>
                      {connectionStatusLabel.pending}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyKey === `${c._id}:cancel`}
                      disabled={busyKey != null}
                      onClick={() => onCancel(c._id)}
                    >
                      신청 취소
                    </Button>
                  </div>
                ) : (
                  <Badge className={connectionStatusTone.declined}>
                    {connectionStatusLabel.declined}
                  </Badge>
                )}
              </Card>
            ))}

          {segment === 'connected' &&
            items.map((c) => (
              <Card key={c._id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <PersonSummary other={c.other} />
                  <Badge className={connectionStatusTone.accepted}>
                    {connectionStatusLabel.accepted}
                  </Badge>
                </div>
                {c.phone ? (
                  <div className="flex gap-2">
                    <a
                      href={`tel:${c.phone}`}
                      className="press flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-navy-800 text-sm font-semibold text-white"
                    >
                      <Phone className="size-4" />
                      전화
                    </a>
                    <a
                      href={`sms:${c.phone}`}
                      className="press flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-navy-200 bg-white text-sm font-semibold text-navy-700"
                    >
                      <MessageCircle className="size-4" />
                      문자
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-navy-400">
                    등록된 연락처가 없습니다.
                  </p>
                )}
              </Card>
            ))}
        </div>
      )}

      {segment === 'connected' ? (
        // '연결' 탭은 서버에서 방향별 상한까지 한 번에 받는다 (양방향 병합)
        connectedData?.hasMore ? (
          <p className="py-3 text-center text-xs text-navy-400">
            최근 연결 {items.length}건까지 표시합니다.
          </p>
        ) : null
      ) : (
        <LoadMore
          status={inbox.status}
          onLoadMore={inbox.loadMore}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  )
}

// 상대 요약 — 이름·기수·학교·회사, 회원 상세로 링크
function PersonSummary({ other }: { other: ConnectionOther }) {
  const line = [formatCohort(other.cohort), other.university, other.company]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link
      to={`/members/${other._id}`}
      className="press flex min-w-0 flex-1 items-center gap-3"
    >
      <Avatar name={other.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-navy-900">{other.name}</p>
        {line && <p className="truncate text-sm text-navy-500">{line}</p>}
      </div>
    </Link>
  )
}
