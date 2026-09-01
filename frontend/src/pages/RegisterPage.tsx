import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register, verifyOtp, resendOtp, login as apiLogin } from '../api/auth'
import { useAuthStore } from '../store/authStore'
// @ts-ignore
import Lightfall from '../components/Lightfall/Lightfall'

type Step = 'form' | 'otp'

function OTPInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const inputs = Array.from({ length: 6 })
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
        {inputs.map((_, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ''}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-12 h-14 text-center text-2xl tracking-widest font-mono bg-surface-2 border ${error ? 'border-crimson' : 'border-border'} rounded-xl text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow transition-all`}
          />
        ))}
      </div>
      {error && <p className="text-xs text-crimson mt-1">{error}</p>}
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const labels = ['Length 8+', 'Lowercase', 'Uppercase', 'Number', 'Special']
  const colors = ['bg-surface-4', 'bg-crimson', 'bg-warning', 'bg-accent', 'bg-cyan']
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {labels.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[Math.min(score - 1, 4)] : 'bg-surface-4'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map((passed, i) => (
          <span key={i} className={`text-[10px] uppercase tracking-wider font-medium ${passed ? 'text-accent' : 'text-text-muted'}`}>
            {labels[i]}
          </span>
        ))}
      </div>
    </div>
  )
}

function CountdownTimer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire()
      return
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, onExpire])
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  return (
    <span className="text-sm text-text-muted tabular-nums">
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('form')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({ email, password, password_confirm: passwordConfirm, first_name: firstName, last_name: lastName })
      setStep('otp')
      setSuccess('Check your email for the verification code.')
    } catch (err: any) {
      const msg = err.response?.data
      if (typeof msg === 'object') setError(Object.values(msg).flat().join(' '))
      else setError(msg || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await verifyOtp(email, otp)
      const loginData = await apiLogin(email, password)
      setAuth(loginData.tokens.access, loginData.tokens.refresh, loginData.user)
      navigate('/')
    } catch (err: any) {
      const msg = err.response?.data
      if (typeof msg === 'object') setError(Object.values(msg).flat().join(' '))
      else setError(msg || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    setError('')
    try {
      await resendOtp(email)
      setOtp('')
      setExpired(false)
      setSuccess('A new code has been sent.')
    } catch {
      setError('Failed to resend. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Lightfall
          colors={['#A6C8FF', '#5227FF', '#FF9FFC']}
          backgroundColor="#0A29FF"
          speed={0.8}
          streakCount={6}
          streakWidth={1}
          streakLength={1}
          glow={1}
          density={0.8}
          twinkle={1}
          zoom={2.5}
          backgroundGlow={0.6}
          opacity={0.6}
          mouseInteraction={true}
          mouseStrength={0.8}
          mouseRadius={0.6}
        />
      </div>

      <div className="w-full max-w-md px-6 relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-violet mb-4 shadow-glow animate-scale-in">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            <span className="gradient-text">Streams</span>
            <span className="text-text-muted font-normal ml-1.5">A Lot</span>
          </h1>
          <p className="text-text-muted mt-2">
            {step === 'form' ? 'Create your account' : 'Verify your email'}
          </p>
        </div>

        <div className="card p-6">
          {step === 'form' ? (
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in-down">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">First name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="input" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Last name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="input" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="you@example.com" autoComplete="email" />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" placeholder="••••••••" autoComplete="new-password" />
                {password && <PasswordStrength password={password} />}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">Confirm password</label>
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required className="input" placeholder="••••••••" autoComplete="new-password" />
              </div>

              <button type="submit" disabled={loading} className="w-full btn-primary py-3">
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {error && (
                <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in-down">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-success/10 border border-success/20 text-success text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in-down">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              )}

              <p className="text-sm text-text-secondary">
                We sent a 6-digit code to <span className="text-text-primary font-medium">{email}</span>
              </p>

              <OTPInput value={otp} onChange={setOtp} error={error} />

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {expired ? 'Code expired' : 'Expires in '}<CountdownTimer seconds={900} onExpire={() => setExpired(true)} />
                </span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!expired}
                  className="text-sm text-accent hover:text-accent-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resend code
                </button>
              </div>

              <button type="submit" disabled={loading || otp.length !== 6} className="w-full btn-primary py-3">
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-text-muted mt-6 animate-fade-in-up">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}