import { useState, useCallback, type FormEvent } from 'react'
import { errorMessage } from './utils'

/**
 * 폼 제출 시 loading/error/success 상태를 표준화하는 훅.
 * 뮤테이션 호출을 감싸서 일관된 UX를 제공한다.
 *
 * @example
 * const { submit, loading, error } = useFormSubmit(async () => {
 *   await createRequest({ token, title, body })
 *   navigate('/requests')
 * })
 * <form onSubmit={submit}>...</form>
 */
export function useFormSubmit(
  handler: () => Promise<void>,
  options?: { onError?: (msg: string) => void },
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      setLoading(true)
      try {
        await handler()
      } catch (err) {
        const msg = errorMessage(err)
        setError(msg)
        options?.onError?.(msg)
      } finally {
        setLoading(false)
      }
    },
    [handler, options],
  )

  const clearError = useCallback(() => setError(null), [])

  return { submit, loading, error, clearError }
}
