import {
  createContext,
  useCallback,
  useContext,
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
