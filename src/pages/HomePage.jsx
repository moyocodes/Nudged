import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { MAX_OPEN_TASKS, useStore } from '../lib/store.jsx'
import { badgeStats, mockExtract, nextBadge } from '../lib/mockData.js'
import { countdown, friendlyDue, isOverdue, nextDue, savedSummary } from '../lib/format.js'
import { describeRepeat, nextOccurrence } from '../lib/schedule.js'
import { greetingLine, isGreeting } from '../lib/phrases.js'
import { BACKSTOP, INTENT_HINT, OFFER, listRequest, looksPhysical, snoozeMinutes, taskSummary, whenAsk } from '../lib/intent.js'
import BrainDump from '../components/BrainDump.jsx'
import SoundPicker from '../components/SoundPicker.jsx'
import TaskCard from '../components/TaskCard.jsx'
import Story from '../components/Story.jsx'
import Mascot from '../components/Mascot.jsx'
import { showModel } from '../components/ModelTag.jsx'
import { BellIcon, ChevronIcon, TrophyIcon } from '../components/Icons.jsx'
import { SNOOZE_OPTIONS, holdNudges, makeNudge } from '../lib/nudges.js'
import { ALARM_MS, playAlarm } from '../lib/alarm.js'
import { pickEngine } from '../lib/engine.js'
import { resumeJobs, runJob } from '../lib/jobs.js'


// What Nudgy says while the model reads a brain dump. One at random each time.
const THINKING = [
  'Untangling your thoughts. Bring snacks.',
  'Sorting the to-dos from the oh-nos…',
  'Decoding brain soup. Mmm, chunky.',
  'Rummaging through your brain drawer…',
  'Hold on, sharpening my nudging finger.',
  'Turning chaos into a checklist. Very wizardly.',
  'Reading between the lines. And the umms.',
  'One sec, filing this under "future you".',
]

// When the rundown opens by itself, as capped by the user's setting: every visit, every 4 hours, once a day,
// or never. It is always one tap away on Today. The time it last opened is kept in localStorage.
const RUNDOWN_AT = 'nudgy:rundownAt'
function rundownDue(mode) {
  if (mode === 'never') return false
  if (mode === 'always') return true
  let last = 0
  try { last = Number(localStorage.getItem(RUNDOWN_AT)) || 0 } catch {}
  if (mode === 'daily') return new Date(last).toDateString() !== new Date().toDateString()
  return Date.now() - last >= 4 * 60 * 60 * 1000
}

// At most once per page load (not on every return to Today), and only when the cap allows.
let rundownShownThisLoad = false
function useDailyStory(ready) {
  const { setStoryOpen, rundownMode } = useStore()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!ready) return
    let fresh = false
    try {
      fresh = localStorage.getItem('nudgy:rundownOnLogin') === '1'
      localStorage.removeItem('nudgy:rundownOnLogin')
    } catch {}
    if (rundownShownThisLoad && !fresh) return
    rundownShownThisLoad = true
    if (!fresh && !rundownDue(rundownMode)) return
    try { localStorage.setItem(RUNDOWN_AT, String(Date.now())) } catch {}
    // Tell the rest of the app now, so the permissions card doesn't pop up while the rundown mounts.
    setStoryOpen(true)
    setOpen(true)
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  return [open, () => setOpen(true), () => setOpen(false)]
}

// Buckets for the list: overdue, today, later, no date.
function groupTasks(tasks) {
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const groups = { Overdue: [], Today: [], Later: [], Someday: [] }
  for (const t of tasks) {
    if (!t.due) groups.Someday.push(t)
    else if (isOverdue(t)) groups.Overdue.push(t)
    else if (new Date(t.due) <= endOfToday) groups.Today.push(t)
    else groups.Later.push(t)
  }
  for (const list of Object.values(groups)) list.sort((a, b) => new Date(a.due ?? 0) - new Date(b.due ?? 0))
  return Object.entries(groups).filter(([, list]) => list.length)
}

// Re-renders once a minute so countdowns stay honest.
function useMinuteClock() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}


// A group of reminders, always open. Long groups are split into pages of PAGE_SIZE.
const PAGE_SIZE = Number(import.meta.env.VITE_PAGE_SIZE) || 10

// Said when the reminder limit stopped some from being saved.
const limitLine = (skipped) => (skipped > 0 ? `You're at the ${MAX_OPEN_TASKS}-reminder limit, so I skipped ${skipped}. Tick a few off and try again.` : '')

