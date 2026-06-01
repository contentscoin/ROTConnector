import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { LogIn, Info } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useSession } from '../lib/session'
import { Button, Card, Field, Input } from '../components/ui'

export function LoginPage() {
  const { token, setToken } = useSession()
  const login = useMutation(api.auth.login)
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (token) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await login({ phone })
      setToken(res.token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? cleanError(err.message) : '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-navy-800 text-sm font-black text-gold-400">
          ROT
        </div>
        <h1 className="text-xl font-extrabold text-navy-900">알비연 링크</h1>
        <p className="mt-1 text-sm text-navy-400">
          회원 휴대폰 번호로 로그인하세요.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="휴대폰 번호" required>
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="010-0000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            loading={loading}
            className="w-full"
            disabled={!phone.trim()}
          >
            <LogIn className="size-4.5" />
            로그인
          </Button>
        </form>
      </Card>

      <div className="mt-4 flex gap-2 rounded-xl bg-navy-100/60 p-3 text-xs text-navy-500">
        <Info className="size-4 shrink-0 text-navy-400" />
        <div>
          <p className="font-semibold text-navy-600">데모 계정</p>
          <p>운영진: 010-1111-0000 (김도현)</p>
          <p>회원: 010-2222-0001 (이상훈) 등</p>
          <p className="mt-1">
            등록되지 않은 번호는 운영진이 먼저 회원 등록을 해야 합니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function cleanError(msg: string): string {
  // Convex 에러 프리픽스 제거
  const m = msg.match(/Uncaught Error:\s*(.*?)(\n|$)/)
  return m ? m[1] : msg
}
