import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { ChevronLeft } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useSession } from '../lib/session'
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  TagSuggest,
  Textarea,
  useToast,
} from '../components/ui'
import { addTag, splitTags } from '../lib/utils'
import { useFormSubmit } from '../lib/hooks'

const categories = [
  '투자',
  '영업',
  '채용',
  '법률',
  '세무/회계',
  '마케팅',
  '제휴',
  '해외',
  '부동산',
  '물류',
  '기타',
]
const regions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '기타']
const urgencies = [
  { value: 'low', label: '여유' },
  { value: 'normal', label: '보통' },
  { value: 'high', label: '급함' },
] as const

export function NewRequestPage() {
  const { token } = useSession()
  const createRequest = useMutation(api.requests.create)
  const tagSuggestions = useQuery(api.requests.tagSuggestions, {})
  const navigate = useNavigate()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [region, setRegion] = useState('')
  const [tags, setTags] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'high'>('normal')

  const handler = useCallback(async () => {
    if (!token) return
    const id = await createRequest({
      token,
      title: title.trim(),
      body: body.trim(),
      category,
      region: region || undefined,
      tags: splitTags(tags),
      urgency,
    })
    toast('도움요청이 등록되었습니다.')
    navigate(`/requests/${id}`, { replace: true })
  }, [token, createRequest, title, body, category, region, tags, urgency, toast, navigate])

  const { submit, loading, error } = useFormSubmit(handler)

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-semibold text-navy-500"
      >
        <ChevronLeft className="size-4" />
        뒤로
      </button>
      <PageHeader eyebrow="알비연 링크" title="도움요청 등록" />

      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <Field label="제목" required>
            <Input
              placeholder="어떤 도움이 필요하신가요?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </Field>

          <Field label="상세 내용" required hint="배경과 원하는 도움을 구체적으로 적어주세요.">
            <Textarea
              placeholder="예) 시리즈A 준비 중입니다. 외식/소비재 투자자를 소개받고 싶습니다."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="분류" required>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="지역">
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택 안함</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="태그" hint="쉼표로 구분 (예: 투자유치, F&B)">
            <Input
              placeholder="투자유치, F&B"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <TagSuggest
              suggestions={tagSuggestions ?? []}
              value={tags}
              onAdd={(t) => setTags(addTag(tags, t))}
            />
          </Field>

          <Field label="긴급도">
            <div className="grid grid-cols-3 gap-2">
              {urgencies.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    urgency === u.value
                      ? 'border-navy-800 bg-navy-800 text-white'
                      : 'border-navy-200 bg-white text-navy-600'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </Field>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            loading={loading}
            className="w-full"
            disabled={!title.trim() || !body.trim()}
          >
            등록하기
          </Button>
        </form>
      </Card>
    </div>
  )
}