// collapsed: starts closed (Done); tap the heading to open it. The count always shows.
function TaskGroup({ label, list, collapsed = false }) {
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(!collapsed)
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  // The list can shrink (ticked off, deleted) while on a later page.
  useEffect(() => { if (page > pages - 1) setPage(pages - 1) }, [page, pages])
  const shown = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pager = 'min-h-8 rounded-full px-3 text-xs font-semibold text-primary hover:bg-ink/5 disabled:text-ink/25 disabled:hover:bg-transparent'
  return (
    <section>
      {collapsed ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink/45"
        >
          <ChevronIcon size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
          {label} · {list.length}
        </button>
      ) : (
        <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${label === 'Overdue' ? 'text-accent' : 'text-ink/45'}`}>
          {label} · {list.length}
        </h2>
      )}
      {open && <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((t) => <TaskCard key={t.id} task={t} />)}
        </AnimatePresence>
      </ul>}
      {open && pages > 1 && (
        <div className="mt-2 flex items-center justify-between">
          <button type="button" className={pager} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-xs text-ink/50">{page * PAGE_SIZE + 1}–{Math.min(list.length, (page + 1) * PAGE_SIZE)} of {list.length}</span>
          <button type="button" className={pager} disabled={page === pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </section>
  )
}

const card = 'rounded-2xl border-[length:var(--bw)] border-line bg-surface p-4 shadow-card'

function NextBadge({ next, stats, className = '' }) {
  return (
    <Link to="/rewards" className={`flex items-center gap-3 rounded-2xl border-[length:var(--bw)] border-line bg-surface px-4 py-2.5 hover:bg-ink/[0.02] ${className}`}>
      <TrophyIcon size={18} className="shrink-0 text-ink/45" />
      <span className="min-w-0 flex-1">
        <span className="flex justify-between text-[13px]">
          <span className="truncate">Next: <span className="font-medium">{next.label}</span></span>
          <span className="text-ink/45">{stats[next.stat]}/{next.goal}</span>
        </span>
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-ink/10">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${(stats[next.stat] / next.goal) * 100}%` }} />
        </span>
      </span>
    </Link>
  )
}

