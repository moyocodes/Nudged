import { useEffect, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { deviceName, directLogin, loginStatus, startLogin, submitCode } from '../lib/account.js'

const field = 'w-full rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary'
const primaryBtn = 'min-h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-btn disabled:opacity-40'

// Sign in with just an email: Nudgy emails a link and a code that confirm this device.
// While waiting, it checks every few seconds in case the link was opened on another device.
export default function AccountCard({ variant = 'sync' }) {
  const { account, setAccount, signOut } = useStore()
  const [email, setEmail] = useState('')
  const [pendingId, setPendingId] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // The server's demo code, when it has one (no email service connected). Shown so nobody has to dig in a terminal.
  const [demoCode, setDemoCode] = useState('')

  useEffect(() => {
    if (!pendingId) return
    const id = setInterval(async () => {
      try {
        const s = await loginStatus()
        if (s.email) {
          setAccount({ email: s.email })
          setPendingId(null)
        }
      } catch {}
    }, 3000)
    return () => clearInterval(id)
  }, [pendingId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // Logging in needs only the email. Signing up (and syncing a new device from the Me page) sends the code.
      if (variant === 'login') {
        try {
          const s = await directLogin(email.trim())
          setAccount({ email: s.email })
          return setBusy(false)
        } catch (err) {
          // The server may be set to ask for a code on login too; otherwise the error is real.
          if (err.status !== 403) throw err
        }
      }
      const started = await startLogin(email.trim())
      if (started.email) { setAccount({ email: started.email }); return setBusy(false) }
      if (started.demoCode) { setDemoCode(started.demoCode); setCode(started.demoCode) }
      setPendingId(started.pendingId)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function check(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const s = await submitCode(pendingId, code)
      setAccount({ email: s.email })
      setPendingId(null)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  if (account) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-display text-xl">Synced</span>
          <span className="block truncate text-sm text-ink/55">{account.email} · {deviceName()}</span>
        </span>
        <button type="button" onClick={signOut} className="min-h-10 shrink-0 rounded-full border-[length:var(--bw)] border-line px-4 text-sm font-semibold text-ink/70 hover:bg-ink/5">
          Log out
        </button>
      </div>
    )
  }

  return (
    <div>
      {variant === 'sync' ? <h2 className="font-display text-xl">Log in to sync</h2> : null}
      <p className="mt-1 text-sm text-ink/55">
        {pendingId
          ? `I emailed ${email.trim()} a link and a code. Open the link (on any device) or type the code here.`
          : variant === 'signup'
            ? 'Enter your email and I will send you a code to confirm it. No password, ever.'
            : variant === 'login'
              ? 'Enter the email you signed up with and your list comes straight back.'
              : 'Same tasks, chat and points on your phone and laptop. No password: I email you to confirm each device.'}
      </p>
      {pendingId ? (
        <form onSubmit={check} className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            aria-label="Code from the email"
            className={`${field} tracking-widest`}
          />
          <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>Confirm</button>
        </form>
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" autoComplete="email" className={field} />
          <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}>{variant === 'login' ? (busy ? 'Logging in…' : 'Log in') : busy ? 'Sending…' : 'Email me'}</button>
        </form>
      )}
      {pendingId && demoCode && <p className="mt-2 text-xs text-ink/55">Demo mode: no email is sent. Use code <span className="font-semibold text-ink">{demoCode}</span>.</p>}
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      {pendingId && (
        <button type="button" onClick={() => { setPendingId(null); setCode(''); setError('') }} className="mt-2 text-xs font-semibold text-ink/50 hover:text-ink">
          Use a different email
        </button>
      )}
    </div>
  )
}
