// Muse Image: one picture from a prompt, as a PNG. Used for the per-user badges.
// The API key stays here. Each call costs credits, so callers only run it when a user asks for a badge.
const apiBase = () => process.env.META_API_BASE || 'https://api.meta.ai/v1'

// The image comes back as base64 in the image_generation_call item's "result".
function findImage(json) {
  const item = (json.output ?? []).find((o) => o.type === 'image_generation_call' && typeof o.result === 'string')
  if (item) return item.result
  let found
  const walk = (v, key = '') => {
    if (found) return
    if (typeof v === 'string' && key === 'result' && v.length > 1000) found = v
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  walk(json)
  return found
}

// reference: an image to anchor the picture on, as a data URL.
export async function generateImage(prompt, { reference } = {}) {
  const model = process.env.IMAGE_MODEL_NAME
  const key = process.env.MODEL_API_KEY
  if (!model || !key) throw new Error('Set MODEL_API_KEY and IMAGE_MODEL_NAME in .env')
  const res = await fetch(`${apiBase()}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    // No web or image search, no shell, low reasoning: the cost rules.
    body: JSON.stringify({
      model,
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }, ...(reference ? [{ type: 'input_image', image_url: reference }] : [])] }],
      // The most output tokens one badge may use. 2048 is what Meta's example uses and is known to work;
      // lower it (IMAGE_MAX_OUTPUT_TOKENS) once the [usage] lines show what a badge really takes.
      max_output_tokens: Number(process.env.IMAGE_MAX_OUTPUT_TOKENS) || 2048,
      stream: false,
      store: false,
      tools: [{ type: 'image_generation', output_format: 'png', reasoning_strength: 'low' }],
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Image request failed (${res.status})`)
  const json = JSON.parse(text)
  const b64 = findImage(json)
  if (!b64) {
    // Same trap as before with Muse Spark: a cap that's too low is spent before the image is made.
    if (json.status === 'incomplete') throw new Error(`Ran out of tokens before the image was made (${json.incomplete_details?.reason ?? 'cap too low'}). Raise IMAGE_MAX_OUTPUT_TOKENS.`)
    throw new Error('The answer had no image')
  }
  const png = Buffer.from(b64, 'base64')
  if (png.subarray(0, 4).toString('hex') !== '89504e47') throw new Error('The image was not a PNG')
  console.log(`[usage] model=${model} input_tokens=${json.usage?.input_tokens} output_tokens=${json.usage?.output_tokens} cap=${Number(process.env.IMAGE_MAX_OUTPUT_TOKENS) || 2048} image_bytes=${png.length}`)
  return png
}

// ---- Personal badge prompts ----
// What each badge shows, built from what the user actually did. No text in the picture (models garble
// letters); the user's name goes in the caption the app adds around it.
const STYLE = 'Round badge icon, centered and filling the whole square canvas, flat vector sticker style with a thick dark outline, friendly and cheeky. No text, no letters, no numbers.'
const clean = (s, n = 40) => String(s ?? '').replace(/["\\\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n)
const motif = (tasks) => (tasks.length ? `, with tiny icons for ${tasks.map((t) => `"${t}"`).join(', ')} around the edge` : '')

// The topic of each badge, so the picture says what it was earned for.
const TOPICS = {
  first: 'First one down: the first task finished',
  streak3: 'A 3-day streak: three days running',
  streak5: 'A 5-day streak: five days running',
  ten: '10 tasks crushed: ten things handled',
  proof: "Pics or it didn't happen: sent photo proof, trust but verify",
}

const SUBJECTS = {
  first: (c) => `A bold checkmark on a medal${c.tasks[0] ? `, with a small illustration of "${c.tasks[0]}" tucked in beside it` : ''}. The first tick.`,
  streak3: (c) => `Three flames in a row, warm and cheerful${motif(c.tasks)}. A ${c.streak || 3}-day streak.`,
  streak5: (c) => `Five flames in a row, the middle one tallest and brightest${motif(c.tasks)}. A ${c.streak || 5}-day streak.`,
  ten: (c) => `A golden trophy cup with a checklist ribbon, all items crossed off${motif(c.tasks)}.`,
  proof: (c) => `A "trust, but verify" badge: a polaroid photo of ${c.proofOf || (c.proofTask ? `"${c.proofTask}"` : 'the thing they photographed')} with a magnifying glass over it and a big checkmark, and a cheeky pink pointing finger pointing at it.`,
}
export const BADGE_IDS = Object.keys(SUBJECTS)

// context: { tasks: [titles they finished], proofOf, streak, palette: ['#hex', …] }, all optional.
export function badgePrompt(kind, context = {}) {
  const ctx = {
    tasks: (Array.isArray(context.tasks) ? context.tasks : []).map((t) => clean(t)).filter(Boolean).slice(0, 3),
    proofOf: clean(context.proofOf, 60),
    proofTask: clean(context.proofTask, 60),
    touch: clean(context.touch, 40),
    streak: Math.min(999, Math.max(0, Number(context.streak) || 0)),
  }
  const palette = (Array.isArray(context.palette) ? context.palette : []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 3)
  const colours = palette.length ? `Use these colours: ${palette.join(', ')}, on a soft cream background.` : 'Soft pink, warm yellow and purple on a cream background.'
  const touch = ctx.touch ? ` Work in a small touch of ${ctx.touch}.` : ''
  return `Badge topic: ${TOPICS[kind]}. ${SUBJECTS[kind](ctx)}${touch} ${STYLE} ${colours}`
}
