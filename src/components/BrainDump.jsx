import { useEffect, useRef, useState } from 'react'
import { startTranscribing } from '../lib/museTranscribe.js'
import { makeLine } from '../lib/voice.js'
import { showModel } from './ModelTag.jsx'
import { Button } from './ui.jsx'
import { ArrowIcon, MicIcon } from './Icons.jsx'
import { friendlyDue } from '../lib/format.js'
import { useStore } from '../lib/store.jsx'
import { holdNudges } from '../lib/nudges.js'

const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

// Saying one of these at the end of a phrase sends the dump.
const SEND_PHRASE = /\b(send it|send)[.!\s]*$/i

const isPhone = () => window.matchMedia('(max-width: 639px)').matches

// about: a reminder picked with @ (from here or a task card); the text is then instructions for it.
// thinking: how many dumps Nudged is still working on; they run in the background.
// Full screen: automatic when typing on a phone, or via the expand button anywhere.
// question: Nudged's open question about a reminder; answer it here in plain words.
// Counts down to Nudged's check-in, so it's clear one is coming.
function QuietTimer({ until }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [until])
  const left = Math.max(0, until - now)
  return (
    <div className="mb-2 px-1" role="timer">
      <p className="text-xs font-semibold text-primary">Go quiet and I'll check in: {Math.ceil(left / 1000)}s</p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(left / 15000) * 100}%` }} />
      </div>
    </div>
  )
}

