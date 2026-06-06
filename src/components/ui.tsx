import { useState } from 'react'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { Loader2, Share2, Check } from 'lucide-react'
import { cn } from '../lib/utils'

/* ---------- Button ---------- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-navy-800 text-white hover:bg-navy-900 active:bg-navy-950 shadow-sm shadow-navy-900/15',
  secondary:
    'bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 active:bg-navy-100',
  ghost: 'bg-transparent text-navy-700 hover:bg-navy-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-900/15',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-13 px-5 text-base rounded-xl gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}) {
  return (
    <button
      className={cn(
        'press inline-flex items-center justify-center font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({
  className,
  children,
  ...props
}: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white border border-navy-100/80 shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ---------- Badge ---------- */
export function Badge({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className ?? 'bg-navy-100 text-navy-700',
      )}
    >
      {children}
    </span>
  )
}

/* ---------- Chip (filter) ---------- */
export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-navy-800 text-white'
          : 'bg-white text-navy-600 border border-navy-200 hover:bg-navy-50',
      )}
    >
      {children}
    </button>
  )
}

/* ---------- Avatar ---------- */
const avatarColors = [
  'bg-navy-700',
  'bg-navy-500',
  'bg-emerald-600',
  'bg-gold-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-teal-600',
]

export function Avatar({
  name,
  size = 'md',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const idx =
    [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % avatarColors.length
  const sizes = {
    sm: 'size-8 text-xs',
    md: 'size-11 text-sm',
    lg: 'size-16 text-xl',
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm ring-1 ring-black/5',
        avatarColors[idx],
        sizes[size],
      )}
    >
      {name.trim().slice(-2)}
    </div>
  )
}

/* ---------- Field / Input / Textarea ---------- */
export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-navy-800">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl border border-navy-200 bg-white px-3.5 py-3 text-navy-950 placeholder:text-navy-400 outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200 transition'

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(inputBase, 'min-h-28 resize-y', className)} {...props} />
  )
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, 'appearance-none', className)} {...props}>
      {children}
    </select>
  )
}

/* ---------- ShareButton ---------- */
// 네이티브 공유시트(navigator.share, 모바일에서 카톡 선택 가능) → 미지원 시 클립보드 복사.
export function ShareButton({
  title,
  text,
  url,
  label = '공유',
  className,
}: {
  title: string
  text?: string
  url?: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function onShare() {
    const shareUrl =
      url ?? (typeof window !== 'undefined' ? window.location.href : '')
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl })
      } catch {
        // 사용자가 공유를 취소한 경우 등 — 무시
      }
      return
    }
    try {
      await navigator.clipboard.writeText(
        `${text ? text + '\n' : ''}${shareUrl}`,
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // 클립보드 접근 불가 — 무시
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className={cn(
        'press inline-flex h-9 items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50',
        className,
      )}
    >
      {copied ? (
        <Check className="size-4 text-emerald-600" />
      ) : (
        <Share2 className="size-4" />
      )}
      {copied ? '복사됨' : label}
    </button>
  )
}

/* ---------- TagSuggest (콤마 입력 자동완성 칩) ---------- */
// 기존 값에 없는 추천 태그를 칩으로 노출 → 클릭 시 onAdd. 태그 파편화 완화.
export function TagSuggest({
  suggestions,
  value,
  onAdd,
}: {
  suggestions: string[]
  value: string
  onAdd: (tag: string) => void
}) {
  const current = new Set(
    value
      .split(/[,\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  const avail = suggestions
    .filter((s) => !current.has(s.toLowerCase()))
    .slice(0, 12)
  if (avail.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {avail.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onAdd(s)}
          className="rounded-full border border-navy-200 bg-white px-2.5 py-0.5 text-xs font-medium text-navy-500 hover:bg-navy-50"
        >
          + {s}
        </button>
      ))}
    </div>
  )
}

/* ---------- Spinner / states ---------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-6 animate-spin text-navy-400', className)} />
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-white/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-navy-400">{icon}</div>}
      <p className="font-semibold text-navy-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-navy-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function SkeletonRow() {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </Card>
  )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2.5" aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}
