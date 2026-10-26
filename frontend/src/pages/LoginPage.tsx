import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import Lightfall from '../components/Lightfall'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [rateLimited, setRateLimited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([])
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const addToast = useCallback((message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  useEffect(() => {
    if (error) {
      addToast(error)
      if (error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('429')) {
        setRateLimited(true)
      }
    }
  }, [error, addToast])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setRateLimited(false)
    setLoading(true)
    try {
      const data = await login(email, password)
      setAuth(data.tokens.access, data.tokens.refresh, data.user)
      navigate('/')
    } catch (err: any) {
      const msg = err.response?.data
      if (typeof msg === 'string') setError(msg)
      else if (typeof msg === 'object') setError(Object.values(msg).flat().join(' '))
      else setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-surface-0 relative overflow-hidden">
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-0 overflow-hidden">
        <div className="absolute inset-0">
          <Lightfall
            colors={['#00F5A0', '#00F0FF', '#7B2CBF', '#5227FF', '#FF9FFC']}
            backgroundColor="#0B0D12"
            speed={1}
            streakCount={8}
            streakWidth={1.2}
            streakLength={1}
            glow={1.2}
            density={1}
            twinkle={1}
            zoom={2}
            backgroundGlow={0.8}
            opacity={1}
            mouseInteraction={true}
            mouseStrength={1}
            mouseRadius={0.6}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface-0/80 via-transparent to-surface-0/30 pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center px-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-violet mb-6 shadow-glow animate-scale-in">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-text-primary mb-4">
              <span className="gradient-text">Streams</span>
              <span className="text-text-muted font-normal ml-2">A Lot</span>
            </h2>
            <p className="text-text-secondary text-lg max-w-md mx-auto">
              Build, collaborate, and ship faster with real-time collaborative coding environments.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-violet mb-4 shadow-glow animate-scale-in">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-text-primary">
              <span className="gradient-text">Streams</span>
              <span className="text-text-muted font-normal ml-1.5">A Lot</span>
            </h1>
          </div>

          <div className="card p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-text-primary mb-1">Welcome back</h1>
              <p className="text-text-secondary text-sm">Sign in to your workspace</p>
            </div>

            {rateLimited && (
              <div className="bg-warning/10 border border-warning/20 text-warning text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2 animate-fade-in-down">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Too many attempts. Please wait a moment before trying again.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border bg-surface-2 accent-accent" />
                  <span className="text-text-secondary">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-accent hover:text-accent-hover transition-colors font-medium">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-text-muted mt-6 animate-fade-in-up">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent hover:text-accent-hover transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-error/90 backdrop-blur-sm text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-down"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}