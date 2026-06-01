import { useState, type FormEvent, type ReactNode } from 'react'
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
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useSession } from '../lib/session'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  LoadingScreen,
} from '../components/ui'
import { requestStatusLabel, requestStatusTone, timeAgo } from '../lib/format'
import { errorMessage } from '../lib/utils'

export function AdminDashboardPage() {
  const { token } = useSession()
  const data = useQuery(api.admin.dashboard, token ? { token } : 'skip')
  const approve = useMutation(api.members.approve)
  const createMember = useMutation(api.members.create)

  const [showReg, setShowReg] = useState(false)
  const [reg, setReg] = useState({ name: '', phone: '', company: '', cohort: '' })
  const [regError, setRegError] = useState<string | null>(null)
  const [regBusy, setRegBusy] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!data) return <LoadingScreen />

  const s = data.stats

  async function onApprove(id: Id<'members'>) {
    if (!token) return
    setBusy(true)
    try {
      await approve({ token, memberId: id })
    } finally {
      setBusy(false)
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setRegError(null)
    setRegBusy(true)
    try {
      await createMember({
        token,
        name: reg.name.trim(),
        phone: reg.phone.trim(),
        company: reg.company.trim() || undefined,
        cohort: reg.cohort.trim() || undefined,
      })
      setReg({ name: '', phone: '', company: '', cohort: '' })
      setShowReg(false)
    } catch (err) {
      setRegError(errorMessage(err))
    } finally {
      setRegBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-navy-900">운영진 대시보드</h1>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Users className="size-5" />}
          label="활성 회원"
          value={s.activeMembers}
          sub={s.pendingMembers > 0 ? `승인대기 ${s.pendingMembers}` : undefined}
        />
        <Stat
          icon={<Inbox className="size-5" />}
          label="접수 요청"
          value={s.openRequests}
          sub={`전체 ${s.totalRequests}`}
        />
        <Stat
          icon={<Handshake className="size-5" />}
          label="매칭중"
          value={s.matchingRequests}
        />
        <Stat
          icon={<CheckCircle2 className="size-5" />}
          label="연결 완료"
          value={s.totalConnections}
          accent
        />
      </div>

      {/* 회원 등록 */}
      <Card className="p-4">
        <button
          onClick={() => setShowReg((v) => !v)}
          className="flex w-full items-center gap-2 font-bold text-navy-800"
        >
          <UserPlus className="size-4" />
          신규 회원 등록
          <span className="ml-auto text-sm font-normal text-navy-400">
            {showReg ? '닫기' : '열기'}
          </span>
        </button>
        {showReg && (
          <form onSubmit={onRegister} className="mt-3 space-y-3">
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
                  value={reg.cohort}
                  onChange={(e) => setReg({ ...reg, cohort: e.target.value })}
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
        )}
      </Card>

      {/* 승인 대기 회원 */}
      {data.pendingMembers.length > 0 && (
        <section>
          <h2 className="mb-2.5 flex items-center gap-1.5 text-lg font-extrabold text-navy-900">
            <UserCheck className="size-5" />
            승인 대기 회원
          </h2>
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

      {/* 처리 대기 요청 */}
      <section>
        <h2 className="mb-2.5 text-lg font-extrabold text-navy-900">
          처리 대기 요청
        </h2>
        {data.pendingRequests.length === 0 ? (
          <Card className="p-5 text-center text-sm text-navy-400">
            처리할 요청이 없습니다. 👍
          </Card>
        ) : (
          <div className="space-y-2.5">
            {data.pendingRequests.map((r) => (
              <Link key={r._id} to={`/requests/${r._id}`} className="press block">
                <Card className="p-4 hover:shadow-soft">
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

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ReactNode
  label: string
  value: number
  sub?: string
  accent?: boolean
}) {
  return (
    <Card className="p-4">
      <div
        className={`mb-1.5 flex size-9 items-center justify-center rounded-xl ${
          accent ? 'bg-emerald-100 text-emerald-600' : 'bg-navy-100 text-navy-700'
        }`}
      >
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-navy-900">{value}</p>
      <p className="text-xs font-medium text-navy-400">
        {label}
        {sub && <span className="ml-1 text-navy-300">· {sub}</span>}
      </p>
    </Card>
  )
}
