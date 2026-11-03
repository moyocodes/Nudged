// Plan my day: Muse Wonder as an agent. Each step it picks one tool, the server runs it against the list, and the result
// feeds the next step. Only when the user taps the button, at most MAX_STEPS calls. Nothing is saved until the app applies the changes.
const MAX_STEPS = 5
const SOON_MIN = 30 // two reminders closer than this clash

const PROMPT = `You are Nudged's planning agent. Make the user's day doable by working through their open reminders one step at a time.
Reply with JSON only: {"thought":str,"tool":str,"args":{}}. thought is one short plain sentence on why.
Tools:
- check_day {"date":"YYYY-MM-DD"}: what's on that day, plus sleep hours
- reschedule {"n":num,"due":"YYYY-MM-DDTHH:MM"}: move a reminder. Refused if it's in the past, in sleep hours or clashes
- set_priority {"n":num,"priority":"high"|"medium"|"low"}
- finish {"summary":str}: end the run, with one warm sentence on what changed, in plain words
Move overdue reminders to a real free time, and spread out clashes. Move only what needs it. Check a day before moving something to it. If a tool refuses, try something else. Never flirty, mean or medical.`

const minutes = (iso) => Date.parse(`${iso}:00Z`) / 60000
const clock = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m }

function inSleep(due, schedule) {
  const at = clock(due.slice(11, 16))
  const start = clock(schedule?.sleepStart ?? '00:00')
  const end = clock(schedule?.sleepEnd ?? '07:00')
  return start < end ? at >= start && at < end : at >= start || at < end
}

// Runs one tool on the working list. Returns what the model sees next.
export function runTool(tool, args, list, schedule, now) {
  const item = list.find((t) => t.n === args?.n)
  if (tool === 'check_day') {
    const date = String(args?.date ?? '').slice(0, 10)
    const day = list.filter((t) => t.due?.startsWith(date)).map((t) => `${t.n}. ${t.title} at ${t.due.slice(11, 16)}`)
    return `${date}: ${day.join('; ') || 'nothing on'}. Sleep ${schedule?.sleepStart ?? '00:00'} to ${schedule?.sleepEnd ?? '07:00'}.`
  }
  if (tool === 'reschedule') {
    const due = String(args?.due ?? '').slice(0, 16)
    if (!item) return 'Refused: no reminder with that number.'
    // The pattern as well as the parse: Date.parse is lenient and reads "tomorrow:00Z" as a real date.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(due) || Number.isNaN(minutes(due))) return 'Refused: use YYYY-MM-DDTHH:MM.'
    if (due <= now) return 'Refused: that time has passed.'
    if (inSleep(due, schedule)) return 'Refused: that is during sleep hours.'
    const clash = list.find((t) => t !== item && t.due && Math.abs(minutes(t.due) - minutes(due)) < SOON_MIN)
    if (clash) return `Refused: too close to "${clash.title}" at ${clash.due.slice(11, 16)}.`
    item.due = due
    return `Moved "${item.title}" to ${due}.`
  }
  if (tool === 'set_priority') {
    if (!item) return 'Refused: no reminder with that number.'
    if (!['high', 'medium', 'low'].includes(args?.priority)) return 'Refused: use high, medium or low.'
    item.priority = args.priority
    return `"${item.title}" is now ${args.priority} priority.`
  }
  return 'Refused: unknown tool.'
}

// ask(instructions, input) returns the model's text.
export async function planDay({ reminders, schedule, now, ask }) {
  const list = reminders.map((t) => ({ ...t }))
  const start = JSON.stringify(list)
  const steps = []
  let summary = ''
  for (let i = 0; i < MAX_STEPS && !summary; i++) {
    const history = steps.map((s) => `${s.tool} ${JSON.stringify(s.args)} -> ${s.result}`).join('\n')
    const text = await ask(PROMPT, `now: ${now}\nsteps left: ${MAX_STEPS - i}\nreminders:\n${JSON.stringify(list)}\n${history ? `done so far:\n${history}` : ''}`)
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    const args = json.args ?? {}
    if (json.tool === 'finish') summary = String(args.summary ?? '').slice(0, 300)
    else steps.push({ thought: String(json.thought ?? '').slice(0, 200), tool: String(json.tool), args, result: runTool(json.tool, args, list, schedule, now) })
  }
  const before = JSON.parse(start)
  const changes = list.filter((t, i) => t.due !== before[i].due || t.priority !== before[i].priority).map(({ id, due, priority }) => ({ id, due, priority }))
  return { steps, changes, summary: summary || 'That is as far as I got today.' }
}
