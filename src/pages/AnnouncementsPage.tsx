import { useState, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Megaphone, Pin, Plus } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useSession } from '../lib/session'
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonList,
  Textarea,
} from '../components/ui'
import { useToast } from '../lib/toast'
import { timeAgo } from '../lib/format'
import { errorMessage } from '../lib/utils'
import { useFormSubmit } from '../lib/hooks'

type Category = 'notice' | 'promotion' | 'bizroom'

const CATEGORY_TABS: { key: Category | undefined; label: string }[] = [
  { key: undefined, label: '전체' },
  { key: 'notice', label: '공지' },
  { key: 'promotion', label: '홍보' },
  { key: 'bizroom', label: '비즈룸' },
]

const categoryLabel: Record<Category, string> = {
  notice: '공지',
  promotion: '홍보',
  bizroom: '비즈룸',
}
const categoryTone: Record<Category, string> = {
  notice: 'bg-red-100 text-red-700',
  promotion: 'bg-gold-400/30 text-gold-600',
  bizroom: 'bg-navy-100 text-navy-600',
}

export function AnnouncementsPage() {
  const { token, member, isAdmin } = useSession()
  const [category, setCategory] = useState<Category | undefined>(undefined)
  const [showForm, setShowForm] = useState(false)

  const items = useQuery(api.announcements.list, {
    category: category ?? undefined,
  })

  return (
    <div className="space-y-5">
      <PageHeader title="커뮤니티" />

      {/* Category tabs */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {CATEGORY_TABS.map((tab) => (
          <Chip
            key={tab.label}
            active={category === tab.key}
            onClick={() => setCategory(tab.key)}
          >
            {tab.label}
          </Chip>
        ))}
      </div>

      {/* Create button */}
      {member && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowForm((prev) => !prev)}
        >
          <Plus className="size-4" />
          글쓰기
        </Button>
      )}

      {/* Creation form */}
      {showForm && member && token && (
        <CreateForm
          token={token}
          isAdmin={isAdmin}
          onDone={() => setShowForm(false)}
        />
      )}

      {/* List */}
      {items === undefined ? (
        <SkeletonList count={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-10" />}
          title="게시글이 없습니다"
          description="첫 글을 작성해 보세요."
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <AnnouncementCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

type AnnouncementItem = FunctionReturnType<typeof api.announcements.list>[number]

function AnnouncementCard({ item }: { item: AnnouncementItem }) {
  const [expanded, setExpanded] = useState(false)
  const { token, member, isAdmin } = useSession()
  const archive = useMutation(api.announcements.archive)
  const { toast } = useToast()

  const canDelete =
    member && (isAdmin || member._id === item.author?._id)

  async function onArchive() {
    if (!token) return
    try {
      await archive({ token, id: item._id })
      toast('삭제되었습니다.')
    } catch (err) {
      toast(errorMessage(err))
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge className={categoryTone[item.category]}>
          {categoryLabel[item.category]}
        </Badge>
        {item.pinned && (
          <Pin className="size-3.5 text-gold-500" />
        )}
        <span className="ml-auto text-xs text-navy-400">
          {timeAgo(item.createdAt)}
        </span>
      </div>
      <p className="font-bold text-navy-900">{item.title}</p>
      <p
        className={`mt-1 text-sm text-navy-600 whitespace-pre-wrap ${
          !expanded && item.body.length > 120 ? 'line-clamp-3' : ''
        }`}
      >
        {item.body}
      </p>
      {item.body.length > 120 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 text-xs font-semibold text-navy-500"
        >
          더보기
        </button>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-navy-400">
          {item.author?.name}
          {item.author?.company ? ` · ${item.author.company}` : ''}
        </span>
        {canDelete && (
          <button
            onClick={onArchive}
            className="text-xs text-red-500 hover:text-red-700"
          >
            삭제
          </button>
        )}
      </div>
    </Card>
  )
}

function CreateForm({
  token,
  isAdmin,
  onDone,
}: {
  token: string
  isAdmin: boolean
  onDone: () => void
}) {
  const create = useMutation(api.announcements.create)
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [cat, setCat] = useState<Category>(isAdmin ? 'notice' : 'promotion')

  const categories: Category[] = isAdmin
    ? ['notice', 'promotion', 'bizroom']
    : ['promotion', 'bizroom']

  const handler = useCallback(async () => {
    await create({ token, title: title.trim(), body: body.trim(), category: cat })
    toast('게시글이 등록되었습니다.')
    onDone()
  }, [create, token, title, body, cat, toast, onDone])

  const { submit, loading, error } = useFormSubmit(handler)

  return (
    <Card className="space-y-3 p-4">
      <form onSubmit={submit} className="space-y-3">
        <Field label="카테고리">
          <Select value={cat} onChange={(e) => setCat(e.target.value as Category)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="제목" required>
          <Input
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="내용" required>
          <Textarea
            placeholder="내용을 입력하세요"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            loading={loading}
            disabled={!title.trim() || !body.trim()}
          >
            등록
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            취소
          </Button>
        </div>
      </form>
    </Card>
  )
}
