import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { listMyInvitations, type Invitation } from '../api/invitations'
import ThemeToggle from './ThemeToggle'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: DashboardIcon },
  { path: '/workspaces', label: 'Workspaces', icon: WorkspacesIcon },
  { path: '/inbox', label: 'Inbox', icon: InboxIcon },
  { path: '/profile', label: 'Profile', icon: ProfileIcon },
]

export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const [inviteCount, setInviteCount] = useState(0)

  useEffect(() => {
    listMyInvitations()
      .then((data: any[]) => {
        setInviteCount(data.filter((i: Invitation) => i.status === 'pending').length)
      })
      .catch(() => {})
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <aside className="w-64 bg-surface-1/80 backdrop-blur-xl border-r border-border flex flex-col shrink-0 animate-slide-in-left">
        <div className="px-5 py-5 border-b border-border">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-text-primary tracking-tight">
                <span className="gradient-text">Streams</span>
              </h1>
              <p className="text-[10px] text-text-muted font-medium -mt-0.5">A Lot</p>
            </div>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                location.pathname === item.path
                  ? 'bg-accent/10 text-accent shadow-glow'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <item.icon active={location.pathname === item.path} />
              {item.label}
              {item.path === '/inbox' && inviteCount > 0 && (
                <span className="ml-auto bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {inviteCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center text-accent text-sm font-semibold">
                {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface-1" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-text-muted truncate">{user?.email}</p>
            </div>
            <ThemeToggle />
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="w-full btn-ghost text-xs justify-center"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-surface-0">
        <Outlet />
      </main>
    </div>
  )
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-accent' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}

function WorkspacesIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-accent' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
    </svg>
  )
}

function InboxIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-accent' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-accent' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}
