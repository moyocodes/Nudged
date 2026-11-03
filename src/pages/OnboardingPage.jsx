import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { Button } from '../components/ui.jsx'
import Mascot from '../components/Mascot.jsx'
import InstallButton from '../components/InstallButton.jsx'
import { ArrowIcon, BellIcon, CameraIcon, CheckIcon, FlameIcon, MicIcon, UserIcon } from '../components/Icons.jsx'

const tile = 'rounded-3xl border-[length:var(--bw)] border-line bg-surface p-5 shadow-card'
const label = 'text-xs font-semibold uppercase tracking-wider text-ink/45'

// How it works, shown rather than told: each step is a tiny piece of the real app.
function HowItWorks() {
  const steps = [
    {
      title: 'Dump it',
      body: 'Talk or type. Typos and umms welcome.',
      demo: (
        <p className="rounded-2xl rounded-bl-md bg-ink/[0.04] px-4 py-3 font-mono text-sm leading-relaxed text-ink/70">
          ugh ok. dentist?? oat milk. yinka's tmrw like 5pm
        </p>
      ),
    },
    {
      title: 'Nudged sorts it',
      body: 'Times, repeats and the who-what-when.',
      demo: (
        <ul className="flex flex-col gap-1.5">
          {[['Book the dentist', 'No date · I’ll ask'], ['Buy oat milk', 'Today, 6:00 PM'], ['Go to Yinka’s', 'Tomorrow, 5:00 PM']].map(([t, d]) => (
            <li key={t} className="flex items-center gap-2.5 rounded-xl bg-bg px-3 py-2">
              <span className="h-4 w-4 shrink-0 rounded-full border-[1.5px] border-ink/25" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{t}</span>
              <span className="shrink-0 text-xs text-ink/45">{d}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: 'Get nudged',
      body: 'Until it’s done. Snooze if you must.',
      demo: (
        <div className="rounded-2xl bg-soft px-4 py-3">
          <p className="flex gap-2 text-sm leading-snug"><BellIcon size={15} className="mt-0.5 shrink-0 text-primary" /> Oat milk won't buy itself. I checked.</p>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <span className="rounded-full px-3 py-1 text-xs font-semibold text-ink/50">Snooze</span>
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">Done</span>
          </div>
        </div>
      ),
    },
  ]
  return (
    <section>
      <p className={`${label} text-center`}>How it works</p>
      <h2 className="mt-2 text-center font-display text-[2rem] leading-tight">Messy in, tidy out.</h2>
      <p className="mt-2 text-center text-sm text-ink/50">An example, start to finish.</p>
      <ol className="mt-8 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {steps.flatMap((s, i) => [
          <li key={s.title} className={`${tile} flex flex-col gap-4`}>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-sm text-primary">0{i + 1}</span>
              <h3 className="font-display text-xl">{s.title}</h3>
            </div>
            <div className="flex-1">{s.demo}</div>
            <p className="text-sm text-ink/55">{s.body}</p>
          </li>,
          i < steps.length - 1 && (
            <li key={`arrow${i}`} aria-hidden className="grid place-items-center text-ink/25">
              <ArrowIcon size={20} className="rotate-90 md:rotate-0" />
            </li>
          ),
        ])}
      </ol>
    </section>
  )
}

// The features as a bento grid: one big voice tile, the rest sized to what they show.
function Features() {
  const levels = ['Nudge', 'Nudge', 'Prod', 'Shove']
  return (
    <section>
      <p className={`${label} text-center`}>What's inside</p>
      <h2 className="mt-2 text-center font-display text-[2rem] leading-tight">Small app, big nudge.</h2>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <div className={`${tile} flex flex-col justify-between gap-6 md:col-span-2 md:row-span-2`}>
          <div>
            <MicIcon size={22} className="text-primary" />
            <h3 className="mt-3 font-display text-2xl">Brain-dump by voice</h3>
            <p className="mt-1 max-w-sm text-ink/60">Say it like you'd tell a friend. Say "send" when you're done, and Nudged sorts the lot.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-bg p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary"><MicIcon size={18} /></span>
            <span className="flex h-8 min-w-0 flex-1 items-center justify-between overflow-hidden" aria-hidden>
              {[3, 6, 4, 8, 5, 7, 3, 6, 8, 4, 6, 3, 5, 7, 4, 2, 5, 3].map((h, i) => (
                <span key={i} className="w-1 shrink-0 rounded-full bg-primary/50" style={{ height: `${h * 12}%` }} />
              ))}
            </span>
            <span className="text-sm text-ink/50">"…and send"</span>
          </div>
        </div>

        <div className={tile}>
          <BellIcon size={20} className="text-primary" />
          <h3 className="mt-3 font-semibold">Nudges that escalate</h3>
          <p className="mt-1 text-sm text-ink/60">Fresh lines every time, getting louder.</p>
          <ol className="mt-4 flex items-center gap-1" aria-label="Gentle to dramatic">
            {levels.map((l, i) => (
              <li key={l} className={`flex-1 rounded-full py-1 text-center text-[11px] font-semibold ${i === levels.length - 1 ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/60'}`}>{l}</li>
            ))}
          </ol>
        </div>

        <div className={tile}>
          <CameraIcon size={20} className="text-primary" />
          <h3 className="mt-3 font-semibold">Pics or it didn't happen</h3>
          <p className="mt-1 text-sm text-ink/60">Snap a photo when an errand's done.</p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-on-primary">
            <CheckIcon size={12} strokeWidth={2.5} /> Complete · +15
          </span>
        </div>

        <div className={tile}>
          <FlameIcon size={20} className="text-primary" />
          <h3 className="mt-3 font-semibold">Coins, and what they're for</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink/60">
            <li><span className="font-semibold text-ink">+10</span> for every task, <span className="font-semibold text-ink">+15</span> more with photo proof</li>
            <li>Snoozing is free: <span className="font-semibold text-ink">30 min</span>, <span className="font-semibold text-ink">1 hour</span> or <span className="font-semibold text-ink">90 min</span>, and coins are never taken for ignoring a nudge</li>
            <li><span className="font-semibold text-ink">5</span> coins to play the nudge-break game</li>
          </ul>
        </div>

        <div className={tile}>
          <UserIcon size={20} className="text-primary" />
          <h3 className="mt-3 font-semibold">On every device</h3>
          <p className="mt-1 text-sm text-ink/60">Just your email. Same list on phone and laptop.</p>
        </div>
      </div>
    </section>
  )
}

// Real lines Nudged has written (the model writes fresh ones each time). No names, no made-up users.
const SAMPLES = [
  '"Call mum back" is aging like milk. Shall we?',
  'Time to bill-ieve in yourself. Send that invoice!',
  'I’ve nudged you three times. I’m basically a woodpecker now.',
]

// What Nudged is built on, and where it stops, stated plainly.
const MODELS = [
  ['Muse Spark', 'Reads what you type or say, finds every reminder in it, asks when it needs to, and writes the nudges.'],
  ['Muse Voice Transcribe', 'Turns your voice into text as you talk, for the brain-dump.'],
  ['SAM 3.1', 'Looks for the thing in your photo, so photo proof is checked, not just accepted.'],
  ['Muse Image', 'Draws your own badges from what you actually did.'],
]
const LIMITS = [
  'Nudges arrive while Nudged is open in a browser tab. Pushing them to a closed app is not built yet.',
  'Your email is only for signing in. Your tasks and chat are saved to your account so they follow you between devices.',
  'Built from scratch for the Meta Global AI Developer Hackathon, 26 October to 4 November 2026.',
]

function BuiltOn() {
  return (
    <section>
      <p className={`${label} text-center`}>Under the hood</p>
      <h2 className="mt-2 text-center font-display text-[2rem] leading-tight">Built on Meta's models.</h2>
      <dl className="mt-8 grid gap-3 sm:grid-cols-2">
        {MODELS.map(([name, what]) => (
          <div key={name} className={tile}>
            <dt className="font-display text-xl">{name}</dt>
            <dd className="mt-1 text-sm text-ink/60">{what}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function GoodToKnow() {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <p className={`${label} text-center`}>Good to know</p>
      <ul className="mt-4 space-y-2 text-[15px] text-ink/70">
        {LIMITS.map((l) => (
          <li key={l} className="flex gap-3 rounded-2xl border-[length:var(--bw)] border-line bg-surface/70 px-4 py-3">
            <CheckIcon size={16} className="mt-0.5 shrink-0 text-primary" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// The first thing a new visitor sees: what to call them. After that comes the choice between signing up and
// logging in (the next screen). Using Nudged needs an account, just an email with no password.
export default function OnboardingPage() {
  const { name, setName } = useStore()
  const [value, setValue] = useState(name)
  const navigate = useNavigate()

  function next(e) {
    e.preventDefault()
    if (!value.trim()) return
    setName(value.trim())
    navigate('/login')
  }

  // Two copies of the form (top and bottom); only the first gets the id.
  const start = (id) => (
    <div className="flex w-full max-w-md flex-col items-center gap-2">
      <form onSubmit={next} className="flex w-full flex-col gap-2 sm:flex-row">
        <label htmlFor={id} className="sr-only">What should I call you?</label>
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What should I call you?"
          className="min-h-12 flex-1 rounded-full border-[length:var(--bw)] border-line bg-surface px-5 text-base shadow-card outline-none placeholder:text-ink/45 focus:ring-2 focus:ring-primary/40"
        />
        <Button type="submit" disabled={!value.trim()}>Continue</Button>
      </form>
      <Link to="/login" state={{ mode: 'login' }} className="text-sm font-semibold text-ink/55 hover:text-ink">Already have an account? Log in</Link>
    </div>
  )

  return (
    <div className="flex flex-col gap-20 pb-10 pt-10 sm:pt-16">
      {/* A soft glow behind the hero, made from the theme's own colours (the pastel clouds of Cheeky, the green
          mist of Chill, the blue of Sassy, the dark glow of Night owl). Gradients only, no images. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[40rem] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] bg-[radial-gradient(60%_55%_at_18%_8%,color-mix(in_srgb,var(--accent)_calc(var(--hero-glow)*100%),transparent),transparent),radial-gradient(55%_50%_at_85%_12%,color-mix(in_srgb,var(--primary)_calc(var(--hero-glow)*100%),transparent),transparent),radial-gradient(70%_45%_at_50%_45%,color-mix(in_srgb,var(--highlight)_calc(var(--hero-glow)*70%),transparent),transparent)]"
      />
      <section className="flex flex-col items-center gap-6 pt-4 text-center sm:pt-10">
        <Mascot size={72} nudging />
        <h1 className="max-w-3xl font-display text-[2.75rem] leading-[1.02] tracking-tight sm:text-[4.5rem]">
          The reminder app that <span className="italic text-primary">nudges back</span>.
        </h1>
        <p className="max-w-lg text-lg text-ink/60">
          Dump everything on your mind. Nudged turns it into reminders and nudges you, cheekily, until it's done.
        </p>
        {start('start-name')}
        <InstallButton />
      </section>

      <section aria-label="Sample nudges" className="mx-auto flex w-full max-w-md flex-col gap-2">
        <p className={`${label} text-center`}>A few lines Nudged has written</p>
        {SAMPLES.map((text, i) => (
          <div key={text} className={`flex items-start gap-3 rounded-2xl border-[length:var(--bw)] border-line bg-surface px-4 py-3 shadow-card ${i % 2 ? 'sm:ml-10' : 'sm:mr-10'}`}>
            <BellIcon size={16} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-left text-[15px] leading-snug">{text}</p>
          </div>
        ))}
      </section>

      <HowItWorks />

      <Features />

      <BuiltOn />

      <GoodToKnow />

      <section className="flex flex-col items-center gap-4 rounded-3xl bg-soft px-6 py-10 text-center">
        <h2 className="font-display text-[1.75rem] leading-tight">Future you says thanks in advance.</h2>
        <p className="text-ink/60">Free. No password. Just your email.</p>
        {start('start-name-2')}
      </section>
    </div>
  )
}
