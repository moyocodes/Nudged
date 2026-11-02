// Email reminders for people who aren't looking at the app. Every minute: a task not ticked or snoozed goes out when due or
// when a snooze ends, then 30, 60, 120 and 240 minutes apart, and that's the last. Nothing during their sleep hours; on waking,
// one morning email lists everything for that day plus whatever is still undone. The copy is fixed, so this never calls the model.
// A free Render service sleeps and stops the timer, so an outside cron can wake it through /api/cron/reminders.
import { store } from './db.js'

const CHECK_EVERY_MS = 60 * 1000
const ROUNDS_MIN = [0, 30, 90, 210, 450] // minutes after the start: gaps of 30, 60, 120, 240
const TOO_OLD_MS = 24 * 60 * 60 * 1000 // stop nagging about long-gone tasks
const WAKE_WINDOW_MIN = 60

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// The clock starts when the task is due, or restarts when its snooze ends.
const startOf = (task) => Math.max(new Date(task.due).getTime(), task.snoozedUntil ? new Date(task.snoozedUntil).getTime() : 0)
// The latest round that has come round. One key per round, so each goes out once.
const roundKey = (task, now) => {
  const round = ROUNDS_MIN.findLastIndex((m) => now - startOf(task) >= m * 60000)
  return `${task.id}|${startOf(task)}|${round}`
}

const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}

// Where this person's night stands, from the sleep hours and timezone their app saved. Unknown timezone: no quiet hours.
// morning is their date during the first hour after waking, so the wake-up email goes out once a day.
export function nightFor(schedule, timeZone, now) {
  if (!timeZone) return { asleep: false, morning: null }
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]))
    const nowMin = Number(parts.hour) * 60 + Number(parts.minute)
    const start = minutesOf(schedule?.sleepStart ?? '00:00')
    const end = minutesOf(schedule?.sleepEnd ?? '07:00')
    const asleep = start < end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end
    const sinceWaking = (nowMin - end + 1440) % 1440
    return { asleep, morning: !asleep && sinceWaking < WAKE_WINDOW_MIN ? `${parts.year}-${parts.month}-${parts.day}` : null }
  } catch {
    return { asleep: false, morning: null }
  }
}

const localDate = (time, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time)

// Reminders whose current round hasn't gone out.
export function tasksToEmail(tasks, emailed, now = Date.now()) {
  return (tasks ?? []).filter((t) => {
    if (t.done || !t.due) return false
    const age = now - startOf(t)
    return age >= 0 && age <= TOO_OLD_MS && !emailed.has(roundKey(t, now))
  })
}

// The morning list: due today, or still undone from the last day. Snoozed ones wait for their snooze.
export function tasksForMorning(tasks, timeZone, now = Date.now()) {
  return (tasks ?? []).filter((t) => {
    if (t.done || !t.due) return false
    const age = now - startOf(t)
    return age >= 0 ? age <= TOO_OLD_MS : !(t.snoozedUntil && new Date(t.snoozedUntil) > now) && localDate(new Date(t.due), timeZone) === localDate(now, timeZone)
  })
}

export const reminderHtml = (url, tasks) => `<!doctype html><html><body style="margin:0;background:#faf6f0;padding:32px 16px;font-family:Geist,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1726">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #ece6dc">
<tr><td style="padding:32px 32px 8px"><a href="${url}"><img src="${url}/icon-192.png" width="56" height="56" alt="Nudgy" style="display:block;border-radius:14px;border:0"></a></td></tr>
<tr><td style="padding:8px 32px 0"><h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.02em">Knock knock, it's Nudgy 👋</h1></td></tr>
<tr><td style="padding:16px 32px 0;font-size:16px;line-height:1.6">You didn't think I'd let ${tasks.length === 1 ? 'this one' : 'these'} slide, did you?<ul style="margin:12px 0 0;padding-left:20px">${tasks.map((t) => `<li style="font-weight:600">${escapeHtml(t.title)}</li>`).join('')}</ul></td></tr>
<tr><td style="padding:24px 32px 32px"><a href="${url}" style="display:inline-block;background:#5b4be8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:999px">Open Nudgy</a></td></tr>
</table></td></tr></table></body></html>`

async function sendReminder(to, tasks, { morning = false, timeZone } = {}) {
  const url = process.env.APP_URL || 'https://getnudged.chat'
  const listed = morning ? tasks.map((t) => ({ title: [t.title, dueText(t, timeZone)].filter(Boolean).join(' · ') })) : tasks
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Nudgy <onboarding@resend.dev>',
      to,
      subject: morning ? 'Morning! Your reminders for today' : tasks.length === 1 ? `Psst: ${tasks[0].title}` : `Psst: ${tasks.length} things are waiting`,
      html: reminderHtml(url, listed),
      text: `Knock knock, it's Nudgy. You didn't think I'd let this slide, did you?\n\n${listed.map((t) => `- ${t.title}`).join('\n')}\n\nOpen Nudgy: ${url}`,
    }),
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
}

