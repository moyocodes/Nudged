import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store.jsx'
import { MAX_LEVEL, dueNudges, makeNudge, notify, nudgesHeld } from '../lib/nudges.js'
import { ALARM_MS, playAlarm } from '../lib/alarm.js'

// While the app is open, checks once a minute for a nudge that's due and sends at most one per check,
// so a pile of overdue tasks can't fire a burst of model calls. Renders nothing.
export default function NudgeScheduler() {
  const { name, tasks, nudges, setNudges, schedule, say, alarmOn, muted, buddyName } = useStore()
  const latest = useRef({ name, tasks, nudges, schedule, alarmOn, muted, buddyName })
  latest.current = { name, tasks, nudges, schedule, alarmOn, muted, buddyName }
  const busy = useRef(false)

  useEffect(() => {
    async function tick() {
      if (busy.current || nudgesHeld()) return
      const { name, tasks, nudges, schedule, buddyName } = latest.current
      const task = dueNudges(tasks, nudges, schedule)[0]
      if (!task) return
      busy.current = true
      try {
        const count = nudges.filter((p) => p.taskId === task.id).length
        const level = Math.min(MAX_LEVEL, count + 1)
        const nudge = await makeNudge(task, level, name, count, buddyName)
        // Something may have started while the line was being written. It waits for the next check.
        if (nudgesHeld()) return
        setNudges((ps) => [...ps, nudge])
        // Said out loud in the app (Done/Snooze sit on the Today banner and Nudges page), and as a
        // system notification if the tab is in the background.
        // Chime first, then the voice once it has finished, so one doesn't drown out the other.
        // The chime always plays, muted or not.
        const chimed = playAlarm()
        notify(nudge.text)
        if (chimed) setTimeout(() => say(nudge.text), ALARM_MS)
        else say(nudge.text)
      } finally {
        busy.current = false
      }
    }
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
