// Nudgy's spoken voice: the device's own voices, nicest first. No model calls. The choice lives on the Me page.
import { getVolume } from './volume.js'

// Natural-sounding voices across Apple, Google and Microsoft, best first.
const NICE = ['Ava', 'Samantha', 'Allison', 'Serena', 'Jenny', 'Aria', 'Sonia', 'Libby', 'Google UK English Female', 'Google US English', 'Karen', 'Moira', 'Tessa', 'Daniel']
const score = (v) => {
  const i = NICE.findIndex((n) => v.name.includes(n))
  return (i < 0 ? NICE.length : i) - (/premium|enhanced|natural|neural/i.test(v.name) ? NICE.length + 1 : 0)
}

export function englishVoices() {
  if (!('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)).sort((a, b) => score(a) - score(b))
}

const chosenName = () => {
  try { return JSON.parse(localStorage.getItem('nudgy:voiceName')) } catch { return null }
}

// A line ready to speak, in the chosen voice or else the nicest one here.
export function makeLine(text, name = chosenName()) {
  const line = new SpeechSynthesisUtterance(text)
  const voices = englishVoices()
  const voice = voices.find((v) => v.name === name) ?? voices[0]
  if (voice) {
    line.voice = voice
    line.lang = voice.lang
  }
  line.rate = 1
  line.pitch = 1.05
  line.volume = getVolume() || 1
  return line
}
