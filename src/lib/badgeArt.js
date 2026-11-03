// Asks the server (Muse Image) for this user's own version of a badge, then shrinks it so it stays small
// in storage and sync. Called only when the user taps "Create my badge".
import { guessPhrase, toJpeg } from './proof.js'
import { resumeJobs, runJob } from './jobs.js'
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

const finishArt = (json) => {
  showModel(json.via)
  return shrink(json.image)
}

export async function makeBadgeArt(badgeId, context, { fresh = false } = {}) {
  return finishArt(await runJob('badge', 'Muse Wonder + Muse Image', '/api/badge', { badge: badgeId, context, fresh }, { badgeId }))
}

// Changes the badge they already have, instead of drawing a new one.
export async function editBadgeArt(badgeId, current, context) {
  const editOf = await toJpeg(current, 1024, 0.9)
  return finishArt(await runJob('badge', 'Muse Image', '/api/badge', { badge: badgeId, context, editOf }, { badgeId }))
}

// A badge still drawing when the page closed lands here once it's done.
export const resumeBadges = (setBadgeArt) => resumeJobs('badge', async (json, job) => {
  const art = await finishArt(json)
  setBadgeArt((all) => ({ ...all, [job.meta.badgeId]: art }))
})
