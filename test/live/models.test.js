// Real model calls through the real server, with the models named in .env. Run with npm run test:live.
// Accounts live in a throwaway database and no emails go out; the models are the real ones.
import fs from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { localIso, startServer } from '../helpers.js'

let server
let session
const now = new Date()
const nowIso = localIso(now)
const dayFrom = (days) => {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return localIso(d).slice(0, 10)
}

beforeAll(async () => {
  server = await startServer()
  ;({ session } = await server.signUp())
})
afterAll(() => {
  // What each call used, from the server's own [usage] lines.
  console.log(server?.logs().split('\n').filter((l) => l.startsWith('[usage]') || /failed|using Muse Spark/.test(l)).join('\n'))
  server?.stop()
})

const post = async (route, body) => {
  const r = await server.call('POST', route, { body, session })
  expect(r.status, r.text.slice(0, 300)).toBe(200)
  return r.json
}
const extract = (text, extra) => post('/api/extract', { text, now: nowIso, name: 'Moyo', ...extra })

// Nudgy's tone rules that can be checked by a program.
const PET_NAMES = /\b(love|gorgeous|babe|baby|darling|sweetie|sweetheart|honey)\b|😘|😉/i

describe.each([
  ['spark', /^Muse Spark · Meta$/],
  ['open', /^Muse Spark Open · /],
  ['modal', /^Muse Spark Open · Modal$/],
])('the %s engine', (engine, via) => {
  it('turns a message into a reminder with the right day', async () => {
    const r = await extract('remind me to pay rent tomorrow at 9am', { engine })
    expect(r.via).toMatch(via)
    expect(r.reply.length).toBeGreaterThan(0)
    expect(r.tasks).toHaveLength(1)
    expect(r.tasks[0].title.toLowerCase()).toContain('rent')
    expect(r.tasks[0].due).toBe(`${dayFrom(1)}T09:00`)
  })

  it('writes a nudge line in tone', async () => {
    const r = await post('/api/nudge', { name: 'Moyo', title: 'Pay rent', level: 2, due: nowIso, now: nowIso, engine })
    expect(r.via).toMatch(via)
    expect(r.text.toLowerCase()).toContain('rent')
    expect(r.text).not.toMatch(PET_NAMES)
  })

  it('writes a check-in line', async () => {
    const r = await post('/api/checkin', { draft: 'remind me to buy', name: 'Moyo', reminders: ['Pay rent'], engine })
    expect(r.via).toMatch(via)
    expect(r.text.trim().length).toBeGreaterThan(0)
    expect(r.text).not.toMatch(PET_NAMES)
  })
})

describe('understanding a brain dump', () => {
  it('finds every reminder in a messy message', async () => {
    const r = await extract("ugh ok dentist?? oat milk. also yinka's tmrw like 5pm", { engine: 'spark' })
    const titles = r.tasks.map((t) => t.title.toLowerCase()).join(' | ')
    expect(titles).toContain('dentist')
    expect(titles).toContain('milk')
    expect(titles).toContain('yinka')
  })

  it('acts on an existing reminder instead of duplicating it', async () => {
    const r = await extract('I called mum', { engine: 'spark', reminders: [{ title: 'Call mum back' }, { title: 'Renew passport' }] })
    expect(r.tasks).toEqual([])
    expect(r.actions).toContainEqual({ type: 'done', n: 1 })
  })

  it('does not invent a reminder from small talk', async () => {
    const r = await extract('hey Nudgy, thanks for yesterday', { engine: 'spark' })
    expect(r.tasks).toEqual([])
    expect(r.actions).toEqual([])
  })

  it('sets up a repeating reminder', async () => {
    const r = await extract('drink water every weekday at 8am and 3pm', { engine: 'spark' })
    expect(r.tasks).toHaveLength(1)
    const times = r.tasks[0].repeat.map((s) => s.time).sort()
    expect(times).toEqual(['08:00', '15:00'])
    expect(r.tasks[0].repeat[0].days).toEqual([1, 2, 3, 4, 5])
  })

  it('serves the same message from its cache', async () => {
    const text = 'remind me to water the plants on friday at noon'
    const first = await extract(text, { engine: 'spark' })
    const before = server.logs().split('[usage]').length
    expect(await extract(text, { engine: 'spark' })).toEqual(first)
    expect(server.logs().split('[usage]').length).toBe(before)
  })
})

