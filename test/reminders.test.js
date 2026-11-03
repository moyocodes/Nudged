// Email reminders, over the real JSON file store. Nothing is emailed: the sender is passed in and only records.
import { beforeEach, describe, expect, it } from 'vitest'
import { nightFor, reminderHtml, runReminders, tasksForMorning, tasksToEmail } from '../server/reminders.js'
import { store } from '../server/db.js'

const HOUR = 3600000
const MIN = 60000
const NOW = Date.UTC(2026, 5, 10, 12)
const ago = (ms) => new Date(NOW - ms).toISOString()

describe('nightFor', () => {
  const schedule = { sleepStart: '23:00', sleepEnd: '07:00' }
  const utc = (h, m = 0) => Date.UTC(2026, 5, 10, h, m)

  it('reads the hours in their own timezone', () => {
    // Lagos is UTC+1: 22:30 UTC is already 23:30 there.
    expect(nightFor(schedule, 'Africa/Lagos', utc(22, 30)).asleep).toBe(true)
    expect(nightFor(schedule, 'UTC', utc(22, 30)).asleep).toBe(false)
  })

  it('marks the first hour after waking as morning, with their date', () => {
    expect(nightFor(schedule, 'UTC', utc(7, 30))).toEqual({ asleep: false, morning: '2026-06-10' })
    expect(nightFor(schedule, 'UTC', utc(8))).toEqual({ asleep: false, morning: null })
    expect(nightFor(schedule, 'UTC', utc(6, 59))).toEqual({ asleep: true, morning: null })
  })

  it('treats an unknown or broken timezone as no quiet hours', () => {
    expect(nightFor(schedule, undefined, utc(3))).toEqual({ asleep: false, morning: null })
    expect(nightFor(schedule, 'Not/AZone', utc(3))).toEqual({ asleep: false, morning: null })
  })

  it('falls back to default sleep hours', () => {
    expect(nightFor(undefined, 'UTC', utc(3)).asleep).toBe(true)
  })
})

describe('tasksToEmail', () => {
  const task = (extra) => ({ id: 't', due: ago(0), ...extra })

  it('picks tasks that are due and leaves the rest', () => {
    expect(tasksToEmail([task()], new Set(), NOW)).toHaveLength(1)
    expect(tasksToEmail([task({ due: new Date(NOW + MIN).toISOString() })], new Set(), NOW)).toEqual([])
    expect(tasksToEmail([task({ done: true })], new Set(), NOW)).toEqual([])
    expect(tasksToEmail([{ id: 't' }], new Set(), NOW)).toEqual([])
    expect(tasksToEmail(undefined, new Set(), NOW)).toEqual([])
  })

  it('stops nagging after a day', () => {
    expect(tasksToEmail([task({ due: ago(24 * HOUR) })], new Set(), NOW)).toHaveLength(1)
    expect(tasksToEmail([task({ due: ago(24 * HOUR + 1) })], new Set(), NOW)).toEqual([])
  })

  it('waits out a snooze', () => {
    expect(tasksToEmail([task({ due: ago(HOUR), snoozedUntil: new Date(NOW + MIN).toISOString() })], new Set(), NOW)).toEqual([])
  })

  it('sends each round once, and the next round after 30 minutes', () => {
    const t = task({ due: ago(0) })
    const emailed = new Set([`t|${NOW}|0`])
    expect(tasksToEmail([t], emailed, NOW)).toEqual([])
    expect(tasksToEmail([t], emailed, NOW + 29 * MIN)).toEqual([])
    expect(tasksToEmail([t], emailed, NOW + 30 * MIN)).toHaveLength(1)
  })
})

describe('tasksForMorning', () => {
  it('lists what is due today and what is still undone', () => {
    const tasks = [
      { id: 'later today', due: new Date(NOW + HOUR).toISOString() },
      { id: 'yesterday', due: ago(5 * HOUR) },
      { id: 'tomorrow', due: new Date(NOW + 24 * HOUR).toISOString() },
      { id: 'long gone', due: ago(48 * HOUR) },
      { id: 'finished', due: ago(HOUR), done: true },
      { id: 'snoozed', due: new Date(NOW + HOUR).toISOString(), snoozedUntil: new Date(NOW + 2 * HOUR).toISOString() },
      { id: 'undated' },
    ]
    expect(tasksForMorning(tasks, 'UTC', NOW).map((t) => t.id)).toEqual(['later today', 'yesterday'])
  })
})

describe('reminderHtml', () => {
  it('escapes task titles', () => {
    const html = reminderHtml('https://x.test', [{ title: '<img src=x onerror=alert(1)> & "more"' }])
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;more&quot;')
  })
})

describe('runReminders', () => {
  const timeZone = 'UTC'
  const schedule = { sleepStart: '23:00', sleepEnd: '07:00' }
  let email
  let count = 0
  // Only this test's account, so runs don't see each other.
  const db = {
    ...store,
    allStates: async () => [{ email, state: await store.getState(email).then((s) => s.state) }],
  }
  const sender = () => {
    const sent = []
    const send = async (to, tasks, options) => { sent.push({ to, tasks, options }) }
    return { sent, send }
  }

  beforeEach(() => { email = `reminders-${count++}-${Date.now()}@example.com` })

  it('emails a due task once, across checks', async () => {
    await store.putState(email, { schedule, timeZone, tasks: [{ id: 't', title: 'Rent', due: ago(MIN) }] })
    const { sent, send } = sender()
    expect(await runReminders({ db, send, now: NOW })).toBe(1)
    expect(await runReminders({ db, send, now: NOW + MIN })).toBe(0)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(email)
    expect(sent[0].tasks.map((t) => t.title)).toEqual(['Rent'])
  })

  it('emails the next round when it comes round', async () => {
    await store.putState(email, { schedule, timeZone, tasks: [{ id: 't', title: 'Rent', due: ago(MIN) }] })
    const { sent, send } = sender()
    await runReminders({ db, send, now: NOW })
    await runReminders({ db, send, now: NOW + 30 * MIN })
    expect(sent).toHaveLength(2)
  })

  it('stays quiet during sleep hours', async () => {
    await store.putState(email, { schedule, timeZone, tasks: [{ id: 't', title: 'Rent', due: new Date(Date.UTC(2026, 5, 10, 2)).toISOString() }] })
    const { sent, send } = sender()
    await runReminders({ db, send, now: Date.UTC(2026, 5, 10, 3) })
    expect(sent).toEqual([])
  })

  it('sends one morning list a day', async () => {
    const wake = Date.UTC(2026, 5, 10, 7, 10)
    await store.putState(email, { schedule, timeZone, tasks: [{ id: 't', title: 'Rent', due: new Date(Date.UTC(2026, 5, 10, 15)).toISOString() }] })
    const { sent, send } = sender()
    await runReminders({ db, send, now: wake })
    await runReminders({ db, send, now: wake + MIN })
    expect(sent).toHaveLength(1)
    expect(sent[0].options.morning).toBe(true)
  })

  it('tries again next check when the send fails', async () => {
    await store.putState(email, { schedule, timeZone, tasks: [{ id: 't', title: 'Rent', due: ago(MIN) }] })
    const failed = await runReminders({ db, send: async () => { throw new Error('email down') }, now: NOW })
    expect(failed).toBe(0)
    const { sent, send } = sender()
    await runReminders({ db, send, now: NOW + MIN })
    expect(sent).toHaveLength(1)
  })
})
