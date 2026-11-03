import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useStore } from '../lib/store.jsx'
import { BellIcon, CameraIcon, CheckIcon, MicIcon, PencilIcon, TrophyIcon } from './Icons.jsx'

// Little scenes that act out Nudged's core loop behind story slides:
// dump -> tasks -> edit -> nudge -> proof -> badge. Built from the app's own UI pieces and
// coloured by the active theme. In the tutorial they're interactive: the scene plays up to
// "ready", waits for the user to tap the highlighted thing, then plays on to "end".
// In the daily rundown they just loop.

const row = 'flex items-center gap-2.5 rounded-xl border-[length:var(--bw)] border-line bg-surface px-3 py-2.5 shadow-card'
const circle = 'grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/25'

// The thing to tap: clickable even though the scene layer ignores pointer events, with a pulse while waiting.
function target(act, hint, label) {
  if (!act) return {}
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: act,
    onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), act()),
    style: hint ? { animation: 'pulse-ring 1.4s infinite' } : undefined,
    className: 'pointer-events-auto cursor-pointer',
  }
}

function Dump({ act, hint }) {
  const t = target(act, hint, 'Tap the mic')
  return (
    <div className="relative h-full">
      <div className="rounded-2xl border-[length:var(--bw)] border-line bg-surface p-3 shadow-card">
        <p className="text-[13px] text-ink/35">What's rattling around?</p>
        <div className="mt-2 flex min-h-16 flex-wrap content-start gap-1.5">
          {['call the dentist', 'oat milk', "Yinka's, tomorrow 5pm"].map((w) => (
            <span key={w} className="s-word rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-ink/80">{w}</span>
          ))}
        </div>
      </div>
      <div className="absolute bottom-1 left-[calc(50%-28px)] h-14 w-14">
        <span className="s-ring absolute inset-0 rounded-full border-2 border-primary opacity-0" />
        <span {...t} className={`s-mic relative grid h-14 w-14 place-items-center rounded-full bg-primary text-on-primary ${t.className ?? ''}`}>
          <MicIcon size={22} />
        </span>
      </div>
    </div>
  )
}

