import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import Lightfall from '../components/Lightfall'
import { Card3D, Shape3D, Floating3DScene } from '../components/Shape3D'

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
      {/* Left 3D Showcase Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-0 overflow-hidden border-r border-border/50">
        <div className="absolute inset-0">
          <Lightfall
            colors={['#00F5A0', '#00F0FF', '#7B2CBF']}
            backgroundColor="#0B0D12"
            speed={0.8}
            streakCount={8}
            streakWidth={1.2}
            streakLength={1.2}
            glow={1.2}
            density={0.8}
            twinkle={1}
            zoom={2.2}
            backgroundGlow={0.8}
            opacity={0.85}
            mouseInteraction={true}
            mouseStrength={1.2}
            mouseRadius={0.8}
          />
        </div>

        {/* Floating 3D Shapes */}
        <Floating3DScene count={6} />

        <div className="absolute inset-0 flex items-center justify-center z-10 p-8 pointer-events-none">
          <div className="text-center max-w-lg">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-surface-1/60 backdrop-blur-xl border border-white/10 mb-8 shadow-2xl animate-float">
              <Shape3D type="gem" size={64} color="#00F5A0" />
            </div>
            <h2 className="text-4xl font-bold text-text-primary mb-4 tracking-tight">
              <span className="gradient-text">Streams</span>
              <span className="text-text-muted font-normal ml-2">A Lot</span>
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed">
              Build, collaborate, and ship faster with real-time 3D interactive environments.
            </p>
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        {/* Background Lightfall accent on mobile */}
        <div className="lg:hidden absolute inset-0 opacity-30 pointer-events-none">
          <Lightfall
            colors={['#00F5A0', '#00F0FF', '#7B2CBF']}
            backgroundColor="#0B0D12"
            speed={0.5}
            streakCount={4}
            opacity={0.4}
          />
        </div>

        <div className="w-full max-w-md animate-fade-in-up">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-1 border border-border mb-4 shadow-glow">
              <Shape3D type="gem" size={40} color="#00F5A0" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary">
              <span className="gradient-text">Streams</span>
              <span className="text-text-muted font-normal ml-1.5">A Lot</span>
            </h1>
          </div>

          <Card3D maxTilt={8} className="p-1">
            <div className="card p-8 bg-surface-1/90 backdrop-blur-2xl border-white/10 shadow-2xl">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-text-primary mb-1 flex items-center gap-2">
                  Welcome back
                  <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
                </h1>
                <p className="text-text-secondary text-sm">Sign in to your 3D workspace</p>
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
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            </div>
          </Card3D>

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
