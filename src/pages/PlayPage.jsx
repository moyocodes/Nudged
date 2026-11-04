import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { GAME_COST, useStore } from '../lib/store.jsx'
import { Button } from '../components/ui.jsx'
import Mascot from '../components/Mascot.jsx'
import { CameraIcon } from '../components/Icons.jsx'

// Whack-a-nudge: a 30-second nudge break. Distractions pop up out of nine holes; nudge them before
// they duck. Your tasks that want photo proof sneak in too: nudge one and it goes on the
// "snap these" list shown at the end. The game nudges; the photo is still what counts.

const ROUND_MS = 30000
const DISTRACTIONS = ['5 more mins', 'later', 'tomorrow-ish', 'after this episode', 'snacks first', 'Monday', 'too tired', "it's raining", 'one more scroll', 'vibes off']
const BEST_KEY = 'nudgy:bestNudge'

// A short low "bzzt" for a miss, made with Web Audio so there's no sound file to load.
let audio
function buzz() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(160, audio.currentTime)
    osc.frequency.exponentialRampToValueAtTime(70, audio.currentTime + 0.25)
    gain.gain.setValueAtTime(0.25, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3)
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.3)
  } catch {}
  navigator.vibrate?.(120)
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]

function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0 } catch { return 0 }
}

// End-of-round recap: total misses, and a 3x3 map of where they happened, redder where you missed more.
function MissRecap({ misses }) {
  const total = misses.reduce((a, b) => a + b, 0)
  const worst = Math.max(1, ...misses)
  return (
    <div className="flex items-center gap-3">
      <div className="grid grid-cols-3 gap-1">
        {misses.map((n, i) => (
          <span
            key={i}
            className="grid h-7 w-7 place-items-center rounded-md text-[11px] font-bold ring-1 ring-line"
            style={{ background: n ? `color-mix(in srgb, var(--accent) ${15 + (n / worst) * 70}%, transparent)` : undefined, color: n / worst > 0.5 ? 'white' : undefined }}
          >
            {n || ''}
          </span>
        ))}
      </div>
      <p className="text-left text-sm">
        <span className="block text-3xl font-black leading-none text-accent">{total}✕</span>
        <span className="text-ink/55">{total === 0 ? 'Zero misses. Surgical.' : total < 5 ? 'A few wild nudges.' : 'Nudging the air a lot there.'}</span>
      </p>
    </div>
  )
}

