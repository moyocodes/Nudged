import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import Mascot from '../components/Mascot.jsx'
import AccountCard from '../components/AccountCard.jsx'
import { Button, Card } from '../components/ui.jsx'

// After the name: are you new (sign up) or coming back (log in)? Both end the same way, just an email with no
// password, but a returning user's saved list and name replace what's on this device. If an account has no name
// yet (someone who skipped it), the one question comes here.
export default function LoginPage() {
  const { account, name, setName, hydrated } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  // 'signup' | 'login' | null (not chosen yet). "Already have an account? Log in" arrives with mode = login.
  const [mode, setMode] = useState(location.state?.mode ?? null)
  const [value, setValue] = useState('')
  // Give the account's saved data a moment to arrive; if the server is slow, carry on anyway.
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (!account) return setWaited(false)
    const id = setTimeout(() => setWaited(true), 4000)
    return () => clearTimeout(id)
  }, [account])
  const ready = hydrated || waited

  useEffect(() => {
    if (account && name) navigate('/', { replace: true })
  }, [account, name, navigate])

  function save(e) {
    e.preventDefault()
    if (value.trim()) setName(value.trim())
  }

  const choice = 'min-h-12 w-full rounded-full px-6 text-[15px] font-semibold transition-colors'

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6">
      <Mascot size={72} nudging={!!account} />
      {account ? (
        !ready ? (
          <p className="text-ink/60">Getting your things…</p>
        ) : (
          <>
            <h1 className="text-center font-display text-[2rem] leading-tight">One thing: what should I call you?</h1>
            <form onSubmit={save} className="flex w-full max-w-sm flex-col gap-3">
              <label htmlFor="your-name" className="sr-only">What should I call you?</label>
              <input
                id="your-name"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Your name"
                className="min-h-12 rounded-full border-[length:var(--bw)] border-line bg-surface px-5 text-base shadow-card outline-none placeholder:text-ink/45 focus:ring-2 focus:ring-primary/40"
              />
              <Button type="submit" disabled={!value.trim()}>Let's go</Button>
            </form>
          </>
        )
      ) : !mode ? (
        <>
          <h1 className="text-center font-display text-[2rem] leading-tight">{name ? `Nice to meet you, ${name}.` : 'Welcome.'}</h1>
          <p className="max-w-sm text-center text-ink/60">New here, or been here before?</p>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <button type="button" onClick={() => setMode('signup')} className={`${choice} bg-primary text-on-primary shadow-btn hover:bg-primary-dark`}>I'm new: sign me up</button>
            <button type="button" onClick={() => setMode('login')} className={`${choice} border-[length:var(--bw)] border-line bg-surface text-ink shadow-btn hover:bg-ink/5`}>I have an account: log in</button>
          </div>
          <Link to="/welcome" className="text-sm font-semibold text-ink/50 hover:text-ink">Back</Link>
        </>
      ) : (
        <>
          <h1 className="text-center font-display text-[2rem] leading-tight">{mode === 'signup' ? 'Sign up.' : 'Welcome back.'}</h1>
          <Card className="w-full max-w-sm">
            <AccountCard variant={mode} />
          </Card>
          <button type="button" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-sm font-semibold text-ink/55 hover:text-ink">
            {mode === 'signup' ? 'I already have an account' : "I'm new here"}
          </button>
        </>
      )}
    </div>
  )
}
