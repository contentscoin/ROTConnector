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
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    // 프로덕션에서만 전체 세션 리플레이, 에러 시 100%
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
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
