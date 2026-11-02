// Making a nudge: ask the server for a model-written line, fall back to a canned one.
// When nudges are due: dated tasks at their due time, then further and further apart until Done or Snooze
// (the tone tops out at level 4); undated tasks once a day at check-in. Sleep hours and snoozes are respected.
import { canNudge, nextNudgeTime } from './schedule.js'
import { showModel } from '../components/ModelTag.jsx'

export const MAX_LEVEL = 4
// Ignored nudges come at doubling gaps: 10, 20, 40, 80 min. After a snooze, the gaps start at the snooze length.
const FIRST_GAP_MS = 10 * 60 * 1000
// Only the first few nudges per task are model-written; after that the stern canned lines rotate (no cost).
export const MODEL_NUDGES = 3
// How long a task can be snoozed for. Snoozing never costs coins.
export const SNOOZE_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '90 min', minutes: 90 },
]

const BACKUP_LINES = {
  1: (n, t) => `${n}, "${t}" is coming up. Future you says thanks in advance.`,
  2: (n, t) => `${n}, "${t}" is aging like milk. Shall we?`,
  3: (n, t) => `${n}, I've nudged you three times. I'm basically a woodpecker now. ${t}.`,
  4: (n, t) => `${n}. ${n.toUpperCase()}. "${t}" has filed a missing person report.`,
}
const SHOVES = [
  (n, t) => `${n}, "${t}". Now. I'm a woodpecker with a deadline.`,
  (n, t) => `Still waiting on "${t}", ${n}. My finger is getting tired.`,
  (n, t) => `${n}! "${t}"! Done or Snooze. Pick one. Or I'll be back in five minutes.`,
  (n, t) => `"${t}" is starting to feel left out, ${n}.`,
]

const localIso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

// count: how many nudges this task has had before this one.
export async function makeNudge(task, level, name, count = 0, buddy = 'Nudgy') {
  const who = name || 'Friend'
  let text
  if (count >= MODEL_NUDGES) {
    text = SHOVES[count % SHOVES.length](who, task.title)
    return { id: `p${Date.now()}`, taskId: task.id, level, text, at: new Date().toISOString() }
  }
  let via
  try {
    const r = await fetch('/api/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: who, buddy, title: task.title, level, due: task.due ? localIso(new Date(task.due)) : null, now: localIso(new Date()) }),
    })
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText)
    const json = await r.json()
    text = json.text
    via = json.via
    showModel(via)
  } catch (err) {
    console.warn('[nudge] using backup line:', err.message)
    text = BACKUP_LINES[level](who, task.title)
  }
  return { id: `p${Date.now()}`, taskId: task.id, level, text, via, at: new Date().toISOString() }
}

function at(date, hhmm) {
  const d = new Date(date)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

// For a dated task: when the clock started (due, or the end of a snooze), the first gap, and the nudges since.
function nudgeClock(t, mine) {
  const snoozed = t.snoozedUntil && new Date(t.snoozedUntil) > new Date(t.due)
  const start = new Date(snoozed ? t.snoozedUntil : t.due).getTime()
  const gap = snoozed && t.snoozeMinutes ? t.snoozeMinutes * 60000 : FIRST_GAP_MS
  return { start, gap, sent: mine.filter((p) => new Date(p.at).getTime() >= start).length }
}

// When this task's next nudge is due, for the countdown on its card. Sleep hours still push low-priority ones to wake-up.
export function nextNudgeAt(t, nudges, schedule, now = new Date()) {
  if (t.done) return null
  if (!t.due) return nextNudgeTime(t, schedule, now)
  const mine = nudges.filter((p) => p.taskId === t.id)
  const { start, gap, sent } = nudgeClock(t, mine)
  const when = sent ? new Date(mine[mine.length - 1].at).getTime() + gap * 2 ** (sent - 1) : start
  return nextNudgeTime({ ...t, due: new Date(when).toISOString() }, schedule, now)
}

// While the mic is on or Nudgy is thinking, nudges wait and go out at the next check once it's over.
let held = false
export const holdNudges = (on) => { held = on }
export const nudgesHeld = () => held

// Tasks that should be nudged right now, most urgent first.
export function dueNudges(tasks, nudges, schedule, now = new Date()) {
  return tasks
    .filter((t) => {
      if (t.done || !canNudge(t, now, schedule)) return false
      if (t.snoozedUntil && new Date(t.snoozedUntil) > now) return false
      const mine = nudges.filter((p) => p.taskId === t.id)
      const last = mine.length ? new Date(mine[mine.length - 1].at) : null
      if (t.due) {
        // The clock starts at the due time, or restarts when a snooze ends. Gaps double with each nudge since then.
        const { start, gap, sent } = nudgeClock(t, mine)
        // Measured from the last nudge, so reopening the app after a while can't fire a catch-up burst.
        return start <= now.getTime() && (!sent || now - last >= gap * 2 ** (sent - 1))
      }
      const checkIn = at(now, schedule.checkIn)
      return now >= checkIn && (!last || last < checkIn)
    })
    .sort((a, b) => new Date(a.due ?? Infinity) - new Date(b.due ?? Infinity))
}

// Shows a system notification when the tab isn't in view. Permission is asked for elsewhere, on a tap.
// Goes through the service worker when there is one (needed on Android, and taps open Nudgy).
export async function notify(text, { silent = false } = {}) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
    const options = { body: text, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'nudgy', renotify: true, requireInteraction: true, silent }
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) return reg.showNotification('Nudgy', options)
    const n = new Notification('Nudgy', options)
    n.onclick = () => { window.focus(); n.close() }
  } catch {}
}
