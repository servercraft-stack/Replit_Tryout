import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset } from '../api/auth'
import Lightfall from '../components/Lightfall'

function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 1)
    const newValue = value.split('')
    newValue[index] = val
    onChange(newValue.join(''))
    if (val && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`)
      next?.focus()
    }
  }
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`)
      prev?.focus()
    }
  }
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Verification code</label>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ''}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-12 h-14 text-center text-2xl tracking-widest font-mono bg-surface-2 border border-border rounded-xl text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow transition-all"
          />
        ))}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const emailParam = searchParams.get('email') || ''
  const [email, setEmail] = useState(emailParam)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmPasswordReset(email, otp, newPassword, confirmPassword)
      setSuccess('Your password has been reset successfully.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      const msg = err.response?.data
      if (typeof msg === 'object') setError(Object.values(msg).flat().join(' '))
      else setError(msg || 'Password reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Lightfall
          colors={['#00F5A0', '#00F0FF', '#7B2CBF']}
          backgroundColor="#0B0D12"
          speed={0.6}
          streakCount={6}
          streakWidth={1}
          streakLength={1}
          glow={1}
          density={0.6}
          twinkle={1}
          zoom={2.2}
          backgroundGlow={0.6}
          opacity={0.6}
          mouseInteraction={true}
        />
      </div>
      <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] bg-crimson/5 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-1/3 -left-32 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: '3s' }} />

      <div className="w-full max-w-md px-6 relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-crimson mb-4 shadow-glow animate-scale-in">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM18.364 5.636l-2.12 2.12M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            <span className="gradient-text">Streams</span>
            <span className="text-text-muted font-normal ml-1.5">A Lot</span>
          </h1>
          <p className="text-text-muted mt-2">Reset your password</p>
        </div>

        <div className="card p-6">
          {success ? (
            <div className="text-center space-y-4 animate-fade-in-up">
              <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-1">Password reset successful</h3>
                <p className="text-sm text-text-secondary">
                  Your password has been reset. Redirecting to login...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in-down">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

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

              <OTPInput value={otp} onChange={setOtp} />

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" disabled={loading || otp.length !== 6} className="w-full btn-primary py-3">
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-text-muted mt-6 animate-fade-in-up">
          <Link to="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">Back to login</Link>
        </p>
      </div>
    </div>
  )
}