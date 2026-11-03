#!/usr/bin/env node
// Practice Nudged's intent-spotting on the conversations in scenarios.mjs.
//
//   npm run practice -- --list                  list scenarios (free)
//   npm run practice -- --dry dentist           show the requests that would be sent (free)
//   npm run practice -- --mock                  run with made-up ideal answers, to check this runner (free)
//   npm run practice -- --run dentist,work-visit  REAL model calls, one per turn. Costs credits.
//
// Real runs go through your running server (npm run dev), so its [usage] lines show the tokens spent.
import { NOW, scenarios } from './scenarios.mjs'

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const after = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined)
const url = after('--url') ?? 'http://localhost:3001'
const pick = (spec) => (!spec || spec.startsWith('--') || spec === 'all' ? scenarios : spec.split(',').map((id) => scenarios.find((s) => s.id === id) ?? (console.error(`No scenario "${id}". Try --list.`), process.exit(1))))

if (has('--list') || args.length === 0) {
  for (const s of scenarios) console.log(`${s.id.padEnd(16)} ${String(s.turns.length)} turn${s.turns.length > 1 ? 's' : ' '}  ${s.title}`)
  const calls = scenarios.reduce((n, s) => n + s.turns.length, 0)
  console.log(`\nAll of them would be ${calls} real model calls. Use --run with just the ones you want.`)
  process.exit(0)
}

const mode = has('--run') ? 'run' : has('--mock') ? 'mock' : has('--dry') ? 'dry' : null
if (!mode) { console.error('Use --list, --dry, --mock or --run <ids>.'); process.exit(1) }
if (mode === 'run' && !after('--run')) { console.error('--run needs scenario ids, e.g. --run dentist (see --list). It never runs everything by accident.'); process.exit(1) }
const chosen = pick(after(`--${mode}`))
const callCount = chosen.reduce((n, s) => n + s.turns.length, 0)
if (mode === 'run') console.log(`Making ${callCount} real model call${callCount > 1 ? 's' : ''} through ${url}. Watch the server terminal for [usage] lines.\n`)

// What /api/extract gets for a turn, like the app builds it.
const bodyFor = (state, say) => ({
  text: say, now: NOW, name: 'Moyo',
  history: state.history.slice(-4),
  reminders: state.reminders.filter((r) => !r.done).slice(0, 25).map((r) => ({ title: r.title, due: r.due ?? null, ask: r.ask ?? null })),
})

// Ideal answers made from the expectations, only to check this runner's own plumbing.
function fabricate(expect = {}, open) {
  const find = (w) => open.findIndex((r) => r.title.toLowerCase().includes(w)) + 1
  const dueOf = (w) => (expect.due?.[w] ? `${expect.due[w]}T09:00` : undefined)
  const words = expect.taskIncludes ?? []
  const tasks = words.map((w) => ({
    title: `Do ${w}`, priority: 'medium', due: dueOf(w),
    repeat: expect.repeats?.[w] ? Array.from({ length: expect.repeats[w] }, () => ({ days: [1, 2, 3, 4, 5], time: '08:00' })) : undefined,
    ask: expect.asks && !dueOf(w) ? { kind: 'when', text: `When for ${w}?` } : undefined,
    proof: expect.proof?.[w] === true || undefined,
    proofOf: expect.proof?.[w] === true ? w : undefined,
  }))
  const updates = [...new Set([...Object.keys(expect.due ?? {}), ...Object.keys(expect.proof ?? {})])].filter((w) => find(w) && !words.includes(w))
  const actions = (expect.actions ?? []).flatMap((type) =>
    type === 'update' ? updates.map((w) => ({ type, n: find(w), due: dueOf(w), ...(expect.proof && w in expect.proof ? { proof: expect.proof[w] } : {}) })) : (expect.actionOn ?? []).map((w) => ({ type, n: find(w) })))
  return { reply: '(mock)', followup: expect.asks && !tasks.some((t) => t.ask) ? 'Which one, and when?' : undefined, tasks, actions }
}

const norm = (r) => ({ reply: r.reply ?? '', followup: r.followup ?? '', tasks: r.tasks ?? [], actions: r.actions ?? [] })

function dueFor(word, got, open) {
  const fromTasks = got.tasks.filter((t) => t.title.toLowerCase().includes(word)).map((t) => t.due)
  const fromActions = got.actions.filter((a) => a.type === 'update' && a.due && open[a.n - 1]?.title.toLowerCase().includes(word)).map((a) => a.due)
  return [...fromTasks, ...fromActions].filter(Boolean)
}

