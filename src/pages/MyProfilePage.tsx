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
  Select,
  Textarea,
} from '../components/ui'
import { requestStatusLabel, requestStatusTone } from '../lib/format'
import { errorMessage, splitTags } from '../lib/utils'

const regions = ['', '서울', '경기', '인천', '부산', '대구', '대전', '광주', '기타']

export function MyProfilePage() {
  const { token, member, logout } = useSession()
  const update = useMutation(api.members.update)
  const myRequests = useQuery(api.requests.mine, token ? { token } : 'skip')

  const [form, setForm] = useState(() => ({
    name: member?.name ?? '',
    title: member?.title ?? '',
    company: member?.company ?? '',
    cohort: member?.cohort ?? '',
    region: member?.region ?? '',
    intro: member?.intro ?? '',
    industry: (member?.industry ?? []).join(', '),
    helpOffer: (member?.helpOffer ?? []).join(', '),
    helpNeed: (member?.helpNeed ?? []).join(', '),
  }))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!member) return null

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
          cohort: form.cohort.trim(),
          region: form.region,
          intro: form.intro.trim(),
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
      <div className="flex items-center gap-4">
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
      </div>

      {/* 편집 폼 */}
      <Card className="space-y-4 p-5">
        <p className="font-bold text-navy-800">내 사업 소개 / 프로필</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="이름" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="기수">
            <Input
              placeholder="학군 38기"
              value={form.cohort}
              onChange={(e) => set('cohort', e.target.value)}
            />
          </Field>
          <Field label="직함">
            <Input
              placeholder="대표"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <Field label="회사">
            <Input
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
            />
          </Field>
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

        <Field label="업종" hint="쉼표로 구분 (예: IT/SaaS, 마케팅)">
          <Input
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
          />
        </Field>
        <Field label="줄 수 있는 도움" hint="쉼표로 구분">
          <Input
            value={form.helpOffer}
            onChange={(e) => set('helpOffer', e.target.value)}
          />
        </Field>
        <Field label="필요한 도움" hint="쉼표로 구분">
          <Input
            value={form.helpNeed}
            onChange={(e) => set('helpNeed', e.target.value)}
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
        <h2 className="mb-2.5 text-lg font-extrabold text-navy-900">
          내 도움요청
        </h2>
        {myRequests && myRequests.length > 0 ? (
          <div className="space-y-2.5">
            {myRequests.map((r) => (
              <Link key={r._id} to={`/requests/${r._id}`} className="press block">
                <Card className="flex items-center gap-3 p-4 hover:shadow-soft">
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
