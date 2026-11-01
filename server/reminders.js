// Email reminders for people who aren't looking at the app. Every few minutes: tasks past due that weren't ticked or snoozed
// go out in one email per account when due or when a snooze ends, then 10, 20, 40, 80... minutes apart, for up to a day. The copy is fixed, so this never calls the model.
// A free Render service sleeps and stops the timer, so an outside cron can wake it through /api/cron/reminders.
import { store } from './db.js'

const CHECK_EVERY_MS = 5 * 60 * 1000
const FIRST_GAP_MIN = 10 // then 20, 40, 80... between emails
const TOO_OLD_MS = 24 * 60 * 60 * 1000 // stop nagging about long-gone tasks

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// The clock starts when the task is due, or restarts when its snooze ends.
const startOf = (task) => Math.max(new Date(task.due).getTime(), task.snoozedUntil ? new Date(task.snoozedUntil).getTime() : 0)
// Rounds fall at 0, 10, 30, 70, 150... minutes. One key per round, so each goes out once.
const reminderKey = (task, now) => {
  const round = Math.floor(Math.log2((now - startOf(task)) / 60000 / FIRST_GAP_MIN + 1))
  return `${task.id}|${startOf(task)}|${round}`
}

export function tasksToEmail(tasks, emailed, now = Date.now()) {
  return (tasks ?? []).filter((t) => {
    if (t.done || !t.due) return false
    const age = now - startOf(t)
    return age >= 0 && age <= TOO_OLD_MS && !emailed.has(reminderKey(t, now))
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

async function sendReminder(to, tasks) {
  const url = process.env.APP_URL || 'https://getnudged.chat'
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Nudgy <onboarding@resend.dev>',
      to,
      subject: tasks.length === 1 ? `Psst: ${tasks[0].title}` : `Psst: ${tasks.length} things are waiting`,
      html: reminderHtml(url, tasks),
      text: `Knock knock, it's Nudgy. You didn't think I'd let this slide, did you?\n\n${tasks.map((t) => `- ${t.title}`).join('\n')}\n\nOpen Nudgy: ${url}`,
    }),
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
}

let running = false
export async function runReminders({ db = store, send = sendReminder, now = Date.now() } = {}) {
  if (running) return 0
  running = true
  let sent = 0
  try {
    for (const { email, state } of await db.allStates()) {
      try {
        const tasks = tasksToEmail(state?.tasks, await db.emailedReminders(email), now)
        if (!tasks.length) continue
        await send(email, tasks)
        await db.markRemindersEmailed(email, tasks.map((t) => reminderKey(t, now)))
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