// Swipe a row right to tick it: follows the finger, commits past 70px, springs back otherwise.
function useSwipe(act) {
  const start = useRef(null)
  if (!act) return {}
  return {
    onPointerDown(e) {
      start.current = e.clientX
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove(e) {
      if (start.current === null) return
      gsap.set(e.currentTarget, { x: Math.max(0, Math.min(140, e.clientX - start.current)) })
    },
    onPointerUp(e) {
      if (start.current === null) return
      const dx = e.clientX - start.current
      start.current = null
      gsap.to(e.currentTarget, { x: 0, duration: 0.45, ease: 'back.out(2)' })
      if (dx > 70) act()
    },
  }
}

function Tasks({ act, hint, data }) {
  const t = target(act, hint, 'Tick the first task')
  const swipe = useSwipe(act)
  // The tutorial uses sample tasks; the daily rundown passes the user's real ones.
  const items = data?.items ?? [['Call the dentist', 'Today, 2:00 PM'], ['Buy oat milk', 'Today, 6:00 PM'], ["Go to Yinka's place", 'Tomorrow, 5:00 PM']]
  return (
    <div className="relative flex h-full flex-col justify-center gap-2">
      <div className="s-input absolute inset-x-0 top-1/2 -mt-6 rounded-xl border-[length:var(--bw)] border-line bg-surface px-3 py-3 text-[13px] text-ink/70 shadow-card">
        {data?.items ? items.map(([t]) => t.toLowerCase()).join(', ') : "dentist, oat milk, Yinka's 5pm"}…
      </div>
      {items.map(([title, due], i) => (
        <div key={title} className={`s-task ${row} ${i === 0 && act ? 'pointer-events-auto cursor-grab touch-pan-y select-none' : ''}`} {...(i === 0 ? swipe : {})}>
          {i === 0 ? (
            <span {...t} className={`s-check ${circle} ${t.className ?? ''}`}><CheckIcon size={12} strokeWidth={2.5} className="s-tick text-on-primary" /></span>
          ) : (
            <span className={circle} />
          )}
          <span className="min-w-0 flex-1">
            <span className={`block text-[13px] font-medium ${i === 0 ? 's-title' : ''}`}>{title}</span>
            <span className="block text-[11px] text-ink/45">{due}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function Edit({ act, hint }) {
  const t = target(act, hint, 'Tap the pencil')
  return (
    <div className="relative flex h-full items-center">
      <div className={`${row} w-full`}>
        <span className={circle} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Go to Yinka's place</span>
          <span className="relative block h-4 text-[11px]">
            <span className="s-old absolute left-0 text-ink/40">No date set</span>
            <span className="s-new absolute left-0 -mx-1 rounded px-1 font-semibold text-primary opacity-0">Tomorrow, 5:00 PM</span>
          </span>
        </span>
        <span {...t} className={`s-pencil grid h-8 w-8 place-items-center rounded-full bg-ink/5 text-ink/60 ${t.className ?? ''}`}><PencilIcon size={15} /></span>
      </div>
    </div>
  )
}

function Nudge({ name, act, hint }) {
  const t = target(act, hint, 'Snooze it')
  return (
    <div className="relative flex h-full flex-col items-center gap-2.5 pt-1">
      <span className="s-bell grid h-11 w-11 place-items-center rounded-full bg-soft text-primary"><BellIcon size={20} /></span>
      <div className={`s-nudge1 ${row} w-full`}>
        <span className="min-w-0 flex-1 text-[13px] leading-snug">{name}, Yinka's in an hour. Shoes on?</span>
        <span {...t} className={`shrink-0 rounded-full border-[length:var(--bw)] border-line px-2.5 py-1 text-[11px] font-semibold text-ink/70 ${t.className ?? ''}`}>Snooze</span>
      </div>
      <div className="s-nudge2 flex w-full items-center rounded-xl bg-primary px-3 py-2.5 text-on-primary shadow-card">
        <span className="text-[13px] font-semibold leading-snug">Snoozed? Noted. {name.toUpperCase()}. Yinka's. Now.</span>
      </div>
    </div>
  )
}

function Proof({ act, hint }) {
  const t = target(act, hint, 'Tap the shutter')
  return (
    <div className="relative mx-auto h-full max-w-[240px]">
      <div className="relative h-full overflow-hidden rounded-2xl bg-ink/[0.06]">
        {['left-2 top-2 border-l-2 border-t-2', 'right-2 top-2 border-r-2 border-t-2', 'left-2 bottom-2 border-b-2 border-l-2', 'right-2 bottom-2 border-b-2 border-r-2'].map((c) => (
          <span key={c} className={`absolute h-5 w-5 rounded-sm border-ink/40 ${c}`} />
        ))}
        {/* a grocery bag, give or take */}
        <svg viewBox="0 0 100 100" className="absolute left-[calc(50%-40px)] top-[calc(50%-40px)] h-20 w-20">
          <path d="M22 38h56l-6 46H28z" fill="var(--soft)" stroke="var(--ink)" strokeOpacity=".5" strokeWidth="3" strokeLinejoin="round" />
          <path d="M38 38c0-10 5-16 12-16s12 6 12 16" fill="none" stroke="var(--ink)" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="s-outline absolute left-[calc(50%-56px)] top-[calc(50%-56px)] h-28 w-28 rounded-[40%] border-[3px] border-dashed border-success bg-success/10 opacity-0" />
        <span className="s-flash absolute inset-0 bg-white opacity-0" />
      </div>
      <span {...t} className={`s-shutter absolute -bottom-2 left-[calc(50%-22px)] grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary shadow-card ${t.className ?? ''}`}>
        <CameraIcon size={18} />
      </span>
      <span className="s-bonus absolute right-1 top-3 rounded-full bg-success px-2.5 py-1 text-xs font-bold text-on-primary opacity-0">+15</span>
    </div>
  )
}

function Badge({ act, hint }) {
  const t = target(act, hint, 'Tap the badge')
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4">
      <div className="relative">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="s-ray absolute left-[calc(50%-1px)] top-[calc(50%-1px)] h-0.5 w-0.5 opacity-0" style={{ transform: `rotate(${i * 45}deg)` }}>
            <span className="absolute left-12 h-0.5 w-3 rounded-full bg-highlight" />
          </span>
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <span key={`d${i}`} className="s-dot absolute left-[calc(50%-3px)] top-[calc(50%-3px)] h-1.5 w-1.5 rounded-full opacity-0" style={{ background: ['var(--primary)', 'var(--accent)', 'var(--highlight)', 'var(--success)'][i % 4] }} />
        ))}
        <span {...t} className={`s-medal relative grid h-20 w-20 place-items-center rounded-full bg-soft text-primary ring-4 ring-highlight/70 ${t.className ?? ''}`}>
          <TrophyIcon size={34} />
        </span>
      </div>
      <div className="w-40">
        <div className="h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="s-bar h-full origin-left rounded-full bg-primary" /></div>
        <p className="s-caption mt-1.5 text-center text-[11px] font-medium text-ink/50">3-day streak unlocked</p>
      </div>
    </div>
  )
}

// GSAP tweens real colours, not var(--x), so read the theme's values.
const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
// A beat of nothing, so "ready" never sits at time 0.
const beat = (tl, d = 0.3) => tl.to({}, { duration: d })

// Each builder sets the start state, plays the intro up to "ready" (where the tutorial waits
// for a tap), then the payoff up to "end" (the settled frame). Anything after "end" only
// runs when looping.
const TIMELINES = {
  dump(tl) {
    tl.set('.s-word', { opacity: 0, y: 90, scale: 0.8 })
    beat(tl).addLabel('ready')
      .fromTo('.s-mic', { scale: 1 }, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1 })
      .fromTo('.s-ring', { scale: 1, opacity: 0.6 }, { scale: 1.9, opacity: 0, duration: 0.9, ease: 'power2.out', repeat: 2 }, '<')
      .to('.s-word', { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.5)', stagger: 0.4 }, '<0.3')
      .addLabel('end')
      .to('.s-word', { opacity: 0, duration: 0.3, delay: 1.2 })
  },
  tasks(tl) {
    tl.set('.s-task', { opacity: 0, y: 14 })
      .set('.s-input', { opacity: 1, scaleY: 1 })
      .set('.s-tick', { opacity: 0, scale: 0.5 })
      .set('.s-check', { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0.2)' })
      .set('.s-title', { opacity: 1 })
      .to('.s-input', { opacity: 0, scaleY: 0.6, duration: 0.3, ease: 'power2.in', delay: 0.6 })
      .to('.s-task', { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.12 }, '-=0.1')
      .addLabel('ready')
      .to('.s-check', { backgroundColor: cssVar('--success'), borderColor: cssVar('--success'), duration: 0.2 }, '+=0.2')
      .to('.s-tick', { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' }, '<')
      .to('.s-title', { opacity: 0.4, duration: 0.3 }, '<')
      .addLabel('end')
      .to('.s-task', { opacity: 0, duration: 0.3, delay: 1 })
  },
  edit(tl) {
    tl.set('.s-old', { opacity: 1, y: 0 })
      .set('.s-new', { opacity: 0, y: 8, backgroundColor: cssVar('--soft') })
      .set('.s-pencil', { x: 50, y: 30, opacity: 0 })
      .to('.s-pencil', { x: 0, y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.4 })
      .addLabel('ready')
      .to('.s-pencil', { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1 })
      .to('.s-old', { opacity: 0, y: -8, duration: 0.25, ease: 'power2.in' }, '+=0.1')
      .to('.s-new', { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, '-=0.05')
      .to('.s-new', { backgroundColor: 'rgba(0,0,0,0)', duration: 0.8 }, '+=0.3')
      .addLabel('end')
      .to('.s-pencil', { opacity: 0, duration: 0.3 }, '+=0.6')
  },
  nudge(tl) {
    tl.set('.s-nudge1, .s-nudge2', { opacity: 0, y: -14, scale: 0.97 })
      .to('.s-bell', { rotation: 16, duration: 0.07, yoyo: true, repeat: 7, ease: 'sine.inOut', transformOrigin: '50% 10%', delay: 0.3 })
      .set('.s-bell', { rotation: 0 })
      .to('.s-nudge1', { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' }, '-=0.2')
      .addLabel('ready')
      .to('.s-nudge1', { opacity: 0.45, duration: 0.25 }, '+=0.3')
      .to('.s-bell', { rotation: 22, duration: 0.06, yoyo: true, repeat: 11, ease: 'sine.inOut' }, '+=0.3')
      .set('.s-bell', { rotation: 0 })
      .to('.s-nudge2', { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.8)' }, '-=0.25')
      .addLabel('end')
      .to('.s-nudge1, .s-nudge2', { opacity: 0, duration: 0.3, delay: 1.2 })
  },
  proof(tl) {
    tl.set('.s-flash', { opacity: 0 })
      .set('.s-outline', { opacity: 0, scale: 0.85 })
      .set('.s-bonus', { opacity: 0, y: 10 })
    beat(tl, 0.6).addLabel('ready')
      .to('.s-shutter', { scale: 0.85, duration: 0.1, yoyo: true, repeat: 1 })
      .to('.s-flash', { opacity: 0.85, duration: 0.06 })
      .to('.s-flash', { opacity: 0, duration: 0.4, ease: 'power2.out' })
      .to('.s-outline', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, '+=0.3')
      .to('.s-bonus', { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, '+=0.2')
      .addLabel('end')
      .to('.s-bonus', { y: -16, opacity: 0, duration: 0.6, ease: 'power2.in' }, '+=0.8')
      .to('.s-outline', { opacity: 0, duration: 0.3 }, '<')
  },
  badge(tl, root) {
    const dots = root.querySelectorAll('.s-dot')
    tl.set('.s-medal', { scale: 0.9, rotation: 0, opacity: 0.35, filter: 'grayscale(1)' })
      .set('.s-ray', { opacity: 0, scale: 0.6 })
      .set('.s-bar', { scaleX: 0 })
      .set('.s-caption', { opacity: 0 })
      .set(dots, { x: 0, y: 0, opacity: 0 })
      .to('.s-bar', { scaleX: 1, duration: 0.9, ease: 'power2.inOut', delay: 0.3 })
      .addLabel('ready')
      .fromTo('.s-medal', { rotation: -20, scale: 0.6 }, { scale: 1, rotation: 0, opacity: 1, filter: 'grayscale(0)', duration: 0.7, ease: 'back.out(2.2)' })
      .to('.s-ray', { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out', stagger: 0.03 }, '<0.15')
      .to('.s-caption', { opacity: 1, duration: 0.3 }, '<')
    dots.forEach((d, i) => {
      const a = (i / dots.length) * Math.PI * 2
      tl.to(d, { x: Math.cos(a) * 70, y: Math.sin(a) * 70, opacity: 1, duration: 0.5, ease: 'power3.out' }, '<0.02')
        .to(d, { opacity: 0, y: '+=20', duration: 0.5, ease: 'power1.in' }, '>-0.1')
    })
    tl.addLabel('end').to('.s-medal, .s-ray', { opacity: 0, duration: 0.3, delay: 1 })
  },
}

const SCENES = { dump: Dump, tasks: Tasks, edit: Edit, nudge: Nudge, proof: Proof, badge: Badge }

export default function StoryScene({ scene, data, paused, interactive = false, onDone }) {
  const { name } = useStore()
  const root = useRef(null)
  const tl = useRef(null)
  const done = useRef(onDone)
  done.current = onDone
  const [waiting, setWaiting] = useState(interactive)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const ctx = gsap.context(() => {
      tl.current = gsap.timeline(interactive ? { paused: true } : { repeat: -1, repeatDelay: 0.4 })
      TIMELINES[scene]?.(tl.current, root.current)
      if (interactive) {
        tl.current.addPause('ready').addPause('end', () => done.current?.())
        if (reduced) tl.current.pause('ready')
        else tl.current.play()
      } else if (reduced) {
        tl.current.pause('end')
      }
    }, root)
    return () => ctx.revert()
  }, [scene, interactive, reduced])

  // Only the looping scenes follow the story's pause; an interactive one is already waiting on the user.
  useEffect(() => {
    if (!interactive && !reduced) tl.current?.paused(paused)
  }, [paused, interactive, reduced])

  function act() {
    if (!waiting) return
    setWaiting(false)
    if (reduced) {
      tl.current.pause('end')
      done.current?.()
    } else {
      // Drop the wait so a tap during the intro just carries on through to the payoff.
      // removePause() returns nothing, so it can't be chained.
      tl.current.removePause('ready')
      tl.current.play()
    }
  }

  const Scene = SCENES[scene]
  if (!Scene) return null
  return (
    <div ref={root} className="h-full">
      <Scene name={name || 'Friend'} data={data} act={interactive ? act : null} hint={waiting} />
    </div>
  )
}
