import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../api/auth'
import Lightfall from '../components/Lightfall'
import { Card3D, Shape3D, Floating3DScene } from '../components/Shape3D'

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
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden p-6">
      <div className="absolute inset-0 opacity-40">
        <Lightfall
          colors={['#00F5A0', '#00F0FF', '#7B2CBF']}
          backgroundColor="#0B0D12"
          speed={0.6}
          streakCount={6}
          opacity={0.6}
        />
      </div>

      <Floating3DScene count={4} />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-1 border border-white/10 mb-4 shadow-2xl animate-float">
            <Shape3D type="pyramid" size={42} color="#7B2CBF" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            <span className="gradient-text">Streams</span>
            <span className="text-text-muted font-normal ml-1.5">A Lot</span>
          </h1>
          <p className="text-text-muted mt-2 text-sm">Enter your email and we'll send you a reset link</p>
        </div>

        <Card3D maxTilt={6}>
          <form onSubmit={handleSubmit} className="card p-6 bg-surface-1/90 backdrop-blur-2xl border-white/10 shadow-2xl space-y-5">
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
        </Card3D>

        <p className="text-center text-sm text-text-muted mt-6 animate-fade-in-up">
          Back to{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
