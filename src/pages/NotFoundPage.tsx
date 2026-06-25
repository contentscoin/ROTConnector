import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-rise">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-navy-50 text-navy-300 ring-1 ring-navy-100 shadow-card">
        <Compass className="size-9" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-navy-900 text-balance">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-1.5 text-sm text-navy-400">
        주소가 변경되었거나 삭제되었을 수 있습니다.
      </p>
      <Link to="/" className="mt-6">
        <Button>홈으로 돌아가기</Button>
      </Link>
    </div>
  )
}
