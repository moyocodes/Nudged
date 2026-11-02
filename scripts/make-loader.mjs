#!/usr/bin/env node
// Makes public/badge-loading.gif, the animation shown while a badge is drawn: four frames from Muse Image, joined with ffmpeg.
//   node --env-file=.env scripts/make-loader.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { generateImage } from '../server/image.js'

const STYLE = 'A round sticker badge of a smiling yellow star, centered on a plain cream background, same composition and same size in every picture. Flat vector style. No text, no letters, no hands.'
const FRAMES = [
  'Stage 1: only a light pencil outline of the badge on the cream background, no colour.',
  'Stage 2: the same badge with a thick dark ink outline, still no colour.',
  'Stage 3: the same inked badge half filled with flat yellow and purple colour.',
  'Stage 4: the same badge fully coloured in yellow and purple, with a few small pink sparkles around it.',
]

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nudgy-loader-'))
for (const [i, stage] of FRAMES.entries()) {
  // Image calls can drop the connection, so each frame gets one retry.
  const prompt = `${STYLE} ${stage}`
  const image = await generateImage(prompt).catch(() => generateImage(prompt))
  fs.writeFileSync(path.join(dir, `f${i}.png`), image)
  console.log(`frame ${i + 1} of ${FRAMES.length}`)
}
// Muse Image returns different sizes, so each frame is resized before joining.
for (let i = 0; i < FRAMES.length; i++) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, `f${i}.png`), '-vf', 'scale=240:240:flags=lanczos,format=rgb24', path.join(dir, `s${i}.png`)])
const frames = path.join(dir, 's%d.png')
const palette = path.join(dir, 'palette.png')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1.5', '-i', frames, '-vf', 'palettegen=stats_mode=full', palette])
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1.5', '-i', frames, '-i', palette, '-lavfi', 'paletteuse', '-fps_mode', 'passthrough', '-loop', '0', 'public/badge-loading.gif'])
console.log('public/badge-loading.gif', fs.statSync('public/badge-loading.gif').size, 'bytes')
