import { useEffect } from 'react'
import { useStore } from '../lib/store.jsx'
import { celebrationLine } from '../lib/phrases.js'
import { confettiBurst } from '../lib/confetti.js'

// Confetti when a task is completed; Nudged (the on-screen buddy) says the line.
export default function Celebration() {
  const { celebration, setCelebration, name, say } = useStore()

  useEffect(() => {
    if (!celebration) return
    // Two bursts, from the lower left and right, so it reads as a proper celebration.
    confettiBurst({ x: window.innerWidth * 0.3, y: window.innerHeight * 0.75, count: 70 })
    setTimeout(() => confettiBurst({ x: window.innerWidth * 0.7, y: window.innerHeight * 0.75, count: 70 }), 150)
    const line = celebrationLine(celebration.context, name || 'Friend', celebration.task, celebration.key)
    say(`${line} +${celebration.earned} coins.`)
    setCelebration(null)
  }, [celebration]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
