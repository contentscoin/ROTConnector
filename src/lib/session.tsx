import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'

const TOKEN_KEY = 'rot_token'

type SessionValue = {
  token: string | null
  member: Doc<'members'> | null
  isLoading: boolean
  isAdmin: boolean
  setToken: (t: string | null) => void
  logout: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  )
  const logoutMutation = useMutation(api.auth.logout)

  // token 없으면 쿼리 skip. me === undefined → 로딩 중.
  const me = useQuery(api.auth.me, token ? { token } : 'skip')

  const setToken = useCallback((t: string | null) => {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
    setTokenState(t)
  }, [])

  // 유령 세션 정리: 로딩 완료 후 토큰이 무효(만료·삭제)면 me === null →
  // 토큰을 비워 '재로그인 영구 잠금' 트랩을 방지. (me === undefined는 로딩 중이라 제외)
  // 비동기 서버 응답(me)에 클라이언트 토큰/localStorage를 동기화하는 외부-시스템 sync이며
  // 가드(token && me===null)로 단발 실행이라 캐스케이딩 렌더가 없다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token && me === null) setToken(null)
  }, [token, me, setToken])

  const logout = useCallback(() => {
    if (token) void logoutMutation({ token }).catch(() => {})
    setToken(null)
  }, [token, logoutMutation, setToken])

  const value: SessionValue = {
    token,
    member: token ? (me ?? null) : null,
    isLoading: token != null && me === undefined,
    isAdmin: !!me?.isAdmin,
    setToken,
    logout,
  }

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
