import { useEffect } from 'react'
import { Button } from './ui.jsx'

const TERMS = [
  ['What Nudgy is', 'Nudgy is a reminder helper, built as a hackathon project. It tries its best, but it can miss a reminder, so please don\'t rely on it for anything urgent, medical or safety-critical.'],
  ['Your account', 'You sign in with just your email and no password, so anyone who knows your email could open your account. Don\'t store anything sensitive here.'],
  ['What we store', 'Your email, name, tasks, chat, settings, timezone and any proof photos, so they can sync across your devices.'],
  ['AI models', 'What you type or say, and photos you send as proof, are sent to AI models to work out your tasks, write nudges and check proof. AI can get things wrong.'],
  ['Emails', 'We email you when you sign up and when a task is overdue, repeating until you tick or snooze it, except during your quiet hours.'],
  ['Fair use', 'Please don\'t misuse the service or try to break it. Nudgy is provided as is, and it may change or stop at any time.'],
]

export default function TermsModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="terms-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-md flex-col rounded-[var(--r-card)] bg-surface p-6 shadow-card">
        <h2 id="terms-title" className="font-display text-2xl">Terms and conditions</h2>
        <div className="mt-3 flex-1 space-y-3 overflow-y-auto text-sm text-ink/70">
          {TERMS.map(([title, text]) => (
            <p key={title}><span className="block font-semibold text-ink">{title}</span>{text}</p>
          ))}
        </div>
        <Button className="mt-4" onClick={onClose}>Back to setup</Button>
      </div>
    </div>
  )
}
