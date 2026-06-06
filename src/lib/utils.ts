import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convex 서버 에러에서 사람이 읽을 메시지만 추출
export function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return '오류가 발생했습니다.'
  const m = err.message.match(/Uncaught Error:\s*([^\n]*)/)
  return m ? m[1].trim() : err.message
}

// "a, b, c" → ['a','b','c']
export function splitTags(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// 렌더 측 방어: http(s) 링크만 통과, 그 외(javascript: 등)는 무력화
export function safeUrl(url: string): string | undefined {
  return /^https?:\/\//i.test(url.trim()) ? url : undefined
}

// 콤마 구분 문자열에 태그 추가(중복 시 무시). TagSuggest 칩 클릭용.
export function addTag(current: string, tag: string): string {
  const tags = splitTags(current)
  if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return current
  return [...tags, tag].join(', ')
}
