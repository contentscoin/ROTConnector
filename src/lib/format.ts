// 도메인 라벨 / 포맷터

export const requestStatusLabel: Record<string, string> = {
  open: '접수',
  matching: '매칭중',
  connected: '연결완료',
  closed: '종료',
}

export const requestStatusTone: Record<string, string> = {
  open: 'bg-navy-100 text-navy-700',
  matching: 'bg-gold-400/30 text-gold-600',
  connected: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-navy-100 text-navy-400',
}

export const matchStatusLabel: Record<string, string> = {
  proposed: '제안',
  accepted: '수락',
  connected: '연결됨',
  done: '완료',
}

export const urgencyLabel: Record<string, string> = {
  low: '여유',
  normal: '보통',
  high: '급함',
}

export const urgencyTone: Record<string, string> = {
  low: 'text-navy-400',
  normal: 'text-navy-600',
  high: 'text-red-600',
}

export const connectionStatusLabel: Record<string, string> = {
  pending: '대기중',
  accepted: '연결됨',
  declined: '거절됨',
}

export const connectionStatusTone: Record<string, string> = {
  pending: 'bg-gold-400/30 text-gold-600',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-navy-100 text-navy-400',
}

export const contributionLabel: Record<string, string> = {
  intro: '소개',
  consult: '상담',
  sponsor: '후원',
  event: '행사 운영',
  onboarding: '온보딩',
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  const week = Math.floor(day / 7)
  if (week < 5) return `${week}주 전`
  return new Date(ts).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  })
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 기수 표시 포맷 ("37" → "37기", 숫자가 아니면 원본 유지)
export function formatCohort(cohort?: string): string {
  if (!cohort) return ''
  return /^\d+$/.test(cohort) ? `${cohort}기` : cohort
}

// 이름 이니셜 (아바타용)
export function initials(name: string): string {
  return name.trim().slice(-2)
}
