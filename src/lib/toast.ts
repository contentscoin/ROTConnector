import { createContext, useContext } from 'react'

// 토스트 컨텍스트/훅은 컴포넌트 파일(ui.tsx)에서 분리한다 —
// 컴포넌트 파일이 컴포넌트 외 값을 export하면 Fast Refresh가 깨진다.
export type ToastType = 'success' | 'error' | 'info'

export type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}
