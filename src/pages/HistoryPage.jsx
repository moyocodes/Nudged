import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store.jsx'
import Mascot from '../components/Mascot.jsx'
import { CheckIcon } from '../components/Icons.jsx'

const WEEK = 7 * 86400000
const dayLabel = (iso) => {
  const d = new Date(iso)
  const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
}

// Everything said to Nudged, kept on this device, plus how it's going.
export default function HistoryPage() {
  const { chat, tasks } = useStore()
  const end = useRef(null)

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [])

  const since = Date.now() - WEEK
  const week = chat.filter((m) => new Date(m.at) >= since)
  const captured = week.flatMap((m) => m.taskIds ?? [])
  const doneIds = new Set(tasks.filter((t) => t.done).map((t) => t.id))
  const doneCount = captured.filter((id) => doneIds.has(id)).length
  const stats = [
    ['Chats', week.filter((m) => m.from === 'you').length],
    ['Reminders set', captured.length],
    ['Done', doneCount],
  ]

  // Consecutive messages on the same day share one heading.
  const rows = chat.map((m, i) => ({ m, heading: i === 0 || dayLabel(chat[i - 1].at) !== dayLabel(m.at) ? dayLabel(m.at) : null }))

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="flex items-center gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-tight">Our chat</h1>
          <p className="text-sm text-ink/50">
            {chat.length ? `Since ${new Date(chat[0].at).toLocaleDateString([], { day: 'numeric', month: 'long' })}. Kept on this device.` : 'Kept on this device.'}
          </p>
        </div>
      </header>

      <section aria-label="This week" className="rounded-2xl bg-surface p-4 shadow-card border-[length:var(--bw)] border-line">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/45">This week</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink/50">{label}</dt>
              <dd className="font-display text-2xl tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {captured.length > 0 && (
          <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(doneCount / captured.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink/50">
              {doneCount === captured.length ? 'Clean sweep. Who even are you?' : `${captured.length - doneCount} still waiting on you. I'm patient. Mostly.`}
            </p>
          </>
        )}
      </section>

      {chat.length === 0 ? (
        <p className="py-8 text-center text-ink/50">Nothing said yet. Brain-dump on the Today page and it'll show up here.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map(({ m, heading }) => (
            <li key={m.id} className="flex flex-col">
              {heading && <p className="my-2 text-center text-xs font-semibold text-ink/40">{heading}</p>}
              {m.from === 'you' ? (
                <p className="ml-10 self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[15px] leading-snug text-on-primary">{m.text}</p>
              ) : (
                <div className="mr-10 flex items-end gap-2">
                  <span className="shrink-0"><Mascot size={28} /></span>
                  <div className="min-w-0 rounded-2xl rounded-bl-md bg-surface px-3.5 py-2 shadow-card border-[length:var(--bw)] border-line">
                    <p className="text-[15px] leading-snug">{m.text}</p>
                    {m.taskIds?.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {m.taskIds.map((id) => {
                          const t = tasks.find((x) => x.id === id)
                          if (!t) return null
                          return (
                            <li key={id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${t.done ? 'bg-success/15 text-success' : 'bg-ink/5 text-ink/70'}`}>
                              {t.done && <CheckIcon size={12} strokeWidth={2.5} />}
                              {t.title}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              <time className={`mt-0.5 text-[11px] text-ink/35 ${m.from === 'you' ? 'self-end' : 'ml-9'}`}>
                {new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </time>
            </li>
          ))}
        </ol>
      )}
      <div ref={end} />
    </div>
  )
}
