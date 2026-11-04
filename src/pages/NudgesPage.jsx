import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useStore } from '../lib/store.jsx'
import { MAX_LEVEL, makeNudge, mostUrgent } from '../lib/nudges.js'
import { ALARM_MS, playAlarm } from '../lib/alarm.js'
import NudgeBubble from '../components/NudgeBubble.jsx'
import { Button } from '../components/ui.jsx'
import { BellIcon } from '../components/Icons.jsx'

const canNotify = typeof Notification !== 'undefined'

// Browsers only let a page ask for notifications from a tap, so this is a button, not a popup on load.
function NotifyCard() {
  const [permission, setPermission] = useState(canNotify ? Notification.permission : 'unsupported')
  if (permission === 'granted' || permission === 'unsupported') return null
  return (
    <div className="flex items-center gap-3 rounded-2xl border-[length:var(--bw)] border-line bg-soft/60 px-4 py-3">
      <BellIcon size={18} className="shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm leading-snug">
        {permission === 'denied'
          ? "Notifications are blocked. Unblock them in your browser's site settings and I can nudge you from other tabs."
          : 'Let me nudge you even when you’re in another tab?'}
      </p>
      {permission === 'default' && (
        <button
          type="button"
          onClick={() => Notification.requestPermission().then((p) => { setPermission(p); if (p === 'granted') playAlarm() })}
          className="min-h-9 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary"
        >
          Allow
        </button>
      )}
    </div>
  )
}

export default function NudgesPage() {
  const { name, buddyName, tasks, nudges, setNudges, completeTask, snoozeTask, say } = useStore()
  const [nudging, setNudging] = useState(false)

  // Nudges the most important open task right now, with a model-written line.
  async function nudgeMeNow() {
    const task = mostUrgent(tasks)
    if (!task || nudging) return
    const level = Math.min(MAX_LEVEL, nudges.filter((p) => p.taskId === task.id).length + 1)
    setNudging(true)
    const nudge = await makeNudge(task, level, name, 0, buddyName)
    setNudges((ps) => [...ps, nudge])
    setNudging(false)
    // Heard like any other nudge: chime first, then the voice.
    const chimed = playAlarm()
    if (chimed) setTimeout(() => say(nudge.text), ALARM_MS)
    else say(nudge.text)
  }

  // Only the newest nudge for each task gets Done/Snooze, so repeats don't stack buttons.
  const latest = new Set(Object.values(Object.fromEntries(nudges.map((p) => [p.taskId, p.id]))))

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-tight">Nudges</h1>
          <p className="text-sm text-ink/50">Everything I've nudged you about.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={nudgeMeNow} disabled={nudging} className="shrink-0 px-3.5">
          <BellIcon size={15} /> {nudging ? 'Winding up…' : 'Nudge me'}
        </Button>
      </header>
      <NotifyCard />
      {nudges.length === 0 ? (
        <p className="py-8 text-center text-ink/50">No nudges. Enjoy the peace while it lasts.</p>
      ) : (
        <ul className="flex flex-col-reverse gap-2">
          <AnimatePresence initial={false}>
          {nudges.map((p) => {
            const task = tasks.find((t) => t.id === p.taskId)
            return (
              <li key={p.id}>
                <NudgeBubble
                  nudge={p}
                  task={task}
                  onDone={latest.has(p.id) ? () => completeTask(p.taskId) : undefined}
                  onSnooze={latest.has(p.id) ? (minutes) => snoozeTask(p.taskId, minutes) : undefined}
                />
              </li>
            )
          })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
