import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INTENT_HINT, listRequest, looksPhysical, snoozeMinutes, taskSummary, isClosing } from '../src/lib/intent.js'
import { guessPhrase } from '../src/lib/proof.js'

describe('listRequest', () => {
  it.each([
    ['what do I have today', 'today'],
    ['tell me all I have to do today', 'today'],
    ["what's on tonight", 'today'],
    ['show me everything due tomorrow', 'tomorrow'],
    ['what do I have this week', 'week'],
    ['show me my reminders', 'all'],
    ['read out everything', 'all'],
    ["what's next", 'today'],
  ])('%s -> %s', (text, scope) => {
    expect(listRequest(text)).toBe(scope)
  })

  it.each(['remind me to call mum', 'buy milk tomorrow', 'tell me to remind me what to do today', 'hello there'])('%s is not a question about the list', (text) => {
    expect(listRequest(text)).toBeNull()
  })
})

describe('INTENT_HINT', () => {
  it('spots words that suggest a reminder', () => {
    for (const text of ['remind me', "don't forget the keys", 'pay rent', 'next tuesday', 'on friday', 'at 5']) expect(INTENT_HINT.test(text)).toBe(true)
  })

  it('leaves plain chat alone', () => {
    for (const text of ['hey Nudged', 'thanks', 'what a day']) expect(INTENT_HINT.test(text)).toBe(false)
  })
})

describe('taskSummary', () => {
  const now = new Date(2026, 5, 10, 12)
  const task = (title, due, extra) => ({ title, due: due?.toISOString() ?? null, ...extra })
  const today = (h) => new Date(2026, 5, 10, h)
  const tomorrow = (h) => new Date(2026, 5, 11, h)

  it('says when the scope is empty', () => {
    expect(taskSummary([], 'today', 'Moyo', now)).toMatch(/^Nothing on today, Moyo\./)
    expect(taskSummary([], 'all', 'Moyo', now)).toMatch(/^Nothing on your list, Moyo\./)
  })

  it('keeps to the scope, and leaves out finished tasks', () => {
    const tasks = [task('Rent', today(15)), task('Gym', tomorrow(9)), task('Old', today(16), { done: true })]
    const summary = taskSummary(tasks, 'today', 'Moyo', now)
    expect(summary).toContain('1 today: Rent at')
    expect(summary).not.toContain('Gym')
    expect(summary).not.toContain('Old')
    expect(taskSummary(tasks, 'tomorrow', 'Moyo', now)).toContain('1 tomorrow: Gym at')
  })

  it('always mentions overdue tasks, and undated ones for today and all', () => {
    const tasks = [task('Late', today(9)), task('Someday', null)]
    expect(taskSummary(tasks, 'today', 'Moyo', now)).toContain('1 overdue: Late')
    expect(taskSummary(tasks, 'today', 'Moyo', now)).toContain('1 with no date: Someday')
    expect(taskSummary(tasks, 'tomorrow', 'Moyo', now)).not.toContain('Someday')
  })

  it('keeps long lists short enough to speak', () => {
    const tasks = Array.from({ length: 7 }, (_, i) => task(`Task ${i}`, today(13 + i)))
    const summary = taskSummary(tasks, 'today', 'Moyo', now)
    expect(summary).toContain('Task 4')
    expect(summary).not.toContain('Task 5')
    expect(summary).toContain('and 2 more')
  })

  it('sorts by time', () => {
    const summary = taskSummary([task('Second', today(16)), task('First', today(14))], 'today', 'Moyo', now)
    expect(summary.indexOf('First')).toBeLessThan(summary.indexOf('Second'))
  })
})

describe('looksPhysical', () => {
  it.each(['Buy oat milk', 'Clean the kitchen', 'Join the team meeting', 'Go to the gym', 'Dentist appointment'])('%s needs a photo', (title) => {
    expect(looksPhysical(title)).toBe(true)
  })

  it.each(['Call the bank', 'Email the office', 'Pay for the gym', 'Book a haircut', 'Think about the wedding'])('%s does not', (title) => {
    expect(looksPhysical(title)).toBe(false)
  })
})

describe('snoozeMinutes', () => {
  it.each([
    ['30 minutes', 30],
    ['thirty mins', 30],
    ['half an hour', 30],
    ['snooze for half hour', 30],
    ['90 min', 90],
    ['an hour and a half', 90],
    ['1 hour', 60],
    ['an hour', 60],
    ['1h', 60],
    ['2 hours', 120],
    ['two hrs', 120],
  ])('%s -> %i', (text, minutes) => {
    expect(snoozeMinutes(text)).toBe(minutes)
  })

  it('has no answer without a length', () => {
    expect(snoozeMinutes('later')).toBeNull()
    expect(snoozeMinutes('12 hours')).toBeNull()
  })

  it('only takes a bare number when replying to "how long?"', () => {
    expect(snoozeMinutes('30')).toBeNull()
    expect(snoozeMinutes('30', true)).toBe(30)
    expect(snoozeMinutes('two.', true)).toBe(120)
    expect(snoozeMinutes('1', true)).toBe(60)
    expect(snoozeMinutes('5', true)).toBeNull()
  })

  it('reads hours and minutes together', () => {
    expect(snoozeMinutes('1 hour 30 minutes')).toBe(90)
    expect(snoozeMinutes('an hour and 30 mins')).toBe(90)
    expect(snoozeMinutes('1h30m')).toBe(90)
    expect(snoozeMinutes('2 hours 15 minutes')).toBe(135)
  })
})

describe('guessPhrase', () => {
  it('drops the verb and article', () => {
    expect(guessPhrase('Buy oat milk')).toBe('oat milk')
    expect(guessPhrase('Clean the kitchen')).toBe('kitchen')
    expect(guessPhrase('Pick up some flowers')).toBe('flowers')
    expect(guessPhrase('Go to the gym (with Sam)')).toBe('gym')
  })

  it('keeps the title when there is nothing to drop', () => {
    expect(guessPhrase('Dentist')).toBe('Dentist')
  })
})

describe('taskSummary defaults', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 5, 10, 12) }))
  afterEach(() => vi.useRealTimers())

  it('uses the current time and "friend"', () => {
    expect(taskSummary([{ title: 'Rent', due: new Date(2026, 5, 10, 15).toISOString() }], 'today')).toContain('friend. 1 today: Rent')
  })
})

describe('isClosing', () => {
  it.each(['bye', 'Bye!', 'byeee', 'thanks', 'thank you so much', 'ok bye', 'no thanks', "that's all", "I'm good", 'good night', 'nope'])('hears "%s" as the end', (text) => {
    expect(isClosing(text)).toBe(true)
  })

  it.each(['remind me to say bye to Tolu at the airport tomorrow morning', 'thanks to Ada for the gift, send a card friday', 'call mum', 'no milk left, buy some tomorrow at the shop near work'])('keeps "%s" going', (text) => {
    expect(isClosing(text)).toBe(false)
  })
})
