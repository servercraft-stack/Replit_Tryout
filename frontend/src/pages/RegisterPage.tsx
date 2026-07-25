import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register, verifyOtp, resendOtp, login as apiLogin } from '../api/auth'
import { useAuthStore } from '../store/authStore'

type Step = 'form' | 'otp'

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
    try { await resendOtp(email); setSuccess('A new code has been sent.') }
    catch { setError('Failed to resend.') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/3 -left-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />

      <div className="w-full max-w-md px-6 relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4 animate-scale-in glow-sm">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">
            <span className="gradient-text">Streams</span>
            <span className="text-zinc-400 font-normal ml-1">A Lot</span>
          </h1>
          <p className="text-zinc-500 mt-2">
            {step === 'form' ? 'Create your account' : 'Verify your email'}
          </p>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl animate-fade-in-down">{error}</div>}

            <div className="grid grid-cols-2 gap-3 animate-fade-in-up stagger-1">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-400">First name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                  className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 hover-lift" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-400">Last name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                  className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 hover-lift" />
              </div>
            </div>

            <div className="space-y-1.5 animate-fade-in-up stagger-2">
              <label className="block text-sm font-medium text-zinc-400">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 hover-lift"
                placeholder="you@example.com" />
            </div>

            <div className="space-y-1.5 animate-fade-in-up stagger-3">
              <label className="block text-sm font-medium text-zinc-400">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 hover-lift"
                placeholder="••••••••" />
            </div>

            <div className="space-y-1.5 animate-fade-in-up stagger-4">
              <label className="block text-sm font-medium text-zinc-400">Confirm password</label>
              <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 hover-lift"
                placeholder="••••••••" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 hover-lift hover-glow animate-fade-in-up stagger-5">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl animate-fade-in-down">{error}</div>}
            {success && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl animate-fade-in-down">{success}</div>}

            <p className="text-sm text-zinc-400 animate-fade-in-up stagger-1">
              We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
            </p>

            <div className="space-y-1.5 animate-fade-in-up stagger-2">
              <label className="block text-sm font-medium text-zinc-400">Verification code</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 text-center text-2xl tracking-[0.5em] font-mono hover-lift"
                placeholder="000000" />
            </div>

            <button type="submit" disabled={loading || otp.length !== 6}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 hover-lift hover-glow animate-fade-in-up stagger-3">
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <button type="button" onClick={handleResendOtp}
              className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              Resend code
            </button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-500 mt-6 animate-fade-in-up stagger-5">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
