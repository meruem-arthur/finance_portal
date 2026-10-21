import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DEMO_MODE } from '../lib/financeData'

export default function AdminLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/admin')
    } catch (err) {
      setError(err.message || 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 w-full max-w-sm">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-bright)]/80 mb-1">GESA UMaT</p>
        <h1 className="display text-2xl font-bold mb-1">Finance admin sign in</h1>
        <p className="text-white/50 text-sm mb-6">Only the finance executive can enter or edit records.</p>

        {DEMO_MODE && (
          <p className="text-xs text-[var(--gold-bright)]/80 bg-[var(--gold)]/10 border border-[var(--line)] rounded-lg px-3 py-2 mb-4">
            Demo mode — no Firebase project connected yet. Any email and password will sign you in so you can preview the admin view.
          </p>
        )}

        <label className="block text-xs text-white/50 mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="focus-ring w-full mb-4 rounded-xl bg-white/5 border border-[var(--line)] px-3 py-2.5 text-sm outline-none"
          placeholder="finance@gesa.umat.edu.gh"
        />
        <label className="block text-xs text-white/50 mb-1.5">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="focus-ring w-full mb-5 rounded-xl bg-white/5 border border-[var(--line)] px-3 py-2.5 text-sm outline-none"
          placeholder="••••••••"
        />

        {error && <p className="text-rose-300 text-xs mb-4">{error}</p>}

        <button type="submit" disabled={busy} className="btn-glass w-full disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
