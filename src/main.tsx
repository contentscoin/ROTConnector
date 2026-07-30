import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SessionProvider } from './lib/session'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui'

const convexUrl = import.meta.env.VITE_CONVEX_URL as string
if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is not set. Check .env.local / Vercel env.')
}
const convex = new ConvexReactClient(convexUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ConvexProvider client={convex}>
        <BrowserRouter>
          <SessionProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </SessionProvider>
        </BrowserRouter>
      </ConvexProvider>
    </ErrorBoundary>
  </StrictMode>,
)
