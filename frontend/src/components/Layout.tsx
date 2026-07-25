import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-1 border-r border-border flex flex-col shrink-0 animate-slide-in-left">
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-lg font-bold tracking-tight text-white">
            <span className="gradient-text">Streams</span>
            <span className="text-zinc-400 font-normal ml-1">A Lot</span>
          </h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink
            active={location.pathname === '/'}
            onClick={() => navigate('/')}
          >
            <IconGrid />
            Dashboard
          </NavLink>
        </nav>

        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-semibold animate-scale-in">
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
            <ThemeToggle />
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="mt-3 w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-surface-0">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-accent/10 text-accent hover-glow'
          : 'text-zinc-400 hover:text-white hover:bg-surface-3 hover-lift'
      }`}
    >
      {children}
    </button>
  )
}

function IconGrid() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
