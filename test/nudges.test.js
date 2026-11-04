import { describe, expect, it } from 'vitest'
import { dueNudges, nextNudgeAt, holdNudges, nudgesHeld, mostUrgent } from '../src/lib/nudges.js'

const schedule = { sleepStart: '23:00', sleepEnd: '07:00', checkIn: '10:00' }
const at = (h, m = 0, day = 10) => new Date(2026, 5, day, h, m)
const iso = (...a) => at(...a).toISOString()
const task = (extra) => ({ id: 't1', title: 'Pay rent', priority: 'medium', ...extra })
const sent = (...times) => times.map((when) => ({ taskId: 't1', at: when }))
const ids = (list) => list.map((t) => t.id)

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
