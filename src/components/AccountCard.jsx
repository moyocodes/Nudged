import { useEffect, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { deviceName, directLogin, loginStatus, startLogin, submitCode } from '../lib/account.js'

const field = 'w-full rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary'
const primaryBtn = 'min-h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-btn disabled:opacity-40'

// Sign in with just an email, no password. If the server asks for a code (REQUIRE_SIGNUP_CODE=true), Nudgy emails a
// link and a code, and while waiting checks every few seconds in case the link was opened on another device.
export default function AccountCard({ variant = 'sync' }) {
  const { account, setAccount, signOut } = useStore()
  const [email, setEmail] = useState('')
  const [pendingId, setPendingId] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Logging in with an email that has no account: offer to sign up with it, right here.
  const [unknownEmail, setUnknownEmail] = useState(false)
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

  // Switching between sign up and log in keeps the typed email but drops the old message.
  useEffect(() => {
    setError('')
    setUnknownEmail(false)
  }, [variant])

  async function signUp() {
    const started = await startLogin(email.trim())
    if (started.email) return setAccount({ email: started.email })
    if (started.demoCode) { setDemoCode(started.demoCode); setCode(started.demoCode) }
    setPendingId(started.pendingId)
  }

  async function signUpInstead() {
    setError('')
    setUnknownEmail(false)
    setBusy(true)
    try {
      await signUp()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function send(e) {
    e.preventDefault()
    setError('')
    setUnknownEmail(false)
    setBusy(true)
    try {
      // Logging in tries the email alone; signing up (and syncing from the Me page) goes through signUp.
      if (variant === 'login') {
        try {
          const s = await directLogin(email.trim())
          setAccount({ email: s.email })
          return setBusy(false)
        } catch (err) {
          // The server may be set to ask for a code on login too; otherwise the error is real.
          if (err.status === 404) {
            setUnknownEmail(true)
            return setBusy(false)
          }
          if (err.status !== 403) throw err
        }
      }
      await signUp()
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
            ? "Enter your email and you're in. No password, ever."
            : variant === 'login'
              ? 'Enter the email you signed up with and your list comes straight back.'
              : 'Same tasks, chat and points on your phone and laptop. No password, ever.'}
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
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setUnknownEmail(false) }} placeholder="you@example.com" aria-label="Email" autoComplete="email" className={field} />
          <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}>{variant === 'signup' ? (busy ? 'Signing up…' : 'Sign up') : busy ? 'Logging in…' : 'Log in'}</button>
        </form>
      )}
      {pendingId && demoCode && <p className="mt-2 text-xs text-ink/55">Demo mode: no email is sent. Use code <span className="font-semibold text-ink">{demoCode}</span>.</p>}
      {unknownEmail && (
        <div className="mt-3">
          <p className="text-sm text-ink/70">I don't know {email.trim()} yet. New here?</p>
          <button type="button" onClick={signUpInstead} disabled={busy} className={`${primaryBtn} mt-2`}>Sign me up with this email</button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      {pendingId && (
        <button type="button" onClick={() => { setPendingId(null); setCode(''); setError('') }} className="mt-2 text-xs font-semibold text-ink/50 hover:text-ink">
          Use a different email
        </button>
      )}
    </div>
  )
}
