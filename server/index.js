import 'dotenv/config'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import express from 'express'
import OpenAI from 'openai'
import { WebSocket, WebSocketServer } from 'ws'
import { deviceFor, mountAuth, requireSession } from './auth.js'
import { mountReminders } from './reminders.js'
import { findInPhoto } from './sam.js'
import { BADGE_IDS, badgePrompt, generateImage } from './image.js'

const app = express()
// Synced state carries small photo thumbnails, so allow more than the 100kb default.
app.use(express.json({ limit: '2mb' }))
mountAuth(app)
mountReminders(app)

// Created on first request, not at startup.
let client
function getClient() {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://api.meta.ai/v1',
      apiKey: process.env.MODEL_API_KEY,
    })
  }
  return client
}

app.post('/api/test', requireSession, async (_req, res) => {
  try {
    const model = process.env.MODEL_NAME
    if (!model || !process.env.MODEL_API_KEY) {
      return res.status(500).json({ error: 'Set MODEL_API_KEY and MODEL_NAME in .env' })
    }
    const r = await getClient().responses.create({
      model,
      input: 'Say hi in one cheeky sentence. Never flirty.',
      max_output_tokens: 300,
      reasoning: { effort: 'low' },
    })
    console.log(
      `[usage] model=${model} input_tokens=${r.usage?.input_tokens} output_tokens=${r.usage?.output_tokens}`,
    )
    res.json({ reply: r.output_text })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// Brain-dump -> tasks plus a one-line reply in Nudgy's voice.
// Only called when the user presses Add tasks / Enter. Same text on the same day is served from cache.
const EXTRACT_PROMPT = `You are Nudgy, a cheeky, warm reminder buddy (never flirty, mean or medical). Input may be messy speech-to-text; work out what they mean.
Return ONLY compact JSON, omitting null/false/empty fields:
{"reply":str,"followup"?:str,"actions"?:[{"type":"done"|"delete"|"snooze"|"update"|"undo","n":num,"due"?,"title"?,"priority"?,"repeat"?,"proof"?,"proofOf"?}],"tasks"?:[{"title":str,"due"?,"priority":"low"|"medium"|"high","proof"?:true,"proofOf"?:str,"ask"?:{"kind":"when"|"who"|"what"|"how"|"why","text":str},"repeat"?:[{"days":[0-6],"time":"HH:mm"}]}]}
- Only items in tasks/actions get saved. Scan the whole text for EVERY possible reminder (tasks, errands, appointments, deadlines, commitments, things to remember, even implied ones like "mum's birthday Friday"); each is its own task, never merged or dropped. If something might be a reminder but is unclear, or nothing was saved and it isn't chit-chat, set followup: one short punny question asking what or when. If there is no reminder in it at all and it isn't chit-chat, say so plainly in reply ("I couldn't find a reminder in that") and set followup offering one ("Want me to set a reminder about something?").
- reminders: user's open list, numbered. Text about one (done, cancel, move, rename, snooze) = action with its n, never a duplicate task. "undo" = {"type":"undo"}. [asked: …] = waiting on your question; an answer = update actions (due, or title for who/what). selected = text is instructions for that n. "split into X and Y" = delete + 2 tasks.
- recent chat is context only; don't re-add from it. Greetings or chat ("hey Nudgy", "thanks") are not tasks; just reply.
- title: short imperative, filler dropped, mishearings fixed. due: local "YYYY-MM-DDTHH:mm" from now, taking any weekday or date from the calendar (never work it out yourself); if the weekday and date they give disagree, ask which they meant instead of guessing; bare 1-6 = PM; a shared time applies to joined tasks. priority: judge the stakes and how they say it, not keywords. high: a firm deadline today or tomorrow, money, health, travel, school, work or legal duties, someone relying on them, or they stress it ("must", "can't forget", "again", "finally"). low: optional or no deadline ("maybe", "sometime", "if I get to it"), treats, ideas, tidying. Otherwise medium; when unsure, medium.
- repeat: recurring only; days 0=Sun; no time = one daily time (due, else 09:00); due = next slot. repeat:null in an update stops it.
- proof: true when finishing means being somewhere or leaves something to photograph: buying or picking up an item, cleaning, tidying, packing, cooking, fixing, posting a parcel, going to a place or an appointment, attending or joining a meeting or event. Not for calls, messages, emails, online payments, bookings, decisions or things to remember. proofOf: the short noun phrase the photo should show ("oat milk carton", "meeting room"). In an update action, proof true or false (with proofOf) when they ask for a photo on a reminder or drop it.
- ask: one short punny question only if essential info is missing; don't ask what you can infer.
- reply: one witty sentence using their name, never labelling them; never list tasks or claim you saved anything.`

const extractCache = new Map()

// What the user calls their Nudgy ("Moyo's Nudgy"): plain words only, so it can't smuggle instructions in.
const cleanBuddy = (b) => String(b ?? '').replace(/["\\\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24)
// Which host serves an open-weights model, read from its base URL, for the "via" label the app shows.
const hostOf = (url) => (/baseten/.test(url) ? 'Baseten' : /fireworks/.test(url) ? 'Fireworks' : /modal/.test(url) ? 'Modal' : 'open weights')
const withBuddy = (prompt, buddy) => (buddy && buddy !== 'Nudgy' ? prompt.replace('You are Nudgy', `You are Nudgy, whom the user calls "${buddy}"`) : prompt)

// Models are bad at weekday arithmetic, so when the text mentions a day or date we hand over a calendar.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DATE_WORDS = /\b(mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{1,2}(st|nd|rd|th)\b|\bnext\b/i
function calendarFor(now) {
  const base = new Date(`${String(now).slice(0, 10)}T12:00:00`)
  if (isNaN(base)) return { weekday: '', calendar: '' }
  const calendar = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${DAYS[d.getDay()]}`
  }).join(', ')
  return { weekday: DAYS[base.getDay()], calendar }
}
const ASK_KINDS = ['when', 'who', 'what', 'how', 'why']

// The model's output is only trusted after this: no title means no task, and a due that
// isn't a real "YYYY-MM-DDTHH:mm" is dropped and turned into a "when" question instead.
function cleanTask(t) {
  const title = typeof t?.title === 'string' ? t.title.trim() : ''
  if (!title) return null
  const due = typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.due) && !isNaN(new Date(t.due)) ? t.due.slice(0, 16) : null
  let ask = t.ask?.text ? { kind: ASK_KINDS.includes(t.ask.kind) ? t.ask.kind : 'what', text: String(t.ask.text) } : null
  if (t.due && !due && !ask) ask = { kind: 'when', text: `When should I nudge you about "${title}"? I lost the time somewhere.` }
  return { title, due, priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium', proof: !!t.proof, proofOf: t.proof && typeof t.proofOf === 'string' ? t.proofOf.trim().slice(0, 60) : '', ask, repeat: cleanRepeat(t.repeat) }
}

// Actions on existing reminders: known types only, n must point at a listed reminder.
const ACTION_TYPES = ['done', 'delete', 'snooze', 'update', 'undo']
function cleanActions(actions, count) {
  if (!Array.isArray(actions)) return []
  return actions
    .filter((a) => ACTION_TYPES.includes(a?.type) && (a.type === 'undo' || (Number.isInteger(a.n) && a.n >= 1 && a.n <= count)))
    .map((a) => {
      if (a.type !== 'update') return { type: a.type, n: a.n }
      const changes = {}
      if (typeof a.due === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(a.due) && !isNaN(new Date(a.due))) changes.due = a.due.slice(0, 16)
      if (typeof a.title === 'string' && a.title.trim()) changes.title = a.title.trim()
      if (['low', 'medium', 'high'].includes(a.priority)) changes.priority = a.priority
      // repeat: slots to start/change repeating, null to stop; absent means leave it alone.
      if ('repeat' in a) changes.repeat = cleanRepeat(a.repeat)
      if (typeof a.proof === 'boolean') {
        changes.proof = a.proof
        if (a.proof && typeof a.proofOf === 'string' && a.proofOf.trim()) changes.proofOf = a.proofOf.trim().slice(0, 60)
      }
      return { type: 'update', n: a.n, ...changes }
    })
    .filter((a) => a.type !== 'update' || Object.keys(a).length > 2)
}

// Repeat slots must be real weekdays (0-6) and "HH:mm" times, or the task just doesn't repeat.
function cleanRepeat(repeat) {
  if (!Array.isArray(repeat)) return null
  const slots = repeat
    .map((s) => ({
      days: [...new Set((Array.isArray(s?.days) ? s.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(),
      time: typeof s?.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) ? s.time : null,
    }))
    .filter((s) => s.days.length && s.time)
  return slots.length ? slots : null
}

// The router: Muse Glimmer on Fireworks, serverless and paid per token. On with ROUTER_API_KEY and ROUTER_MODEL.
// It sorts each chat message: plain chat ("hey", "thanks") is answered here; anything that might add, change
// or finish a reminder goes to Muse Spark. When unsure, or if the call fails, it's Muse Spark as before.
const ROUTER_PROMPT = `You are Nudgy, a cheeky, warm reminder buddy (never flirty, mean or medical). Sort the user's message.
Return ONLY JSON: {"route":"chat","reply":str} or {"route":"spark"}.
- chat: greetings, thanks, small talk, questions about you, with nothing to remember, add, change, finish, snooze or delete. reply: one witty sentence using their name.
- spark: anything else, including anything that might be a task, plan, date, time or update. When unsure, spark.`

let routerClient
const routerEnabled = () => !!process.env.ROUTER_API_KEY && !!process.env.ROUTER_MODEL

async function routeMessage(text, name, buddy, recent) {
  routerClient ??= new OpenAI({ baseURL: process.env.ROUTER_BASE_URL || 'https://api.fireworks.ai/inference/v1', apiKey: process.env.ROUTER_API_KEY })
  try {
    const r = await routerClient.chat.completions.create({
      model: process.env.ROUTER_MODEL,
      messages: [
        { role: 'system', content: withBuddy(ROUTER_PROMPT, buddy) },
        { role: 'user', content: `name: ${name || 'friend'}\n${recent ? `recent chat:\n${recent}\n` : ''}text: ${text}` },
      ],
      max_tokens: 1000,
      reasoning_effort: 'low',
    })
    console.log(`[usage] step=router model=${process.env.ROUTER_MODEL} input_tokens=${r.usage?.prompt_tokens} output_tokens=${r.usage?.completion_tokens}`)
    const out = r.choices?.[0]?.message?.content ?? ''
    const json = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1))
    console.log(`[router] ${json.route}`)
    if (json.route !== 'chat' || typeof json.reply !== 'string' || !json.reply.trim()) return null
    return { reply: json.reply.trim().slice(0, 300), followup: '', actions: [], tasks: [], via: `Muse Glimmer · ${hostOf(process.env.ROUTER_BASE_URL || 'fireworks')}` }
  } catch (err) {
    console.error('[router]', err.message)
    return null
  }
}

app.post('/api/extract', requireSession, async (req, res) => {
  const { text, now, name, history, reminders, selected } = req.body ?? {}
  const buddy = cleanBuddy(req.body?.buddy)
  if (!text?.trim()) return res.status(400).json({ error: 'No text' })
  const model = process.env.MODEL_NAME
  if (!model || !process.env.MODEL_API_KEY) {
    return res.status(500).json({ error: 'Set MODEL_API_KEY and MODEL_NAME in .env' })
  }

  // The last few messages, trimmed, so follow-ups make sense without resending the whole chat.
  const recent = (Array.isArray(history) ? history : [])
    .slice(-4)
    .map((m) => `${m?.from === 'you' ? 'user' : 'nudgy'}: ${String(m?.text ?? '').slice(0, 150)}`)
    .join('\n')

  // Open reminders, one short line each, so "I called mum" can tick off the right one.
  const list = (Array.isArray(reminders) ? reminders : [])
    .slice(0, 25)
    .map((r, i) => `${i + 1}. ${String(r?.title ?? '').slice(0, 80)}${r?.due ? ` (${String(r.due).slice(0, 16)})` : ''}${r?.ask ? ` [asked: ${String(r.ask).slice(0, 120)}]` : ''}`)
  const listCount = list.length
  const pick = Number.isInteger(selected) && selected >= 1 && selected <= listCount ? selected : null

  const { weekday, calendar: fullCalendar } = calendarFor(now)
  const calendar = DATE_WORDS.test(text) ? fullCalendar : ''

  const key = `${String(now).slice(0, 10)}|${name}|${buddy}|${recent}|${list.join(';')}|${pick}|${text.trim().toLowerCase()}`
  if (extractCache.has(key)) return res.json(extractCache.get(key))

  // Muse Glimmer reads the message first. Plain chat gets its reply right there; anything that might be a
  // reminder goes on to Muse Spark. Skipped while a question is waiting or a reminder is selected, since the
  // answer then edits the list.
  if (routerEnabled() && !pick && !list.some((l) => l.includes('[asked:'))) {
    const routed = await routeMessage(text.trim(), name, buddy, recent)
    if (routed) {
      extractCache.set(key, routed)
      return res.json(routed)
    }
  }

  try {
    const r = await getClient().responses.create({
      model,
      instructions: withBuddy(EXTRACT_PROMPT, buddy),
      input: `now: ${now}${weekday ? ` (${weekday})` : ''}\n${calendar ? `calendar: ${calendar}\n` : ''}name: ${name || 'friend'}\n${listCount ? `reminders:\n${list.join('\n')}\n` : ''}${pick ? `selected: ${pick}\n` : ''}${recent ? `recent chat:\n${recent}\n` : ''}text: ${text.trim()}`,
      // Muse Spark can spend ~800 tokens just reasoning on "low", so 800 left nothing for the JSON.
      max_output_tokens: 2000,
      reasoning: { effort: 'low' },
    })
    console.log(`[usage] model=${model} input_tokens=${r.usage?.input_tokens} output_tokens=${r.usage?.output_tokens}`)
    if (!r.output_text?.includes('{')) {
      console.error('[extract] no JSON in reply', r.status, JSON.stringify(r.incomplete_details), JSON.stringify(r.usage), JSON.stringify(r.output_text?.slice(0, 300)))
      throw new Error(`Model returned no JSON (status ${r.status}${r.incomplete_details ? `, ${r.incomplete_details.reason}` : ''})`)
    }
    const json = JSON.parse(r.output_text.slice(r.output_text.indexOf('{'), r.output_text.lastIndexOf('}') + 1))
    const result = { reply: String(json.reply ?? ''), followup: typeof json.followup === 'string' ? json.followup.slice(0, 200) : '', actions: cleanActions(json.actions, listCount), tasks: (Array.isArray(json.tasks) ? json.tasks : []).map(cleanTask).filter(Boolean), via: 'Muse Spark' }
    extractCache.set(key, result)
    res.json(result)
  } catch (err) {
    console.error('[extract]', err.message)
    res.status(502).json({ error: err.message })
  }
})

// Photo proof: SAM 3.1 looks for the task's object in the photo. Called once, when a photo is added.
app.post('/api/proof', requireSession, async (req, res) => {
  const { image, phrase } = req.body ?? {}
  const what = typeof phrase === 'string' ? phrase.trim().slice(0, 80) : ''
  if (!what || typeof image !== 'string') return res.status(400).json({ error: 'Need a photo and what to look for' })
  try {
    res.json({ ...(await findInPhoto({ image, phrase: what })), via: 'SAM 3.1' })
  } catch (err) {
    console.error('[proof]', err.message)
    res.status(502).json({ error: err.message })
  }
})

// Personal badge art with Muse Image. Only when a user taps "Create my badge" on a badge they've earned.
// A server-wide daily cap (MAX_IMAGES_PER_DAY, default 20) protects the credits; repeats come from the cache.
let imageDay = ''
let imageCount = 0
const badgeCache = new Map()
function takeImageSlot() {
  const day = new Date().toDateString()
  if (day !== imageDay) { imageDay = day; imageCount = 0 }
  if (imageCount >= (Number(process.env.MAX_IMAGES_PER_DAY) || 20)) return false
  imageCount++
  return true
}

// Muse Spark turns the plain badge brief into a richer prompt for Muse Image: composition, lighting, mood and
// small details drawn from what the user really did. One short call per new badge; if it fails, the plain brief is used.
const ART_PROMPT = `You write prompts for an image model. From the badge brief, write ONE vivid prompt, max 90 words: a single round sticker badge, flat vector style with a thick dark outline, cheeky and warm. Say what is in the middle, what small details sit around it (drawn from the user's tasks), the lighting, and the mood. Keep the brief's colours. No text, letters or numbers anywhere in the picture. Reply with the prompt only.`
const NO_TEXT = ' No text, no letters, no numbers.'
async function writeArtPrompt(brief) {
  const model = process.env.MODEL_NAME
  if (!model || !process.env.MODEL_API_KEY) return brief
  try {
    const r = await getClient().responses.create({
      model,
      instructions: ART_PROMPT,
      input: brief,
      max_output_tokens: 1000,
      reasoning: { effort: 'low' },
    })
    console.log(`[usage] model=${model} step=badge-prompt input_tokens=${r.usage?.input_tokens} output_tokens=${r.usage?.output_tokens}`)
    const text = r.output_text?.trim().replace(/^"|"$/g, '')
    if (!text || text.length < 40 || text.length > 900) return brief
    return text.replace(/\s+/g, ' ') + NO_TEXT
  } catch (err) {
    console.warn('[badge] prompt writer failed, using the plain brief:', err.message)
    return brief
  }
}

app.post('/api/badge', requireSession, async (req, res) => {
  const { badge, context, fresh } = req.body ?? {}
  if (!BADGE_IDS.includes(badge)) return res.status(400).json({ error: 'Unknown badge' })
  const brief = badgePrompt(badge, context)
  if (!fresh && badgeCache.has(brief)) return res.json({ image: badgeCache.get(brief), via: 'Muse Spark + Muse Image' })
  if (!takeImageSlot()) return res.status(429).json({ error: "That's all the badge art for today. Try again tomorrow." })
  try {
    const prompt = await writeArtPrompt(brief)
    const image = `data:image/png;base64,${(await generateImage(prompt)).toString('base64')}`
    badgeCache.set(brief, image)
    res.json({ image, via: 'Muse Spark + Muse Image' })
  } catch (err) {
    console.error('[badge]', err.message)
    res.status(502).json({ error: "Couldn't draw that just now. Try again in a bit." })
  }
})

// One nudge line for a task that's due. Called by the browser's scheduler (one task per minute at most)
// or the "Nudge me" button. The browser keeps a canned line as backup if this fails.
const NUDGE_PROMPT = `You are Nudgy, a cheeky, warm reminder buddy. Never flirty, mean or medical, and never label the person (no "procrastinator" or "lazy"): joke about the task or yourself. No pet names (love, gorgeous, babe, darling, sweetie) and no winks or kissy emoji.
Write ONE reminder line, max 20 words, to the user by name about their task. Say it in plain everyday words, like a funny friend texting, so it makes sense on first read. Name the task clearly. No twisted words or forced puns; a joke only if it's instantly obvious. Don't mention nudges or levels. Level 1 is light, 4 is dramatic and over the top. Reply with the line only.`

// Nudge lines can come from an open-weights Meta model (Muse Spark Open or Muse Glimmer) hosted on Modal, Baseten
// or Fireworks, through an OpenAI-style chat endpoint. Turned on with NUDGE_ENGINE=open plus OPEN_BASE_URL,
// OPEN_API_KEY and OPEN_MODEL. If it fails, the nudge falls back to Muse Spark, so a nudge is never lost.
const openEnabled = () => process.env.NUDGE_ENGINE === 'open' && !!process.env.OPEN_BASE_URL && !!process.env.OPEN_API_KEY && !!process.env.OPEN_MODEL
// Muse Spark Open on Modal too, for anyone who picks it on the Me page. On with MODAL_BASE_URL, MODAL_API_KEY and MODAL_MODEL.
const modalEnabled = () => !!process.env.MODAL_BASE_URL && !!process.env.MODAL_API_KEY && !!process.env.MODAL_MODEL
const openHosts = {
  open: () => ({ baseURL: process.env.OPEN_BASE_URL, apiKey: process.env.OPEN_API_KEY, model: process.env.OPEN_MODEL }),
  modal: () => ({ baseURL: process.env.MODAL_BASE_URL, apiKey: process.env.MODAL_API_KEY, model: process.env.MODAL_MODEL }),
}
const openClients = {}
async function openNudge(instructions, input, host = 'open') {
  const { baseURL, apiKey, model } = openHosts[host]()
  openClients[host] ??= new OpenAI({ baseURL, apiKey })
  const r = await openClients[host].chat.completions.create({
    model,
    messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }],
    // Open models can spend part of this on reasoning before the line, as Muse Spark did. 1000 is the project cap;
    // raise OPEN_MAX_TOKENS only if the log shows finish_reason=length with no text.
    max_tokens: Number(process.env.OPEN_MAX_TOKENS) || 1000,
    temperature: 0.8,
    reasoning_effort: 'low',
  })
  console.log(`[usage] engine=${host} model=${model} input_tokens=${r.usage?.prompt_tokens} output_tokens=${r.usage?.completion_tokens}`)
  // Some open models write their reasoning inline; keep only what follows it.
  const text = String(r.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim().replace(/^"|"$/g, '')
  // Cut off by the cap means half a line: Muse Spark takes over instead.
  if (!text || r.choices?.[0]?.finish_reason === 'length') throw new Error(`Open model returned no full line (${r.choices?.[0]?.finish_reason ?? 'no reason'})`)
  return text
}

app.post('/api/nudge', requireSession, async (req, res) => {
  const { name, title, level, due, now, engine } = req.body ?? {}
  const buddy = cleanBuddy(req.body?.buddy)
  if (!title) return res.status(400).json({ error: 'No task' })
  const input = `name: ${name || 'friend'}\ntask: ${title}\nlevel: ${level}\n${due ? `due: ${due}\nnow: ${now}` : 'no due time'}`
  if (engine === 'modal' && modalEnabled()) {
    try {
      return res.json({ text: await openNudge(withBuddy(NUDGE_PROMPT, buddy), input, 'modal'), engine: 'modal', via: 'Muse Spark Open · Modal' })
    } catch (err) {
      console.error('[nudge] modal failed, using Muse Spark:', err.message)
    }
  } else if (engine !== 'spark' && openEnabled()) {
    try {
      return res.json({ text: await openNudge(withBuddy(NUDGE_PROMPT, buddy), input), engine: 'open', via: `Muse Spark Open · ${hostOf(process.env.OPEN_BASE_URL)}` })
    } catch (err) {
      console.error('[nudge] open model failed, using Muse Spark:', err.message)
    }
  }
  const model = process.env.MODEL_NAME
  if (!model || !process.env.MODEL_API_KEY) {
    return res.status(500).json({ error: 'Set MODEL_API_KEY and MODEL_NAME in .env' })
  }
  try {
    const r = await getClient().responses.create({
      model,
      instructions: withBuddy(NUDGE_PROMPT, buddy),
      input,
      // 300 was all spent on reasoning, leaving no line; raised with the user's OK.
      max_output_tokens: 1000,
      reasoning: { effort: 'low' },
    })
    console.log(`[usage] model=${model} input_tokens=${r.usage?.input_tokens} output_tokens=${r.usage?.output_tokens}`)
    const text = r.output_text?.trim().replace(/^"|"$/g, '')
    if (!text) throw new Error(`Model returned no text (status ${r.status}${r.incomplete_details ? `, ${r.incomplete_details.reason}` : ''})`)
    res.json({ text, engine: 'spark', via: 'Muse Spark' })
  } catch (err) {
    console.error('[nudge]', err.message)
    res.status(502).json({ error: err.message })
  }
})

// In production (Render) this one server also serves the built app from dist/.
// Locally Vite serves the app and proxies /api here, so dist/ usually doesn't exist.
const dist = path.join(import.meta.dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  // Client-side routes (/nudges, /settings…) all load index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const server = http.createServer(app)

// Live speech-to-text: the browser streams 16 kHz PCM here, and we relay it to
// Muse Voice Transcribe so the API key never leaves the server.
// Only opened when the user taps the mic; closed when they stop.
const asr = new WebSocketServer({
  server,
  path: '/api/asr',
  verifyClient: ({ req }, done) => deviceFor(req).then((device) => done(!!device, 401), () => done(false, 401)),
})
asr.on('connection', (browser) => {
  const model = process.env.VOICE_MODEL_NAME
  if (!model || !process.env.MODEL_API_KEY) {
    browser.send(JSON.stringify({ type: 'error', message: 'Set MODEL_API_KEY and VOICE_MODEL_NAME in .env' }))
    return browser.close()
  }

  const upstream = new WebSocket('wss://api.meta.ai/v1/asr/realtime')
  let ready = false
  let pending = []
  let audioBytes = 0

  upstream.on('open', () => {
    upstream.send(
      JSON.stringify({
        authorization: { accessToken: `Bearer ${process.env.MODEL_API_KEY}` },
        audioEncoding: 'PCM_16KHZ',
        model,
        mode: 'ENDPOINTING',
        partialMode: 'CUMULATIVE',
        emitAudioProgress: false,
      }),
    )
  })

  upstream.on('message', (data, isBinary) => {
    if (isBinary) return
    const msg = JSON.parse(data.toString())
    if (!ready && msg.sessionId && !msg.type) {
      ready = true
      pending.forEach((chunk) => upstream.send(chunk))
      pending = []
      return
    }
    if (browser.readyState === WebSocket.OPEN) browser.send(data.toString())
  })

  upstream.on('close', () => browser.close())
  upstream.on('error', (err) => {
    console.error('[asr] upstream error', err.message)
    browser.close()
  })

  browser.on('message', (data, isBinary) => {
    if (!isBinary) return
    audioBytes += data.length
    if (ready) upstream.send(data)
    else pending.push(data)
  })

  browser.on('close', () => {
    // 16 kHz * 2 bytes per sample
    console.log(`[usage] model=${model} audio_seconds=${(audioBytes / 32000).toFixed(1)}`)
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify({ type: 'endStream' }))
      upstream.close()
    } else {
      upstream.terminate()
    }
  })
})

const port = process.env.PORT || 3001
server.listen(port, () => console.log(`Nudgy server on http://localhost:${port}`))
