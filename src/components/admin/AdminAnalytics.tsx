import { useQuery } from 'convex/react'
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  UserPlus,
  Gauge,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Card, LoadingScreen, SectionHeader, StatCard } from '../ui'
import {
  contributionLabel,
  formatCohort,
  requestStatusLabel,
} from '../../lib/format'

// 운영진 통계 보드 — api.admin.analytics 한 화면 집계.
export function AdminAnalytics({ token }: { token: string }) {
  const data = useAdminAnalytics(token)
  if (data === undefined) return <LoadingScreen />

  const m = data.members

  return (
    <div className="space-y-6">
      {/* 회원 요약 */}
      <section>
        <SectionHeader title="회원 요약" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Users className="size-5" />} label="전체 회원" value={m.total} />
          <StatCard
            icon={<UserCheck className="size-5" />}
            label="활성"
            value={m.active}
            tone="emerald"
          />
          <StatCard icon={<Clock className="size-5" />} label="승인 대기" value={m.pending} />
          <StatCard icon={<UserX className="size-5" />} label="비활성" value={m.suspended} />
          <StatCard
            icon={<UserPlus className="size-5" />}
            label="이번 달 신규"
            value={m.newThisMonth}
          />
          <StatCard
            icon={<Gauge className="size-5" />}
            label="평균 완성률"
            value={
              <>
                {data.avgCompletion}
                <span className="text-base">%</span>
              </>
            }
          />
        </div>
      </section>

      {/* 분포 막대 */}
      <section className="space-y-4">
        <SectionHeader title="회원 분포" />
        <BarChart title="기수별" data={data.cohorts} labelFmt={formatCohort} />
        <BarChart title="학교별" data={data.universities} />
        <BarChart title="업종별" data={data.industries} />
        <BarChart title="지역별" data={data.regions} />
      </section>

      {/* 요청 퍼널 */}
      <section>
        <SectionHeader title="요청 퍼널" />
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <FunnelRow label="전체 요청" value={data.requests.total} />
            <FunnelRow
              label={requestStatusLabel.open}
              value={data.requests.open}
            />
            <FunnelRow
              label={requestStatusLabel.matching}
              value={data.requests.matching}
            />
            <FunnelRow
              label={requestStatusLabel.connected}
              value={data.requests.connected}
            />
            <FunnelRow
              label={requestStatusLabel.closed}
              value={data.requests.closed}
            />
            <FunnelRow label="중개 연결" value={data.matchesDone} accent />
          </div>
        </Card>
      </section>

      {/* 교류 퍼널 */}
      <section>
        <SectionHeader title="교류 퍼널" />
        <Card className="p-4">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-extrabold text-emerald-600">
                {data.exchange.acceptRate}
                <span className="text-lg">%</span>
              </p>
              <p className="text-xs font-medium text-navy-400">수락률</p>
            </div>
            <p className="text-sm text-navy-500">
              전체 교류 {data.exchange.total}건
            </p>
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <FunnelRow label="대기" value={data.exchange.pending} />
            <FunnelRow label="연결됨" value={data.exchange.accepted} accent />
            <FunnelRow label="거절됨" value={data.exchange.declined} />
          </div>
        </Card>
      </section>

      {/* 기여 분석 */}
      <section>
        <SectionHeader title="기여 분석" />
        <Card className="space-y-4 p-4">
          <div>
            <p className="text-3xl font-extrabold text-gold-600">
              {data.contributions.totalPoints.toLocaleString('ko-KR')}
            </p>
            <p className="text-xs font-medium text-navy-400">누적 기여 점수</p>
          </div>
          <BarChart
            bare
            data={data.contributions.byType.map((t) => ({
              key: t.type,
              count: t.points,
            }))}
            labelFmt={(k) => contributionLabel[k] ?? k}
            emptyText="기여 내역이 없습니다."
          />
        </Card>
      </section>

      {/* 활발한 교류 회원 */}
      <section>
        <SectionHeader title="활발한 교류 회원" />
        {data.topConnectors.length === 0 ? (
          <Card className="p-5 text-center text-sm text-navy-400">
            아직 연결된 교류가 없습니다.
          </Card>
        ) : (
          <Card className="divide-y divide-navy-50">
            {data.topConnectors.map((t, i) => (
              <div key={t.memberId} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 shrink-0 text-center text-sm font-extrabold text-navy-400">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate font-semibold text-navy-800">
                  {t.name}
                </p>
                <span className="shrink-0 text-sm font-bold text-navy-500">
                  {t.count}건
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

/* ---------- 사설 헬퍼 ---------- */

// 퍼널 셀 (라벨 + 카운트)
function FunnelRow({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-navy-500">{label}</span>
      <span
        className={`text-lg font-extrabold ${
          accent ? 'text-emerald-600' : 'text-navy-900'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

// 가로 막대 한 줄 (라벨 + 카운트 + 최대값 대비 width%)
function BarRow({
  label,
  count,
  max,
}: {
  label: string
  count: number
  max: number
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-20 shrink-0 truncate text-sm text-navy-600">
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy-100">
        <div
          className="h-full rounded-full bg-navy-700"
          style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-bold text-gold-600">
        {count}
      </span>
    </div>
  )
}

// 막대 차트 묶음 (제목 + 항목들). bare=true면 Card 래퍼 없이 막대 행만 — 다른 카드 내부 재사용용.
type BarDatum = { key: string; count: number }

function BarChart({
  title,
  data,
  labelFmt,
  bare,
  emptyText = '데이터가 없습니다.',
}: {
  title?: string
  data: BarDatum[]
  labelFmt?: (key: string) => string
  bare?: boolean
  emptyText?: string
}) {
  const max = data.reduce((acc, d) => Math.max(acc, d.count), 0)
  const body =
    data.length === 0 ? (
      <p className="text-sm text-navy-400">{emptyText}</p>
    ) : (
      <div className="space-y-2.5">
        {data.map((d) => (
          <BarRow
            key={d.key}
            label={labelFmt ? labelFmt(d.key) : d.key}
            count={d.count}
            max={max}
          />
        ))}
      </div>
    )

  if (bare) return body
  return (
    <Card className="space-y-2.5 p-4">
      {title && <p className="mb-1 text-sm font-bold text-navy-800">{title}</p>}
      {body}
    </Card>
  )
}

/* ---------- 쿼리 래퍼 (계약 형태 명시) ---------- */

type AdminAnalyticsResult = {
  members: {
    total: number
    active: number
    pending: number
    suspended: number
    newThisMonth: number
  }
  cohorts: BarDatum[]
  universities: BarDatum[]
  industries: BarDatum[]
  regions: BarDatum[]
  requests: {
    total: number
    open: number
    matching: number
    connected: number
    closed: number
  }
  matchesDone: number
  exchange: {
    total: number
    pending: number
    accepted: number
    declined: number
    acceptRate: number
  }
  contributions: {
    totalPoints: number
    byType: { type: string; count: number; points: number }[]
  }
  topConnectors: { memberId: string; name: string; count: number }[]
  avgCompletion: number
}

function useAdminAnalytics(token: string): AdminAnalyticsResult | undefined {
  return useQuery(api.admin.analytics, { token }) as
    | AdminAnalyticsResult
    | undefined
}
