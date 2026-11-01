import { MAX_REPEATS_PER_DAY, describeRepeat } from '../lib/schedule.js'

// Repeat controls for a task: off, daily, weekdays or picked days, at one or more times.
// Works in slots ([{ days, time }]); here every time shares the same days. Slots with
// different days per time (e.g. from a brain dump) are kept as they are until changed.

const ALL = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
// 10 minutes is the shortest allowed; schedule.js also stops at 12 times a day.
const INTERVALS = [[null, 'Once'], [10, '10 min'], [30, '30 min'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours']]

const chip = (active) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`

export default function RepeatPicker({ value, defaultTime, onChange }) {
  const sameDays = value?.every((s) => s.days.join() === value[0].days.join())
  const days = value?.[0]?.days ?? []
  const times = value ? [...new Set(value.map((s) => s.time))] : []
  const key = days.join('')
  const mode = !value ? 'off' : !sameDays ? 'mixed' : key === '0123456' ? 'daily' : key === '12345' ? 'weekdays' : 'custom'

  const every = value?.[0]?.every ?? null
  // An interval needs a single start time; adding a second time goes back to set times.
  const build = (d, t, e = every) => (d.length && t.length ? t.map((time) => ({ days: d, time, ...(e && t.length === 1 ? { every: e } : {}) })) : null)
  // Turning repeat on defaults to the same time every day.
  const startTimes = times.length ? times : [defaultTime || '09:00']

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-ink/[0.04] px-3 py-2.5">
      <span className="text-sm font-medium">Repeat</span>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange(null)} className={chip(mode === 'off')}>Doesn't repeat</button>
        <button type="button" onClick={() => onChange(build(ALL, startTimes))} className={chip(mode === 'daily')}>Daily</button>
        <button type="button" onClick={() => onChange(build(WEEKDAYS, startTimes))} className={chip(mode === 'weekdays')}>Weekdays</button>
        <button type="button" onClick={() => onChange(build(days.length && mode !== 'mixed' ? days : [new Date().getDay()], startTimes))} className={chip(mode === 'custom')}>Pick days</button>
      </div>

      {mode === 'mixed' && (
        <p className="text-xs text-ink/60">{describeRepeat(value)}. Pick an option above to change it.</p>
      )}

      {(mode === 'custom' || mode === 'daily' || mode === 'weekdays') && (
        <>
          {mode === 'custom' && (
            <div className="flex gap-1" role="group" aria-label="Days">
              {ALL.map((d) => {
                const on = days.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
                    onClick={() => {
                      const next = on ? days.filter((x) => x !== d) : [...days, d].sort()
                      if (next.length) onChange(build(next, times))
                    }}
                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${on ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/60 hover:bg-ink/10'}`}
                  >
                    {LETTERS[d]}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {times.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <input
                  type="time"
                  value={t}
                  onChange={(e) => e.target.value && onChange(build(days, times.map((x, j) => (j === i ? e.target.value : x))))}
                  aria-label={`Time ${i + 1}`}
                  className="rounded-xl border-[length:var(--bw)] border-line bg-bg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                {times.length > 1 && (
                  <button type="button" onClick={() => onChange(build(days, times.filter((_, j) => j !== i)))} aria-label={`Remove time ${i + 1}`} className="px-1 text-sm text-ink/40 hover:text-ink">
                    ×
                  </button>
                )}
              </span>
            ))}
            <button type="button" onClick={() => onChange(build(days, [...times, '20:00']))} className="rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-ink/5">
              + Add a time
            </button>
          </div>
          {times.length === 1 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Repeat every">
              <span className="text-xs text-ink/60">Then every</span>
              {INTERVALS.map(([minutes, label]) => (
                <button key={label} type="button" aria-pressed={every === minutes} onClick={() => onChange(build(days, times, minutes))} className={chip(every === minutes)}>{label}</button>
              ))}
              {every && <span className="basis-full text-xs text-ink/50">Up to {MAX_REPEATS_PER_DAY} times a day, from the time above.</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
