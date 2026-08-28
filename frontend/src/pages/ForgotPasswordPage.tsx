import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../api/auth'
import Lightfall from '../components/Lightfall'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSuccess('If that email is registered, a reset link has been sent.')
    } catch (err: any) {
      const msg = err.response?.data
      if (typeof msg === 'object') setError(Object.values(msg).flat().join(' '))
      else setError(msg || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <Lightfall
          colors={['#A6C8FF', '#5227FF', '#FF9FFC']}
          backgroundColor="#080B14"
          speed={0.6}
          streakCount={5}
          glow={1}
          density={0.7}
          twinkle={0.8}
          zoom={2.2}
          backgroundGlow={0.5}
          opacity={0.5}
          mouseInteraction={true}
        />
      </div>

      <div className="absolute top-12 right-16 w-28 h-28 rounded-2xl bg-gradient-to-br from-purple-500/10 to-accent/10 backdrop-blur-md border border-white/10 shadow-2xl transform rotate-6 animate-float pointer-events-none" />

      <div className="w-full max-w-md px-6 relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 mb-4 shadow-glow animate-scale-in">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75V15m0 0v.01M12 15h.01M20.25 8.25L10.5 15 6.75 11.25" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            <span className="gradient-text">Streams</span>
            <span className="text-text-muted font-normal ml-1.5">A Lot</span>
          </h1>
          <p className="text-text-muted mt-2 text-sm">Enter your email and we'll send you a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}
          {success && (
            <div className="bg-success/10 border border-success/20 text-success text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full btn-primary py-3">
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6 animate-fade-in-up">
          Back to{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
