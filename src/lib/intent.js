// Small, local intent helpers for the brain dump. Kept in their own file (not inside a page) so a
// cleanup elsewhere can't delete them by accident.
import { friendlyDue } from './format.js'

// Words that suggest a reminder. If a message has these but nothing got saved, Nudged asks instead of shrugging.
export const INTENT_HINT = /\b(remind(er)?|remember|need to|have to|got to|gotta|don'?t forget|must|should|schedule|appointment|meeting|deadline|due|call|buy|pay|book|submit|send|tomorrow|tonight|today|next \w+|on (mon|tue|wed|thu|fri|sat|sun)\w*|at \d)\b/i
export const BACKSTOP = 'That sounded like it might be a reminder. What should I nudge you about, and when?'
// Nothing found at all (and the model said nothing either): say so and offer.
export const OFFER = "I couldn't find a reminder in that. Want me to set one about something?"
// Every reminder gets a time, or Nudged asks for one ("Whenever" on the card skips it).
export const whenAsk = (title) => ({ kind: 'when', text: `When should I nudge you about "${title}"?` })

// "What do I have today?", "tell me all I have to do today", "show me everything due tomorrow".
// A question about the list, not a new reminder. Returns 'today' | 'tomorrow' | 'week' | 'all', or null.
const ASKING = [
  /\b(?:what(?:'s| is| do i| have i| have)?|which|how many)\b.*\b(?:on|do|have|got|due|left|planned|to do)\b.*\b(?:today|tonight|tomorrow|this week|the week|now|my list|my plate|left)\b/i,
  /\b(?:tell me|show me|list|read(?: out)?|give me)\b.*\b(?:all|everything|what|my (?:tasks|reminders|list))\b/i,
  /\bwhat(?:'s| is) (?:on|up|next)\b/i,
  /\bwhat do i have\b/i,
]
export function listRequest(text) {
  const t = String(text).toLowerCase()
  if (!ASKING.some((re) => re.test(t))) return null
  // "tell me ... to remind"/"remind me to" is a new reminder, not a question.
  if (/\bremind me\b/.test(t)) return null
  if (/\btoday|tonight\b/.test(t)) return 'today'
  if (/\btomorrow\b/.test(t)) return 'tomorrow'
  if (/\b(this week|the week|next 7|next seven)\b/.test(t)) return 'week'
  if (/\b(all|everything|whole list|my list|my tasks|my reminders)\b/.test(t)) return 'all'
  return 'today'
}

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const dayKey = (d) => new Date(d).toDateString()

// The answer, built from the real list (no model, so it can't make anything up). Short enough to be spoken.
export function taskSummary(tasks, scope, name = 'friend', now = new Date()) {
  const open = tasks.filter((t) => !t.done)
  const late = open.filter((t) => t.due && new Date(t.due) < now)
  const soon = new Date(now)
  soon.setDate(soon.getDate() + 1)
  const inScope = open
    .filter((t) => t.due && new Date(t.due) >= now)
    .filter((t) => {
      if (scope === 'today') return dayKey(t.due) === dayKey(now)
      if (scope === 'tomorrow') return dayKey(t.due) === dayKey(soon)
      if (scope === 'week') return new Date(t.due) <= new Date(now.getTime() + 7 * 86400000)
      return true
    })
    .sort((a, b) => new Date(a.due) - new Date(b.due))
  const undated = open.filter((t) => !t.due)
  const label = scope === 'all' ? 'on your list' : scope === 'week' ? 'this week' : scope
  const say = (t) => `${t.title} ${scope === 'today' || scope === 'tomorrow' ? `at ${clock(t.due)}` : friendlyDue(t.due).toLowerCase()}`
  const list = (items) => {
    const shown = items.slice(0, 5).map(say).join('; ')
    return items.length > 5 ? `${shown}; and ${items.length - 5} more` : shown
  }

  const parts = []
  if (late.length) parts.push(`${late.length} overdue: ${late.slice(0, 3).map((t) => t.title).join(', ')}${late.length > 3 ? '…' : ''}`)
  if (inScope.length) parts.push(`${inScope.length} ${scope === 'all' ? 'coming up' : label}: ${list(inScope)}`)
  if (undated.length && (scope === 'all' || scope === 'today')) parts.push(`${undated.length} with no date: ${undated.slice(0, 3).map((t) => t.title).join(', ')}${undated.length > 3 ? '…' : ''}`)
  if (!parts.length) return `Nothing on ${scope === 'all' ? 'your list' : label}, ${name}. Genuinely. Go stare at a cloud.`
  return `Here's ${scope === 'all' ? 'your list' : label}, ${name}. ${parts.join('. ')}.`
}

// Which reminders should have Photo proof ticked automatically: ones where finishing means being somewhere
// or leaves something to show (meetings, appointments, errands, chores, going to a place). Calls, messages,
// emails, payments and bookings are digital, so there's nothing to photograph. A local backstop for the model's
// own call, and for the offline fallback.
const DIGITAL = /^\s*(?:call|phone|ring|text|email|e-mail|message|dm|whatsapp|pay|transfer|send|reply|respond|remind|remember|think|decide|plan|research|read|review|check|book|renew|order)\b/i
const PHYSICAL = /\b(?:meeting|stand-?up|conference|workshop|class|lecture|interview|presentation|event|party|wedding|appointment|visit|go to|head to|drive to|walk to|drop (?:off|by)|pick up|collect|buy|shop|clean|wash|tidy|cook|pack|fix|assemble|post|mail|gym|workout|exercise|haircut|dentist|doctor|bank|pharmacy|airport|work|office|school|church|mosque|market|store)\b/i
// "Bye", "thanks", "that's all", "no thanks": they're done, so Nudged stops asking things.
export const isClosing = (text) => /^\s*(ok(ay)?[,\s]+)?(bye+|goodbye|good ?night|see (you|ya)|later|thanks?( you| a lot| so much)?|thx|no( thanks?| thank you)?|nope|nah|i'?m good|i'?m done|that'?s (all|it)|all good|nothing( else)?|stop)\b[\s\w,.!']{0,20}$/i.test(text)

export const looksPhysical = (title) => !DIGITAL.test(title) && PHYSICAL.test(title)

// "30 minutes", "half an hour", "1 hour", "2h", "two hours" -> minutes. Null if no length is given.
// bare: also accept just "30", "1" or "2", for a reply to "how long?".
export function snoozeMinutes(text, bare = false) {
  const t = String(text).toLowerCase().trim()
  const only = (re) => bare && new RegExp(`^(${re})[.!\\s]*$`).test(t)
  // Hours and minutes together come first, or the rules below would only see one half ("1 hour 30 minutes" as 30).
  const both = t.match(/\b(\d+|one|two|an?)\s*(?:h|hrs?|hours?)\s*(?:and\s*)?(\d+|thirty)\s*(?:m|mins?|minutes?)\b/)
  if (both) {
    const count = (word) => ({ a: 1, an: 1, one: 1, two: 2, thirty: 30 })[word] ?? Number(word)
    return count(both[1]) * 60 + count(both[2])
  }
  if (/\b(30|thirty)\s*(m|mins?|minutes?)\b|half( an)? hour/.test(t) || only('30|thirty')) return 30
  if (/\b(90|ninety)\s*(m|mins?|minutes?)\b|\b(an? )?hour and a half\b/.test(t) || only('90|ninety')) return 90
  if (/\b(2|two)\s*(h|hrs?|hours?)\b/.test(t) || only('2|two')) return 120
  if (/\b(1|one|an?)\s*(h|hrs?|hours?)\b|\bhour\b/.test(t) || only('1|one')) return 60
  return null
}