export default function PlayPage() {
  const { tasks, say, points, spendPoints } = useStore()
  const canAfford = points >= GAME_COST
  const proofTasks = tasks.filter((t) => !t.done && t.physical)
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [holes, setHoles] = useState(Array(9).fill(null))
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(ROUND_MS)
  const [caught, setCaught] = useState([])
  const [pops, setPops] = useState([])
  const [misses, setMisses] = useState(Array(9).fill(0))
  const [best, setBest] = useState(readBest)
  const state = useRef({})
  // Play time so far (excludes check-in pauses), and which check-ins have been asked.
  const elapsedRef = useRef(0)
  const askedRef = useRef(new Set())
  state.current = { holes, caught }

  // A round costs coins, so the game is a reward for getting things done, not a way to avoid them.
  function start() {
    if (!canAfford) return say(`A round costs ${GAME_COST} coins and you've got ${points}. Tick something off first?`)
    spendPoints(GAME_COST)
    setHoles(Array(9).fill(null))
    setScore(0)
    setCaught([])
    setMisses(Array(9).fill(0))
    setLeft(ROUND_MS)
    elapsedRef.current = 0
    askedRef.current = new Set()
    setPhase('playing')
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const began = performance.now() - elapsedRef.current
    let spawnTimer

    // Starts gentle and ramps up: a pop every 1.4s with 2s to nudge it, down to every 0.5s with 0.8s.
    const spawn = () => {
      const elapsed = performance.now() - began
      const ramp = Math.min(1, elapsed / ROUND_MS)
      const { holes: now, caught: got } = state.current
      const empty = now.map((h, i) => (h ? null : i)).filter((i) => i !== null)
      if (empty.length) {
        const spot = pick(empty)
        const waiting = proofTasks.filter((t) => !got.includes(t.id) && !now.some((h) => h?.taskId === t.id))
        const target = waiting.length && Math.random() < 0.22
          ? (({ id, title, photo }) => ({ kind: 'task', label: title, taskId: id, photo }))(pick(waiting))
          : { kind: 'distraction', label: pick(DISTRACTIONS) }
        const life = 2000 - 1200 * ramp
        setHoles((hs) => hs.map((h, i) => (i === spot ? { ...target, id: Math.random(), until: Date.now() + life } : h)))
      }
      spawnTimer = setTimeout(spawn, 1400 - 900 * ramp)
    }
    spawnTimer = setTimeout(spawn, 600)

    const tick = setInterval(() => {
      elapsedRef.current = performance.now() - began
      const remaining = ROUND_MS - elapsedRef.current
      setLeft(Math.max(0, remaining))
      setHoles((hs) => hs.map((h) => (h && h.until < Date.now() ? null : h)))
      if (remaining <= 0) return setPhase('over')
      // One check-in, two-thirds of the way through, when it gets fast: still up for it?
      const checkpoint = [20000].find((c) => elapsedRef.current >= c && !askedRef.current.has(c))
      if (checkpoint) {
        askedRef.current.add(checkpoint)
        setHoles(Array(9).fill(null))
        setPhase('resting')
      }
    }, 100)

    return () => {
      clearTimeout(spawnTimer)
      clearInterval(tick)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'over') return
    setHoles(Array(9).fill(null))
    say(score > best && score > 0 ? `${score}! New personal best. Fingers of steel.` : `${score} nudges. Not bad. Not legendary. Yet.`)
    if (score > best) {
      setBest(score)
      try { localStorage.setItem(BEST_KEY, String(score)) } catch {}
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function nudge(i) {
    const h = holes[i]
    if (phase !== 'playing') return
    if (!h) {
      // Missed: loud red X, a buzz, and the hole shakes.
      buzz()
      setMisses((m) => m.map((n, j) => (j === i ? n + 1 : n)))
      const miss = { id: Math.random(), hole: i, text: '✕', miss: true }
      setPops((p) => [...p, miss])
      setTimeout(() => setPops((p) => p.filter((x) => x.id !== miss.id)), 600)
      return
    }
    const gain = h.kind === 'task' ? 3 : 1
    setScore((s) => s + gain)
    if (h.kind === 'task') setCaught((c) => [...c, h.taskId])
    setHoles((hs) => hs.map((x, j) => (j === i ? null : x)))
    const pop = { id: Math.random(), hole: i, text: `+${gain}` }
    setPops((p) => [...p, pop])
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== pop.id)), 600)
  }

  const caughtTasks = tasks.filter((t) => caught.includes(t.id) && !t.done)

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.75rem] leading-tight">Nudge break</h1>
          <p className="text-sm text-ink/50">30 seconds. Nudge the distractions before they hide.</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl leading-none">{score}</p>
          <p className="text-xs text-ink/45">best {best}</p>
        </div>
      </header>

      <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${left / ROUND_MS})` }} />
      </div>

      <div className="relative">
        <div className="grid grid-cols-3 gap-2">
          {holes.map((h, i) => (
            <button
              key={i}
              type="button"
              onPointerDown={() => nudge(i)}
              aria-label={h ? `Nudge ${h.label}` : 'Empty'}
              className="relative aspect-square overflow-hidden rounded-2xl border-[length:var(--bw)] border-line bg-ink/[0.04]"
            >
              <span className="absolute inset-x-3 bottom-3 h-3 rounded-full bg-ink/10" />
              <AnimatePresence>
                {h && (
                  <motion.span
                    key={h.id}
                    initial={{ y: '70%', opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: '70%', opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ type: 'spring', duration: 0.3, bounce: 0.35 }}
                    className={`absolute inset-2 flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 text-center text-[11px] font-semibold leading-tight shadow-card ${
                      h.kind === 'task' ? 'bg-primary text-on-primary' : 'bg-surface text-ink/80'
                    }`}
                  >
                    {h.photo && <img src={h.photo} alt="" className="absolute inset-0 h-full w-full rounded-xl object-cover opacity-40" />}
                    {h.kind === 'task' && <CameraIcon size={16} className="relative" />}
                    <span className="relative line-clamp-2">{h.label}</span>
                  </motion.span>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {pops.filter((p) => p.hole === i).map((p) => (
                  p.miss ? (
                    <motion.span
                      key={p.id}
                      initial={{ opacity: 1, scale: 0.6, x: 0 }}
                      animate={{ opacity: [1, 1, 0], scale: [0.6, 1.25, 1], x: [0, -8, 8, -6, 6, 0] }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-accent/15 text-6xl font-black text-accent"
                    >
                      {p.text}
                    </motion.span>
                  ) : (
                  <motion.span
                    key={p.id}
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -30 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="pointer-events-none absolute inset-x-0 top-2 text-center text-sm font-bold text-primary"
                  >
                    {p.text}
                  </motion.span>
                  )
                ))}
              </AnimatePresence>
            </button>
          ))}
        </div>

        {phase !== 'playing' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-bg/90 p-5 text-center backdrop-blur-sm"
          >
            <Mascot size={56} nudging={phase === 'ready'} />
            {phase === 'resting' ? (
              <>
                <p className="font-display text-2xl leading-tight">Tired yet? <em>{score} so far.</em></p>
                <p className="text-sm text-ink/60">It only gets faster from here.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setPhase('over')}>I'm done</Button>
                  <Button onClick={() => setPhase('playing')}>Keep nudging</Button>
                </div>
              </>
            ) : phase === 'ready' ? (
              <>
                <p className="text-sm text-ink/60">
                  Distractions are +1.{proofTasks.length > 0 && ' Your proof tasks are +3, and I\'ll line them up for a photo after.'}
                </p>
                <Button onClick={start} disabled={!canAfford}>Start nudging · {GAME_COST} coins</Button>
                <Link to="/" className="min-h-9 px-3 py-1.5 text-sm font-semibold text-ink/60 hover:text-ink">Not now</Link>
                {!canAfford && <p className="text-xs text-ink/50">You have {points}. Finish a task to earn 10.</p>}
              </>
            ) : (
              <>
                <MissRecap misses={misses} />
                <p className="font-display text-2xl leading-tight">
                  {score} {score === 1 ? 'nudge' : 'nudges'}.{' '}
                  <em>{score >= best && score > 0 ? 'New best.' : score > 20 ? 'Ruthless.' : 'Warming up.'}</em>
                </p>
                <Button onClick={start} disabled={!canAfford}>Again · {GAME_COST} coins</Button>
              </>
            )}
          </motion.div>
        )}
      </div>

      {phase === 'over' && caughtTasks.length > 0 && (
        <section className="rounded-2xl border-[length:var(--bw)] border-line bg-surface p-4 shadow-card">
          <h2 className="font-display text-xl">You nudged these. Snap them?</h2>
          <p className="text-sm text-ink/55">Pics or it didn't happen. +15 each.</p>
          <ul className="mt-3 space-y-2">
            {caughtTasks.map((t) => (
              <li key={t.id}>
                <Link to={`/proof/${t.id}`} className="flex items-center gap-3 rounded-xl bg-ink/[0.04] px-3 py-2.5 hover:bg-ink/[0.07]">
                  <CameraIcon size={18} className="text-primary" />
                  <span className="flex-1 text-sm font-medium">{t.title}</span>
                  <span className="text-xs font-semibold text-primary">Snap</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