export default function BrainDump({ onActivity, quietUntil, questionLabel = 'Nudged:', onSubmit, reminders = [], about, onPickAbout, thinking = 0, question, onDismissQuestion }) {
  const { muted, nudgeModel, setNudgeModel } = useStore()
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [micError, setMicError] = useState('')
  useEffect(() => {
    holdNudges(listening || thinking > 0)
    return () => holdNudges(false)
  }, [listening, thinking])
  const [focused, setFocused] = useState(false)
  const [picking, setPicking] = useState(false)
  const [full, setFull] = useState(false)
  const expanded = focused || listening || !!text || !!about || full
  const stopRef = useRef(null)
  const textRef = useRef('')
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  textRef.current = text

  useEffect(() => () => { stopRef.current?.() }, [])

  // Full screen: lock the page behind it, and Esc closes it. It fits the visible area above the phone keyboard.
  // Closing drops the keyboard and puts the page back where it was, since phones leave it shifted otherwise.
  const [viewport, setViewport] = useState(null)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('nudgy:fullchat', { detail: full }))
    if (!full) return
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    const esc = (e) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', esc)
    const vv = window.visualViewport
    const fit = () => vv && setViewport({ top: vv.offsetTop, height: vv.height })
    fit()
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', esc)
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      setViewport(null)
      inputRef.current?.blur()
      window.scrollTo(0, scrollY)
      setTimeout(() => window.scrollTo(0, scrollY), 350) // again once the keyboard has gone
    }
  }, [full])

  // Picking a reminder (here or from a card) brings the box into view, ready to type.
  useEffect(() => {
    if (!about) return
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    inputRef.current?.focus({ preventScroll: true })
  }, [about?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function stopMic() {
    stopRef.current?.()
    stopRef.current = null
  }

  function submit(value = textRef.current) {
    const clean = value.trim()
    if (!clean) return
    stopMic()
    onSubmit?.(clean)
    setText('')
    setInterim('')
    setFull(false)
  }

  async function toggleMic() {
    if (listening) return stopMic()
    setMicError('')
    // Shown at once, since the mic and the connection take a moment.
    showModel('Muse Voice Transcribe · Meta')
    setConnecting(true)
    try {
      setListening(true)
      stopRef.current = await startTranscribing({
        onPartial: (partial) => { setInterim(partial); onActivity?.(`${textRef.current} ${partial}`.trim()) },
        onFinal: (phrase) => {
          setInterim('')
          showModel('Muse Voice Transcribe · Meta')
          const joined = `${textRef.current} ${phrase}`.replace(/\s+/g, ' ').trimStart()
          if (SEND_PHRASE.test(phrase)) submit(joined.replace(SEND_PHRASE, ''))
          else { setText(joined); onActivity?.(joined) }
        },
        onError: setMicError,
        onEnd: () => {
          setListening(false)
          setInterim('')
        },
      })
      setConnecting(false)
    } catch (e) {
      setConnecting(false)
      setListening(false)
      setMicError(e.name === 'NotAllowedError' ? 'Mic access was blocked.' : e.message)
    }
  }

  return (
    <>
    {full && <button type="button" aria-label="Close brain dump" onClick={() => setFull(false)} className="fixed inset-0 z-[59] cursor-default bg-ink/40" />}
    <section
      ref={boxRef}
      style={full && viewport ? { top: viewport.top, height: viewport.height, bottom: 'auto', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' } : undefined}
      className={
        full
          ? 'drawer-in fixed right-0 top-0 bottom-0 z-[60] flex w-[min(92vw,28rem)] flex-col rounded-l-3xl bg-surface p-4 pt-3 shadow-card'
          : 'relative rounded-3xl bg-surface p-3 shadow-card border-[length:var(--bw)] border-line focus-within:border-primary/40'
      }
    >
      <label htmlFor="dump" className="sr-only">
        Dump everything on your mind
      </label>
      <div className={`flex items-center justify-between ${full ? 'mb-9' : 'absolute right-2 top-2'}`}>
        {full && <span className="font-display text-xl">Brain dump</span>}
        <button
          type="button"
          onClick={() => {
            // Refocusing on close would reopen it on a phone, where focusing the box goes full screen.
            if (full) return setFull(false)
            setFull(true)
            inputRef.current?.focus({ preventScroll: true })
          }}
          aria-label={full ? 'Close brain dump' : 'Open brain dump'}
          title={full ? 'Close (Esc)' : 'Open larger'}
          className={full
            ? 'grid h-11 w-11 place-items-center rounded-full bg-ink text-2xl leading-none text-bg shadow-btn'
            : 'grid h-8 w-8 place-items-center rounded-full text-ink/40 hover:bg-ink/5 hover:text-ink'}
        >
          {full ? '×' : '⤢'}
        </button>
      </div>
      {question && !about && (
        <p className="mb-1 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-2xl rounded-bl-md bg-soft px-3 py-2 pr-9 text-sm leading-snug">
          <span className={`shrink-0 font-semibold text-primary ${questionLabel === 'Nudged:' ? '' : 'basis-full'}`}>{questionLabel}</span>
          <span className="min-w-0 flex-1">{question}</span>
          {onDismissQuestion && (
            <button type="button" onClick={onDismissQuestion} className="-my-1 shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-ink/50 hover:bg-ink/5 hover:text-ink">No thanks</button>
          )}
          {/* Read the question aloud with the device's own voice (no model call). */}
          {'speechSynthesis' in window && !muted && (
            <button
              type="button"
              onClick={() => {
                window.speechSynthesis.cancel()
                window.speechSynthesis.speak(makeLine(question))
              }}
              aria-label="Hear Nudged's question"
              title="Hear it"
              className="-my-1 shrink-0 rounded-full px-1.5 py-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
            >
              🔊
            </button>
          )}
        </p>
      )}
      {about && (
        <div className="mb-1 flex items-center gap-2 px-1">
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-sm font-medium">
            <span className="text-primary">@</span>
            <span className="truncate">{about.title}</span>
          </span>
          <button type="button" onClick={() => onPickAbout(null)} aria-label="Stop talking about this reminder" className="text-sm text-ink/40 hover:text-ink">×</button>
        </div>
      )}
      <textarea
        ref={inputRef}
        id="dump"
        value={interim ? `${text} ${interim}`.trimStart() : text}
        onChange={(e) => { setText(e.target.value); onActivity?.(e.target.value) }}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter is a new line. Leave it alone mid-IME composition.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        readOnly={!!interim}
        rows={expanded ? 3 : 1}
        onFocus={() => { setFocused(true); if (isPhone()) setFull(true) }}
        onBlur={() => setFocused(false)}
        placeholder={
          about
            ? 'What should I do with it? "7pm", "every Monday", "high priority", "done"…'
            : question ? 'Answer Nudged, or add something new…'
            : expanded ? "Call the dentist, buy oat milk, Yinka's tomorrow at 5…" : 'Add something, or brain-dump it all…'
        }
        className={`w-full resize-none bg-transparent p-2 leading-relaxed outline-none placeholder:text-ink/35 ${full ? 'flex-1 text-lg' : 'pr-9 text-base'}`}
      />
      {quietUntil && <QuietTimer until={quietUntil} />}
      <div role="radiogroup" aria-label="Model" className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
        <span className="text-xs font-semibold text-ink/50">Model</span>
        {[['auto', 'Auto'], ['open', 'Spark Open · Baseten'], ['modal', 'Spark Open · Modal'], ['spark', 'Muse Spark · Meta']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={nudgeModel === value}
            onClick={() => setNudgeModel(value)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${nudgeModel === value ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!canRecord}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Start speaking'}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${
            listening ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
          }`}
          style={listening ? { animation: 'pulse-ring 1.2s infinite' } : undefined}
        >
          <MicIcon size={18} />
        </button>
        {reminders.length > 0 && (
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            aria-expanded={picking}
            aria-label="Pick a reminder to talk about"
            title="Pick a reminder to talk about"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-semibold transition ${picking ? 'bg-primary text-on-primary' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`}
          >
            @
          </button>
        )}
        <p className="min-w-0 flex-1 text-[13px] leading-tight text-ink/50">
          {micError
            ? micError
            : !canRecord
              ? "Your browser can't record. Type instead."
              : listening
                ? connecting ? 'Connecting to Muse Voice Transcribe…' : 'Listening… say "send" when you\'re done.'
                : 'Talk or type. Enter sends.'}
        </p>
        <Button size="sm" onClick={() => submit()} disabled={!text.trim()}>
          {about ? 'Tell Nudged' : 'Add tasks'} <ArrowIcon size={16} />
        </Button>
      </div>
      {picking && (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-2xl border-[length:var(--bw)] border-line bg-bg p-1" aria-label="Your reminders">
          {reminders.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => { onPickAbout(t.id); setPicking(false) }}
                className="flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink/5"
              >
                <span className="min-w-0 truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-ink/45">{t.due ? friendlyDue(t.due) : 'No date'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
    {thinking > 0 && (
      <p role="status" className="-mt-2 flex items-center gap-2 px-2 text-xs text-ink/50">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        On it{thinking > 1 ? ` (${thinking})` : ''}… carry on, I'll shout when it's sorted.
      </p>
    )}
    </>
  )
}
