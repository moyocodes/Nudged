import { useEffect, useState } from 'react'

// Chrome/Edge/Android fire "beforeinstallprompt"; we keep it and show our own Install button.
// iPhone has no such event, so it gets the two manual steps instead.
let deferred = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    window.dispatchEvent(new Event('nudgy:installable'))
  })
}

const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone

const pitch = <p className="mb-2 text-sm text-ink/60">I'm a web app, but I feel more at home on your home screen. Pun intended.</p>

export default function InstallButton({ className = '' }) {
  const [canInstall, setCanInstall] = useState(!!deferred)
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => {
    const on = () => setCanInstall(true)
    window.addEventListener('nudgy:installable', on)
    return () => window.removeEventListener('nudgy:installable', on)
  }, [])

  if (installed()) return null

  if (canInstall) {
    return (
      <div className={className}>
        {pitch}
        <button
          type="button"
          onClick={async () => {
            deferred.prompt()
            await deferred.userChoice
            deferred = null
            setCanInstall(false)
          }}
          className="min-h-10 w-full rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-btn"
        >
          Add Nudgy to your home screen
        </button>
      </div>
    )
  }

  if (isIOS) {
    return (
      <div className={className}>
        {pitch}
        <button type="button" onClick={() => setShowSteps((s) => !s)} className="min-h-10 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-btn">
          Add Nudgy to your home screen
        </button>
        {showSteps && (
          <p className="mt-2 text-sm text-ink/60">Tap <strong>Share</strong> (the square with the arrow) at the bottom of Safari, then <strong>Add to Home Screen</strong>.</p>
        )}
      </div>
    )
  }

  return null
}
