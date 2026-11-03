// Photo proof helpers: what to look for, a smaller JPEG to send, and the server check.
import { showModel } from '../components/ModelTag.jsx'

// "Buy oat milk" -> "oat milk". Only a first guess; the Proof page lets the user change it.
const LEADING = /^(?:(?:do|complete|finish|submit|buy|get|pick up|grab|bring|send|take|clean|wash|tidy|fix|collect|return|order|cook|make|water|feed|walk|pack|visit|call|book|pay for|put away|go to)\s+)(?:(?:the|a|an|some|my|our)\s+)?/i
export const guessPhrase = (title) => title.replace(/\s*\(.*\)\s*$/, '').replace(LEADING, '').trim() || title

// The photo as a JPEG no bigger than `max` pixels, so the upload stays small.
export function toJpeg(url, max = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

// found: true (it's in the photo), false (it isn't), null (couldn't check, so the user is taken at their word).
export async function checkPhoto(image, phrase) {
  try {
    const r = await fetch('/api/proof', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, phrase }) })
    if (!r.ok) throw new Error(r.statusText)
    const { found, via, boxes, steps } = await r.json()
    showModel(via)
    return { found: typeof found === 'boolean' ? found : null, boxes: Array.isArray(boxes) ? boxes : [], steps: Array.isArray(steps) ? steps : [] }
  } catch (err) {
    console.warn('[proof] could not check the photo:', err.message)
    return { found: null }
  }
}
