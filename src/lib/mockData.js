const today = new Date()
const at = (days, hours) => {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  d.setHours(hours, 0, 0, 0)
  return d.toISOString()
}

export const MOCK_TASKS = [
  { id: 't1', title: 'Buy groceries', due: at(0, 18), priority: 'low', physical: true, done: false },
  { id: 't2', title: 'Call mum', due: at(1, 10), priority: 'medium', physical: false, done: false },
  { id: 't3', title: 'Finish hackathon demo', due: at(2, 17), priority: 'high', physical: false, done: false },
  { id: 't4', title: 'Water the plants', due: at(-1, 9), priority: 'medium', physical: true, done: false },
]

export const MOCK_NUDGES = [
  { id: 'p1', taskId: 't4', level: 2, text: 'Your plants are writing their wills. Water, today?', at: at(0, 9) },
  { id: 'p2', taskId: 't1', level: 1, text: 'Groceries tonight. Your fridge is echoing.', at: at(0, 12) },
]

// Each badge tracks one stat towards a goal. Art lives in public/badges/<id>.png when it exists.
export const BADGES = [
  { id: 'first', label: 'First one down', blurb: 'You finished a task. The bar was on the floor and you cleared it.', stat: 'done', goal: 1 },
  { id: 'streak3', label: '3-day streak', blurb: 'Three days running. Consistency looks good on you.', stat: 'streak', goal: 3 },
  { id: 'streak5', label: '5-day streak', blurb: 'Five days. At this point it\'s a personality trait.', stat: 'streak', goal: 5 },
  { id: 'ten', label: '10 tasks crushed', blurb: 'Ten things, handled. Your to-do list fears you now.', stat: 'done', goal: 10 },
  { id: 'proof', label: 'Pics or it didn\'t happen', blurb: 'You sent photo proof. Trust, but verify.', stat: 'proofs', goal: 1 },
]

export function badgeStats(tasks, streak) {
  return {
    done: tasks.filter((t) => t.done).length,
    proofs: tasks.filter((t) => t.proof).length,
    streak,
  }
}

export const isEarned = (badge, stats) => stats[badge.stat] >= badge.goal

// The locked badge closest to being earned, for the "next up" hint.
export function nextBadge(stats) {
  return BADGES.filter((b) => !isEarned(b, stats)).sort(
    (a, b) => stats[b.stat] / b.goal - stats[a.stat] / a.goal,
  )[0]
}

// Stand-in for /api/extract so the flow can be clicked through for free.
// Splits on commas, "and", and full stops. A piece that is only a date or time
// ("..., 5pm") belongs to the task before it rather than being its own task, and a
// task joined by "and" with no time of its own shares the time of the one before
// ("see dad on Friday and go to the store" -> both Friday).
export function mockExtract(text) {
  const parts = normaliseTimes(text).split(/(,|\band\b|\.(?=\s|$)|\n)/i)
  const pieces = []
  for (let i = 0; i < parts.length; i += 2) {
    const p = parseWhen(parts[i].trim())
    pieces.push({ ...p, rest: cleanTitle(p.rest), joinedByAnd: /^and$/i.test(parts[i - 1] ?? '') })
  }

  const merged = []
  for (const p of pieces) {
    const prev = merged[merged.length - 1]
    if (p.rest.length <= 2) {
      if (prev) {
        prev.day ??= p.day
        if (prev.hours === null) Object.assign(prev, { hours: p.hours, minutes: p.minutes, meridiem: p.meridiem })
      }
      continue
    }
    if (prev && p.joinedByAnd && !p.day && p.hours === null) {
      Object.assign(p, { day: prev.day, hours: prev.hours, minutes: prev.minutes, meridiem: prev.meridiem })
    }
    merged.push(p)
  }

  return merged.map((p, i) => ({
    id: `m${Date.now()}${i}`,
    title: p.rest.charAt(0).toUpperCase() + p.rest.slice(1),
    due: toDue(p),
    priority: /asap|urgent|today/i.test(p.rest) ? 'high' : 'medium',
    physical: /buy|clean|water|cook|wash|tidy|pick up/i.test(p.rest),
    done: false,
  }))
}

