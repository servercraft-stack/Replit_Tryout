import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
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
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />

      <div className="w-full max-w-md px-6 relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4 animate-scale-in glow-sm">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">
            <span className="gradient-text">Streams</span>
            <span className="text-zinc-400 font-normal ml-1">A Lot</span>
          </h1>
          <p className="text-zinc-500 mt-2">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl animate-fade-in-down">
              {error}
            </div>
          )}

          <div className="space-y-1.5 animate-fade-in-up stagger-1">
            <label className="block text-sm font-medium text-zinc-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 hover-lift"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5 animate-fade-in-up stagger-2">
            <label className="block text-sm font-medium text-zinc-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 hover-lift"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 hover-lift hover-glow animate-fade-in-up stagger-3"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 mt-6 animate-fade-in-up stagger-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent hover:text-accent-hover transition-colors font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
