import { afterEach, describe, expect, it, vi } from 'vitest'
import { MODEL_NUDGES, dueNudges, nextNudgeAt, holdNudges, nudgesHeld, mostUrgent, makeNudge, notify } from '../src/lib/nudges.js'

const schedule = { sleepStart: '23:00', sleepEnd: '07:00', checkIn: '10:00' }
const at = (h, m = 0, day = 10) => new Date(2026, 5, day, h, m)
const iso = (...a) => at(...a).toISOString()
const task = (extra) => ({ id: 't1', title: 'Pay rent', priority: 'medium', ...extra })
const sent = (...times) => times.map((when) => ({ taskId: 't1', at: when }))
const ids = (list) => list.map((t) => t.id)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('dueNudges for a dated task', () => {
  it('waits for the due time', () => {
    const t = task({ due: iso(12) })
    expect(dueNudges([t], [], schedule, at(11, 59))).toEqual([])
    expect(dueNudges([t], [], schedule, at(12))).toEqual([t])
  })

  it('doubles the gap between ignored nudges: 10, 20, 40 minutes', () => {
    const t = task({ due: iso(12) })
    expect(dueNudges([t], sent(iso(12)), schedule, at(12, 9))).toEqual([])
    expect(dueNudges([t], sent(iso(12)), schedule, at(12, 10))).toEqual([t])
    expect(dueNudges([t], sent(iso(12), iso(12, 10)), schedule, at(12, 29))).toEqual([])
    expect(dueNudges([t], sent(iso(12), iso(12, 10)), schedule, at(12, 30))).toEqual([t])
    expect(dueNudges([t], sent(iso(12), iso(12, 10), iso(12, 30)), schedule, at(13, 9))).toEqual([])
    expect(dueNudges([t], sent(iso(12), iso(12, 10), iso(12, 30)), schedule, at(13, 10))).toEqual([t])
  })

  it('stays quiet during a snooze, then restarts with gaps of the snooze length', () => {
    const t = task({ due: iso(12), snoozedUntil: iso(13), snoozeMinutes: 30 })
    const before = sent(iso(12))
    expect(dueNudges([t], before, schedule, at(12, 59))).toEqual([])
    expect(dueNudges([t], before, schedule, at(13))).toEqual([t])
    const after = sent(iso(12), iso(13))
    expect(dueNudges([t], after, schedule, at(13, 29))).toEqual([])
    expect(dueNudges([t], after, schedule, at(13, 30))).toEqual([t])
  })

  it('skips finished tasks', () => {
    expect(dueNudges([task({ due: iso(12), done: true })], [], schedule, at(13))).toEqual([])
  })

  it('holds low and medium priority until morning, but not high', () => {
    const late = iso(23, 30)
    expect(dueNudges([task({ due: late, priority: 'low' })], [], schedule, at(23, 45))).toEqual([])
    expect(dueNudges([task({ due: late, priority: 'medium' })], [], schedule, at(23, 45))).toEqual([])
    expect(ids(dueNudges([task({ due: late, priority: 'high' })], [], schedule, at(23, 45)))).toEqual(['t1'])
  })

  it('only counts nudges for the same task', () => {
    const t = task({ due: iso(12) })
    expect(dueNudges([t], [{ taskId: 'other', at: iso(12, 59) }], schedule, at(13))).toEqual([t])
  })
})

describe('dueNudges for an undated task', () => {
  it('nudges once a day, from check-in', () => {
    const t = task()
    expect(dueNudges([t], [], schedule, at(9, 59))).toEqual([])
    expect(dueNudges([t], [], schedule, at(10))).toEqual([t])
    expect(dueNudges([t], sent(iso(10, 1)), schedule, at(18))).toEqual([])
    expect(dueNudges([t], sent(iso(10, 1)), schedule, at(10, 0, 11))).toEqual([t])
  })
})

describe('mostUrgent', () => {
  it('picks overdue over important', () => {
    const list = [task({ id: 'later', priority: 'high', due: iso(15) }), task({ id: 'late', priority: 'low', due: iso(9) })]
    expect(mostUrgent(list, at(12)).id).toBe('late')
  })

  it('then the most important, skipping finished ones', () => {
    const list = [task({ id: 'done', priority: 'high', due: iso(9), done: true }), task({ id: 'low', priority: 'low', due: iso(15) }), task({ id: 'high', priority: 'high', due: iso(16) })]
    expect(mostUrgent(list, at(12)).id).toBe('high')
  })
})