function checks(expect = {}, got, open) {
  const out = []
  const add = (ok, label) => out.push({ ok, label })
  const titles = got.tasks.map((t) => t.title.toLowerCase())
  const types = got.actions.map((a) => a.type)
  const asked = !!got.followup || got.tasks.some((t) => t.ask)
  if (expect.tasks !== undefined) add(got.tasks.length === expect.tasks, `${expect.tasks} new reminder${expect.tasks === 1 ? '' : 's'} (got ${got.tasks.length})`)
  for (const w of expect.taskIncludes ?? []) add(titles.some((t) => t.includes(w)), `a reminder mentions "${w}"`)
  for (const a of expect.actions ?? []) add(types.includes(a), `a "${a}" action`)
  if (expect.actions?.length === 0) add(types.length === 0, 'no actions on the list')
  for (const w of expect.actionOn ?? []) add(got.actions.some((a) => a.type !== 'update' && open[a.n - 1]?.title.toLowerCase().includes(w)), `an action hits the "${w}" reminder`)
  for (const [w, day] of Object.entries(expect.due ?? {})) { const d = dueFor(w, got, open); add(d.some((x) => x.startsWith(day)), `"${w}" is due ${day} (got ${d.join(', ') || 'no date'})`) }
  for (const [w, n] of Object.entries(expect.repeats ?? {})) { const t = got.tasks.find((x) => x.title.toLowerCase().includes(w)); add(t?.repeat?.length === n, `"${w}" repeats at ${n} times (got ${t?.repeat?.length ?? 0})`) }
  for (const [w, want] of Object.entries(expect.proof ?? {})) {
    const fromTask = got.tasks.find((t) => t.title.toLowerCase().includes(w))
    const fromAction = got.actions.find((a) => a.type === 'update' && 'proof' in a && open[a.n - 1]?.title.toLowerCase().includes(w))
    const has = fromTask ? !!fromTask.proof : fromAction ? !!fromAction.proof : null
    add(has === want, `"${w}" ${want ? 'needs' : 'does not need'} a photo (got ${has === null ? 'nothing' : has ? 'needs' : 'no'})`)
  }
  if (expect.asks !== undefined) add(asked === expect.asks, expect.asks ? 'Nudged asks a question' : 'Nudged does not ask')
  return out
}

let passed = 0, total = 0
for (const s of chosen) {
  console.log(`\n▶ ${s.id}: ${s.title}`)
  const state = { history: [], reminders: (s.reminders ?? []).map((r) => ({ ...r })) }
  for (const turn of s.turns) {
    const open = state.reminders.filter((r) => !r.done)
    console.log(`  you:    ${turn.say}`)
    if (mode === 'dry') { console.log(`  would send: ${JSON.stringify(bodyFor(state, turn.say))}`); state.history.push({ from: 'you', text: turn.say }); continue }
    let got
    try {
      if (mode === 'mock') got = norm(fabricate(turn.expect, open))
      else {
        const r = await fetch(`${url}/api/extract`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NUDGY_SESSION}` }, body: JSON.stringify(bodyFor(state, turn.say)) })
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json.error || r.statusText)
        got = norm(json)
      }
    } catch (err) {
      console.log(`  ✗ call failed: ${err.message}`)
      total++
      break
    }
    const said = [got.reply, got.followup].filter(Boolean).join(' ')
    console.log(`  nudgy:  ${said || '(nothing)'}`)
    for (const t of got.tasks) console.log(`    + ${t.title}${t.due ? ` · ${t.due}` : ' · no time'}${t.repeat ? ` · repeats ×${t.repeat.length}` : ''}${t.proof ? ` · needs photo${t.proofOf ? ` (${t.proofOf})` : ''}` : ''}${t.ask ? ` · asks: ${t.ask.text}` : ''}`)
    for (const a of got.actions) console.log(`    ~ ${a.type} #${a.n ?? ''} ${open[a.n - 1]?.title ?? ''}${a.due ? ` → ${a.due}` : ''}`)
    for (const c of checks(turn.expect, got, open)) { total++; if (c.ok) passed++; console.log(`    ${c.ok ? '✓' : '✗'} ${c.label}`) }
    // Carry the conversation forward the way the app does.
    for (const a of got.actions) {
      const r = open[a.n - 1]
      if (!r) continue
      if (a.type === 'done' || a.type === 'delete') r.done = true
      if (a.type === 'update') { if (a.due) r.due = a.due; if (a.title) r.title = a.title; if (a.due || a.title) r.ask = null }
    }
    for (const t of got.tasks) state.reminders.push({ title: t.title, due: t.due ?? null, repeat: t.repeat, ask: t.ask?.text ?? (t.due || t.repeat ? null : `When should I nudge you about "${t.title}"?`) })
    state.history.push({ from: 'you', text: turn.say }, { from: 'nudgy', text: said })
  }
}
if (mode !== 'dry') console.log(`\n${passed}/${total} checks passed${mode === 'run' ? ` across ${callCount} model call${callCount > 1 ? 's' : ''}` : ' (mock answers, no model calls)'}.`)
