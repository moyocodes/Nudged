import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import Mascot from '../components/Mascot.jsx'
import AccountCard from '../components/AccountCard.jsx'
import TermsModal from '../components/TermsModal.jsx'
import { Button, Card } from '../components/ui.jsx'

// After the name: are you new (sign up) or coming back (log in)? Both end the same way, just an email with no
// password, but a returning user's saved list and name replace what's on this device. If an account has no name
// yet (someone who skipped it), the one question comes here.
export default function LoginPage() {
  const { account, name, setName, hydrated, schedule, setSchedule, termsAcceptedAt, setTermsAcceptedAt } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  // 'signup' | 'login' | null (not chosen yet). "Already have an account? Log in" arrives with mode = login.
  const [mode, setMode] = useState(location.state?.mode ?? null)
  const [value, setValue] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  // Give the account's saved data a moment to arrive; if the server is slow, carry on anyway.
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (!account) return setWaited(false)
    const id = setTimeout(() => setWaited(true), 4000)
    return () => clearTimeout(id)
  }, [account])
  const ready = hydrated || waited

  useEffect(() => {
    if (account && name && termsAcceptedAt) navigate('/', { replace: true })
  }, [account, name, termsAcceptedAt, navigate])

  function save(e) {
    e.preventDefault()
    if (value.trim()) setName(value.trim())
  }

  const setTime = (key) => (e) => e.target.value && setSchedule((s) => ({ ...s, [key]: e.target.value }))
  const timeField = 'mt-1 w-full rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary'

  const choice = 'min-h-12 w-full rounded-full px-6 text-[15px] font-semibold transition-colors'

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6">
      <Mascot size={72} nudging={!!account} />
      {account ? (
        !ready ? (
          <p className="text-ink/60">Getting your things…</p>
        ) : name ? (
          <>
            <h1 className="text-center font-display text-[2rem] leading-tight">When should I let you sleep?</h1>
            <p className="max-w-sm text-center text-ink/60">No reminder emails during these hours. Whatever's still undone lands in your inbox when you wake. Happy with these? Change them now or any time in Settings.</p>
            <Card className="w-full max-w-sm">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-ink/60">
                  Bedtime
                  <input type="time" value={schedule.sleepStart} onChange={setTime('sleepStart')} className={timeField} />
                </label>
                <label className="text-xs font-medium text-ink/60">
                  Wake up
                  <input type="time" value={schedule.sleepEnd} onChange={setTime('sleepEnd')} className={timeField} />
                </label>
              </div>
              <label className="mt-4 flex items-start gap-2 text-sm text-ink/70">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                <span>I agree to the <button type="button" onClick={() => setShowTerms(true)} className="font-semibold text-primary underline">terms and conditions</button></span>
              </label>
              <Button className="mt-4 w-full" disabled={!agreed} onClick={() => setTermsAcceptedAt(new Date().toISOString())}>Let's go</Button>
            </Card>
            {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
          </>
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
              <Button type="submit" disabled={!value.trim()}>Next</Button>
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