describe('holding nudges', () => {
  it('stays held until every reason has ended', () => {
    holdNudges('plan', true)
    holdNudges('talking', true)
    holdNudges('plan', false)
    expect(nudgesHeld()).toBe(true)
    holdNudges('talking', false)
    expect(nudgesHeld()).toBe(false)
  })

  it('does not nudge a task Nudged is already asking about', () => {
    const asking = task({ ask: { text: 'When should I nudge you?' } })
    expect(dueNudges([asking], [], schedule, at(11))).toEqual([])
    expect(ids(dueNudges([task()], [], schedule, at(11)))).toEqual(['t1'])
  })
})

describe('dueNudges order', () => {
  it('puts the longest overdue first', () => {
    const list = [task({ id: 'later', due: iso(11) }), task({ id: 'sooner', due: iso(9) })]
    expect(ids(dueNudges(list, [], schedule, at(12)))).toEqual(['sooner', 'later'])
  })

  it('puts dated tasks in order ahead of undated ones', () => {
    const list = [task({ id: 'later', due: iso(11) }), task({ id: 'undated' }), task({ id: 'sooner', due: iso(9) })]
    expect(ids(dueNudges(list, [], schedule, at(12)))).toEqual(['sooner', 'later', 'undated'])
  })
})

describe('nextNudgeAt', () => {
  it('is the due time before any nudge, then the last nudge plus the gap', () => {
    const t = task({ due: iso(15) })
    expect(nextNudgeAt(t, [], schedule, at(12))).toEqual(at(15))
    expect(nextNudgeAt(task({ due: iso(12) }), sent(iso(12)), schedule, at(12, 1))).toEqual(at(12, 10))
    expect(nextNudgeAt(task({ due: iso(12) }), sent(iso(12), iso(12, 10)), schedule, at(12, 11))).toEqual(at(12, 30))
  })

  it('is the next check-in for undated tasks and nothing for finished ones', () => {
    expect(nextNudgeAt(task(), [], schedule, at(9))).toEqual(at(10))
    expect(nextNudgeAt(task({ done: true }), [], schedule, at(9))).toBeNull()
  })
})

describe('dueNudges snooze edges', () => {
  it('falls back to 10-minute gaps when a snooze has no length', () => {
    const t = task({ due: iso(12), snoozedUntil: iso(13) })
    const after = sent(iso(12), iso(13))
    expect(dueNudges([t], after, schedule, at(13, 9))).toEqual([])
    expect(dueNudges([t], after, schedule, at(13, 10))).toEqual([t])
  })

  it('ignores a stale snooze from before the due time', () => {
    const t = task({ due: iso(12), snoozedUntil: iso(11) })
    expect(dueNudges([t], [], schedule, at(11, 30))).toEqual([])
    expect(dueNudges([t], [], schedule, at(12))).toEqual([t])
  })

  it('still restarts the clock at the end of an expired snooze', () => {
    const t = task({ due: iso(12), snoozedUntil: iso(12, 30), snoozeMinutes: 30 })
    expect(dueNudges([t], [], schedule, at(13))).toEqual([t])
    expect(dueNudges([t], sent(iso(12, 30)), schedule, at(12, 59))).toEqual([])
  })

  it('doubles the gaps after a snooze too: 30, then 60 minutes', () => {
    const t = task({ due: iso(12), snoozedUntil: iso(13), snoozeMinutes: 30 })
    const after = sent(iso(12), iso(13), iso(13, 30))
    expect(dueNudges([t], after, schedule, at(14, 29))).toEqual([])
    expect(dueNudges([t], after, schedule, at(14, 30))).toEqual([t])
  })

  it('keeps a snoozed undated task quiet until the snooze ends', () => {
    const t = task({ snoozedUntil: iso(13) })
    expect(dueNudges([t], [], schedule, at(11))).toEqual([])
    expect(dueNudges([t], [], schedule, at(13))).toEqual([t])
  })
})

describe('dueNudges gap edges', () => {
  it('waits 80 minutes after the fourth ignored nudge', () => {
    const t = task({ due: iso(12) })
    const four = sent(iso(12), iso(12, 10), iso(12, 30), iso(13, 10))
    expect(dueNudges([t], four, schedule, at(14, 29))).toEqual([])
    expect(dueNudges([t], four, schedule, at(14, 30))).toEqual([t])
  })

  it('measures from the last nudge, so reopening the app cannot fire a catch-up burst', () => {
    const t = task({ due: iso(9) })
    expect(dueNudges([t], sent(iso(12)), schedule, at(12, 5))).toEqual([])
    expect(dueNudges([t], sent(iso(12)), schedule, at(12, 10))).toEqual([t])
  })

  it('ignores nudges sent before the clock starts', () => {
    const t = task({ due: iso(12) })
    expect(dueNudges([t], sent(iso(11, 30)), schedule, at(12))).toEqual([t])
  })

  it('still nudges a dated task Nudged is asking about', () => {
    const t = task({ due: iso(12), ask: { text: 'When should I nudge you?' } })
    expect(dueNudges([t], [], schedule, at(13))).toEqual([t])
  })
})