describe('Plan my day', () => {
  it('moves an overdue reminder to a real time, and saves nothing itself', async () => {
    const late = new Date(now.getTime() - 3 * 3600000)
    const reminders = [
      { n: 1, id: 'late', title: 'Pay rent', due: localIso(late), priority: 'high' },
      { n: 2, id: 'gym', title: 'Go to the gym', due: `${dayFrom(1)}T18:00`, priority: 'low' },
    ]
    const r = await post('/api/plan', { reminders, schedule: { sleepStart: '00:00', sleepEnd: '07:00' }, now: nowIso })
    expect(r.via).toBe('Muse Spark Agent · Meta')
    expect(r.summary.length).toBeGreaterThan(0)
    const moved = r.changes.find((c) => c.id === 'late')
    expect(moved, JSON.stringify(r)).toBeDefined()
    expect(moved.due > nowIso).toBe(true)
  })
})

describe('photo proof', () => {
  const icon = `data:image/png;base64,${fs.readFileSync('public/icon-192.png').toString('base64')}`

  it('gets an answer from SAM on a real photo', async () => {
    const r = await post('/api/proof', { image: icon, phrase: 'cartoon character' })
    expect(r.via).toMatch(/SAM 3\.1/)
    expect(typeof r.found === 'boolean' || r.found === null).toBe(true)
  })

  it('says no to something clearly not in the picture', async () => {
    const r = await post('/api/proof', { image: icon, phrase: 'red double decker bus' })
    expect(r.found).toBe(false)
  })
})

describe('art', () => {
  const isPng = (image) => Buffer.from(image.split(',')[1], 'base64').subarray(0, 4).toString('hex') === '89504e47'

  it('draws a badge, and serves a repeat from its cache', async () => {
    const body = { badge: 'first', context: { tasks: ['Pay rent'] } }
    const r = await post('/api/badge', body)
    expect(isPng(r.image)).toBe(true)
    expect(r.via).toMatch(/Muse Image/)
    const before = server.logs().split('[usage]').length
    expect((await post('/api/badge', body)).image).toBe(r.image)
    expect(server.logs().split('[usage]').length).toBe(before)
  })

  it('restyles Nudgy', async () => {
    const r = await post('/api/mascot', { look: 'wearing a tiny party hat', palette: ['#5b4be8'] })
    expect(isPng(r.image)).toBe(true)
    expect(r.via).toMatch(/Muse Image/)
  })
})

describe('voice', () => {
  // test/fixtures/speech.wav: "Remind me to call my mum tomorrow", as 16 kHz 16-bit mono.
  it('transcribes real speech through Muse Voice Transcribe', async () => {
    const wav = fs.readFileSync('test/fixtures/speech.wav')
    const pcm = wav.subarray(wav.indexOf('data') + 8)
    const silence = Buffer.alloc(32000 * 2)
    const heard = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/api/asr`, { headers: { Cookie: `nudgy_session=${session}` } })
      let last = ''
      const finish = () => { ws.close(); resolve(last) }
      const timer = setTimeout(finish, 30000)
      ws.on('error', reject)
      ws.on('open', async () => {
        const audio = Buffer.concat([pcm, silence])
        // Real time, like the mic: 100 ms of audio every 100 ms.
        for (let i = 0; i < audio.length && ws.readyState === WebSocket.OPEN; i += 3200) {
          ws.send(audio.subarray(i, i + 3200))
          await new Promise((r) => setTimeout(r, 100))
        }
      })
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'error') { clearTimeout(timer); ws.close(); reject(new Error(msg.message)) }
        if (msg.type === 'transcript') last = msg.transcript
        if (msg.type === 'speechComplete') { last = msg.transcript; clearTimeout(timer); finish() }
      })
    })
    expect(heard.toLowerCase()).toMatch(/call my (mum|mom)/)
  })
})

describe('the log', () => {
  it('has model, input tokens and output tokens for each call', () => {
    const lines = server.logs().split('\n').filter((l) => l.startsWith('[usage]') && l.includes('input_tokens'))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).toMatch(/model=\S+.*input_tokens=\d+ output_tokens=\d+/)
  })
})
