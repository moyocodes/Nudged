export function friendlyDue(iso) {
  if (!iso) return 'No date set'
  const d = new Date(iso)
  const now = new Date()
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diff = Math.round((day(d) - day(now)) / 86400000)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (d < now) return `Overdue · ${diff === 0 ? time : `${-diff}d ago`}`
  if (diff === 0) return `Today, ${time}`
  if (diff === 1) return `Tomorrow, ${time}`
  // Weekday plus date ('Wed, Nov 4'), so a wrong day can be spotted and 'Wednesday' can't mean two different weeks.
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`
}

// What actually got saved, in words. Built from the real tasks so Nudged never claims a reminder it didn't set.
export function savedSummary(tasks) {
  if (!tasks.length) return ''
  const one = (t) => `"${t.title}" ${t.due ? friendlyDue(t.due).toLowerCase() : '(no time yet)'}`
  if (tasks.length === 1) return `Set: ${one(tasks[0])}.`
  if (tasks.length <= 3) return `Set ${tasks.length}: ${tasks.map(one).join('; ')}.`
  return `Set ${tasks.length} reminders. They're on your list.`
}

// "3h 2m", "45m", "2d 4h": how long until something is due.
export function countdown(ms) {
  const mins = Math.max(1, Math.round(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d) return h ? `${d}d ${h}h` : `${d}d`
  if (h) return m ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

// The soonest open task that's still in the future.
export function nextDue(tasks, now = Date.now()) {
  return tasks
    .filter((t) => !t.done && t.due && new Date(t.due) > now)
    .sort((a, b) => new Date(a.due) - new Date(b.due))[0]
}

// Not due yet: finishing or binning it now earns a "sure?" from Nudged.
export function isEarly(task) {
  return !task.done && task.due && new Date(task.due) > new Date()
}

export function isOverdue(task) {
  return !task.done && task.due && new Date(task.due) < new Date()
}
