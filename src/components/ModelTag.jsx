import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useJobs } from '../lib/jobs.js'

// Shows which Meta model did the latest work ("Muse Spark Open · Baseten"). It stays on screen until the next call, so it can't be missed.
// Anything can trigger it with showModel(label).
export function showModel(label) {
  if (label) window.dispatchEvent(new CustomEvent('nudgy:model', { detail: label }))
}

export default function ModelTag() {
  const jobs = useJobs()
  const working = jobs[jobs.length - 1]
  const [label, setLabel] = useState(() => localStorage.getItem('nudgy:lastModel') ?? '')

  // In the full-screen chat the tag sits in the header, clear of the messages.
  const [fullChat, setFullChat] = useState(false)
  useEffect(() => {
    const on = (e) => setFullChat(e.detail)
    window.addEventListener('nudgy:fullchat', on)
    return () => window.removeEventListener('nudgy:fullchat', on)
  }, [])

  useEffect(() => {
    const on = (e) => {
      setLabel(e.detail)
      localStorage.setItem('nudgy:lastModel', e.detail)
    }
    window.addEventListener('nudgy:model', on)
    return () => window.removeEventListener('nudgy:model', on)
  }, [])

  return (
    <div className={`pointer-events-none fixed inset-x-0 z-[1000] flex ${fullChat ? 'top-3 justify-end pr-14' : 'top-[4.25rem] justify-center'}`} aria-live="polite">
      <AnimatePresence>
        {(working || label) && (
          <motion.span
            key={working ? `working-${working.id}` : label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bg shadow-btn"
          >
            {working ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-bg/30 border-t-bg" aria-hidden />
                {working.label} working…
              </span>
            ) : <>⚡ {label}</>}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
