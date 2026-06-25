import { Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Layout } from './components/Layout'
import { LoadingScreen } from './components/ui'
import { useSession } from './lib/session'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { MemberDetailPage } from './pages/MemberDetailPage'
import { RequestsPage } from './pages/RequestsPage'
import { NewRequestPage } from './pages/NewRequestPage'
import { RequestDetailPage } from './pages/RequestDetailPage'
import { ConnectionsPage } from './pages/ConnectionsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { MyProfilePage } from './pages/MyProfilePage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { EventsPage } from './pages/EventsPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

function Protected({
  admin,
  children,
}: {
  admin?: boolean
  children: ReactNode
}) {
  const { token, member, isLoading, isAdmin } = useSession()
  if (!token) return <Navigate to="/login" replace />
  if (isLoading) return <LoadingScreen />
  if (!member) return <Navigate to="/login" replace />
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/members/:id" element={<MemberDetailPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route
          path="/requests/new"
          element={
            <Protected>
              <NewRequestPage />
            </Protected>
          }
        />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route
          path="/connections"
          element={
            <Protected>
              <ConnectionsPage />
            </Protected>
          }
        />
        <Route
          path="/notifications"
          element={
            <Protected>
              <NotificationsPage />
            </Protected>
          }
        />
        <Route
          path="/me"
          element={
            <Protected>
              <MyProfilePage />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected admin>
              <AdminDashboardPage />
            </Protected>
          }
        />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  )
}
