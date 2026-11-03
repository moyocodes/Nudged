import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store.jsx'
import Mascot from './Mascot.jsx'
import { makeLine } from '../lib/voice.js'
import { soundUnlocked, unlockSound } from '../lib/alarm.js'

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
// Browsers load voices lazily, which delays the first line. Asking early warms them up.
if (canSpeak) window.speechSynthesis.getVoices()

// Nudged as an on-screen buddy: pops up from the corner, talks in a bubble (mouth moving),
// and reads the line aloud with the browser's own voice when sound is on. No model calls.
export default function Buddy() {
  const { buddy, setBuddy, voiceOn, setVoiceOn, muted, setMuted, voiceDeclined } = useStore()
  const [talking, setTalking] = useState(false)
  // Voice is on, but the phone needs a first tap before this line can be heard.
  const [needsTap, setNeedsTap] = useState(false)

  // A line that had to wait, because phones stay silent until the first tap after a login or reload.
  const waiting = useRef(null)
  useEffect(() => {
    // Click and key, not pointerdown: iPhones don't count a pointerdown as permission to start speech.
    const onTap = () => {
      unlockSound()
      if (!waiting.current || !canSpeak) return
      window.speechSynthesis.speak(makeLine(waiting.current))
      waiting.current = null
      setNeedsTap(false)
    }
    window.addEventListener('click', onTap, true)
    window.addEventListener('keydown', onTap, true)
    return () => {
      window.removeEventListener('click', onTap, true)
      window.removeEventListener('keydown', onTap, true)
    }
  }, [])

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
    if (voiceOn && canSpeak && !muted && soundUnlocked() && !buddy.spoken) {
      const synth = window.speechSynthesis
      // Only cancel a line that's really playing: Chrome can stall a speak() right after a cancel(), so give it a beat then.
      const interrupting = synth.speaking || synth.pending
      if (interrupting) synth.cancel()
      const line = makeLine(buddy.text)
      line.onend = () => {
        setTalking(false)
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => setBuddy(null), 5000)
      }
      // If the phone drops the line, onend never fires, and the bubble mustn't stay up for good.
      hideTimer = setTimeout(() => setBuddy(null), stayMs + 5000)
      const start = () => {
        synth.resume()
        synth.speak(line)
      }
      if (interrupting) startTimer = setTimeout(start, 60)
      else start()
    } else {
      if (voiceOn && canSpeak && !muted && !buddy.spoken) {
        waiting.current = buddy.text
        setNeedsTap(true)
      }
      const held = voiceOn && canSpeak && !muted && !buddy.spoken
      const quiet = setTimeout(() => setTalking(false), speakMs)
      // A line waiting for its first tap stays up longer, so there's time to see the button.
      hideTimer = setTimeout(() => setBuddy(null), held ? Math.max(stayMs, 30000) : stayMs)
      return () => { waiting.current = null; setNeedsTap(false); clearTimeout(quiet); clearTimeout(hideTimer) }
    }
    return () => {
      clearTimeout(hideTimer)
      clearTimeout(startTimer)
      if (canSpeak) window.speechSynthesis.cancel()
    }
  }, [buddy]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tell the top bar how much room Nudged needs, so the page moves down instead of sitting under the bubble.
  const boxRef = useRef(null)
  const showing = !!buddy
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!showing || !box) return
    const root = document.documentElement
    const fit = () => root.style.setProperty('--buddy-h', `${box.offsetHeight + 8}px`)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--buddy-h')
    }
  }, [showing])

  // Shout about it when a tap would make Nudged audible, unless they've already said no to the voice.
  const askForVoice = needsTap || ((!voiceOn || muted) && !voiceDeclined)

  // The tap itself has to start the speech (phones block it otherwise), and it reads the line already on screen.
  function toggleVoice() {
    // The tap itself already started the waiting line.
    if (needsTap) return
    const synth = window.speechSynthesis
    if (voiceOn && !muted) {
      setVoiceOn(false)
      synth.cancel()
      return
    }
    setVoiceOn(true)
    setMuted(false)
    synth.cancel()
    synth.resume()
    synth.speak(makeLine(buddy.text))
  }

  return (
    <AnimatePresence>
      {buddy && (
        <motion.div
          key="buddy"
          ref={boxRef}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.35 }}
          className="pointer-events-none fixed top-[5.25rem] right-3 z-50 flex max-w-[min(22rem,calc(100vw-1.5rem))] items-end gap-1"
          role="status"
          aria-live="polite"
        >
          <motion.div
            key={buddy.key}
            initial={{ opacity: 0, scale: 0.9, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.3 }}
            style={{ transformOrigin: '100% 100%' }}
            className="mb-4 rounded-2xl rounded-br-md border-[length:var(--bw)] border-line bg-surface px-3.5 py-2.5 shadow-card"
          >
            <p className="text-sm leading-snug">{buddy.text}</p>
            {canSpeak && (
              <button
                type="button"
                onClick={toggleVoice}
                style={askForVoice ? { animation: 'pulse-ring 1.6s ease-out infinite' } : undefined}
                className={askForVoice
                  ? 'pointer-events-auto mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-btn'
                  : 'pointer-events-auto mt-1 text-[11px] font-semibold text-ink/45 hover:text-ink'}
              >
                {needsTap ? <><span aria-hidden>🔊</span> Tap to hear me</> : voiceOn && !muted ? 'Sound on · mute' : askForVoice ? <><span aria-hidden>🔊</span> Turn my voice on</> : 'Turn my voice on'}
              </button>
            )}
          </motion.div>
          <motion.button
            type="button"
            onClick={() => setBuddy(null)}
            aria-label="Dismiss Nudged"
            animate={talking ? { y: [0, -4, 0], rotate: [0, -3, 0] } : { y: 0, rotate: 0 }}
            transition={talking ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            className="pointer-events-auto shrink-0"
          >
            <Mascot size={56} talking={talking} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
