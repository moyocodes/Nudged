import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Shows which Meta model just did the work ("Muse Glimmer · Fireworks"), for a few seconds after each call.
// Anything can trigger it with showModel(label).
export function showModel(label) {
  if (label) window.dispatchEvent(new CustomEvent('nudgy:model', { detail: label }))
}

export default function ModelTag() {
  const [label, setLabel] = useState('')

  useEffect(() => {
    let timer
    const on = (e) => {
      setLabel(e.detail)
      clearTimeout(timer)
      timer = setTimeout(() => setLabel(''), 4000)
    }
    window.addEventListener('nudgy:model', on)
    return () => {
      window.removeEventListener('nudgy:model', on)
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center" aria-live="polite">
      <AnimatePresence>
        {label && (
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bg shadow-btn"
          >
            ⚡ {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
