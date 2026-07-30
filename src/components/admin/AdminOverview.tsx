import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import {
  Users,
  Inbox,
  Handshake,
  CheckCircle2,
  UserCheck,
  UserPlus,
  Clock,
  Award,
  Zap,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  Badge,
  Button,
  Card,
  Disclosure,
  Field,
  Input,
  LoadingScreen,
  SectionHeader,
  Select,
  StatCard,
} from '../ui'
import {
  contributionLabel,
  requestStatusLabel,
  requestStatusTone,
  timeAgo,
} from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { profileCompleteness } from '../../lib/profile'
import { useDebounce } from '../../lib/useDebounce'

const contributionTypes = [
  'sponsor',
  'event',
  'onboarding',
  'intro',
  'consult',
] as const

export function AdminOverview({ token }: { token: string }) {
  const data = useQuery(api.admin.dashboard, { token })
  // 1000명 기준: <Select>에 전체 회원을 담지 않는다. 검색어 기반 상위 후보만 받아온다.
  const [memberQuery, setMemberQuery] = useState('')
  const debouncedMemberQuery = useDebounce(memberQuery, 300)
  const memberOptions = useQuery(api.members.picker, {
    token,
    q: debouncedMemberQuery.trim() || undefined,
  })
  // 프로필 미작성 회원은 members.profileScore 인덱스로 서버가 골라 보낸다
  const incompleteMembers = useQuery(api.admin.incompleteMembers, { token })
  const approve = useMutation(api.members.approve)
  const createMember = useMutation(api.members.create)
  const awardContribution = useMutation(api.contributions.award)

  const [showReg, setShowReg] = useState(false)
  const [reg, setReg] = useState({
    name: '',
    phone: '',
    company: '',
    cohort: '',
    university: '',
  })
  const [regError, setRegError] = useState<string | null>(null)
  const [regBusy, setRegBusy] = useState(false)
  const [busy, setBusy] = useState(false)

  const [showAward, setShowAward] = useState(false)
  const [award, setAward] = useState({
    memberId: '',
    type: 'sponsor' as (typeof contributionTypes)[number],
    points: '10',
    note: '',
  })
  const [awardError, setAwardError] = useState<string | null>(null)
  const [awardBusy, setAwardBusy] = useState(false)

  if (!data) return <LoadingScreen />

  async function onAward(e: FormEvent) {
    e.preventDefault()
    setAwardError(null)
    setAwardBusy(true)
    try {
      await awardContribution({
        token,
        memberId: award.memberId as Id<'members'>,
        type: award.type,
        points: Number(award.points),
        note: award.note.trim() || undefined,
      })
      setAward({ memberId: '', type: 'sponsor', points: '10', note: '' })
      setShowAward(false)
    } catch (err) {
      setAwardError(errorMessage(err))
    } finally {
      setAwardBusy(false)
    }
  }

  const s = data.stats
  // 미작성 항목 라벨은 클라이언트에서 계산 (서버는 상위 20명만 골라 보낸다)
  const incomplete = (incompleteMembers ?? []).map((m) => ({
    m,
    c: profileCompleteness(m),
  }))

  async function onApprove(id: Id<'members'>) {
    setBusy(true)
    try {
      await approve({ token, memberId: id })
    } finally {
      setBusy(false)
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    setRegError(null)
    setRegBusy(true)
    try {
      await createMember({
        token,
        name: reg.name.trim(),
        phone: reg.phone.trim(),
        company: reg.company.trim() || undefined,
        cohort: reg.cohort.trim() || undefined,
        university: reg.university.trim() || undefined,
      })
      setReg({ name: '', phone: '', company: '', cohort: '', university: '' })
      setShowReg(false)
    } catch (err) {
      setRegError(errorMessage(err))
    } finally {
      setRegBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Users className="size-5" />}
          label="활성 회원"
          value={s.activeMembers}
          sub={s.pendingMembers > 0 ? `승인대기 ${s.pendingMembers}` : undefined}
        />
        <StatCard
          icon={<Inbox className="size-5" />}
          label="접수 요청"
          value={s.openRequests}
          sub={`전체 ${s.totalRequests}`}
        />
        <StatCard
          icon={<Handshake className="size-5" />}
          label="매칭중"
          value={s.matchingRequests}
          tone="gold"
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          label="연결 완료"
          value={s.totalConnections}
          tone="emerald"
        />
      </div>

      {/* 회원 등록 */}
      <Disclosure
        title="신규 회원 등록"
        icon={<UserPlus className="size-4" />}
        open={showReg}
        onToggle={setShowReg}
      >
        <form onSubmit={onRegister} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="이름" required>
                <Input
                  value={reg.name}
                  onChange={(e) => setReg({ ...reg, name: e.target.value })}
                />
              </Field>
              <Field label="휴대폰" required>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="010..."
                  value={reg.phone}
                  onChange={(e) => setReg({ ...reg, phone: e.target.value })}
                />
              </Field>
              <Field label="회사">
                <Input
                  value={reg.company}
                  onChange={(e) => setReg({ ...reg, company: e.target.value })}
                />
              </Field>
              <Field label="기수">
                <Input
                  placeholder="예: 37"
                  value={reg.cohort}
                  onChange={(e) => setReg({ ...reg, cohort: e.target.value })}
                />
              </Field>
              <Field label="출신 학교">
                <Input
                  placeholder="예: 한양대"
                  value={reg.university}
                  onChange={(e) =>
                    setReg({ ...reg, university: e.target.value })
                  }
                />
              </Field>
            </div>
            {regError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {regError}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              loading={regBusy}
              disabled={!reg.name.trim() || !reg.phone.trim()}
            >
              등록
            </Button>
        </form>
      </Disclosure>

      {/* 수동 기여 적립 (후원·행사 운영·온보딩 등) */}
      <Disclosure
        title="기여 적립"
        icon={<Award className="size-4" />}
        open={showAward}
        onToggle={setShowAward}
      >
        <form onSubmit={onAward} className="space-y-3">
            <Field label="회원" required>
              {/* 회원 검색 → 상위 후보만 <Select>에 채운다 (전체 목록 로드 없음) */}
              <Input
                className="mb-2"
                placeholder="이름·회사·기수로 회원 검색"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
              />
              <Select
                value={award.memberId}
                onChange={(e) =>
                  setAward({ ...award, memberId: e.target.value })
                }
              >
                <option value="">회원 선택</option>
                {memberOptions?.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                    {m.company ? ` (${m.company})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="기여 유형">
                <Select
                  value={award.type}
                  onChange={(e) =>
                    setAward({
                      ...award,
                      type: e.target.value as (typeof contributionTypes)[number],
                    })
                  }
                >
                  {contributionTypes.map((t) => (
                    <option key={t} value={t}>
                      {contributionLabel[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="점수">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  value={award.points}
                  onChange={(e) =>
                    setAward({ ...award, points: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="메모">
              <Input
                placeholder="예) 6월 정기모임 후원"
                value={award.note}
                onChange={(e) => setAward({ ...award, note: e.target.value })}
              />
            </Field>
            {awardError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {awardError}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              loading={awardBusy}
              disabled={!award.memberId || !award.points}
            >
              적립
            </Button>
        </form>
      </Disclosure>

      {/* 승인 대기 회원 */}
      {data.pendingMembers.length > 0 && (
        <section>
          <SectionHeader
            title="승인 대기 회원"
            icon={<UserCheck className="size-5" />}
          />
          <Card className="divide-y divide-navy-50">
            {data.pendingMembers.map((m) => (
              <div key={m._id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy-800">{m.name}</p>
                  <p className="text-xs text-navy-400">
                    {[m.company, m.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onApprove(m._id)}
                  disabled={busy}
                >
                  승인
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* 프로필 미작성 회원 */}
      {incomplete.length > 0 && (
        <section>
          <SectionHeader title="프로필 미작성 회원" />
          <Card className="divide-y divide-navy-50">
            {incomplete.map(({ m, c }) => (
              <Link
                key={m._id}
                to={`/members/${m._id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-navy-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy-800">
                    {m.name}
                    {m.company ? ` · ${m.company}` : ''}
                  </p>
                  <p className="truncate text-xs text-navy-400">
                    {c.missing
                      .slice(0, 3)
                      .map((f) => f.label)
                      .join(', ')}{' '}
                    미작성
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-navy-500">
                  {c.percent}%
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {/* 빠른 매칭 (상위 3건 open 요청에 대한 추천 helper) */}
      {data.pendingRequests.length > 0 && (
        <section>
          <SectionHeader
            title="빠른 매칭"
            icon={<Zap className="size-5" />}
          />
          <div className="space-y-2.5">
            {data.pendingRequests
              .filter((r) => r.status === 'open')
              .slice(0, 3)
              .map((r) => (
                <QuickMatchCard key={r._id} token={token} request={r} />
              ))}
          </div>
        </section>
      )}

      {/* 처리 대기 요청 */}
      <section>
        <SectionHeader title="처리 대기 요청" />
        {data.pendingRequests.length === 0 ? (
          <Card className="p-5 text-center text-sm text-navy-400">
            처리할 요청이 없습니다. 👍
          </Card>
        ) : (
          <div className="space-y-2.5">
            {data.pendingRequests.map((r) => (
              <Link key={r._id} to={`/requests/${r._id}`} className="press block">
                <Card className="p-4 lift hover:border-navy-200 hover:shadow-soft">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge className={requestStatusTone[r.status]}>
                      {requestStatusLabel[r.status]}
                    </Badge>
                    <span className="text-xs text-navy-400">{r.category}</span>
                    {r.matchCount > 0 && (
                      <span className="text-xs font-semibold text-navy-500">
                        연결 {r.matchCount}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-0.5 text-xs text-navy-400">
                      <Clock className="size-3" />
                      {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  <p className="truncate font-bold text-navy-900">{r.title}</p>
                  <p className="text-xs text-navy-400">요청: {r.authorName}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// 빠른 매칭 카드: 요청 + 추천 1위 helper, 원클릭 제안
function QuickMatchCard({
  token,
  request,
}: {
  token: string
  request: { _id: Id<'requests'>; title: string; category: string; authorName: string }
}) {
  const recommend = useQuery(api.members.recommendForRequest, {
    token,
    requestId: request._id,
    limit: 1,
  })
  const propose = useMutation(api.matches.propose)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const top = recommend?.[0]

  async function onPropose() {
    if (!top) return
    setBusy(true)
    setError(null)
    try {
      await propose({
        token,
        requestId: request._id,
        helperId: top.member._id,
      })
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold text-navy-500">
          {request.category}
        </span>
        <span className="truncate font-bold text-navy-900">
          {request.title}
        </span>
      </div>
      <p className="text-xs text-navy-400">요청: {request.authorName}</p>
      {top ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-navy-700">
            추천: <b>{top.member.name}</b>
            {top.member.company ? ` (${top.member.company})` : ''}
          </span>
          {done ? (
            <Badge className="bg-emerald-100 text-emerald-700 ml-auto">
              제안 완료
            </Badge>
          ) : (
            <Button
              size="sm"
              className="ml-auto"
              loading={busy}
              onClick={onPropose}
            >
              연결
            </Button>
          )}
        </div>
      ) : recommend !== undefined ? (
        <p className="mt-2 text-xs text-navy-400">
          적합한 추천 회원이 없습니다.
        </p>
      ) : null}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </Card>
  )
}
