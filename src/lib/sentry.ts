import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

/**
 * Sentry 초기화 (VITE_SENTRY_DSN 환경변수가 설정된 경우에만 활성화)
 */
export function initSentry() {
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // 세션 리플레이(replayIntegration)는 번들이 커져 미도입 —
    // 성능 트레이싱만 사용한다.
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
  })
}

/**
 * 에러를 Sentry에 리포팅 (DSN 미설정 시 no-op)
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!dsn) return
  Sentry.captureException(error, { extra: context })
}

export { Sentry }