const dueText = (task, timeZone) => {
  if (!task.due) return ''
  try {
    return new Date(task.due).toLocaleString('en-GB', { timeZone: timeZone || 'UTC', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return ''
  }
}

// Logging in on a new device: says so, and lists everything still open. Never blocks the login.
export async function sendLoginEmail(to, deviceName) {
  if (!process.env.RESEND_API_KEY) return
  try {
    const url = process.env.APP_URL || 'https://getnudged.chat'
    const { state } = (await store.getState(to)) ?? {}
    const open = (state?.tasks ?? []).filter((t) => !t.done)
    const line = (t) => [t.title, dueText(t, state?.timeZone)].filter(Boolean).join(' · ')
    const list = open.length
      ? `Here's what's still on your list:<ul style="margin:12px 0 0;padding-left:20px">${open.map((t) => `<li style="font-weight:600">${escapeHtml(line(t))}</li>`).join('')}</ul>`
      : "Your list is empty. Suspiciously tidy."
    const html = reminderHtml(url, []).replace(/<h1[\s\S]*?<\/h1>/, '<h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.02em">New login, same you? 👀</h1>').replace(/<tr><td style="padding:16px 32px 0[\s\S]*?<\/td><\/tr>/, () => `<tr><td style="padding:16px 32px 0;font-size:16px;line-height:1.6">You just logged in on ${escapeHtml(deviceName)}.<br><br>${list}<br><br><span style="font-size:13px;opacity:.6">Not you? Open Nudgy and check your account.</span></td></tr>`)
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Nudgy <onboarding@resend.dev>',
        to,
        subject: 'New Nudgy login, and your list',
        html,
        text: `You just logged in on ${deviceName}.\n\n${open.length ? `Still on your list:\n${open.map((t) => `- ${line(t)}`).join('\n')}` : 'Your list is empty.'}\n\nOpen Nudgy: ${url}`,
      }),
    })
    if (!r.ok) console.error('[auth] login email failed:', r.status, await r.text())
  } catch (err) {
    console.error('[auth] login email failed:', err.message)
  }
}

// Seeing a reminder through to the end gets a little well-done note. Never blocks anything.
export async function sendDoneEmail(to, title) {
  if (!process.env.RESEND_API_KEY) return
  try {
    const url = process.env.APP_URL || 'https://getnudged.chat'
    const html = reminderHtml(url, []).replace(/<h1[\s\S]*?<\/h1>/, '<h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.02em">Done and dusted! 🎉</h1>').replace(/<tr><td style="padding:16px 32px 0[\s\S]*?<\/td><\/tr>/, () => `<tr><td style="padding:16px 32px 0;font-size:16px;line-height:1.6">You saw <strong>${escapeHtml(title)}</strong> through to the end. That one's off my list for now. My finger needed the rest.</td></tr>`)
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Nudgy <onboarding@resend.dev>',
        to,
        subject: `Done: ${title}`,
        html,
        text: `Done and dusted! You saw "${title}" through to the end. That one's off my list for now.\n\nOpen Nudgy: ${url}`,
      }),
    })
    if (!r.ok) console.error('[reminders] done email failed:', r.status, await r.text())
  } catch (err) {
    console.error('[reminders] done email failed:', err.message)
  }
}

let running = false
export async function runReminders({ db = store, send = sendReminder, now = Date.now() } = {}) {
  if (running) return 0
  running = true
  let sent = 0
  try {
    for (const { email, state } of await db.allStates()) {
      try {
        const { asleep, morning } = nightFor(state?.schedule, state?.timeZone, now)
        if (asleep) continue
        const emailed = await db.emailedReminders(email)
        const morningKey = `morning|${morning}`
        const isMorning = !!morning && !emailed.has(morningKey)
        const due = tasksToEmail(state?.tasks, emailed, now)
        const list = isMorning ? tasksForMorning(state?.tasks, state?.timeZone, now) : due
        // Claim first, so a second server or a failed save can't send it twice. A failed send gives the claim back.
        const keys = [...due.map((t) => roundKey(t, now)), ...(isMorning ? [morningKey] : [])]
        const won = keys.length ? await db.claimReminders(email, keys) : []
        const shouldSend = isMorning ? won.includes(morningKey) && list.length : due.some((t) => won.includes(roundKey(t, now)))
        if (!shouldSend) continue
        const tasks = isMorning ? list : due.filter((t) => won.includes(roundKey(t, now)))
        try {
          await send(email, tasks, { morning: isMorning, timeZone: state?.timeZone })
        } catch (err) {
          await db.releaseReminders(email, won)
          throw err
        }
        sent++
      } catch (err) {
        console.error('[reminders] failed for one account:', err.message) // tried again next check
      }
    }
  } finally {
    running = false
  }
  return sent
}

export function mountReminders(app) {
  app.post('/api/cron/reminders', async (req, res) => {
    const secret = process.env.CRON_SECRET
    if (!secret || req.get('authorization') !== `Bearer ${secret}`) return res.status(404).end()
    if (!process.env.RESEND_API_KEY) return res.json({ sent: 0 })
    try {
      res.json({ sent: await runReminders() })
    } catch (err) {
      console.error('[reminders]', err.message)
      res.status(500).json({ error: 'Reminder check failed' })
    }
  })
  // Only the deployed server emails on a timer, so a local run pointed at the same database stays quiet.
  if (process.env.RENDER && process.env.RESEND_API_KEY) {
    setInterval(() => runReminders().catch((err) => console.error('[reminders]', err.message)), CHECK_EVERY_MS)
  }
}
