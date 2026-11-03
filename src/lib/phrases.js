// Nudged's stock lines, grouped by what just happened. Warm, cheeky and punny, and the joke is always on
// the task or on Nudged, never a label for the person (no "procrastinator", "lazy").
// Each context has a few lines; the caller's seed rotates through them.
const line = (list, seed = 0) => list[Math.abs(seed) % list.length]

// A task was just completed. Context says what kind of finish it was.
const CELEBRATE = {
  plain: [
    (n, t) => `${n}! "${t}": DONE. Look at you, a whole professional.`,
    (n, t) => `"${t}" has left the chat. Gone. Handled. Iconic, ${n}.`,
    (n) => `One off the list, ${n}. My finger is clapping.`,
    (n, t) => `"${t}"? Sorted. Smooth, ${n}.`,
  ],
  early: [
    (n, t) => `"${t}" done before it was even due, ${n}. Future you says thanks in advance.`,
    (n) => `Ahead of schedule, ${n}. I didn't even get to nudge.`,
    (n, t) => `Early! "${t}" never saw it coming, ${n}.`,
  ],
  late: [
    (n, t) => `"${t}" is off the overdue list, ${n}. Clean slate.`,
    (n) => `Overdue no more. Nicely done, ${n}.`,
    (n, t) => `There it is: "${t}", sorted. Just applause from me, ${n}.`,
  ],
  proof: [
    (n, t) => `Pics AND done. "${t}" is officially real, ${n}.`,
    (n) => `Evidence logged, ${n}. The bonus is yours.`,
    (n, t) => `"${t}", with receipts. Chef's kiss, ${n}.`,
  ],
  recurring: [
    (n, t) => `"${t}" done, and I'll bring it back at its next time, ${n}.`,
    (n) => `Another one banked, ${n}. That's how streaks are made.`,
    (n, t) => `"${t}" ticked. See you at the next one, ${n}.`,
  ],
  allClear: [
    (n) => `Everything's done, ${n}. The list is empty. Enjoy it.`,
    (n) => `List cleared, ${n}. Go and stare at a cloud.`,
    (n) => `That's the lot, ${n}. I have nothing left to nudge you about. Odd feeling.`,
  ],
}

// A task was just snoozed. First time, or again.
const SNOOZE = {
  first: [
    (n, d) => `Snoozed for ${d}. I'll be back, ${n}. I always come back.`,
    (n, d) => `${d[0].toUpperCase()}${d.slice(1)}, ${n}. Then I'm nudging again.`,
  ],
  again: [
    (n, d) => `Snoozed again. Noted, ${n}. ${d[0].toUpperCase()}${d.slice(1)} from now.`,
    (n) => `Round two of snooze. I'll keep the seat warm, ${n}.`,
  ],
}

export const celebrationLine = (context, name, title, seed) => line(CELEBRATE[context] ?? CELEBRATE.plain, seed)(name, title)
export const snoozeLine = (again, name, seed, duration = 'an hour') => line(again ? SNOOZE.again : SNOOZE.first, seed)(name, duration)

// Greetings, by time of day, so "hey" at 7am and at 1am don't get the same hello.
const GREET = {
  morning: [(n, b) => `Morning, ${n}! ${b} here, finger warmed up.`, (n) => `Rise and nudge, ${n}.`],
  afternoon: [(n, b) => `Afternoon, ${n}! ${b} at your service.`, (n) => `Hey ${n}! Hope the day's being kind.`],
  evening: [(n, b) => `Evening, ${n}. ${b} is still up.`, (n) => `Well hello, ${n}.`],
  night: [(n) => `Still up, ${n}? Same. What are we remembering?`, (n, b) => `${b} doesn't sleep. Hi, ${n}.`],
}
export function greetingLine(name, buddy, seed, hour) {
  const when = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night'
  return line(GREET[when], seed)(name, buddy)
}

// Is the message only a hello? "hey Nudged", "hi Moyo's Nudged", "good morning", "hello Moyo". The only words
// allowed after the greeting are the names it could be aimed at, so "hi buy milk" still goes to the model.
const HELLOS = new Set(['hey', 'hi', 'hiya', 'hello', 'heya', 'yo', 'sup', 'howdy', 'hola'])
const FILLER = ['there', 'friend', 'buddy', 'mate', 'pal', 'everyone']
export function isGreeting(text, names = []) {
  const allowed = new Set(['nudged', 'nudgy', ...FILLER])
  for (const n of names) {
    for (const w of String(n ?? '').toLowerCase().split(/\s+/).filter(Boolean)) {
      allowed.add(w)
      allowed.add(w.replace(/['\u2019]s$/, ''))
    }
  }
  let words = String(text).toLowerCase().replace(/[^\p{L}'\u2019\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return false
  if (words[0] === 'good' && ['morning', 'afternoon', 'evening', 'night'].includes(words[1])) words = words.slice(2)
  else if (HELLOS.has(words[0])) words = words.slice(1)
  else return false
  return words.every((w) => allowed.has(w) || allowed.has(w.replace(/['\u2019]s$/, '')))
}
