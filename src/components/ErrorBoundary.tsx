import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

type Props = { children: ReactNode }
type State = { hasError: boolean; errorMessage: string | null }

/**
 * 최상위 에러 경계.
 * 형식이 깨진 딥링크(예: /members/abc)나 일시적 백엔드 오류로
 * useQuery가 렌더 중 throw해도 앱 전체가 백색화면으로 죽지 않도록 막는다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Production에서는 에러 리포팅 서비스로 전송
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-5 px-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle className="size-8" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-navy-900">
            문제가 발생했습니다
          </h1>
          <p className="mt-1.5 text-sm text-navy-500">
            잘못된 링크이거나 일시적인 오류일 수 있어요.
          </p>
          {this.state.errorMessage && (
            <p className="mt-2 rounded-lg bg-navy-100 px-3 py-2 text-xs text-navy-600 break-words">
              {this.state.errorMessage}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={this.handleRetry}
            className="press flex items-center gap-2 rounded-xl bg-navy-800 px-5 h-11 font-semibold text-white"
            aria-label="다시 시도"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            다시 시도
          </button>
          <button
            onClick={this.handleGoHome}
            className="press flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-5 h-11 font-semibold text-navy-700"
            aria-label="홈으로"
          >
            <Home className="size-4" aria-hidden="true" />
            홈으로
          </button>
        </div>
      </div>
    )
  }
}
