import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BellIcon, CameraIcon } from './Icons.jsx'
import { SNOOZE_OPTIONS } from '../lib/nudges.js'

// How pushy a nudge is shows as a small label, not a louder colour.
const LEVEL_LABEL = { 1: 'Nudge', 2: 'Nudge', 3: 'Prod', 4: 'Shove' }

// A nudge as a quiet notification row: the line, the task it's about, and actions.
// Only the newest nudge per task gets actions; older ones read as history.
export default function NudgeBubble({ nudge, task, onDone, onSnooze }) {
  const [asking, setAsking] = useState(false)
  const [snoozing, setSnoozing] = useState(false)
  const navigate = useNavigate()
  const time = nudge.at && new Date(nudge.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const actionable = task && !task.done && (onDone || onSnooze)
  const btn = 'min-h-10 flex-1 rounded-full px-4 text-sm font-semibold sm:flex-none'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className={`flex gap-3 rounded-2xl p-3.5 sm:p-4 border-[length:var(--bw)] border-line ${actionable ? 'bg-surface shadow-card' : 'bg-surface/60'}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full sm:h-9 sm:w-9 ${nudge.level >= 3 ? 'bg-primary text-on-primary' : 'bg-soft text-primary'}`}>
        <BellIcon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-semibold text-ink/60">{LEVEL_LABEL[nudge.level] ?? 'Nudge'}</span>
          {task && <span className="min-w-0 truncate text-ink/40">{task.title}</span>}
          {time && <span className="ml-auto shrink-0 tabular-nums text-ink/40">{time}</span>}
        </div>
        <p className={`mt-1 text-[15px] leading-snug ${actionable ? '' : 'text-ink/60'}`}>{nudge.text}</p>
        {nudge.via && <p className="mt-1 text-xs font-semibold text-primary">⚡ {nudge.via}</p>}
        {actionable && !asking && !snoozing && (
          <div className="mt-3 flex gap-2">
            {onDone && (
              <button type="button" onClick={() => (task.physical ? setAsking(true) : onDone())} className={`${btn} bg-primary text-on-primary`}>
                Done
              </button>
            )}
            {onSnooze && (
              <button type="button" onClick={() => setSnoozing(true)} className={`${btn} border-[length:var(--bw)] border-line text-ink/70 hover:bg-ink/5`}>
                Snooze
              </button>
            )}
          </div>
        )}
        {/* Snoozing is free: pick how long. */}
        {actionable && snoozing && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SNOOZE_OPTIONS.map((o) => (
              <button key={o.minutes} type="button" onClick={() => onSnooze(o.minutes)} className={`${btn} border-[length:var(--bw)] border-line text-ink/70 hover:bg-ink/5`}>
                {o.label}
              </button>
            ))}
            <button type="button" onClick={() => setSnoozing(false)} className={`${btn} text-ink/50 hover:bg-ink/5`}>
              Back
            </button>
          </div>
        )}
        {/* Proof tasks ask, they don't insist. Same choice as on the task card. */}
        <AnimatePresence>
          {asking && actionable && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="mt-3 flex flex-col gap-2 border-t-[length:var(--bw)] border-line pt-3"
            >
              <span className="text-sm font-medium">Snap a photo for the bonus? Pics or it didn't happen.</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAsking(false)} className={`${btn} text-ink/60 hover:bg-ink/5`}>
                  Not now
                </button>
                {onDone && (
                  <button type="button" onClick={() => { setAsking(false); onDone() }} className={`${btn} text-ink/60 hover:bg-ink/5`}>
                    Skip photo
                  </button>
                )}
                <button type="button" onClick={() => navigate(`/proof/${task.id}`)} className={`${btn} inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary`}>
                  <CameraIcon size={15} /> Snap it +15
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {task?.done && <p className="mt-2 text-xs text-success">Done</p>}
      </div>
    </motion.div>
  )
}
