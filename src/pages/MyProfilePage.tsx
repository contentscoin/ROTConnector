import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { LogOut, Save, Award, ShieldCheck, Check } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useSession } from '../lib/session'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  SectionHeader,
  Select,
  TagSuggest,
  Textarea,
} from '../components/ui'
import { requestStatusLabel, requestStatusTone } from '../lib/format'
import { addTag, errorMessage, splitTags } from '../lib/utils'
import { profileCompleteness } from '../lib/profile'

const regions = ['', '서울', '경기', '인천', '부산', '대구', '대전', '광주', '기타']

export function MyProfilePage() {
  const { token, member, logout } = useSession()
  const update = useMutation(api.members.update)
  const myRequests = useQuery(api.requests.mine, token ? { token } : 'skip')
  const pool = useQuery(api.members.tagPool, {})

  const [form, setForm] = useState(() => ({
    name: member?.name ?? '',
    title: member?.title ?? '',
    company: member?.company ?? '',
    cohort: member?.cohort ?? '',
    university: member?.university ?? '',
    region: member?.region ?? '',
    intro: member?.intro ?? '',
    products: member?.products ?? '',
    customers: member?.customers ?? '',
    industry: (member?.industry ?? []).join(', '),
    helpOffer: (member?.helpOffer ?? []).join(', '),
    helpNeed: (member?.helpNeed ?? []).join(', '),
  }))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!member) return null

  // 입력값 기준 실시간 완성도 (저장 전에도 반영)
  const completeness = profileCompleteness({
    intro: form.intro,
    company: form.company,
    title: form.title,
    cohort: form.cohort,
    university: form.university,
    region: form.region,
    industry: splitTags(form.industry),
    helpOffer: splitTags(form.helpOffer),
    helpNeed: splitTags(form.helpNeed),
  })

  function set<K extends keyof typeof form>(k: K, val: string) {
    setForm((f) => ({ ...f, [k]: val }))
    setSaved(false)
  }

  async function onSave() {
    if (!token) return
    setError(null)
    setSaving(true)
    try {
      await update({
        token,
        patch: {
          name: form.name.trim(),
          title: form.title.trim(),
          company: form.company.trim(),
          cohort: form.cohort.trim() || undefined,
          university: form.university.trim() || undefined,
          region: form.region,
          intro: form.intro.trim(),
          products: form.products.trim() || undefined,
          customers: form.customers.trim() || undefined,
          industry: splitTags(form.industry),
          helpOffer: splitTags(form.helpOffer),
          helpNeed: splitTags(form.helpNeed),
        },
      })
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <Card className="flex items-center gap-4 p-5 shadow-elevated">
        <Avatar name={member.name} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-navy-900">
              {member.name}
            </h1>
            {member.isAdmin && (
              <Badge className="bg-gold-400/30 text-gold-600">
                <ShieldCheck className="mr-0.5 size-3" />
                운영진
              </Badge>
            )}
          </div>
          <p className="flex items-center gap-1 text-sm font-semibold text-gold-600">
            <Award className="size-3.5" />
            기여 점수 {member.contributionScore}
          </p>
        </div>
        <Link
          to={`/members/${member._id}`}
          className="text-sm font-semibold text-navy-500"
        >
          공개 프로필
        </Link>
      </Card>

      {/* 프로필 완성도 */}
      {completeness.percent < 100 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold text-navy-800">프로필 완성도</p>
            <span className="text-sm font-bold text-navy-700">
              {completeness.percent}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
            <div
              className="h-full rounded-full bg-navy-700 transition-all"
              style={{ width: `${completeness.percent}%` }}
            />
          </div>
          {completeness.missing.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {completeness.missing.map((f) => (
                <span
                  key={f.key}
                  className="rounded-full bg-gold-400/15 px-2.5 py-0.5 text-xs font-medium text-gold-600"
                >
                  {f.label} 추가
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-navy-400">
            완성된 프로필일수록 더 잘 연결됩니다.
          </p>
        </Card>
      )}

      {/* 편집 폼 */}
      <Card className="space-y-4 p-5">
        <p className="font-bold text-navy-800">내 사업 소개 / 프로필</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="이름" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="기수">
            <Input
              placeholder="예: 37 (기수 숫자)"
              value={form.cohort}
              onChange={(e) => set('cohort', e.target.value)}
            />
          </Field>
          <Field label="출신 학교">
            <Input
              placeholder="예: 한양대"
              value={form.university}
              onChange={(e) => set('university', e.target.value)}
            />
          </Field>
          <Field label="직함">
            <Input
              placeholder="대표"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <div className="col-span-2">
            <Field label="회사">
              <Input
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Field label="지역">
          <Select value={form.region} onChange={(e) => set('region', e.target.value)}>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r || '선택 안함'}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="사업 소개">
          <Textarea
            placeholder="어떤 사업을 하고 계신가요?"
            value={form.intro}
            onChange={(e) => set('intro', e.target.value)}
          />
        </Field>

        <Field label="주요 제품/서비스" hint="한 줄로 간단히 (최대 200자)">
          <Input
            placeholder="예: B2B 인사관리 SaaS"
            value={form.products}
            onChange={(e) => set('products', e.target.value)}
          />
        </Field>
        <Field label="주요 고객" hint="한 줄로 간단히 (최대 200자)">
          <Input
            placeholder="예: 50인 이하 스타트업"
            value={form.customers}
            onChange={(e) => set('customers', e.target.value)}
          />
        </Field>

        <Field label="업종" hint="쉼표로 구분 (예: IT/SaaS, 마케팅)">
          <Input
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
          />
          <TagSuggest
            suggestions={pool?.industries ?? []}
            value={form.industry}
            onAdd={(t) => set('industry', addTag(form.industry, t))}
          />
        </Field>
        <Field label="줄 수 있는 도움" hint="쉼표로 구분">
          <Input
            value={form.helpOffer}
            onChange={(e) => set('helpOffer', e.target.value)}
          />
          <TagSuggest
            suggestions={pool?.helps ?? []}
            value={form.helpOffer}
            onAdd={(t) => set('helpOffer', addTag(form.helpOffer, t))}
          />
        </Field>
        <Field label="필요한 도움" hint="쉼표로 구분">
          <Input
            value={form.helpNeed}
            onChange={(e) => set('helpNeed', e.target.value)}
          />
          <TagSuggest
            suggestions={pool?.helps ?? []}
            value={form.helpNeed}
            onAdd={(t) => set('helpNeed', addTag(form.helpNeed, t))}
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={onSave}
          loading={saving}
          disabled={!form.name.trim()}
        >
          {saved ? <Check className="size-4.5" /> : <Save className="size-4.5" />}
          {saved ? '저장됨' : '저장하기'}
        </Button>
      </Card>

      {/* 내 도움요청 */}
      <section>
        <SectionHeader title="내 도움요청" />
        {myRequests && myRequests.length > 0 ? (
          <div className="space-y-2.5">
            {myRequests.map((r) => (
              <Link key={r._id} to={`/requests/${r._id}`} className="press block">
                <Card className="lift flex items-center gap-3 p-4 hover:border-navy-200 hover:shadow-soft">
                  <Badge className={requestStatusTone[r.status]}>
                    {requestStatusLabel[r.status]}
                  </Badge>
                  <span className="flex-1 truncate font-semibold text-navy-800">
                    {r.title}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-5 text-center text-sm text-navy-400">
            아직 등록한 도움요청이 없습니다.
          </Card>
        )}
      </section>

      <Button variant="ghost" className="w-full text-red-600" onClick={logout}>
        <LogOut className="size-4.5" />
        로그아웃
      </Button>
    </div>
  )
}
