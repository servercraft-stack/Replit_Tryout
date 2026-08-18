import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { verifyOtp, resendOtp } from '../api/auth'

export default function VerifyOtpPage() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await verifyOtp(email, otp)
      navigate('/login')
    } catch (err: any) {
      const msg = err.response?.data
      if (typeof msg === 'object') setError(Object.values(msg).flat().join(' '))
      else setError(msg || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setSuccess('')
    try {
      await resendOtp(email)
      setSuccess('A new code has been sent.')
    } catch {
      setError('Failed to resend code.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />

      <div className="w-full max-w-md px-6 relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 mb-4 shadow-glow animate-scale-in">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V9m0 0l3 3m-3-3l-3 3m3-7.5a9 9 0 11-6.364 2.636A9 9 0 0112 4.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            <span className="gradient-text">Streams</span>
            <span className="text-text-muted font-normal ml-1.5">A Lot</span>
          </h1>
          <p className="text-text-muted mt-2 text-sm">Enter the verification code sent to your email</p>
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

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Verification code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                className="input text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="000000"
              />
            </div>
          </div>

          <button type="submit" disabled={loading || otp.length !== 6} className="w-full btn-primary py-3">
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <button type="button" onClick={handleResend} className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors">
            Resend code
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