describe('dueNudges undated edges', () => {
  it('holds undated tasks overnight unless they are high priority', () => {
    expect(dueNudges([task({ priority: 'low' })], [], schedule, at(23, 45))).toEqual([])
    expect(ids(dueNudges([task({ priority: 'high' })], [], schedule, at(23, 45)))).toEqual(['t1'])
  })

  it('counts a nudge sent exactly at check-in as todays nudge', () => {
    const t = task()
    expect(dueNudges([t], sent(iso(10)), schedule, at(18))).toEqual([])
  })

  it('still nudges when the only nudge was before check-in', () => {
    const t = task()
    expect(dueNudges([t], sent(iso(9)), schedule, at(11))).toEqual([t])
  })
})

describe('mostUrgent edges', () => {
  it('returns nothing when there is nothing to nudge', () => {
    expect(mostUrgent([], at(12))).toBeUndefined()
    expect(mostUrgent([task({ done: true })], at(12))).toBeUndefined()
  })

  it('picks the soonest due among equals, dated before undated', () => {
    const list = [task({ id: 'later', priority: 'medium', due: iso(15) }), task({ id: 'sooner', priority: 'medium', due: iso(14) })]
    expect(mostUrgent(list, at(12)).id).toBe('sooner')
    const mixed = [task({ id: 'undated', priority: 'medium' }), task({ id: 'dated', priority: 'medium', due: iso(15) })]
    expect(mostUrgent(mixed, at(12)).id).toBe('dated')
  })

  it('treats a missing priority as medium', () => {
    const low = task({ id: 'low', priority: 'low', due: iso(15) })
    const none = task({ id: 'none', priority: undefined, due: iso(15) })
    const high = task({ id: 'high', priority: 'high', due: iso(15) })
    expect(mostUrgent([low, none], at(12)).id).toBe('none')
    expect(mostUrgent([none, high], at(12)).id).toBe('high')
  })

  it('only counts strictly past due as overdue', () => {
    const list = [task({ id: 'due-now', priority: 'low', due: iso(12) }), task({ id: 'high-later', priority: 'high', due: iso(15) })]
    expect(mostUrgent(list, at(12)).id).toBe('high-later')
    expect(mostUrgent(list, at(12, 1)).id).toBe('due-now')
  })
})

describe('nextNudgeAt edges', () => {
  it('is nothing for finished dated tasks', () => {
    expect(nextNudgeAt(task({ due: iso(12), done: true }), [], schedule, at(9))).toBeNull()
  })

  it('pushes a dated nudge in sleep hours to wake-up, unless high priority', () => {
    expect(nextNudgeAt(task({ due: iso(23, 30), priority: 'low' }), [], schedule, at(12))).toEqual(at(7, 0, 11))
    expect(nextNudgeAt(task({ due: iso(23, 30), priority: 'high' }), [], schedule, at(12))).toEqual(at(23, 30))
  })

  it('counts down from the end of a snooze, ignoring earlier nudges', () => {
    const t = task({ due: iso(12), snoozedUntil: iso(13), snoozeMinutes: 30 })
    expect(nextNudgeAt(t, sent(iso(12)), schedule, at(12, 30))).toEqual(at(13))
    expect(nextNudgeAt(t, sent(iso(12), iso(13)), schedule, at(13, 1))).toEqual(at(13, 30))
  })

  it('is now when a task is already overdue with no nudge yet', () => {
    expect(nextNudgeAt(task({ due: iso(12) }), [], schedule, at(13))).toEqual(at(13))
  })

  it('is the next morning check-in for undated tasks asked in the afternoon', () => {
    expect(nextNudgeAt(task(), [], schedule, at(11))).toEqual(at(10, 0, 11))
  })
})