// The week ahead at a glance: one column per day, a dot per task due. Tapping a day jumps the list to it.
function WeekGlance({ tasks, day, onPickDay }) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  return (
    <div className={card}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/45">This week</h2>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {days.map((d, i) => {
          const key = d.toDateString()
          const due = tasks.filter((t) => !t.done && t.due && new Date(t.due).toDateString() === key).length
          const picked = day === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(picked ? null : key)}
              aria-pressed={picked}
              aria-label={`${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}, ${due} due`}
              className={`rounded-xl py-2 transition-colors ${picked ? 'bg-primary text-on-primary' : i === 0 ? 'bg-soft hover:bg-ink/10' : 'hover:bg-ink/5'}`}
            >
              <span className={`block text-[10px] font-medium uppercase ${picked ? 'text-on-primary/70' : 'text-ink/45'}`}>{d.toLocaleDateString([], { weekday: 'narrow' })}</span>
              <span className={`block text-sm ${i === 0 && !picked ? 'font-semibold text-primary' : ''}`}>{d.getDate()}</span>
              <span className="mt-1 flex h-1.5 justify-center gap-0.5">
                {Array.from({ length: Math.min(due, 3) }, (_, j) => <span key={j} className={`h-1.5 w-1.5 rounded-full ${picked ? 'bg-on-primary' : 'bg-primary'}`} />)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Daily goals: recurring reminders that fall on today, as a checklist. Ticking one moves it to its
// next slot, so "done today" comes from lastDoneAt. Photo-proof goals go to the proof page instead.
function DailyGoals({ tasks, onTick }) {
  const navigate = useNavigate()
  const today = new Date()
  const goals = tasks.filter((t) => !t.done && t.repeat?.some((slot) => slot.days.includes(today.getDay())))
  if (!goals.length) return null
  const doneToday = (t) => t.lastDoneAt && new Date(t.lastDoneAt).toDateString() === today.toDateString()
  const count = goals.filter(doneToday).length
  return (
    <section aria-label="Daily goals" className={card}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/45">Daily goals</h2>
        <span className="text-xs font-semibold text-primary">{count}/{goals.length} today</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/5">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(count / goals.length) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-1">
        {goals.map((t) => {
          const ticked = doneToday(t)
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={ticked}
                onClick={() => (t.physical ? navigate(`/proof/${t.id}`) : onTick(t.id))}
                className="-mx-2 flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-ink/5 disabled:hover:bg-transparent"
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] ${ticked ? 'border-primary bg-primary text-on-primary' : 'border-ink/25'}`}>
                  {ticked && <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.5l2.2 2L9.5 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] ${ticked ? 'text-ink/45 line-through' : 'font-medium'}`}>{t.title}</span>
                  <span className="block text-xs text-ink/50">{describeRepeat(t.repeat)}{t.physical && !ticked ? ' · photo proof' : ''}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// The list narrowed to one day, picked from the week strip.
function DayView({ day, tasks, onClear }) {
  const list = tasks
    .filter((t) => t.due && new Date(t.due).toDateString() === day)
    .sort((a, b) => a.done - b.done || new Date(a.due) - new Date(b.due))
  const label = new Date(day).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/45">{label} · {list.length}</h2>
        <button type="button" onClick={onClear} className="rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-ink/5">Show all</button>
      </div>
      {list.length ? (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {list.map((t) => <TaskCard key={t.id} task={t} />)}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="py-6 text-center text-ink/50">Nothing that day. Pencil in a nap?</p>
      )}
    </section>
  )
}

// The panels beside the list: rundown, next badge, recent nudges, the week, nudge break.
// A right rail on desktop; below the list on mobile.
function RailContent({ open, overdue, nudges, tasks, next, stats, onRundown, upcoming, now, day, onPickDay }) {
  const recent = [...nudges].reverse().slice(0, 3)
  return (
    <>
      <div className={`${card} flex items-center gap-3`}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-soft ring-2 ring-primary ring-offset-2 ring-offset-surface">
          <Mascot size={28} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Today's rundown</span>
          <span className="block text-xs text-ink/50">
            {open} open{overdue ? ` · ${overdue} overdue` : ''}{upcoming ? ` · next in ${countdown(new Date(upcoming.due) - now)}` : ''}
          </span>
          {upcoming && <span className="block truncate text-xs font-medium">{upcoming.title}</span>}
        </span>
        <button type="button" onClick={onRundown} className="min-h-9 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary">Play</button>
      </div>

      {next && <NextBadge next={next} stats={stats} />}

      <div className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/45">Recent nudges</h2>
          <Link to="/nudges" className="text-xs font-semibold text-primary">See all</Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">Quiet. Suspiciously quiet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recent.map((p) => (
              <li key={p.id}>
                <Link to="/nudges" className="-mx-2 flex gap-2.5 rounded-xl px-2 py-1 hover:bg-ink/5">
                  <BellIcon size={15} className="mt-0.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 block text-[13px] leading-snug">{p.text}</span>
                    <span className="block text-[11px] text-ink/45">{tasks.find((t) => t.id === p.taskId)?.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <WeekGlance tasks={tasks} day={day} onPickDay={onPickDay} />

      <div className={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/45">Background sound</h2>
        <SoundPicker compact />
      </div>

      <Link to="/play" className={`${card} flex items-center gap-3 hover:bg-ink/[0.02]`}>
        <span className="flex-1">
          <span className="block text-sm font-semibold">Nudge break</span>
          <span className="block text-xs text-ink/50">30 seconds of whack-a-nudge.</span>
        </span>
        <span className="text-sm font-semibold text-primary">Play</span>
      </Link>
    </>
  )
}

export default function HomePage() {
  const { hydrated, nudgeModel, setNudges, schedule, name, buddyName, tasks, addTasks, introSeen, nudges, completeTask, snoozeTask, updateTask, deleteTask, replaceTasks, replacePoints, points, aboutTaskId, setAboutTaskId, streak, tutorialSeen, openTutorial, say, chat, addChat } = useStore()
  const [storyOpen, openStory, closeStory] = useDailyStory(tutorialSeen && introSeen && hydrated)
  const [askingProof, setAskingProof] = useState(false)
  const [snoozingBanner, setSnoozingBanner] = useState(false)
  // A day picked from the week strip ("Wed Oct 28 2026"), or null for the full list.
  const [day, setDay] = useState(null)
  const listRef = useRef(null)
  function pickDay(key) {
    setDay(key)
    if (key) setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // First visit: show how things work before the daily rundown takes over.
  useEffect(() => {
    if (!tutorialSeen) openTutorial()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Prototype: local mock extraction. Swap for POST /api/extract later.
  // Muse Spark reads the dump and replies; the local parser is only a fallback if the call fails.
  // The task list just before the last brain dump changed it, so it can be undone.
  const [lastChange, setLastChange] = useState(null)
  function undoLast() {
    if (!lastChange) return say('Nothing to undo. Clean slate, clean conscience.')
    replaceTasks(lastChange.before)
    replacePoints(lastChange.points)
    setLastChange(null)
    const line = 'Undone. Like it never happened.'
    say(line)
    addChat({ from: 'nudgy', text: line })
  }

  // Work left running when the page closed: collect it and carry on, with the same loaders.
  useEffect(() => {
    if (!hydrated) return
    const byId = (ids) => ids.map((id) => tasks.find((t) => t.id === id)).filter(Boolean)
    resumeJobs('extract', (json, job) => {
      applyReply(json, job.meta.text, job.meta.said, byId(job.meta.listed))
    }, (job, err) => say(`I lost that one, sorry: ${err.message}`))
    resumeJobs('plan', applyPlan, (job, err) => say(err.message))
  }, [hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quiet for 15 seconds after typing, talking or a reply: Nudgy picks the conversation back up, once per burst of activity.
  const idleTimer = useRef(null)
  const idleState = useRef({})
  function noteActivity(draft = '') {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => checkIn(draft), 15000)
  }
  async function checkIn(draft) {
    const { chat, tasks, thinking, name, nudgeModel } = idleState.current
    if (document.hidden || thinking > 0) return
    try {
      const r = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, name, engine: pickEngine(nudgeModel), history: chat.slice(-30).map(({ from, text, at }) => ({ from, text, at })), reminders: tasks.filter((t) => !t.done).map((t) => t.title) }),
      })
      const json = await r.json()
      if (!r.ok || !json.text) return
      showModel(json.via)
      say(json.text)
      addChat({ from: 'nudgy', text: json.text, checkin: true })
    } catch {}
  }
  useEffect(() => () => clearTimeout(idleTimer.current), [])
  // A fresh reply starts the clock. Old messages loaded from the account don't, and neither do the check-ins themselves.
  const lastChat = chat[chat.length - 1]
  useEffect(() => {
    if (lastChat && !lastChat.checkin && Date.now() - new Date(lastChat.at) < 5000) noteActivity()
  }, [lastChat?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Try a nudge: a real one on demand, so a first-timer hears what's coming. Gone once they've had any nudge.
  const [tryingNudge, setTryingNudge] = useState(false)
  async function tryNudge() {
    const rank = { high: 0, medium: 1, low: 2 }
    const task = tasks.filter((t) => !t.done).sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1))[0]
    if (!task || tryingNudge) return
    setTryingNudge(true)
    const nudge = await makeNudge(task, 1, name, 0, buddyName)
    setNudges((ps) => [...ps, nudge])
    setTryingNudge(false)
    const chimed = playAlarm()
    if (chimed) setTimeout(() => say(nudge.text), ALARM_MS)
    else say(nudge.text)
  }

  // Plan my day: the agent works on a copy on the server, and its changes land here in one undoable go.
  const [planning, setPlanning] = useState(false)
  const [plan, setPlan] = useState(null)
  function applyPlan(json) {
    showModel(json.via)
    if (json.changes.length) setLastChange({ before: tasks, points })
    json.changes.forEach((c) => updateTask(c.id, { due: c.due ? new Date(c.due).toISOString() : null, priority: c.priority, snoozedUntil: null }))
    setPlan(json)
    say(json.summary)
  }
  async function planMyDay() {
    const localTime = (d) => new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    // Recurring reminders keep their own slots.
    const movable = tasks.filter((t) => !t.done && !t.repeat)
    const reminders = movable.map((t, i) => ({ n: i + 1, id: t.id, title: t.title, due: t.due ? localTime(t.due) : null, priority: t.priority ?? 'medium' }))
    if (!reminders.length) return say('Nothing to plan. Enjoy it while it lasts.')
    setPlanning(true)
    holdNudges(true)
    try {
      applyPlan(await runJob('plan', 'Muse Spark Agent', '/api/plan', { reminders, schedule, now: localTime(new Date()) }))
    } catch (err) {
      say(err.message || "Couldn't plan just now. Try again in a bit.")
    } finally {
      holdNudges(false)
      setPlanning(false)
    }
  }

  // Applies the model's actions on existing reminders and describes what really changed.
  function applyActions(actions, listed, text = '') {
    const said = []
    for (const a of actions) {
      const task = listed[a.n - 1]
      if (!task) continue
      if (a.type === 'done') {
        completeTask(task.id)
        said.push(`Ticked off "${task.title}".${task.physical ? ' No photo, so no bonus.' : ''}`)
      }
      if (a.type === 'delete') { deleteTask(task.id); said.push(`Binned "${task.title}".`) }
      if (a.type === 'snooze') {
        // Nudgy asks how long, unless the message already said.
        const minutes = snoozeMinutes(text)
        if (minutes) { snoozeTask(task.id, minutes); said.push(`Snoozed "${task.title}" for ${snoozeName(minutes)}.`) }
        else { setPendingSnooze(task.id); said.push(`How long should I snooze "${task.title}"? 30 min, 1 hour or 90 min?`) }
      }
      if (a.type === 'update') {
        const changes = {}
        if (a.due) changes.due = new Date(a.due).toISOString()
        if (a.title) changes.title = a.title
        if (a.priority) changes.priority = a.priority
        if ('proof' in a) {
          changes.physical = !!a.proof
          if (a.proofOf) changes.proofOf = a.proofOf
        }
        if ('repeat' in a) {
          changes.repeat = a.repeat
          if (a.repeat && !a.due) changes.due = nextOccurrence(a.repeat)?.toISOString() ?? task.due
        }
        // Setting a time or name answers any question Nudgy had about this task.
        if (changes.due || changes.title) changes.ask = null
        updateTask(task.id, changes)
        const title = a.title || task.title
        said.push(
          'proof' in a
            ? a.proof ? `"${title}" now has a photo bonus.` : `"${title}" no longer needs a photo.`
            : 'repeat' in a
            ? a.repeat ? `"${title}" now repeats: ${describeRepeat(a.repeat)}.` : `"${title}" won't repeat any more.`
            : a.due ? `Moved "${title}" to ${friendlyDue(changes.due).toLowerCase()}.`
            : a.priority ? `"${title}" is now ${a.priority} priority.`
            : a.title ? `Renamed it "${a.title}".` : `Updated "${title}".`,
        )
      }
    }
    return said.join(' ')
  }

  // Dumps still being worked on. The page stays usable meanwhile; this just shows a "Nudgy's on it" pill.
  const [thinking, setThinking] = useState(0)
  // A question with no reminder to hang on ("what did you mean?"), kept above the box until answered.
  const [pendingQuestion, setPendingQuestion] = useState(null)
  // A snooze waiting on "how long?", answered by the next message with no model call.
  const [pendingSnooze, setPendingSnooze] = useState(null)
  const snoozeName = (m) => (m === 30 ? '30 minutes' : m === 60 ? 'an hour' : m === 90 ? '90 minutes' : `${m / 60} hours`)
  async function handleDump(text) {
    setPendingQuestion(null)
    setThinking((n) => n + 1)
    try {
      await processDump(text)
    } finally {
      setThinking((n) => n - 1)
    }
  }

  async function processDump(text) {
    if (pendingSnooze) {
      const id = pendingSnooze
      setPendingSnooze(null)
      const minutes = snoozeMinutes(text, true)
      const task = tasks.find((t) => t.id === id && !t.done)
      if (minutes && task) {
        snoozeTask(id, minutes)
        const line = `Snoozed "${task.title}" for ${snoozeName(minutes)}.`
        say(line)
        return addChat({ from: 'you', text }, { from: 'nudgy', text: line })
      }
    }
    // A bare greeting ("hey Nudgy", "hi Moyo", "good morning") gets a hello back, no model call.
    if (isGreeting(text, [name, buddyName])) {
      const open = tasks.filter((t) => !t.done)
      const next = nextDue(tasks)
      const hello = greetingLine(name || 'friend', buddyName || 'Nudgy', Date.now(), new Date().getHours())
      const status = open.length
        ? `${open.length} ${open.length === 1 ? 'thing' : 'things'} on${next ? `, next up: ${next.title}` : ''}. What's on your mind?`
        : 'Your list is empty. Suspicious. What are we remembering?'
      const line = `${hello} ${status}`
      say(line)
      return addChat({ from: 'you', text }, { from: 'nudgy', text: line })
    }
    // "What do I have today?" is a question about the list, not a new reminder: answer it from the real list.
    const scope = listRequest(text)
    if (scope) {
      const line = taskSummary(tasks, scope, name || 'friend')
      say(line)
      return addChat({ from: 'you', text }, { from: 'nudgy', text: line })
    }
    // A bare "undo" needs no model call.
    if (/^\s*(undo( that| it)?|take (that|it) back)[.!\s]*$/i.test(text)) {
      addChat({ from: 'you', text })
      return undoLast()
    }
    say(THINKING[Math.floor(Math.random() * THINKING.length)])
    const local = new Date()
    const now = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    // Numbered for the model; actions come back as numbers and are matched to ids here.
    // A reminder picked with @ goes first, as number 1, and the text is about it.
    const about = tasks.find((t) => t.id === aboutTaskId && !t.done)
    const listed = [...(about ? [about] : []), ...tasks.filter((t) => !t.done && t !== about)].slice(0, 25)
    setAboutTaskId(null)
    const said = about ? `About "${about.title}": ${text}` : text
    try {
      const engine = pickEngine(nudgeModel)
      const label = { open: 'Muse Spark Open · Baseten', modal: 'Muse Spark Open · Modal', spark: 'Muse Spark · Meta' }[engine]
      const json = await runJob('extract', label, '/api/extract', {
          text, now, name, buddy: buddyName, engine,
          history: chat.slice(-30).map(({ from, text, at }) => ({ from, text, at })),
          selected: about ? 1 : null,
          reminders: listed.map((t) => ({ title: t.title, due: t.due ? new Date(new Date(t.due).getTime() - local.getTimezoneOffset() * 60000).toISOString() : null, ask: t.ask?.text ?? null })),
      }, { text, said, listed: listed.map((t) => t.id) })
      return applyReply(json, text, said, listed)
    } catch (err) {
      return dumpFailed(err, text, said, listed, about)
    }
  }

  // Uses Muse Spark's answer. Also runs for an answer collected after the page reloaded.
  function applyReply({ reply, followup, actions = [], tasks: found, via }, text, said, listed) {
      showModel(via)
      if (actions.some((a) => a.type === 'undo')) {
        addChat({ from: 'you', text: said })
        return undoLast()
      }
      const before = tasks
      const changed = applyActions(actions, listed, text)
      const room = Math.max(0, MAX_OPEN_TASKS - tasks.filter((t) => !t.done).length)
      const saved = found.slice(0, room).map((t, i) => {
        const due = t.due ? new Date(t.due).toISOString() : t.repeat ? nextOccurrence(t.repeat)?.toISOString() ?? null : null
        return {
          id: `x${Date.now()}${i}`,
          title: t.title,
          due,
          priority: t.priority,
          // Photo proof is ticked for meetings, places and errands, by the model or by the local backstop.
          physical: !!t.proof || looksPhysical(t.title),
          proofOf: t.proofOf || undefined,
          ask: t.ask ?? (due ? null : whenAsk(t.title)),
          repeat: t.repeat,
          done: false,
        }
      })
      addTasks(saved)
      if (saved.length || changed) setLastChange({ before, points })
      // The quip is the model's; the "Set: ..." and action parts come from what was really changed.
      // Keep the conversation going: ask about a new task first, else the next one still waiting.
      const answered = new Set(actions.filter((a) => a.type !== 'update' || a.due || a.title).map((a) => listed[a.n - 1]?.id))
      const question = saved.find((t) => t.ask)?.ask.text ?? listed.find((t) => t.ask && !answered.has(t.id))?.ask.text
      // Nothing saved but it reads like a reminder: ask, don't shrug. The model's followup wins over the backstop.
      const nothing = !saved.length && !changed
      let ask = question ?? (followup || (nothing && INTENT_HINT.test(text) ? BACKSTOP : ''))
      // If the model had nothing to say either, don't shrug: say no reminder was found and offer to set one.
      if (nothing && !reply && !ask) ask = OFFER
      if (!question && ask) setPendingQuestion(ask)
      const line = [reply, changed, savedSummary(saved), limitLine(found.length - saved.length), ask].filter(Boolean).join(' ')
      say(line)
      addChat({ from: 'you', text: said }, { from: 'nudgy', text: line, taskIds: saved.map((t) => t.id) })
  }

  function dumpFailed(err, text, said, listed, about) {
      console.warn('[extract] falling back to local parser:', err.message)
      // The local parser only handles simple lists. A reply to Nudgy's question, an @ instruction
      // or a long sentence would just become a junk task, so say so instead.
      if (about || listed.some((t) => t.ask) || text.split(/\s+/).length > 12) {
        const line = `I couldn't reach my brain just now (${err.message}), so I didn't touch anything. Try again in a moment?`
        say(line)
        return addChat({ from: 'you', text: said }, { from: 'nudgy', text: line })
      }
      const all = mockExtract(text)
      const found = all.slice(0, Math.max(0, MAX_OPEN_TASKS - tasks.filter((t) => !t.done).length)).map((t) => ({ ...t, physical: t.physical || looksPhysical(t.title), ...(t.due || t.ask ? {} : { ask: whenAsk(t.title) }) }))
      if (found.length) setLastChange({ before: tasks, points })
      addTasks(found)
      const nudge = INTENT_HINT.test(text) ? BACKSTOP : OFFER
      if (!found.length) setPendingQuestion(nudge)
      const line = found.length ? `My brain's offline, so I winged it. ${savedSummary(found)} Check the times.${all.length > found.length ? ` ${limitLine(all.length - found.length)}` : ''}` : all.length ? limitLine(all.length) : nudge
      say(line)
      addChat({ from: 'you', text: said }, { from: 'nudgy', text: line, taskIds: found.map((t) => t.id) })
  }

  idleState.current = { chat, tasks, thinking, name, nudgeModel }
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const overdue = open.filter(isOverdue).length
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
  const stats = badgeStats(tasks, streak)
  const next = nextBadge(stats)
  const now = useMinuteClock()
  // The banner: the newest nudge's task, else the oldest overdue one, so it's there the moment the app opens. Never a model call.
  const waiting = (t) => t && !t.done && !(t.snoozedUntil && new Date(t.snoozedUntil) > now)
  const lastNudged = tasks.find((t) => t.id === nudges[nudges.length - 1]?.taskId)
  const bannerTask = waiting(lastNudged) ? lastNudged : open.filter((t) => waiting(t) && isOverdue(t)).sort((a, b) => new Date(a.due) - new Date(b.due))[0]
  const bannerNudge = bannerTask && nudges.findLast((p) => p.taskId === bannerTask.id)
  const upcoming = nextDue(tasks, now)
  const rail = { open: open.length, overdue, nudges, tasks, next, stats, onRundown: openStory, upcoming, now, day, onPickDay: pickDay }

  return (
    <div className="pt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8">
      <AnimatePresence>{storyOpen && <Story onClose={closeStory} />}</AnimatePresence>
      <div className="flex min-w-0 flex-col gap-4">

      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink/50">{today}</p>
          <h1 className="mt-1 font-display text-[1.75rem] leading-tight">
            Hey {name || 'you'}, <em>{open.length || 'nothing'}</em> {open.length === 1 ? 'thing' : 'things'} on.
          </h1>
          {overdue > 0 && <p className="mt-1 text-sm text-ink/60">{overdue} overdue. No judgement. Mostly.</p>}
          {upcoming && (
            <p className="mt-1 text-sm text-ink/60">
              Next up in <span className="font-semibold text-ink">{countdown(new Date(upcoming.due) - now)}</span>: {upcoming.title}
            </p>
          )}
        </div>
        <button type="button" onClick={openStory} className="flex shrink-0 flex-col lg:hidden items-center gap-1 text-[11px] font-medium text-ink/60">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-surface ring-2 ring-primary ring-offset-2 ring-offset-bg">
            <Mascot size={28} />
          </span>
          Rundown
        </button>
      </header>

      <DailyGoals tasks={tasks} onTick={completeTask} />

      {/* On phones: a short block up top with nothing to scroll. The rundown button is in the header,
          sound is in the top bar, so that card isn't repeated. */}
      <section aria-label="Your day" className="grid grid-cols-2 gap-3 lg:hidden">
        {next && <NextBadge next={next} stats={stats} className="!px-3" />}
        <Link to="/play" className={`${card} flex flex-col justify-center !p-3 hover:bg-ink/[0.02] ${next ? '' : 'col-span-2'}`}>
          <span className="text-sm font-semibold">Nudge break</span>
          <span className="text-xs text-ink/50">30-second game</span>
        </Link>
        <div className="col-span-2"><WeekGlance tasks={tasks} day={day} onPickDay={pickDay} /></div>
        {nudges.length > 0 && (
          <div className={`${card} col-span-2 !py-3`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/45">Recent nudges</h2>
              <Link to="/nudges" className="text-xs font-semibold text-primary">See all</Link>
            </div>
            <ul className="mt-2 space-y-1">
              {[...nudges].reverse().slice(0, 2).map((p) => (
                <li key={p.id}>
                  <Link to="/nudges" className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-ink/5">
                    <BellIcon size={14} className="shrink-0 text-primary" />
                    <span className="truncate text-[13px]">{p.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <AnimatePresence>
        {bannerTask && (
          <motion.div
            key={bannerNudge?.id ?? bannerTask.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 rounded-2xl border-[length:var(--bw)] border-line bg-soft/60 px-4 py-3"
          >
            <BellIcon size={18} className="shrink-0 text-primary" />
            <Link to="/nudges" className="min-w-0 flex-1 text-sm leading-snug">{bannerNudge?.text ?? `Psst, "${bannerTask.title}" is overdue. Done, or snooze?`}{bannerNudge?.via && <span className="mt-0.5 block text-xs font-semibold text-primary">⚡ {bannerNudge.via}</span>}</Link>
            {/* Proof tasks ask first, same as the task card. */}
            {askingProof ? (
              <span className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setAskingProof(false)} className="rounded-full px-2 py-1 text-sm font-semibold text-ink/60 hover:bg-ink/5">
                  Not now
                </button>
                <button type="button" onClick={() => { completeTask(bannerTask.id); setAskingProof(false) }} className="rounded-full px-2 py-1 text-sm font-semibold text-ink/60 hover:bg-ink/5">
                  Skip photo
                </button>
                <Link to={`/proof/${bannerTask.id}`} className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-on-primary">Snap +15</Link>
              </span>
            ) : snoozingBanner ? (
              <span className="flex shrink-0 items-center">
                {SNOOZE_OPTIONS.map((o) => (
                  <button key={o.minutes} type="button" onClick={() => { snoozeTask(bannerTask.id, o.minutes); setSnoozingBanner(false) }} className="rounded-full px-2 py-1 text-sm font-semibold text-ink/60 hover:bg-ink/5">
                    {o.label}
                  </button>
                ))}
              </span>
            ) : (
              <span className="flex shrink-0 items-center">
                <button type="button" onClick={() => setSnoozingBanner(true)} className="rounded-full px-2 py-1 text-sm font-semibold text-ink/50 hover:bg-ink/5">
                  Snooze
                </button>
                <button type="button" onClick={() => (bannerTask.physical ? setAskingProof(true) : completeTask(bannerTask.id))} className="rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-ink/5">
                  Done
                </button>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {open.length > 0 && nudges.length === 0 && (
        <div className={`${card} flex items-center gap-3`}>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">See how I nudge</h2>
            <p className="text-xs text-ink/50">Hear the chime and my voice before the real thing.</p>
          </div>
          <button type="button" disabled={tryingNudge} onClick={tryNudge} className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">
            {tryingNudge ? 'Winding up…' : 'Try a nudge'}
          </button>
        </div>
      )}

      {open.length > 0 && (
        <div className={card}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Plan my day</h2>
              <p className="text-xs text-ink/50">Nudgy's agent sorts out overdue and clashing reminders, step by step.</p>
            </div>
            <button type="button" disabled={planning} onClick={planMyDay} className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">
              {planning ? 'Planning…' : 'Plan it'}
            </button>
          </div>
          {plan && (
            <div className="mt-3 border-t-[length:var(--bw)] border-line pt-3">
              <ol className="space-y-2">
                {plan.steps.map((s, i) => (
                  <li key={i} className="text-sm leading-snug">
                    <span className="font-medium">{i + 1}. {s.thought}</span>
                    <span className="block text-xs text-ink/50">{s.result}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm font-semibold">{plan.summary}</p>
            </div>
          )}
        </div>
      )}

      <BrainDump
        onActivity={noteActivity}
        onSubmit={handleDump}
        reminders={open}
        about={open.find((t) => t.id === aboutTaskId)}
        onPickAbout={setAboutTaskId}
        thinking={thinking}
        question={pendingQuestion ?? open.find((t) => t.ask)?.ask.text}
        onDismissQuestion={pendingQuestion ? () => setPendingQuestion(null) : undefined}
      />
      {(chat.length > 0 || lastChange) && (
        <div className="-mt-2 flex items-center justify-end gap-3">
          {lastChange && (
            <button type="button" onClick={undoLast} className="text-xs font-semibold text-primary hover:underline">
              ↶ Undo last change
            </button>
          )}
          {chat.length > 0 && (
            <Link to="/history" className="text-xs font-semibold text-ink/50 hover:text-primary">
              Our chat so far →
            </Link>
          )}
        </div>
      )}



      <div ref={listRef} className="flex scroll-mt-20 flex-col gap-4">
      {day ? (
        <DayView day={day} tasks={tasks} onClear={() => setDay(null)} />
      ) : (
        <>
        {open.length === 0 ? (
          <p className="py-6 text-center text-ink/50">All clear. Suspiciously productive.</p>
        ) : (
          groupTasks(open).map(([label, list]) => (
            <TaskGroup key={label} label={label} list={list} />
          ))
        )}

        {/* Done always sits last, under Someday, even when empty. */}
        <TaskGroup label="Done" list={done} collapsed />
        </>
      )}
      </div>
      </div>

      <aside className="sticky top-20 hidden flex-col gap-3 lg:flex"><RailContent {...rail} /></aside>
    </div>
  )
}
