import { useStore } from '../lib/store.jsx'
import { THEMES } from '../lib/themes.js'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card } from '../components/ui.jsx'
import { ChevronIcon } from '../components/Icons.jsx'
import AccountCard from '../components/AccountCard.jsx'
import InstallButton from '../components/InstallButton.jsx'
import { playAlarm } from '../lib/alarm.js'
import SoundPicker from '../components/SoundPicker.jsx'

export default function SettingsPage() {
  // "Sync devices" in the top bar links to #account; jump to it.
  useEffect(() => {
    if (window.location.hash === '#account') document.getElementById('account')?.scrollIntoView({ block: 'center' })
  }, [])
  const { chat, name, setName, theme, setTheme, accents, setAccent, resetDemo, openTutorial, schedule, setSchedule, setIntroSeen, voiceOn, setVoiceOn, say, rundownMode, setRundownMode, nudgeModel, setNudgeModel, buddyName, setBuddyName,  } = useStore()
  const setTime = (key) => (e) => e.target.value && setSchedule((s) => ({ ...s, [key]: e.target.value }))
  const timeField = 'mt-1 w-full rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="font-display text-[1.75rem] leading-tight">Me</h1>
      <Card>
        <label htmlFor="name" className="text-sm font-medium text-ink/70">What should I call you?</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-2 w-full rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary"
        />
      </Card>

      <Card>
        <label htmlFor="buddy" className="text-sm font-medium text-ink/70">What should your Nudgy be called?</label>
        <input
          id="buddy"
          value={buddyName}
          onChange={(e) => setBuddyName(e.target.value.slice(0, 24))}
          placeholder="Nudgy"
          className="mt-2 w-full rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {name && (
            <button type="button" onClick={() => setBuddyName(`${name}'s Nudgy`.slice(0, 24))} className="rounded-full bg-ink/5 px-3 py-1.5 text-sm font-semibold text-ink/70 hover:bg-ink/10">
              Use {name}'s Nudgy
            </button>
          )}
          <button type="button" onClick={() => setBuddyName('Nudgy')} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink/50 hover:bg-ink/5">Back to Nudgy</button>
        </div>
      </Card>

      <Card id="account">
        <AccountCard />
      </Card>

      <Link to="/history" className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-card border-[length:var(--bw)] border-line hover:bg-ink/[0.02]">
        <span>
          <span className="block font-display text-xl">Our chat</span>
          <span className="block text-sm text-ink/55">{chat.length ? `${chat.filter((m) => m.from === 'you').length} brain dumps so far, and how it's going.` : 'Everything you tell me, kept on this device.'}</span>
        </span>
        <ChevronIcon size={18} className="-rotate-90 shrink-0 text-ink/40" />
      </Link>

      <Card className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-display text-xl">Alarm sound</span>
          <span className="block text-sm text-ink/55">Plays on every nudge while Nudgy is open.</span>
          <button type="button" onClick={playAlarm} className="mt-1 text-xs font-semibold text-primary hover:underline">Play it</button>
        </span>
      </Card>

      <Card>
        <h2 className="font-display text-xl">Background sound</h2>
        <p className="mt-1 text-sm text-ink/55">Keeps playing softly while you use Nudgy.</p>
        <SoundPicker />
      </Card>

      <InstallButton className="w-full" />

      <Card className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-display text-xl">Nudgy talks out loud</span>
          <span className="block text-sm text-ink/55">Uses your device's voice. Off means speech bubbles only.</span>
        </span>
        <input
          type="checkbox"
          checked={voiceOn}
          onChange={(e) => { setVoiceOn(e.target.checked); if (e.target.checked) setTimeout(() => say(`Hi ${name || 'friend'}! This is my voice. Fancy, right?`), 50) }}
          aria-label="Nudgy talks out loud"
          className="h-6 w-6 shrink-0 accent-[var(--primary)]"
        />
      </Card>

      <Card>
        <h2 className="font-display text-xl">Sleep hours</h2>
        <p className="mt-1 text-sm text-ink/55">
          I won't nudge you about low-priority things while you sleep. Medium and high still get through.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-ink/60">
            Bedtime
            <input type="time" value={schedule.sleepStart} onChange={setTime('sleepStart')} className={timeField} />
          </label>
          <label className="text-xs font-medium text-ink/60">
            Wake up
            <input type="time" value={schedule.sleepEnd} onChange={setTime('sleepEnd')} className={timeField} />
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-ink/60">
          Daily nudge for tasks with no date
          <input type="time" value={schedule.checkIn} onChange={setTime('checkIn')} className={timeField} />
        </label>
      </Card>

      <Card>
        <h2 className="font-display text-xl">Today's rundown</h2>
        <p className="mt-1 text-sm text-ink/55">How often it opens by itself. It's always one tap away on Today.</p>
        <div role="radiogroup" aria-label="How often the rundown opens" className="mt-3 flex flex-wrap gap-1.5">
          {[['always', 'Every visit'], ['4h', 'Every 4 hours'], ['daily', 'Once a day'], ['never', 'Only when I tap']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rundownMode === value}
              onClick={() => setRundownMode(value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${rundownMode === value ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl">Nudge voice</h2>
        <p className="mb-3 text-sm text-ink/60">Which Meta model writes your nudges.</p>
        <div role="radiogroup" aria-label="Nudge voice" className="flex flex-wrap gap-2">
          {[['open', 'Muse Spark Open · Baseten'], ['modal', 'Muse Spark Open · Modal'], ['spark', 'Muse Spark · Meta']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={nudgeModel === value}
              onClick={() => setNudgeModel(value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${nudgeModel === value ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <section>
        <h2 className="font-display text-xl">Nudgy's personality</h2>
        <p className="mb-3 text-sm text-ink/60">Changes the look and the attitude.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {THEMES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={theme === t.id}
                data-theme={t.id}
                className={`h-full w-full rounded-2xl border-[length:var(--bw)] border-line bg-bg p-4 text-left text-ink shadow-card transition ${
                  theme === t.id ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-lg">{t.name}</span>
                  <span className="flex gap-1">
                    {t.swatch.map((c) => (
                      <span key={c} className="h-5 w-5 rounded-full ring-1 ring-ink/15" style={{ background: c }} />
                    ))}
                  </span>
                </div>
                <p className="text-sm text-ink/60">{t.vibe}</p>
                <p className="mt-2 rounded-xl bg-surface p-3 text-sm">
                  “{t.sample(name || 'Friend')}”
                </p>
              </button>
            </li>
          ))}
        </ul>
        {(() => {
          const active = THEMES.find((t) => t.id === theme)
          const picked = accents[theme] ?? active.accents[0].id
          return (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink/60">{active.name} colour</span>
              <div role="radiogroup" aria-label={`${active.name} colour`} className="flex gap-1.5">
                {active.accents.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={picked === a.id}
                    onClick={() => setAccent(theme, a.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${picked === a.id ? 'bg-ink/10 text-ink ring-2 ring-primary' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: a.primary }} />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={openTutorial}>How to use Nudgy</Button>
        <Button variant="ghost" onClick={() => setIntroSeen(false)}>Replay the intro</Button>
      </div>
      <Button variant="ghost" onClick={resetDemo}>Clear all my tasks</Button>
    </div>
  )
}
