import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store.jsx'

// The "third snooze" gag: a fake crash screen that counts up, then admits it's kidding.
export default function Joke() {
  const { joke, setJoke, tasks, name, completeTask } = useStore()
  const [percent, setPercent] = useState(0)
  const [kidding, setKidding] = useState(false)
  const timer = useRef(null)
  const task = joke && tasks.find((t) => t.id === joke.taskId)

  useEffect(() => {
    if (!joke) return
    setPercent(0)
    setKidding(false)
    let p = 0
    timer.current = setInterval(() => {
      p = Math.min(100, p + Math.ceil(Math.random() * 14))
      setPercent(p)
      if (p >= 100) {
        clearInterval(timer.current)
        setTimeout(() => setKidding(true), 500)
      }
    }, 160)
    return () => clearInterval(timer.current)
  }, [joke])

  const close = () => setJoke(null)

  return (
    <AnimatePresence>
      {joke && (
        <motion.div
          key={joke.key}
          role="alertdialog"
          aria-label="Nudged has stopped believing in you. Just kidding."
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex flex-col justify-center bg-ink px-8 font-mono text-bg"
        >
          <AnimatePresence mode="wait">
            {!kidding ? (
              <motion.div key="crash" exit={{ opacity: 0 }} className="mx-auto w-full max-w-md">
                <p className="text-6xl">:/</p>
                <p className="mt-6 text-xl leading-snug">Nudged.exe has stopped believing in you.</p>
                <p className="mt-4 text-sm opacity-60">
                  Error 0x5N00ZE: "{task?.title ?? 'that thing'}" snoozed 3 times. Nudged is rebooting from the shock.
                </p>
                <p className="mt-6 text-sm">{percent}% complete</p>
              </motion.div>
            ) : (
              <motion.div
                key="kidding"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
                className="mx-auto w-full max-w-md font-sans"
              >
                <p className="font-display text-4xl leading-tight">Just kidding.</p>
                <p className="mt-3 text-base opacity-80">
                  I'd never give up on you, {name || 'friend'}. But "{task?.title ?? 'that thing'}" really would love some attention.
                </p>
                <div className="mt-6 flex gap-2">
                  {task && !task.done && (
                    <button
                      type="button"
                      onClick={() => { completeTask(task.id); close() }}
                      className="min-h-11 flex-1 rounded-full bg-bg px-4 text-sm font-semibold text-ink"
                    >
                      Already done it
                    </button>
                  )}
                  <button type="button" onClick={close} className="min-h-11 flex-1 rounded-full border border-bg/30 px-4 text-sm font-semibold">
                    Fine, I'm on it
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
