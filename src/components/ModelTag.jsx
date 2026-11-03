import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useJobs } from '../lib/jobs.js'
import { useStore } from '../lib/store.jsx'

// Shows which Meta model did the latest work ("Muse Spark Open · Baseten"). It stays on screen until the next call, so it can't be missed.
// Anything can trigger it with showModel(label).
export function showModel(label) {
  if (label) window.dispatchEvent(new CustomEvent('nudgy:model', { detail: label }))
}

// inTopBar: the page has a top bar, which keeps a row free for the tag so it never covers the page.
export default function ModelTag({ inTopBar = false }) {
  const { storyOpen } = useStore()
  const jobs = useJobs()
  const working = jobs[jobs.length - 1]
  const [label, setLabel] = useState(() => localStorage.getItem('nudgy:lastModel') ?? '')

  // In the brain dump drawer the tag sits under the header, clear of the messages.
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
    <div className={`pointer-events-none fixed inset-x-0 z-[1000] flex ${fullChat ? 'top-[3.8rem] justify-end pr-4' : inTopBar && !storyOpen ? 'top-14 justify-center' : 'top-[4.25rem] justify-center'}`} aria-live="polite">
      {/* One pill at a time: side by side they squash each other during a handover. */}
      <AnimatePresence mode="wait">
        {(working || label) && (
          <motion.span
            key={working ? `working-${working.id}` : label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.1 } }}
            className="whitespace-nowrap rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bg shadow-btn"
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
