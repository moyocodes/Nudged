import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Mascot from './Mascot.jsx'

const MESSY = "ugh ok. dentist?? oat milk. also yinka's tmrw like 5pm"
// What Nudged makes of it: one tidy reminder per part of the messy line, same as the how-to slides.
const TIDY = [['Call the dentist', 'Today, 2:00 PM'], ['Buy oat milk', 'Today, 6:00 PM'], ["Go to Yinka's place", 'Tomorrow, 5:00 PM']]

// Welcome intro, once per visit: a messy thought types itself out, falls apart, and snaps into a
// tidy task card that Nudged nudges. A Skip button counts down the seconds left; any key or tap skips too.
export default function Intro({ onDone }) {
  const root = useRef(null)
  const done = useRef(onDone)
  done.current = onDone
  const [left, setLeft] = useState(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const finish = () => done.current?.()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: finish,
        onUpdate() {
          setLeft(Math.max(1, Math.ceil(this.duration() - this.time())))
          setProgress(this.progress())
        },
      })
      if (reduced) {
        tl.set('.i-char', { opacity: 0 }).set('.i-card, .i-nudge, .i-tag', { opacity: 1 }).to({}, { duration: 2.5 })
        return
      }
      tl.set('.i-card', { opacity: 0, scale: 0.9, y: 16 })
        .set('.i-nudge', { opacity: 0 })
        .set('.i-tag', { opacity: 0, y: 8 })
        .from('.i-hero', { opacity: 0, scale: 0.6, y: 20, duration: 0.5, ease: 'back.out(2)' })
        .from('.i-char', { opacity: 0, duration: 0.01, stagger: 0.035 })
        .to('.i-line', { x: 3, duration: 0.05, yoyo: true, repeat: 5 }, '+=0.35')
        .to('.i-char', {
          opacity: 0,
          y: () => gsap.utils.random(40, 110),
          x: () => gsap.utils.random(-50, 50),
          rotation: () => gsap.utils.random(-90, 90),
          scale: 0.4,
          duration: 0.5,
          ease: 'power2.in',
          stagger: { each: 0.008, from: 'random' },
        }, '+=0.15')
        .to('.i-card', { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.2 }, '-=0.15')
        .to('.i-nudge', { opacity: 1, duration: 0.3 }, '-=0.2')
        .to('.i-last', { x: 6, duration: 0.08, yoyo: true, repeat: 1 }, '+=0.25')
        .to('.i-tag', { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, '+=0.1')
        .to({}, { duration: 1.6 })
        .to(root.current, { opacity: 0, duration: 0.35 })
    }, root)

    const skip = (e) => {
      if (e.type === 'keydown' && (e.metaKey || e.ctrlKey)) return
      finish()
    }
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      ctx.revert()
    }
  }, [])

  return (
    <div
      ref={root}
      role="dialog"
      aria-label="Welcome to Nudged"
      onPointerDown={() => done.current?.()}
      className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center gap-8 bg-bg px-6"
    >
      <div className="i-hero flex flex-col items-center gap-1">
        <Mascot size={104} wiggle />
        <p className="font-display text-3xl text-primary">Nudged</p>
      </div>

      {/* The messy line and the tidy card share one spot, so the card appears where the words fell apart. */}
      <div className="relative grid h-56 w-full max-w-sm place-items-center">
        <p className="i-line absolute inset-x-0 text-center font-mono text-lg leading-relaxed text-ink/70" aria-label={MESSY}>
          {[...MESSY].map((c, i) => (
            <span key={i} className="i-char inline-block whitespace-pre" aria-hidden>{c}</span>
          ))}
        </p>

        <div className="relative flex items-end gap-2">
          <span className="i-nudge opacity-0"><Mascot size={56} nudging /></span>
          <div className="flex flex-col gap-2">
            {TIDY.map(([title, when], i) => (
              <div key={title} className={`${i === TIDY.length - 1 ? 'i-last ' : ''}i-card flex w-64 items-center gap-3 rounded-2xl border-[length:var(--bw)] border-line bg-surface px-4 py-2.5 opacity-0 shadow-card`}>
                <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-ink/25" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{title}</span>
                  <span className="block text-[13px] text-ink/50">{when}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="i-tag text-center opacity-0 font-display text-2xl leading-tight">
        Say it messy. <em>I'll keep it tidy.</em>
      </p>

      <button
        type="button"
        onPointerDown={(e) => { e.stopPropagation(); done.current?.() }}
        className="absolute right-4 top-4 min-h-10 rounded-full border-[length:var(--bw)] border-line bg-surface px-4 text-sm font-semibold text-ink/70 shadow-card hover:text-ink"
      >
        Skip{left ? ` · ${left}s` : ''}
      </button>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-ink/5" aria-hidden>
        <div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
