import { useCallback, useEffect, useState } from 'react'
import { useJobs } from '../lib/jobs.js'
import ArtLoader from '../components/ArtLoader.jsx'
import { AnimatePresence, motion } from 'framer-motion'
import Counter from '../components/Counter.jsx'
import { useStore } from '../lib/store.jsx'
import { BADGES, badgeStats, isEarned } from '../lib/mockData.js'
import { confettiBurst } from '../lib/confetti.js'
import { badgeContext, editBadgeArt, makeBadgeArt } from '../lib/badgeArt.js'
import { FlameIcon, StarIcon, TrophyIcon } from '../components/Icons.jsx'
import { Link } from 'react-router-dom'
import Mascot from '../components/Mascot.jsx'

// This user's own badge art (made by Muse Image), else public/badges/<id>.png, else a plain medal.
function BadgeArt({ badge, size = 64 }) {
  const { badgeArt } = useStore()
  const [failed, setFailed] = useState(false)
  const mine = badgeArt[badge.id]
  if (mine || !failed) {
    return <img src={mine ?? `/badges/${badge.id}.png`} alt="" width={size} height={size} onError={() => setFailed(true)} className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span className="grid place-items-center rounded-full bg-soft text-primary ring-1 ring-line" style={{ width: size, height: size }}>
      <TrophyIcon size={size * 0.42} />
    </span>
  )
}

