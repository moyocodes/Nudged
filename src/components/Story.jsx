import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { holdNudges } from '../lib/nudges.js'
import { friendlyDue, isEarly, isOverdue } from '../lib/format.js'
import { badgeStats, nextBadge } from '../lib/mockData.js'
import Mascot from './Mascot.jsx'
import StoryScene from './StoryScene.jsx'
import { resumeMusic, startMusic, stopMusic } from '../lib/music.js'
import { AMBIENT_SOUNDS, resumeAmbient } from '../lib/ambient.js'
import { CameraIcon, CheckIcon } from './Icons.jsx'

const SLIDE_MS = 5000

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
}

// Builds the rundown for the next 24 hours from now (not just until midnight): hello, the full list,
// each overdue and upcoming task, the next badge, and a sign-off.
function buildSlides(name, tasks, streak) {
  const open = tasks.filter((t) => !t.done)
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const overdue = open.filter(isOverdue)
  const today = open.filter((t) => t.due && !isOverdue(t) && new Date(t.due) <= in24h).sort((a, b) => new Date(a.due) - new Date(b.due))
  const someday = open.filter((t) => !t.due).length
  const count = overdue.length + today.length

  const slides = [{
    kind: 'hello',
    // Animate the user's own next few tasks, not sample ones.
    scene: open.length ? 'tasks' : null,
    sceneData: { items: [...overdue, ...today, ...open.filter((t) => !overdue.includes(t) && !today.includes(t))].slice(0, 3).map((t) => [t.title, friendlyDue(t.due)]) },
    eyebrow: new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }),
    title: `${greeting()}, ${name || 'you'}.`,
    body: count ? `${count} thing${count > 1 ? 's' : ''} in the next 24 hours. Quick run through?` : 'Nothing due in the next 24 hours. Rare. Savour it.',
  }]
  // The whole picture on one slide, which waits for a tap so there's time to read it.
  if (count || someday) {
    slides.push({
      kind: 'list',
      eyebrow: 'Next 24 hours',
      title: count ? `${count} on the list` : 'Nothing timed',
      items: [...overdue, ...today].map((t) => ({ id: t.id, title: t.title, when: friendlyDue(t.due), late: isOverdue(t) })),
      body: someday ? `Plus ${someday} with no date, nudged at check-in.` : '',
    })
  }
  for (const t of overdue.slice(0, 5)) slides.push({ kind: 'task', eyebrow: 'Overdue', task: t, body: friendlyDue(t.due) })
  for (const t of today.slice(0, 5)) slides.push({ kind: 'task', eyebrow: 'Next 24 hours', task: t, body: friendlyDue(t.due) })

  const stats = badgeStats(tasks, streak)
  const next = nextBadge(stats)
  if (next) {
    const left = next.goal - stats[next.stat]
    slides.push({ kind: 'badge', eyebrow: 'Next badge', title: next.label, body: `${left} more to go.`, progress: stats[next.stat] / next.goal })
  }
  slides.push({ kind: 'end', title: "That's the lot.", body: "I'll nudge you if anything slips." })
  return slides
}

