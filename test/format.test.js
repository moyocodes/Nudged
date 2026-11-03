import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { countdown, friendlyDue, isEarly, isOverdue, nextDue, savedSummary } from '../src/lib/format.js'

const iso = (day, h = 12, m = 0) => new Date(2026, 5, day, h, m).toISOString()

beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 5, 10, 12) }))
afterEach(() => vi.useRealTimers())

describe('friendlyDue', () => {
  it('handles no date', () => {
    expect(friendlyDue(null)).toBe('No date set')
  })

  it('names today and tomorrow', () => {
    expect(friendlyDue(iso(10, 15))).toMatch(/^Today, /)
    expect(friendlyDue(iso(11, 9))).toMatch(/^Tomorrow, /)
  })

  it('shows the time for overdue today, and days ago for older', () => {
    expect(friendlyDue(iso(10, 9))).toMatch(/^Overdue · \d/)
    expect(friendlyDue(iso(8, 9))).toBe('Overdue · 2d ago')
  })

  it('shows weekday and date further out', () => {
    expect(friendlyDue(iso(17, 9))).toContain('Wed')
    expect(friendlyDue(iso(17, 9))).toContain('17')
  })
})

describe('savedSummary', () => {
  it('is empty with nothing saved', () => {
    expect(savedSummary([])).toBe('')
  })

  it('names one, up to three, then just counts', () => {
    expect(savedSummary([{ title: 'Rent' }])).toBe('Set: "Rent" (no time yet).')
    expect(savedSummary([{ title: 'Rent', due: iso(10, 15) }])).toMatch(/^Set: "Rent" today, /)
    expect(savedSummary([{ title: 'A' }, { title: 'B' }])).toBe('Set 2: "A" (no time yet); "B" (no time yet).')
    expect(savedSummary([{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }])).toBe("Set 4 reminders. They're on your list.")
  })
})

describe('countdown', () => {
  const MIN = 60000
  it.each([
    [45 * MIN, '45m'],
    [60 * MIN, '1h'],
    [182 * MIN, '3h 2m'],
    [1440 * MIN, '1d'],
    [(2 * 1440 + 240) * MIN, '2d 4h'],
  ])('%i ms -> %s', (ms, text) => {
    expect(countdown(ms)).toBe(text)
  })

  it('never shows less than a minute', () => {
    expect(countdown(0)).toBe('1m')
    expect(countdown(-5000)).toBe('1m')
  })
})

describe('nextDue', () => {
  it('picks the soonest open task in the future', () => {
    const soon = { id: 'soon', due: iso(11) }
    const tasks = [{ id: 'later', due: iso(12) }, soon, { id: 'past', due: iso(9) }, { id: 'done', due: iso(10, 13), done: true }, { id: 'undated' }]
    expect(nextDue(tasks)).toBe(soon)
  })

  it('has nothing when no task qualifies', () => {
    expect(nextDue([{ id: 'undated' }])).toBeUndefined()
  })
})

describe('isEarly and isOverdue', () => {
  it('splits on the due time', () => {
    expect(isEarly({ due: iso(11) })).toBe(true)
    expect(isOverdue({ due: iso(11) })).toBe(false)
    expect(isEarly({ due: iso(9) })).toBe(false)
    expect(isOverdue({ due: iso(9) })).toBe(true)
  })

  it('is never true for finished or undated tasks', () => {
    expect(isOverdue({ due: iso(9), done: true })).toBe(false)
    expect(isEarly({ due: iso(11), done: true })).toBe(false)
    expect(isEarly({})).toBeFalsy()
    expect(isOverdue({})).toBeFalsy()
  })
})
