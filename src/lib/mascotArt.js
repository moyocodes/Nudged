// Restyle Nudged: Muse Wonder directs, Muse Image draws, and the white background is cut away here so it sits on any page.
import { showModel } from '../components/ModelTag.jsx'
import { resumeJobs, runJob } from './jobs.js'

const SIZE = 256

// Clears the near-white area connected to the edges, so white inside the character (eyes, belly) stays.
function cutOut(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = SIZE
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0, SIZE, SIZE)
      const pixels = g.getImageData(0, 0, SIZE, SIZE)
      const d = pixels.data
      const light = (i) => d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235
      const seen = new Uint8Array(SIZE * SIZE)
      const stack = []
      for (let i = 0; i < SIZE; i++) stack.push(i, SIZE * (SIZE - 1) + i, SIZE * i, SIZE * i + SIZE - 1)
      while (stack.length) {
        const p = stack.pop()
        if (p < 0 || p >= SIZE * SIZE || seen[p] || !light(p * 4)) continue
        seen[p] = 1
        d[p * 4 + 3] = 0
        const x = p % SIZE
        stack.push(p - SIZE, p + SIZE)
        if (x > 0) stack.push(p - 1)
        if (x < SIZE - 1) stack.push(p + 1)
      }
      g.putImageData(pixels, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

const finish = (json) => {
  showModel(json.via)
  return cutOut(json.image)
}

export async function makeMascot(look) {
  const palette = ['--primary', '--accent', '--highlight'].map((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim())
  return finish(await runJob('mascot', 'Muse Wonder + Muse Image', '/api/mascot', { look, palette }))
}

// A restyle still drawing when the page closed lands here once it's done.
export const resumeMascot = (setMascotArt) => resumeJobs('mascot', async (json) => setMascotArt(await finish(json)))
