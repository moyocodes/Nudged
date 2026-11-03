// Practice conversations for Nudged's intent-spotting, taken from real cases that went wrong or felt off.
// Each turn is what the user says plus what we expect Nudged to pick up. The runner replays them against
// /api/extract, carrying the chat history and reminder list between turns, like the app does.
//
// expect keys (all optional):
//   tasks: n                   exactly n NEW reminders
//   taskIncludes: ['word']     a new reminder mentions each word
//   actions: ['update']        these action types appear (done, delete, update, snooze)
//   actionOn: ['mum']          the non-update actions hit a reminder mentioning these words
//   due: { word: 'YYYY-MM-DD'} the reminder mentioning word ends up due that day (new or updated)
//   repeats: { word: 2 }       the reminder mentioning word repeats with that many time slots
//   asks: true | false         Nudged asks a follow-up question (or not)
//   proof: { word: true|false } the reminder mentioning word does (or doesn't) need a photo

// "Now" for every scenario: a Tuesday, so Nov 3 is Tue, Nov 4 is Wed, Nov 5 is Thu.
export const NOW = '2026-10-27T10:00'

export const scenarios = [
  {
    id: 'date-mismatch',
    title: 'Weekday and date disagree (Tuesday, November 4th)',
    turns: [
      { say: 'remind me to pay rent on Tuesday, November 4th', expect: { asks: true, tasks: 0 } },
      { say: 'wednesday the 4th', expect: { taskIncludes: ['rent'], due: { rent: '2026-11-04' } } },
    ],
  },
  {
    id: 'dentist',
    title: 'One messy message, then answers as a conversation',
    turns: [
      { say: "ugh ok dentist?? oat milk. also yinka's tmrw like 5pm", expect: { tasks: 3, taskIncludes: ['dentist', 'milk', 'yinka'], due: { yinka: '2026-10-28' }, asks: true } },
      { say: 'dentist is at 2', expect: { tasks: 0, actions: ['update'], due: { dentist: '2026-10-27' } } },
      { say: "oat milk tonight, and forget about yinka's", expect: { actions: ['delete'], actionOn: ['yinka'] } },
    ],
  },
  {
    id: 'work-visit',
    title: 'Nudged asks when, user answers for two things at once',
    turns: [
      { say: 'go to work tomorrow and visit Ayomide', expect: { tasks: 2, taskIncludes: ['work', 'ayomide'], asks: true } },
      { say: 'work is at 9, Ayomide 5:30', expect: { tasks: 0, actions: ['update'], due: { work: '2026-10-28', ayomide: '2026-10-28' } } },
    ],
  },
  {
    id: 'plumber-rent',
    title: 'Two reminders, one with a time and one without',
    turns: [
      { say: 'call the plumber and pay rent on wednesday 4th', expect: { tasks: 2, taskIncludes: ['plumber', 'rent'], due: { rent: '2026-11-04' }, asks: true } },
    ],
  },
  {
    id: 'no-intent',
    title: "No reminder in it: say so and offer, don't invent one",
    turns: [
      { say: 'I had a really weird day honestly', expect: { tasks: 0, actions: [] } },
      { say: 'yeah remind me to text Sam', expect: { tasks: 1, taskIncludes: ['sam'] } },
    ],
  },
  {
    id: 'recurring',
    title: 'Repeats at different times of day',
    turns: [
      { say: 'drink water every weekday at 8 and 3', expect: { tasks: 1, taskIncludes: ['water'], repeats: { water: 2 } } },
    ],
  },
  {
    id: 'existing',
    title: 'Acting on reminders that already exist (no duplicates)',
    reminders: [{ title: 'Call mum back' }, { title: 'Renew passport' }],
    turns: [
      { say: 'I called mum', expect: { tasks: 0, actions: ['done'], actionOn: ['mum'] } },
      { say: 'push the passport to friday', expect: { tasks: 0, actions: ['update'], due: { passport: '2026-10-30' } } },
    ],
  },
  {
    id: 'stamps-dentist',
    title: 'Three-turn conversation',
    turns: [
      { say: 'buy stamps and book the dentist', expect: { tasks: 2, taskIncludes: ['stamps', 'dentist'], asks: true } },
      { say: 'stamps tonight', expect: { tasks: 0, actions: ['update'], due: { stamps: '2026-10-27' } } },
      { say: 'dentist sometime next week, I will tell you the day later', expect: { tasks: 0 } },
    ],
  },
  {
    id: 'proof-sorting',
    title: 'Which reminders need a photo (and changing it by talking)',
    turns: [
      { say: 'buy oat milk, call the bank, clean the kitchen, email Sam and join the weekly team meeting', expect: { tasks: 5, taskIncludes: ['milk', 'bank', 'kitchen', 'sam', 'meeting'], proof: { milk: true, kitchen: true, meeting: true, bank: false, sam: false } } },
      { say: 'the bank one needs a photo too actually', expect: { tasks: 0, actions: ['update'], proof: { bank: true } } },
    ],
  },
]