// Drops greetings and "remind me to", "set a reminder for" and similar so the title is just the task.
function cleanTitle(s) {
  return s
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^((hi|hey|hello|ok|okay|so|um|uh|ugh|yo)\b[,!.\s]*)+(nudg(?:ed|y)\b[,!.\s]*)?/i, '')
    .replace(/^(please\s+)?(i want you to|i'?d like you to|can you|could you|pls|please)\s+/i, '')
    .replace(/^(also|then|plus|oh|and)\s+/i, '')
    .replace(/^i\s+(want to|wanna|might( just)?|may|will|'?ll|plan to|am going to|'?m gonna|gotta)\s+/i, '')
    .replace(/^(maybe|probably|just)\s+/i, '')
    .replace(/^(set|add|create|make)\s+(a\s+|me\s+a\s+)?reminder\s+(for|to|that)?\s*/i, '')
    .replace(/^remind me\s+(to|that|about)?\s*/i, '')
    .replace(/^(i )?(need to|have to|gotta|must|should)\s+/i, '')
    .replace(/^i'?m going to\s+/i, 'Go to ')
    .replace(/\s+(at|on|by|for|around)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const NUMBER_WORD = `(${NUMBERS.slice(1).join('|')})`
const DAY_WORD = '(today|tonight|tomorrow|tmrw|monday|tuesday|wednesday|thursday|friday|saturday|sunday)'

// Speech-to-text writes "5 p.m.", "five pm", "at five" or "five thirty". Turn those into "5pm",
// "at 5" and "5:30" so one time pattern can read them.
function normaliseTimes(text) {
  const num = (w) => NUMBERS.indexOf(w.toLowerCase())
  return text
    .replace(/\b([ap])\.\s?m\.?/gi, '$1m')
    .replace(new RegExp(`\\b${NUMBER_WORD}\\s+(thirty|fifteen|forty[- ]five)\\b`, 'gi'), (_, h, m) =>
      `${num(h)}:${{ thirty: '30', fifteen: '15' }[m.toLowerCase()] ?? '45'}`)
    .replace(new RegExp(`\\bhalf\\s+(past\\s+)?${NUMBER_WORD}\\b`, 'gi'), (_, __, h) => `${num(h)}:30`)
    .replace(new RegExp(`\\b${NUMBER_WORD}(?=\\s*(am|pm|o'?\\s?clock)\\b)`, 'gi'), (w) => num(w))
    .replace(new RegExp(`\\b(at|by|around|from)\\s+${NUMBER_WORD}\\b`, 'gi'), (_, at, w) => `${at} ${num(w)}`)
    .replace(new RegExp(`\\b${DAY_WORD}([,\\s]+)${NUMBER_WORD}\\b`, 'gi'), (_, d, gap, w) => `${d}${gap}${num(w)}`)
    .replace(/o'?\s?clock/gi, '')
}

// Pulls a day (today/tonight/tomorrow/<weekday>) and a time out of a phrase.
// Times: "5pm", "5:30 pm", "17:00", or a bare hour after "at"/a day ("Friday 5", "at 5").
// The real dates will come from Muse Spark via /api/extract; this keeps the prototype honest.
function parseWhen(s) {
  let rest = s
  let day = null
  let hours = null
  let minutes = 0
  let meridiem = null

  const dayMatch = rest.match(/\b(today|tonight|tomorrow|tmrw|(?:next |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/i)
  if (dayMatch) {
    const word = dayMatch[1].toLowerCase()
    const d = new Date()
    if (word === 'tomorrow' || word === 'tmrw') d.setDate(d.getDate() + 1)
    else if (dayMatch[2]) {
      const target = WEEKDAYS.indexOf(dayMatch[2].toLowerCase())
      d.setDate(d.getDate() + (((target - d.getDay() + 7) % 7) || 7))
    }
    if (word === 'tonight') meridiem = 'pm'
    day = d
    rest = rest.replace(dayMatch[0], ' ')
  }

  if (/\b(evening|afternoon|tonight)\b/i.test(rest)) meridiem = 'pm'
  if (/\bmorning\b/i.test(rest)) meridiem = 'am'
  rest = rest.replace(/\b(in the )?(morning|afternoon|evening)\b/gi, ' ')

  const timeMatch =
    rest.match(/\b(?:at\s+|by\s+|around\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ||
    rest.match(/\b(?:at\s+|by\s+|around\s+)?([01]?\d|2[0-3]):(\d{2})\b/) ||
    rest.match(/\b(?:at|by|around)\s+(\d{1,2})\b/i) ||
    (day && rest.match(/^\s*(\d{1,2})\s*$/)) ||
    (day && rest.match(/\s(\d{1,2})\s*$/))
  if (timeMatch) {
    hours = Number(timeMatch[1]) % 24
    minutes = Number(timeMatch[2] || 0)
    meridiem = timeMatch[3]?.toLowerCase() ?? meridiem
    rest = rest.replace(timeMatch[0], ' ')
  }
  if (dayMatch?.[1].toLowerCase() === 'tonight' && hours === null) hours = 20

  return { rest: rest.replace(/\b(for|at|on|by|around)\s+(?=\s|$)/gi, ' '), day, hours, minutes, meridiem }
}

// Turns the parsed bits into an ISO date. Without am/pm, an hour from 1 to 6 means afternoon
// (nobody wants a 5 AM dentist reminder); 7 to 11 means morning.
function toDue({ day, hours, minutes, meridiem }) {
  if (!day && hours === null) return null
  let h = hours
  if (h !== null && h <= 12) {
    if (meridiem === 'pm' && h < 12) h += 12
    else if (meridiem === 'am' && h === 12) h = 0
    else if (!meridiem && h >= 1 && h <= 6) h += 12
  }
  const due = day ? new Date(day) : new Date()
  due.setHours(h ?? 9, minutes, 0, 0)
  // A bare time that has already passed today means tomorrow.
  if (!day && due < new Date()) due.setDate(due.getDate() + 1)
  return due.toISOString()
}
