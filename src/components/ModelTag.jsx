import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Shows which Meta model did the latest work ("Muse Spark Open · Baseten"). It stays on screen until the next call, so it can't be missed.
// Anything can trigger it with showModel(label).
export function showModel(label) {
  if (label) window.dispatchEvent(new CustomEvent('nudgy:model', { detail: label }))
}

export default function ModelTag() {
  const [label, setLabel] = useState(() => localStorage.getItem('nudgy:lastModel') ?? '')

  useEffect(() => {
    const on = (e) => {
      setLabel(e.detail)
      localStorage.setItem('nudgy:lastModel', e.detail)
    }
    window.addEventListener('nudgy:model', on)
    return () => window.removeEventListener('nudgy:model', on)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[1000] flex justify-center" aria-live="polite">
      <AnimatePresence>
        {label && (
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-bg shadow-btn"
          >
            ⚡ {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
