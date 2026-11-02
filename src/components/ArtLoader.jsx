// Shown until a picture arrives: an animation drawn by Muse Image, and the two models taking turns.
import { useEffect, useState } from 'react'

export default function ArtLoader({ drawing = 'Drawing your badge…' }) {
  const steps = [['Muse Wonder', 'Writing the art direction…'], ['Muse Image', drawing]]
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStep((s) => s + 1), 2000)
    return () => clearInterval(id)
  }, [])
  const [model, doing] = steps[step % steps.length]
  return (
    <div role="status" className="mt-3 flex flex-col items-center">
      <img src="/badge-loading.gif" alt="" width="120" height="120" className="rounded-2xl" />
      <p className="mt-2 text-sm font-semibold">⚡ {model}</p>
      <p className="text-xs text-ink/55">{doing}</p>
    </div>
  )
}
