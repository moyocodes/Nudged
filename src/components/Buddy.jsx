import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store.jsx'
import Mascot from './Mascot.jsx'
import { getVolume } from '../lib/volume.js'

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
// Browsers load voices lazily, which delays the first line. Asking early warms them up.
if (canSpeak) window.speechSynthesis.getVoices()

// Nudgy as an on-screen buddy: pops up from the corner, talks in a bubble (mouth moving),
// and reads the line aloud with the browser's own voice when sound is on. No model calls.
export default function Buddy() {
  const { buddy, setBuddy, voiceOn, setVoiceOn, muted } = useStore()
  const [talking, setTalking] = useState(false)

  useEffect(() => {
    if (!buddy) return
    // Roughly reading pace, so the mouth stops when a silent line would have finished.
    const speakMs = Math.min(4000, 600 + buddy.text.length * 45)
    // How long the bubble stays up: long enough to read it all, and then some (it used to vanish ~2s after the words).
    const stayMs = Math.min(20000, 6000 + buddy.text.length * 70)
    let hideTimer
    let startTimer
    setTalking(true)

    // Out loud only with the user's permission ("Talk out loud"). Sound off still wins.
    if (voiceOn && canSpeak && !muted) {
      const synth = window.speechSynthesis
      // Only cancel a line that's really playing: Chrome can stall a speak() right after a cancel(), so give it a beat then.
      const interrupting = synth.speaking || synth.pending
      if (interrupting) synth.cancel()
      const line = new SpeechSynthesisUtterance(buddy.text)
      line.rate = 1.05
      line.pitch = 1.25
      line.volume = getVolume()
      line.onend = () => {
        setTalking(false)
        hideTimer = setTimeout(() => setBuddy(null), 5000)
      }
      const start = () => {
        synth.resume()
        synth.speak(line)
      }
      if (interrupting) startTimer = setTimeout(start, 60)
      else start()
    } else {
      const quiet = setTimeout(() => setTalking(false), speakMs)
      hideTimer = setTimeout(() => setBuddy(null), stayMs)
      return () => { clearTimeout(quiet); clearTimeout(hideTimer) }
    }
    return () => {
      clearTimeout(hideTimer)
      clearTimeout(startTimer)
      if (canSpeak) window.speechSynthesis.cancel()
    }
  }, [buddy]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {buddy && (
        <motion.div
          key="buddy"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.35 }}
          className="fixed bottom-24 right-3 z-50 flex max-w-[min(22rem,calc(100vw-1.5rem))] items-end gap-1"
          role="status"
          aria-live="polite"
        >
          <motion.div
            key={buddy.key}
            initial={{ opacity: 0, scale: 0.9, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.3 }}
            style={{ transformOrigin: '100% 100%' }}
            className="mb-8 rounded-2xl rounded-br-md border-[length:var(--bw)] border-line bg-surface px-3.5 py-2.5 shadow-card"
          >
            <p className="text-sm leading-snug">{buddy.text}</p>
            {canSpeak && (
              <button
                type="button"
                onClick={() => setVoiceOn((v) => !v)}
                className="mt-1 text-[11px] font-semibold text-ink/45 hover:text-ink"
              >
                {voiceOn ? 'Sound on · mute' : 'Hear me say it'}
              </button>
            )}
          </motion.div>
          <motion.button
            type="button"
            onClick={() => setBuddy(null)}
            aria-label="Dismiss Nudgy"
            animate={talking ? { y: [0, -4, 0], rotate: [0, -3, 0] } : { y: 0, rotate: 0 }}
            transition={talking ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            className="shrink-0"
          >
            <Mascot size={72} talking={talking} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
