import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE, canNudge, describeRepeat, isAsleep, nextNudgeTime, nextOccurrence } from '../src/lib/schedule.js'

// Wednesday June 10th 2026, local time.
const june = (day, h = 0, m = 0) => new Date(2026, 5, day, h, m)
const schedule = { sleepStart: '23:00', sleepEnd: '07:00', checkIn: '10:00' }

describe('isAsleep', () => {
  it('handles sleep hours that wrap midnight', () => {
    expect(isAsleep(june(10, 23, 30), schedule)).toBe(true)
    expect(isAsleep(june(10, 3), schedule)).toBe(true)
    expect(isAsleep(june(10, 7), schedule)).toBe(false)
    expect(isAsleep(june(10, 22, 59), schedule)).toBe(false)
  })

  it('handles sleep hours inside one day', () => {
    expect(isAsleep(june(10, 1), DEFAULT_SCHEDULE)).toBe(true)
    expect(isAsleep(june(10, 7), DEFAULT_SCHEDULE)).toBe(false)
  })
})

describe('canNudge', () => {
  it('lets only high priority through during sleep hours', () => {
    const night = june(10, 2)
    expect(canNudge({ priority: 'low' }, night, schedule)).toBe(false)
    expect(canNudge({ priority: 'medium' }, night, schedule)).toBe(false)
    expect(canNudge({ priority: 'high' }, night, schedule)).toBe(true)
  })

  it('lets every priority through when awake', () => {
    const day = june(10, 12)
    expect(canNudge({ priority: 'low' }, day, schedule)).toBe(true)
    expect(canNudge({ priority: 'medium' }, day, schedule)).toBe(true)
    expect(canNudge({ priority: 'high' }, day, schedule)).toBe(true)
  })

  it('never nudges a finished task', () => {
    expect(canNudge({ priority: 'high', done: true }, june(10, 12), schedule)).toBe(false)
  })
})

describe('nextNudgeTime', () => {
  it('uses the due time, or now if that has passed', () => {
    const now = june(10, 12)
    expect(nextNudgeTime({ due: june(10, 15).toISOString() }, schedule, now)).toEqual(june(10, 15))
    expect(nextNudgeTime({ due: june(10, 9).toISOString() }, schedule, now)).toEqual(now)
  })

  it('sends undated tasks to the next check-in', () => {
    expect(nextNudgeTime({}, schedule, june(10, 9))).toEqual(june(10, 10))
    expect(nextNudgeTime({}, schedule, june(10, 11))).toEqual(june(11, 10))
  })

  it('pushes everything but high priority out of sleep hours to wake-up', () => {
    const due = june(10, 23, 30).toISOString()
    expect(nextNudgeTime({ due, priority: 'low' }, schedule, june(10, 12))).toEqual(june(11, 7))
    expect(nextNudgeTime({ due, priority: 'medium' }, schedule, june(10, 12))).toEqual(june(11, 7))
    expect(nextNudgeTime({ due, priority: 'high' }, schedule, june(10, 12))).toEqual(june(10, 23, 30))
  })

  it('has nothing for a finished task', () => {
    expect(nextNudgeTime({ done: true }, schedule, june(10, 12))).toBeNull()
  })
})

describe('nextOccurrence', () => {
  const weekdays = [1, 2, 3, 4, 5]

  it('finds the next slot strictly after the given time', () => {
    const repeat = [{ days: weekdays, time: '08:00' }]
    expect(nextOccurrence(repeat, june(10, 7))).toEqual(june(10, 8))
    expect(nextOccurrence(repeat, june(10, 8))).toEqual(june(11, 8))
  })

  it('skips days not in the slot', () => {
    // Friday evening rolls over the weekend to Monday.
    expect(nextOccurrence([{ days: weekdays, time: '08:00' }], june(12, 20))).toEqual(june(15, 8))
  })

  it('wraps round to the same weekday next week', () => {
    expect(nextOccurrence([{ days: [3], time: '08:00' }], june(10, 9))).toEqual(june(17, 8))
  })

  it('picks the earliest of several slots', () => {
    const repeat = [{ days: weekdays, time: '15:00' }, { days: weekdays, time: '08:00' }]
    expect(nextOccurrence(repeat, june(10, 7))).toEqual(june(10, 8))
    expect(nextOccurrence(repeat, june(10, 9))).toEqual(june(10, 15))
  })

  it('walks through "every" repeats and enforces the 10 minute minimum', () => {
    expect(nextOccurrence([{ days: [3], time: '09:00', every: 30 }], june(10, 9, 5))).toEqual(june(10, 9, 30))
    expect(nextOccurrence([{ days: [3], time: '09:00', every: 1 }], june(10, 9, 1))).toEqual(june(10, 9, 10))
  })

  it('stops "every" repeats after 12 a day', () => {
    // Last one is 09:00 + 11 hours. After that it waits for next week.
    const repeat = [{ days: [3], time: '09:00', every: 60 }]
    expect(nextOccurrence(repeat, june(10, 19, 30))).toEqual(june(10, 20))
    expect(nextOccurrence(repeat, june(10, 20, 30))).toEqual(june(17, 9))
  })

  it('does not run "every" repeats past midnight', () => {
    const repeat = [{ days: [3], time: '23:00', every: 60 }]
    expect(nextOccurrence(repeat, june(10, 23, 30))).toEqual(june(17, 23))
  })

  it('has nothing when there are no slots', () => {
    expect(nextOccurrence([], june(10))).toBeNull()
    expect(nextOccurrence(null, june(10))).toBeNull()
  })
})

describe('describeRepeat', () => {
  it('names common day sets', () => {
    expect(describeRepeat([{ days: [0, 1, 2, 3, 4, 5, 6], time: '08:00' }])).toMatch(/^Daily 8:00/)
    expect(describeRepeat([{ days: [5, 4, 3, 2, 1], time: '08:00' }])).toMatch(/^Weekdays /)
    expect(describeRepeat([{ days: [6, 0], time: '08:00' }])).toMatch(/^Weekends /)
    expect(describeRepeat([{ days: [5, 1], time: '08:00' }])).toMatch(/^Mon, Fri /)
  })

  it('describes "every" repeats and joins slots', () => {
    expect(describeRepeat([{ days: [1], time: '08:00', every: 30 }])).toMatch(/, every 30 min$/)
    expect(describeRepeat([{ days: [1], time: '08:00', every: 60 }])).toMatch(/, every hour$/)
    expect(describeRepeat([{ days: [1], time: '08:00', every: 120 }])).toMatch(/, every 2 hours$/)
    expect(describeRepeat([{ days: [1], time: '08:00' }, { days: [2], time: '09:00' }])).toContain(' · ')
  })

  it('is empty without slots', () => {
    expect(describeRepeat(null)).toBe('')
  })
})
