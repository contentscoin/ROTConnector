import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Compass className="size-12 text-navy-300" />
      <h1 className="mt-4 text-2xl font-extrabold text-navy-900">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-1 text-sm text-navy-400">
        주소가 변경되었거나 삭제되었을 수 있습니다.
      </p>
      <Link to="/" className="mt-6">
        <Button>홈으로 돌아가기</Button>
      </Link>
    </div>
  )
}