describe('holding nudges edges', () => {
  it('clears a doubled hold with a single remove', () => {
    holdNudges('dup', true)
    holdNudges('dup', true)
    holdNudges('dup', false)
    expect(nudgesHeld()).toBe(false)
  })

  it('ignores removing a reason that was never held', () => {
    holdNudges('plan', true)
    try {
      holdNudges('ghost', false)
      expect(nudgesHeld()).toBe(true)
    } finally {
      holdNudges('plan', false)
    }
    expect(nudgesHeld()).toBe(false)
  })
})

describe('makeNudge edges', () => {
  it('uses canned shoves past the model-written limit, without calling the server', async () => {
    const fetchMock = vi.fn(() => { throw new Error('should not fetch') })
    vi.stubGlobal('fetch', fetchMock)
    const t = task({ title: 'Pay rent' })
    const first = await makeNudge(t, 2, 'Tize', MODEL_NUDGES)
    expect(first.taskId).toBe('t1')
    expect(first.level).toBe(2)
    expect(first.text).toBe('"Pay rent" is starting to feel left out, Tize.')
    expect(first.via).toBeUndefined()
    expect(first.id).toMatch(/^p/)
    const next = await makeNudge(t, 4, 'Tize', MODEL_NUDGES + 1)
    expect(next.text).toBe('Tize, "Pay rent". Now. I\'m a woodpecker with a deadline.')
    const wraps = await makeNudge(t, 1, 'Tize', MODEL_NUDGES + 4)
    expect(wraps.text).toBe(first.text)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to a backup line when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nudge = await makeNudge(task({ title: 'Pay rent' }), 1, undefined, 0)
    expect(nudge.text).toBe('Friend, "Pay rent" is coming up. Future you says thanks in advance.')
    expect(nudge.taskId).toBe('t1')
    expect(nudge.level).toBe(1)
    expect(nudge.via).toBeUndefined()
  })

  it('falls back to the shouting level 4 line on a server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, statusText: 'Bad', json: async () => ({}) })))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nudge = await makeNudge(task({ title: 'Pay rent' }), 4, 'Tize', 0)
    expect(nudge.text).toBe('Tize. TIZE. "Pay rent" has filed a missing person report.')
  })

  it('still tries the server for the last model-written nudge', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('down') })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nudge = await makeNudge(task({ title: 'Pay rent' }), 2, 'Tize', MODEL_NUDGES - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(nudge.text).toBe('Tize, "Pay rent" is aging like milk. Shall we?')
  })
})

describe('notify edges', () => {
  it('does nothing when notifications are unsupported', async () => {
    vi.stubGlobal('Notification', undefined)
    await expect(notify('hello')).resolves.toBeUndefined()
  })

  it('stays quiet without permission or when the tab is visible', async () => {
    const Ctor = vi.fn()
    Ctor.permission = 'denied'
    vi.stubGlobal('Notification', Ctor)
    vi.stubGlobal('document', { hidden: true })
    await notify('hello')
    expect(Ctor).not.toHaveBeenCalled()
    Ctor.permission = 'granted'
    vi.stubGlobal('document', { hidden: false })
    await notify('hello')
    expect(Ctor).not.toHaveBeenCalled()
  })

  it('shows a notification when granted and hidden, passing silent through', async () => {
    const Ctor = vi.fn()
    Ctor.permission = 'granted'
    vi.stubGlobal('Notification', Ctor)
    vi.stubGlobal('document', { hidden: true })
    vi.stubGlobal('navigator', {})
    await notify('hello')
    expect(Ctor).toHaveBeenCalledWith('Nudged', expect.objectContaining({ body: 'hello', tag: 'nudgy', silent: false }))
    await notify('quiet', { silent: true })
    expect(Ctor).toHaveBeenLastCalledWith('Nudged', expect.objectContaining({ body: 'quiet', silent: true }))
  })

  it('goes through the service worker when there is one', async () => {
    const showNotification = vi.fn()
    const Ctor = vi.fn()
    Ctor.permission = 'granted'
    vi.stubGlobal('Notification', Ctor)
    vi.stubGlobal('document', { hidden: true })
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => ({ showNotification }) } })
    await notify('hello')
    expect(showNotification).toHaveBeenCalledWith('Nudged', expect.objectContaining({ body: 'hello' }))
    expect(Ctor).not.toHaveBeenCalled()
  })

  it('swallows notification errors', async () => {
    const Ctor = vi.fn()
    Ctor.permission = 'granted'
    vi.stubGlobal('Notification', Ctor)
    vi.stubGlobal('document', { hidden: true })
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => { throw new Error('nope') } } })
    await expect(notify('hello')).resolves.toBeUndefined()
    expect(Ctor).not.toHaveBeenCalled()
  })
})