function BadgeView({ badge, stats, onClose }) {
  const earned = isEarned(badge, stats)
  const { name, tasks, streak, badgeArt, setBadgeArt } = useStore()
  const [making, setMaking] = useState(false)
  const [touch, setTouch] = useState('')
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')
  const mine = badgeArt[badge.id]

  // One image per tap, only for earned badges. The result is kept, so it never costs twice.
  // Back to the standard badge: only the picture goes, and the badge stays earned. Two taps, since it can't be undone.
  function clearArt() {
    if (!clearing) return setClearing(true)
    setBadgeArt(({ [badge.id]: _gone, ...rest }) => rest)
    setClearing(false)
  }

  async function create(addTo = false) {
    setClearing(false)
    setMaking(true)
    setError('')
    try {
      const context = badgeContext(tasks, streak, touch)
      const art = mine && addTo ? await editBadgeArt(badge.id, mine, context) : await makeBadgeArt(badge.id, context, { fresh: !!mine })
      setTouch('')
      setBadgeArt((all) => ({ ...all, [badge.id]: art }))
      confettiBurst({ y: window.innerHeight * 0.45, count: 60 })
    } catch (err) {
      setError(err.message)
    }
    setMaking(false)
  }

  // Still drawing from before, even if this was closed or the page reloaded.
  const jobs = useJobs()
  const drawing = making || jobs.some((j) => j.kind === 'badge' && j.meta?.badgeId === badge.id)

  useEffect(() => {
    if (earned) confettiBurst({ y: window.innerHeight * 0.45, count: 90 })
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [earned, onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={badge.label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[55] grid items-start justify-items-center overflow-y-auto bg-ink/40 px-6 pb-6 pt-[5.5rem] backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-3xl bg-surface p-6 text-center shadow-card"
      >
        <motion.div
          className={`mx-auto w-fit ${earned ? '' : 'opacity-40 grayscale'}`}
          initial={{ rotate: -12, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.05 }}
        >
          <BadgeArt badge={badge} size={140} />
        </motion.div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink/45">{earned ? 'Unlocked' : 'Locked'}</p>
        <h2 className="mt-1 font-display text-2xl leading-tight">{badge.label}</h2>
        <p className="mt-2 text-sm text-ink/60">
          {earned ? badge.blurb : `${badge.goal - stats[badge.stat]} more to go. You've got this.`}
        </p>
        {!earned && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(stats[badge.stat] / badge.goal) * 100}%` }} />
          </div>
        )}
        {drawing && <ArtLoader />}
        {earned && mine && <p className="mt-2 text-xs text-ink/45">Made for {name || 'you'} by Muse Image</p>}
        {earned && (
          <input
            value={touch}
            onChange={(e) => setTouch(e.target.value)}
            maxLength={40}
            placeholder={mine ? 'Add to this badge: glasses, a hat, my dog…' : 'Add your own touch: my dog, football, jollof…'}
            aria-label="Your own touch for this badge"
            className="mt-3 w-full rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        )}
        {earned && mine && touch.trim() && (
          <button
            type="button"
            onClick={() => create(true)}
            disabled={drawing}
            className="mt-4 min-h-10 w-full rounded-full bg-soft px-3 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {drawing ? 'Adding it…' : `✨ Add ${touch.trim()} to my badge`}
          </button>
        )}
        {earned && (
          <button
            type="button"
            onClick={() => create(false)}
            disabled={drawing}
            className={`mt-2 min-h-10 w-full rounded-full text-sm font-semibold disabled:opacity-60 ${mine ? 'text-ink/60 hover:bg-ink/5' : 'bg-soft text-ink'}`}
          >
            {drawing ? 'Drawing your badge…' : mine ? 'Draw a whole new one' : '✨ Create my badge'}
          </button>
        )}
        {earned && mine && !drawing && (
          <button
            type="button"
            onClick={clearArt}
            className={`mt-1 min-h-9 w-full rounded-full text-xs font-semibold hover:bg-ink/5 ${clearing ? 'text-accent' : 'text-ink/45'}`}
          >
            {clearing ? 'Tap again to clear it' : 'Clear my picture'}
          </button>
        )}
        {error && <p className="mt-2 text-sm text-accent">{error}</p>}
        <button type="button" onClick={onClose} className="mt-3 min-h-10 w-full rounded-full bg-primary text-sm font-semibold text-on-primary">
          {earned ? 'Nice' : 'Got it'}
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function RewardsPage() {
  const { tasks, points, streak } = useStore()
  const stats = badgeStats(tasks, streak)
  const [viewing, setViewing] = useState(null)
  const close = useCallback(() => setViewing(null), [])

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="font-display text-[1.75rem] leading-tight">Rewards</h1>

      <div className="grid grid-cols-3 gap-2">
        {[
          { Icon: StarIcon, value: <Counter value={points} />, label: 'points' },
          { Icon: FlameIcon, value: streak, label: 'day streak' },
          { Icon: TrophyIcon, value: BADGES.filter((b) => isEarned(b, stats)).length, label: 'badges' },
        ].map(({ Icon, value, label }) => (
          <div key={label} className="rounded-2xl border-[length:var(--bw)] border-line bg-surface p-3 shadow-card">
            <Icon size={16} className="text-ink/40" />
            <p className="mt-1.5 font-display text-3xl leading-none">{value}</p>
            <p className="mt-1 text-xs text-ink/50">{label}</p>
          </div>
        ))}
      </div>

      <Link to="/play" className="flex items-center gap-3 rounded-2xl border-[length:var(--bw)] border-line bg-surface p-4 shadow-card hover:bg-ink/[0.02]">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft"><Mascot size={30} /></span>
        <span className="flex-1">
          <span className="block font-semibold">Nudge break</span>
          <span className="block text-xs text-ink/50">30-second whack-a-nudge. Proof tasks are worth extra.</span>
        </span>
        <span className="text-sm font-semibold text-primary">Play</span>
      </Link>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">Badges</h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {BADGES.map((b, i) => {
            const earned = isEarned(b, stats)
            return (
              <motion.li key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <button
                  type="button"
                  onClick={() => setViewing(b)}
                  className="flex h-full w-full flex-col items-center gap-2 rounded-2xl border-[length:var(--bw)] border-line bg-surface p-3 text-center shadow-card transition hover:-translate-y-0.5"
                >
                  <span className={earned ? '' : 'opacity-35 grayscale'}><BadgeArt badge={b} size={52} /></span>
                  <span className={`text-xs leading-tight ${earned ? 'font-medium' : 'text-ink/45'}`}>{b.label}</span>
                </button>
              </motion.li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-ink/45">Tap a badge to see it up close.</p>
      </section>

      <AnimatePresence>
        {viewing && <BadgeView badge={viewing} stats={stats} onClose={close} />}
      </AnimatePresence>
    </div>
  )
}
