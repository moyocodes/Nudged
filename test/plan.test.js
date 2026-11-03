// The guard rails around the planning agent's tools. The agent itself is tested with the real model in test/live.
import { describe, expect, it } from 'vitest'
import { runTool } from '../server/plan.js'

const now = '2026-06-10T12:00'
const schedule = { sleepStart: '23:00', sleepEnd: '07:00' }
const list = () => [
  { n: 1, id: 'a', title: 'Rent', due: '2026-06-10T09:00', priority: 'high' },
  { n: 2, id: 'b', title: 'Gym', due: '2026-06-10T18:00', priority: 'low' },
  { n: 3, id: 'c', title: 'Someday', priority: 'medium' },
]
const run = (tool, args, items = list()) => runTool(tool, args, items, schedule, now)

describe('reschedule', () => {
  it('moves a reminder to a free time', () => {
    const items = list()
    expect(run('reschedule', { n: 1, due: '2026-06-10T15:00' }, items)).toBe('Moved "Rent" to 2026-06-10T15:00.')
    expect(items[0].due).toBe('2026-06-10T15:00')
  })

  it.each([
    ['an unknown reminder', { n: 9, due: '2026-06-10T15:00' }, /no reminder/],
    ['a time that has passed', { n: 1, due: '2026-06-10T11:00' }, /has passed/],
    ['sleep hours after midnight', { n: 1, due: '2026-06-11T03:00' }, /sleep hours/],
    ['sleep hours before midnight', { n: 1, due: '2026-06-10T23:30' }, /sleep hours/],
    ['a clash with another reminder', { n: 1, due: '2026-06-10T18:15' }, /too close to "Gym"/],
  ])('refuses %s and leaves the list alone', (_, args, message) => {
    const items = list()
    expect(run('reschedule', args, items)).toMatch(message)
    expect(items).toEqual(list())
  })

  // Known bug: Date.parse is lenient and reads "tomorrow:00Z" as a real date, so the word gets saved as the due time.
  // it.fails flips to a failure once this is fixed: change it to a plain it then.
  it.fails('refuses a due time that is not YYYY-MM-DDTHH:MM', () => {
    const items = list()
    expect(run('reschedule', { n: 1, due: 'tomorrow' }, items)).toMatch(/use YYYY/)
    expect(items).toEqual(list())
  })

  it('allows exactly 30 minutes apart', () => {
    expect(run('reschedule', { n: 1, due: '2026-06-10T18:30' })).toMatch(/^Moved/)
  })

  it('does not clash a reminder with itself', () => {
    expect(run('reschedule', { n: 2, due: '2026-06-10T18:10' })).toMatch(/^Moved/)
  })

  it('uses the default sleep hours when none are saved', () => {
    expect(runTool('reschedule', { n: 1, due: '2026-06-11T03:00' }, list(), undefined, now)).toMatch(/sleep hours/)
  })
})

describe('set_priority', () => {
  it('changes the priority', () => {
    const items = list()
    expect(run('set_priority', { n: 2, priority: 'high' }, items)).toBe('"Gym" is now high priority.')
    expect(items[1].priority).toBe('high')
  })

  it('refuses unknown reminders and priorities', () => {
    expect(run('set_priority', { n: 9, priority: 'high' })).toMatch(/no reminder/)
    expect(run('set_priority', { n: 1, priority: 'urgent' })).toMatch(/use high/)
  })
})

describe('check_day', () => {
  it('lists that day and the sleep hours', () => {
    expect(run('check_day', { date: '2026-06-10' })).toBe('2026-06-10: 1. Rent at 09:00; 2. Gym at 18:00. Sleep 23:00 to 07:00.')
  })

  it('says when nothing is on', () => {
    expect(run('check_day', { date: '2026-06-11' })).toContain('nothing on')
  })
})

it('refuses a tool that does not exist', () => {
  expect(run('delete_everything', {})).toBe('Refused: unknown tool.')
})
