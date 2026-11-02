import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store.jsx'
import Mascot from './Mascot.jsx'
import { AMBIENT_SOUNDS } from '../lib/ambient.js'
import { playAlarm, unlockAlarm } from '../lib/alarm.js'

const hasNotify = typeof Notification !== 'undefined'
const hasMic = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
const hasVoice = typeof window !== 'undefined' && 'speechSynthesis' in window

// "Set Nudgy up": sound, notifications and mic, asked on a visit where any is still undecided.
// Browsers only allow these prompts from a tap, so each row has its own Allow button.
// "Not now" hides the card for this visit; it comes back next visit until everything is decided.
export default function Permissions() {
  const { name, voiceOn, setVoiceOn, muted, setMuted, setSoundAsked, voiceDeclined, setVoiceDeclined, say, storyOpen, tutorialOpen, setAmbient, ambientAsked, setAmbientAsked } = useStore()
  // A short beat before the first check, so the rundown (which opens right after the intro) gets the screen first.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 900)
    return () => clearTimeout(id)
  }, [])
  const [notify, setNotify] = useState(hasNotify ? Notification.permission : 'unsupported')
  const [mic, setMic] = useState(hasMic ? 'unknown' : 'unsupported')
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('nudgy:permsLater') === '1' } catch { return false }
  })

  useEffect(() => {
    if (!hasMic || !navigator.permissions?.query) return
    navigator.permissions.query({ name: 'microphone' }).then((s) => setMic(s.state)).catch(() => setMic('prompt'))
  }, [])

  const rows = [
    hasVoice && (!voiceOn || muted) && !voiceDeclined && {
      key: 'sound', icon: '🔊', title: 'Talk out loud', body: 'I read my nudges and replies aloud.',
      allow: () => { setVoiceOn(true); setMuted(false); setVoiceDeclined(false); setSoundAsked(true); setTimeout(() => say(`Hi ${name || 'friend'}! This is my voice.`), 50) },
      no: () => { setVoiceDeclined(true); setSoundAsked(true) },
    },
    notify === 'default' && {
      key: 'notify', icon: '🔔', title: 'Notifications', body: 'Nudges reach you when you’re in another tab.',
      allow: () => { unlockAlarm(); Notification.requestPermission().then((p) => { setNotify(p); if (p === 'granted') playAlarm() }) },
    },
    !ambientAsked && {
      key: 'ambient', icon: '🎧', title: 'Background sound', body: 'Rain, fire or waves while you work.',
      // Picking one here is also the tap browsers need before sound can play.
      choices: AMBIENT_SOUNDS.map(([id, emoji, label]) => ({ id, emoji, label, pick: () => { setAmbient(id); setAmbientAsked(true) } })),
      no: () => setAmbientAsked(true),
    },
    mic === 'prompt' && {
      key: 'mic', icon: '🎙️', title: 'Microphone',
      body: 'Brain-dump by voice. Say "send" when done.',
      allow: () => navigator.mediaDevices.getUserMedia({ audio: true })
        .then((s) => { s.getTracks().forEach((t) => t.stop()); setMic('granted') })
        .catch(() => setMic('denied')),
    },
  ].filter(Boolean)

  const later = () => {
    setHidden(true)
    try { sessionStorage.setItem('nudgy:permsLater', '1') } catch {}
  }

  // Order on a visit: intro, then the how-to (first time) or rundown, then this card. Never two at once.
  const open = settled && !hidden && rows.length > 0 && !!name && !storyOpen && !tutorialOpen
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Set Nudgy up"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] grid place-items-end bg-ink/30 p-3 sm:place-items-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
            className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-card"
          >
            <div className="flex items-center gap-3">
              <Mascot size={44} />
              <div>
                <h2 className="font-display text-xl">Set me up, {name}</h2>
                <p className="text-sm text-ink/55">A few taps and I can really nudge you.</p>
              </div>
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-3 rounded-2xl bg-ink/[0.04] px-3 py-2.5">
                  <span className="text-xl" aria-hidden>{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{r.title}</span>
                    <span className="block text-xs text-ink/55">{r.body}</span>
                  </span>
                  {r.no && (
                    <button type="button" onClick={r.no} className="rounded-full px-2 py-1 text-xs font-semibold text-ink/50 hover:bg-ink/5">No</button>
                  )}
                  {r.choices ? (
                    <span className="flex gap-1">
                      {r.choices.map((c) => (
                        <button key={c.id} type="button" onClick={c.pick} aria-label={c.label} title={c.label} className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-base hover:bg-primary/20">
                          {c.emoji}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <button type="button" onClick={r.allow} className="min-h-8 rounded-full bg-primary px-3 text-xs font-semibold text-on-primary shadow-btn">Allow</button>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" onClick={later} className="mt-3 w-full rounded-full py-2 text-sm font-semibold text-ink/50 hover:bg-ink/5">
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
