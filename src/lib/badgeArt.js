// Asks the server (Muse Image) for this user's own version of a badge, then shrinks it so it stays small
// in storage and sync. Called only when the user taps "Create my badge".
import { guessPhrase } from './proof.js'
import { showModel } from '../components/ModelTag.jsx'

const hex = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// What the badge should show, from what this person has actually done, in their theme's colours.
export function badgeContext(tasks, streak, touch = '') {
  const done = tasks.filter((t) => t.done)
  const proofTask = done.find((t) => t.proof)
  return {
    tasks: done.slice(0, 3).map((t) => t.title),
    proofOf: proofTask ? proofTask.proofOf || guessPhrase(proofTask.title) : '',
    proofTask: proofTask?.title ?? '',
    touch: touch.trim(),
    streak,
    palette: ['--primary', '--accent', '--highlight'].map(hex),
  }
}

function shrink(dataUrl, size = 384) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      c.getContext('2d').drawImage(img, 0, 0, size, size)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export async function makeBadgeArt(badgeId, context, { fresh = false } = {}) {
  const r = await fetch('/api/badge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ badge: badgeId, context, fresh }) })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.error || "Couldn't draw that just now.")
  showModel(json.via)
  return shrink(json.image)
}