// Plays the daily rundown by default; pass `slides` to reuse it for something else, like the tutorial.
export default function Story({ onClose, slides: custom, title = "Today's rundown", endLabel = 'Open my list' }) {
  const navigate = useNavigate()
  const { name, tasks, streak, completeTask, setStoryOpen, musicOn, setMusicOn, ambient, setAmbient, muted, setMuted } = useStore()
  useEffect(() => {
    setStoryOpen(true)
    holdNudges('rundown', true)
    return () => {
      setStoryOpen(false)
      holdNudges('rundown', false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Background music for the daily rundown only (not the tutorial), stopped when it closes.
  // A rain/fire/waves background sound replaces it, and keeps playing after the rundown.
  const withMusic = !custom && musicOn && !ambient && !muted
  const SOUNDS = [['music', '🎵', 'Music'], ...AMBIENT_SOUNDS, ['off', '🔇', 'Sound off']]
  const current = muted ? 'off' : ambient ?? (musicOn ? 'music' : 'off')
  const currentSound = SOUNDS.find(([id]) => id === current) ?? SOUNDS[0]
  function nextSound() {
    const [id] = SOUNDS[(SOUNDS.findIndex(([s]) => s === current) + 1) % SOUNDS.length]
    // "Sound off" is the master mute: it silences everything, including nudges. Any other choice turns sound back on.
    if (id === 'off') return setMuted(true)
    setMuted(false)
    setMusicOn(id === 'music')
    setAmbient(id === 'music' ? null : id)
  }
  useEffect(() => {
    if (!withMusic) return
    startMusic()
    return () => stopMusic()
  }, [withMusic])
  // Snapshot on open so ticking a task off doesn't reshuffle the slides mid-story.
  const slides = useMemo(() => custom ?? buildSlides(name, tasks, streak), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [ticked, setTicked] = useState({})
  const [acted, setActed] = useState({})
  const [held, setHeld] = useState(false)

  const slide = slides[index]
  // A "try it" slide holds its timer until the user has done the thing.
  const waiting = !!slide.try && !acted[index]
  // A task that isn't due yet, waiting on "Done already? Sure?".
  const [confirming, setConfirming] = useState(null)
  const stopped = paused || held || waiting || slide.kind === 'list' || !!confirming

  // The progress bar is a CSS animation; when it finishes, the slide advances.
  // With reduced motion the bar doesn't run, so the story waits for taps instead.
  function advance() {
    if (index < slides.length - 1) go(1)
    else onClose()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function go(step) {
    setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + step)))
  }

  const hold = (on) => setHeld(on)

  // The scene's payoff has played; give it a beat to land, then move on (unless they already did).
  function sceneDone(i) {
    setActed((a) => ({ ...a, [i]: true }))
    setTimeout(() => setIndex((cur) => (cur === i ? Math.min(slides.length - 1, i + 1) : cur)), 1100)
  }

  // Ticking off something that isn't due yet asks first (see `confirming`).
  function tickOff(task, sure = false) {
    // Photo-proof tasks can't be ticked off here; off to the camera.
    if (task.physical) {
      onClose()
      return navigate(`/proof/${task.id}`)
    }
    if (!sure && isEarly(task)) return setConfirming(task.id)
    setConfirming(null)
    completeTask(task.id)
    setTicked((t) => ({ ...t, [task.id]: true }))
    setTimeout(() => go(1), 700)
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={() => { resumeMusic(); resumeAmbient() }}
      className="fixed inset-0 z-[70] grid place-items-center bg-ink/40 backdrop-blur-sm md:p-6"
    >
      <motion.div
        initial={{ y: 30, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="relative flex h-full w-full flex-col overflow-hidden bg-bg md:h-[min(720px,90vh)] md:max-w-sm md:rounded-3xl md:shadow-card"
      >
        <div className="flex gap-1 px-3 pt-3">
          {slides.map((_, i) => (
            <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink/10">
              {i < index && <span className="block h-full rounded-full bg-ink/70" />}
              {i === index && (
                <span
                  key={index}
                  onAnimationEnd={advance}
                  className="block h-full origin-left rounded-full bg-ink/70"
                  style={{ animation: `story-fill ${SLIDE_MS}ms linear forwards`, animationPlayState: stopped ? 'paused' : 'running' }}
                />
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 px-4 pt-3">
          <Mascot size={26} />
          <span className="text-sm font-semibold">{title}</span>
          {!custom && (
            <button
              type="button"
              onClick={nextSound}
              aria-label={`Background sound: ${currentSound[2]}. Tap to change.`}
              title={`${currentSound[2]} · tap to change`}
              className="ml-auto inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-ink/60 hover:bg-ink/5"
            >
              <span aria-hidden>{currentSound[1]}</span> {currentSound[2]}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play' : 'Pause'}
            className={`${custom ? 'ml-auto ' : ''}grid h-9 w-9 place-items-center rounded-full text-ink/60 hover:bg-ink/5`}
          >
            {paused ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></svg>
            )}
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink/60 hover:bg-ink/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {slide.scene && (
          <div className="pointer-events-none absolute inset-x-0 top-24 z-20 h-[38%] px-7">
            <StoryScene key={index} scene={slide.scene} data={slide.sceneData} paused={stopped} interactive={!!slide.try} onDone={() => sceneDone(index)} />
          </div>
        )}

        {/* Tap zones: left goes back, right goes forward, press and hold pauses. */}
        <div className="relative z-10 flex-1">
          <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 z-10 w-1/3"
            onClick={() => go(-1)} onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)} />
          <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 z-10 w-2/3"
            onClick={() => (index < slides.length - 1 ? go(1) : onClose())} onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)} />

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className={`flex h-full flex-col px-7 ${slide.scene ? 'justify-end pb-28' : 'justify-center pb-24'}`}
            >
              {slide.Icon && !slide.scene && (
                <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-soft text-primary">
                  <slide.Icon size={26} />
                </span>
              )}
              {slide.eyebrow && (
                <p className={`text-xs font-semibold uppercase tracking-wider ${slide.eyebrow === 'Overdue' ? 'text-accent' : 'text-ink/45'}`}>
                  {slide.eyebrow}
                </p>
              )}
              <h2 className="mt-2 font-display text-[2.25rem] leading-[1.1]">
                {slide.kind === 'task' ? slide.task.title : slide.title}
              </h2>
              {slide.kind === 'list' && slide.items.length > 0 && (
                <ul className="mt-4 flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto">
                  {slide.items.map((it) => (
                    <li key={it.id} className="flex items-baseline justify-between gap-3 rounded-xl bg-surface px-3 py-2">
                      <span className="min-w-0 truncate text-[15px] font-medium">{it.title}</span>
                      <span className={`shrink-0 text-xs ${it.late ? 'text-accent' : 'text-ink/50'}`}>{it.when}</span>
                    </li>
                  ))}
                </ul>
              )}
              {slide.body && <p className="mt-3 text-base text-ink/60">{slide.body}</p>}
              {slide.kind === 'list' && <p className="mt-2 text-xs font-semibold text-ink/40">Tap to continue</p>}
              {slide.try && (
                <p className={`mt-3 text-sm font-semibold transition-opacity ${acted[index] ? 'text-success' : 'text-primary'}`}>
                  {acted[index] ? 'Nice.' : `Try it: ${slide.try}`}
                </p>
              )}
              {slide.kind === 'badge' && (
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/10">
                  <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${slide.progress * 100}%` }} transition={{ delay: 0.2, duration: 0.8 }} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {slide.kind === 'task' && (
            confirming === slide.task.id ? (
            <div className="absolute inset-x-0 bottom-6 z-20 px-7">
              <p className="mb-2 text-sm font-medium">Done already? It's not due till {friendlyDue(slide.task.due).toLowerCase()}. Sure?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => tickOff(slide.task, true)} className="min-h-11 flex-1 rounded-full bg-primary text-sm font-semibold text-on-primary">Yes, done</button>
                <button type="button" onClick={() => setConfirming(null)} className="min-h-11 flex-1 rounded-full border-[length:var(--bw)] border-line bg-surface text-sm font-semibold">Oops, not yet</button>
              </div>
            </div>
            ) : (
            <div className="absolute inset-x-0 bottom-6 z-20 flex gap-2 px-7">
              <button
                type="button"
                onClick={() => tickOff(slide.task)}
                disabled={ticked[slide.task.id]}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-on-primary disabled:bg-success"
              >
                {slide.task.physical ? <><CameraIcon size={16} /> Snap proof +15</> : <><CheckIcon size={16} /> {ticked[slide.task.id] ? 'Done' : 'Already done'}</>}
              </button>
              <button type="button" onClick={() => go(1)} className="min-h-11 flex-1 rounded-full border-[length:var(--bw)] border-line bg-surface text-sm font-semibold">
                On it later
              </button>
            </div>
            )
          )}
          {slide.kind === 'end' && (
            <div className="absolute inset-x-0 bottom-6 z-20 px-7">
              <button type="button" onClick={onClose} className="min-h-11 w-full rounded-full bg-primary text-sm font-semibold text-on-primary">
                {endLabel}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
