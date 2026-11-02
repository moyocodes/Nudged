// Photo proof with SAM 3.1, in the two calls Meta's playground "Get code" shows:
//   1) upload the photo to /v1/files, 2) /v1/responses with the file id and a noun phrase to find.
// The API key stays on the server. Only runs when someone adds a photo on the Proof page.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const apiBase = () => process.env.META_API_BASE || 'https://api.meta.ai/v1'
const DEBUG_FILE = path.join(import.meta.dirname, 'data', 'last-sam.json')
const seen = new Map() // same photo + same phrase isn't sent twice

// The streamed answer is "data: {json}" lines; a plain JSON answer is handled too.
export function parseEvents(text) {
  const events = []
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue
    const body = line.slice(5).trim()
    if (!body || body === '[DONE]') continue
    try { events.push(JSON.parse(body)) } catch {}
  }
  if (!events.length) { try { events.push(JSON.parse(text)) } catch {} }
  return events
}

// Did it find the thing? A match comes back in the text stream as <|box;...|><|mask;...|>; no match finishes with empty text.
// found: true (a box), false (finished with none), null (cut off before finishing, so we can't tell).
export function interpret(events) {
  const hasBox = (value) => typeof value === 'string' ? value.includes('<|box;') : !!value && typeof value === 'object' && Object.values(value).some(hasBox)
  if (events.some(hasBox)) return { found: true }
  return { found: events.some((e) => e.type === 'response.completed') ? false : null }
}

export async function findInPhoto({ image, phrase }) {
  const model = process.env.SAM_MODEL_NAME
  const key = process.env.MODEL_API_KEY
  if (!model || !key) throw new Error('Set MODEL_API_KEY and SAM_MODEL_NAME in .env')

  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(image)
  if (!m) throw new Error('That is not a photo I can read')
  const photo = Buffer.from(m[2], 'base64')
  if (photo.length > 1_200_000) throw new Error('That photo is too big')

  const cacheKey = `${crypto.createHash('sha1').update(photo).digest('hex')}|${phrase.toLowerCase()}`
  if (seen.has(cacheKey)) return seen.get(cacheKey)

  const form = new FormData()
  form.append('purpose', 'user_data')
  form.append('file', new Blob([photo], { type: m[1] }), 'upload.jpg')
  const up = await fetch(`${apiBase()}/files`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form })
  const upText = await up.text()
  if (!up.ok) throw new Error(`Photo upload failed (${up.status})`)
  const fileId = JSON.parse(upText).id
  if (typeof fileId !== 'string' || !fileId) throw new Error('Photo upload gave no file id')

  const res = await fetch(`${apiBase()}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      model,
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: phrase }, { type: 'input_image', file_id: fileId }] }],
      stream: true,
      metadata: { mask_encoding: 'lossless' },
    }),
  })
  const text = await res.text()
  try {
    fs.mkdirSync(path.dirname(DEBUG_FILE), { recursive: true })
    fs.writeFileSync(DEBUG_FILE, JSON.stringify({ phrase, status: res.status, answer: text.slice(0, 60000) }))
  } catch {}
  if (!res.ok) throw new Error(`Photo check failed (${res.status})`)

  const result = interpret(parseEvents(text))
  console.log(`[usage] model=${model} photo_bytes=${photo.length} found=${result.found}`)
  seen.set(cacheKey, result)
  return result
}
