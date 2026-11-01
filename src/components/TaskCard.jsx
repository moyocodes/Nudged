import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store.jsx'
import { friendlyDue, isEarly, isOverdue } from '../lib/format.js'
import { canNudge, describeRepeat, formatClock, nextOccurrence } from '../lib/schedule.js'
import { nextNudgeAt } from '../lib/nudges.js'
import { PriorityBadge, ProofBadge } from './ui.jsx'
import DatePicker from './DatePicker.jsx'
import RepeatPicker from './RepeatPicker.jsx'
import { BellIcon, CameraIcon, CheckIcon, PencilIcon, TrashIcon } from './Icons.jsx'

// ISO string -> local "YYYY-MM-DD" and "HH:mm". Separate inputs, because a combined
// datetime-local stays empty until both halves are filled, which silently dropped dates.
function toLocalParts(iso) {
  if (!iso) return ['', '']
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()
  return [local.slice(0, 10), local.slice(11, 16)]
}

const dayString = (offset) => toLocalParts(new Date(Date.now() + offset * 86400000).toISOString())[0]

function TaskEditor({ task, onClose }) {
  const { updateTask, deleteTask, schedule } = useStore()
  const [title, setTitle] = useState(task.title)
  const [initialDate, initialTime] = toLocalParts(task.due)
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)
  const [priority, setPriority] = useState(task.priority)
  const [proof, setProof] = useState(!!task.physical)
  const [repeat, setRepeat] = useState(task.repeat ?? null)
  // Deleting before it's due takes a second tap.
  const [sureDelete, setSureDelete] = useState(false)

  // A date with no time defaults to 9 AM; a time with no date means today.
  // A repeating task's due is its next slot. If the repeat didn't change, keep the slot it's already on:
  // recomputing from now would bring back a slot that was ticked off early (ticked at 00:30, saved at 8:00 = 9:00 again).
  const sameRepeat = JSON.stringify(repeat) === JSON.stringify(task.repeat ?? null)
  const keepDue = sameRepeat && task.due && new Date(task.due) > new Date()
  const due = repeat ? (keepDue ? new Date(task.due) : nextOccurrence(repeat)) : date || time ? new Date(`${date || dayString(0)}T${time || '09:00'}`) : null
  const asleep = due && priority === 'low' && !canNudge({ priority }, due, schedule)

  function save(e) {
    e.preventDefault()
    if (!title.trim()) return
    updateTask(task.id, { title: title.trim(), due: due ? due.toISOString() : null, priority, physical: proof, repeat, ask: due ? null : task.ask })
    onClose()
  }


  const field = 'w-full rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-primary/40'
  return (
    <form onSubmit={save} className="flex w-full flex-col gap-2">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task" className={field} />
      {!repeat && <DatePicker date={date} time={time} onChange={(d, t) => { setDate(d); setTime(t) }} />}
      <RepeatPicker value={repeat} defaultTime={time} onChange={setRepeat} />
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink/50">Priority</span>
        <div role="radiogroup" aria-label="Priority" className="flex gap-1.5">
          {[['high', 'High', 'bg-primary'], ['medium', 'Medium', 'bg-highlight'], ['low', 'Low', 'bg-ink/25']].map(([value, label, dot]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={priority === value}
              onClick={() => setPriority(value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${priority === value ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`}
            >
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 py-2.5">
        <span>
          <span className="block text-sm font-medium">Photo proof</span>
          <span className="block text-xs text-ink/50">I'll ask for a pic when you tick it. Optional, +15 if you do.</span>
        </span>
        <input type="checkbox" checked={proof} onChange={(e) => setProof(e.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
      </label>
      <p className="text-xs text-ink/50">
        {!due
          ? `No date: I'll nudge you at ${formatClock(schedule.checkIn)} each day.`
          : asleep
            ? `That's during your sleep hours, so I'll wait until ${formatClock(schedule.sleepEnd)}. Make it medium or high to nudge you anyway.`
            : `I'll nudge you ${friendlyDue(due.toISOString()).toLowerCase()}${repeat ? `, then ${describeRepeat(repeat).toLowerCase()}` : ''}.`}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (isEarly(task) && !sureDelete ? setSureDelete(true) : deleteTask(task.id))} className="mr-auto rounded-full px-2 py-1.5 text-sm font-semibold text-accent hover:bg-ink/5">
          {sureDelete ? "Not due yet. Sure? Delete" : 'Delete'}
        </button>
        <button type="button" onClick={onClose} className="min-h-9 rounded-full px-4 text-sm font-semibold text-ink/60 hover:bg-ink/5">Cancel</button>
        <button type="submit" disabled={!title.trim()} className="min-h-9 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-40">Save</button>
      </div>
    </form>
  )
}

// Quick answers for a "when" question; anything else gets a one-line answer box.
// who/what answers go into the title; how/why become a note under it.
const ASK_PLACEHOLDER = { who: 'Who?', how: 'How?', why: 'Why? Humour me', what: 'Tell me more' }

function AskRow({ task, onPick }) {
  const { updateTask, addChat } = useStore()
  const [answer, setAnswer] = useState('')
  function saveAnswer(text) {
    const changes = ['how', 'why'].includes(task.ask.kind) ? { note: text } : { title: `${task.title} (${text})` }
    updateTask(task.id, { ...changes, ask: null })
    addChat({ from: 'nudgy', text: task.ask.text }, { from: 'you', text })
  }
  const at = (days, h) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(h, 0, 0, 0)
    return d.toISOString()
  }
  const setWhen = (due) => {
    updateTask(task.id, { due, ask: null })
    addChat({ from: 'nudgy', text: task.ask.text }, { from: 'you', text: friendlyDue(due) })
  }
  const chip = 'min-h-8 rounded-full bg-surface px-3 text-xs font-semibold ring-1 ring-line hover:bg-ink/5'

  return (
    <div className="mt-2 basis-full rounded-xl bg-soft/60 px-3 py-2.5">
      <p className="text-sm font-medium">{task.ask.text}</p>
      {task.ask.kind === 'when' ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {new Date().getHours() < 18 && <button type="button" onClick={() => setWhen(at(0, 18))} className={chip}>This evening</button>}
          <button type="button" onClick={() => setWhen(at(0, 20) < new Date().toISOString() ? at(1, 20) : at(0, 20))} className={chip}>Tonight</button>
          <button type="button" onClick={() => setWhen(at(1, 9))} className={chip}>Tomorrow morning</button>
          <button type="button" onClick={onPick} className={chip}>Pick a time…</button>
          <button type="button" onClick={() => updateTask(task.id, { ask: null })} className="min-h-8 px-2 text-xs font-semibold text-ink/50">Whenever</button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (answer.trim()) saveAnswer(answer.trim())
          }}
          className="mt-2 flex gap-1.5"
        >
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={ASK_PLACEHOLDER[task.ask.kind] ?? 'Tell me more'} className="min-w-0 flex-1 rounded-full bg-surface px-3 py-1.5 text-sm outline-none ring-1 ring-line focus:ring-primary/50" />
          <button type="submit" className="rounded-full bg-primary px-3 text-xs font-semibold text-on-primary">Save</button>
          <button type="button" onClick={() => updateTask(task.id, { ask: null })} className="px-2 text-xs font-semibold text-ink/50">Skip</button>
        </form>
      )}
    </div>
  )
}

