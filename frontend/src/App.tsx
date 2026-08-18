import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyOtpPage from './pages/VerifyOtpPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import WorkspacePage from './pages/WorkspacePage'
import TerminalPage from './pages/TerminalPage'
import BoardPage from './pages/BoardPage'
import AuditPage from './pages/AuditPage'
import SandboxPage from './pages/SandboxPage'
import WorkspacesPage from './pages/WorkspacesPage'
import MembersPage from './pages/MembersPage'
import ProjectsPage from './pages/ProjectsPage'
import InboxPage from './pages/InboxPage'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="workspaces/:workspaceId/members" element={<MembersPage />} />
        <Route path="workspaces/:workspaceId/projects" element={<ProjectsPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="workspaces/:workspaceId/projects/:projectId/ide" element={<WorkspacePage />} />
        <Route path="workspaces/:workspaceId/projects/:projectId/board" element={<BoardPage />} />
        <Route path="workspaces/:workspaceId/projects/:projectId/board/:boardId" element={<BoardPage />} />
        <Route path="workspaces/:workspaceId/projects/:projectId/board/:boardId/audit" element={<AuditPage />} />
        <Route path="workspaces/:workspaceId/projects/:projectId/terminal" element={<TerminalPage />} />
        <Route path="workspaces/:workspaceId/projects/:projectId/terminal/:sessionId" element={<TerminalPage />} />
      </Route>
      <Route path="accept-invite" element={<Navigate to="/inbox" replace />} />
      <Route path="/sandbox" element={<SandboxPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
