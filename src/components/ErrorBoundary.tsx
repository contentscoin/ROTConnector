import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/**
 * 최상위 에러 경계.
 * 형식이 깨진 딥링크(예: /members/abc)나 일시적 백엔드 오류로
 * useQuery가 렌더 중 throw해도 앱 전체가 백색화면으로 죽지 않도록 막는다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  handleReset = () => {
    // 홈으로 강제 이동 + 경계 리셋 (잘못된 라우트에서 벗어남)
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle className="size-7" />
        </div>
        <div>
          <p className="text-lg font-extrabold text-navy-900">
            문제가 발생했습니다
          </p>
          <p className="mt-1 text-sm text-navy-500">
            잘못된 링크이거나 일시적인 오류일 수 있어요.
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="press h-11 rounded-xl bg-navy-800 px-5 font-semibold text-white"
        >
          홈으로 돌아가기
        </button>
      </div>
    )
  }
}