const countdown = (ms) => {
  const secs = Math.ceil(ms / 1000)
  const days = Math.floor(secs / 86400)
  const hours = Math.floor((secs % 86400) / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${mins}m`
  return `${mins}m ${String(secs % 60).padStart(2, '0')}s`
}

// Ticks once a second, so only this line re-renders.
function NextNudge({ task }) {
  const { nudges, schedule } = useStore()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const when = nextNudgeAt(task, nudges, schedule, now)
  if (!when) return null
  const left = when - now
  return <span className="block text-xs tabular-nums text-ink/50">{left > 0 ? `Next nudge in ${countdown(left)}` : 'Nudge coming any moment'}</span>
}

export default function TaskCard({ task }) {
  const { completeTask, reopenTask, deleteTask, nudges, schedule, aboutTaskId, setAboutTaskId } = useStore()
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState(false)
  const navigate = useNavigate()
  const nudged = nudges.filter((p) => p.taskId === task.id).length
  // Ticking off something not due yet asks "sure?" first; then the usual photo-proof question.
  const [early, setEarly] = useState(false)
  const finish = () => { setEarly(false); task.physical ? setAsking(true) : completeTask(task.id) }
  const overdue = isOverdue(task)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="flex flex-wrap items-center gap-x-3 rounded-2xl bg-surface px-4 py-3 shadow-card border-[length:var(--bw)] border-line">
      {editing ? <TaskEditor task={task} onClose={() => setEditing(false)} /> : (
      <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        onClick={() => (task.done ? reopenTask(task.id) : isEarly(task) ? setEarly(true) : finish())}
        aria-label={task.done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] transition ${
          task.done ? 'border-success bg-success text-on-primary' : 'border-ink/25 hover:border-primary'
        }`}
      >
        <AnimatePresence>
          {task.done && (
            <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}>
              <CheckIcon size={14} strokeWidth={2.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      {task.photo && (
        <Link to={`/proof/${task.id}`} aria-label={`Photo for ${task.title}, proof ${task.proof ? 'complete' : 'incomplete'}`} className="relative shrink-0">
          <img src={task.photo} alt="" className={`h-11 w-11 rounded-lg object-cover ring-1 ring-line ${task.done ? 'opacity-50' : ''}`} />
          <ProofBadge complete={!!task.proof} compact className="absolute -right-1 -top-1" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${task.title}`}
          className={`block w-full text-left text-[15px] font-medium ${task.done ? 'text-ink/40 line-through' : ''}`}
        >
          {task.title}
        </button>
        {task.note && <p className="truncate text-xs text-ink/45">{task.note}</p>}
        <div className="mt-0.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Change time for ${task.title}`}
            className={`text-left text-[13px] underline-offset-2 hover:underline ${overdue ? 'text-accent' : 'text-ink/50'}`}
          >
            {task.done ? (task.proof ? 'Done · proof accepted' : 'Done') : task.due ? friendlyDue(task.due) : `No date · nudge at ${formatClock(schedule.checkIn)}`}
          </button>
          {!task.done && <PriorityBadge priority={task.priority} />}
          {task.repeat && <span className="truncate text-xs text-ink/50" title={describeRepeat(task.repeat)}>↻ {describeRepeat(task.repeat)}</span>}
          {!task.done && nudged > 0 && (
            <Link to="/nudges" className="inline-flex items-center gap-1 text-xs text-ink/50 hover:text-primary">
              <BellIcon size={12} /> {nudged}×
            </Link>
          )}
        </div>
        {!task.done && <NextNudge task={task} />}
      </div>
      <div className="-mr-2 flex shrink-0 items-center">
      {/* Once a task is done, a bin pops out beside it so it can be cleared in one tap. */}
      <AnimatePresence initial={false}>
        {task.done && (
          <motion.button
            key="trash"
            type="button"
            onClick={() => deleteTask(task.id)}
            aria-label={`Delete ${task.title}`}
            title="Delete"
            initial={{ opacity: 0, scale: 0.6, x: 8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.35, delay: 0.15 }}
            whileTap={{ scale: 0.85 }}
            className="grid h-8 w-8 place-items-center rounded-full text-accent hover:bg-accent/10"
          >
            <TrashIcon size={16} />
          </motion.button>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${task.title}`}
        title="Edit"
        className="grid h-8 w-8 place-items-center rounded-full text-ink/40 hover:bg-ink/5 hover:text-ink"
      >
        <PencilIcon size={16} />
      </button>
      {/* @: talk to Nudgy about this one; it lands as a chip in the brain dump. */}
      {!task.done && (
        <button
          type="button"
          onClick={() => setAboutTaskId(task.id)}
          aria-label={`Tell Nudgy what to do with ${task.title}`}
          title="Tell Nudgy what to do with this"
          className={`grid h-8 w-8 place-items-center rounded-full text-[15px] font-semibold hover:bg-ink/5 ${aboutTaskId === task.id ? 'text-primary' : 'text-ink/40 hover:text-ink'}`}
        >
          @
        </button>
      )}
      {!task.done && task.physical && (
        <Link
          to={`/proof/${task.id}`}
          className="grid h-8 w-8 place-items-center rounded-full text-ink/40 hover:bg-ink/5 hover:text-ink"
          aria-label={`Snap proof for ${task.title}`}
          title="Snap proof for bonus points"
        >
          <CameraIcon size={17} />
        </Link>
      )}
      </div>
      </>
      )}
      {/* Nudgy's follow-up question when the model couldn't tell when/who/what. */}
      {task.ask && !task.done && !editing && <AskRow task={task} onPick={() => setEditing(true)} />}
      {early && !task.done && (
        <div className="mt-2 flex basis-full flex-wrap items-center gap-2 border-t-[length:var(--bw)] border-line pt-3">
          <span className="mr-auto text-sm font-medium">Done already? It's not due till {friendlyDue(task.due).toLowerCase()}.</span>
          <button type="button" onClick={() => setEarly(false)} className="min-h-9 rounded-full px-3 text-sm font-semibold text-ink/60 hover:bg-ink/5">Oops, not yet</button>
          <button type="button" onClick={finish} className="min-h-9 rounded-full bg-primary px-3 text-sm font-semibold text-on-primary">Yes, done</button>
        </div>
      )}
      {/* Proof tasks ask, they don't insist. */}
      <AnimatePresence>
        {asking && !task.done && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="basis-full"
          >
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t-[length:var(--bw)] border-line pt-3">
              <span className="mr-auto text-sm font-medium">Snap a photo for the bonus? Pics or it didn't happen.</span>
              <button type="button" onClick={() => setAsking(false)} className="min-h-9 rounded-full px-3 text-sm font-semibold text-ink/60 hover:bg-ink/5">
                Not now
              </button>
              <button type="button" onClick={() => { completeTask(task.id); setAsking(false) }} className="min-h-9 rounded-full px-3 text-sm font-semibold text-ink/60 hover:bg-ink/5">
                Skip photo
              </button>
              <button type="button" onClick={() => navigate(`/proof/${task.id}`)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-on-primary">
                <CameraIcon size={15} /> Snap it +15
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}
