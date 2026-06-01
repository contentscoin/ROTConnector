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
