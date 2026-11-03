import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore, PROOF_BONUS } from '../lib/store.jsx'
import { Button, Card, ProofBadge } from '../components/ui.jsx'
import { CameraIcon } from '../components/Icons.jsx'
import { checkPhoto, guessPhrase, toJpeg } from '../lib/proof.js'

// Photo proof: the photo goes to SAM 3.1 with what to look for (a noun phrase from the task).
// Found: Complete, claim the bonus. Not found: try another angle. Can't check: taken at their word.
export default function ProofPage() {
  const { id } = useParams()
  const { name, tasks, completeTask, updateTask } = useStore()
  const navigate = useNavigate()
  const task = tasks.find((t) => t.id === id)
  // Coming back to a task that already has a photo shows it, rather than an empty uploader.
  const [photo, setPhoto] = useState(task?.photo ?? null)
  const [state, setState] = useState(task?.photo ? 'found' : 'idle') // idle | checking | found | notfound
  // What happened with this visit's photo: verified by SAM, skipped (couldn't check), or restored (came back to it).
  const [note, setNote] = useState('restored')
  const [boxes, setBoxes] = useState([])
  const [steps, setSteps] = useState([])
  const [phrase, setPhrase] = useState(() => task?.proofOf || (task ? guessPhrase(task.title) : ''))

  if (!task) return <p className="text-center">That task wandered off. <Link to="/" className="underline">Home</Link></p>
  const claimed = task.done && task.proof

  // Keep a small JPEG of the photo on the task, so the card (and the nudge break) can show it
  // even if the user never finishes the proof.
  function saveThumb(url) {
    const img = new Image()
    img.onload = () => {
      const scale = 240 / Math.max(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      updateTask(task.id, { photo: c.toDataURL('image/jpeg', 0.7) })
    }
    img.src = url
  }

  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPhoto(url)
    setState('checking')
    setBoxes([])
    setSteps([])
    let found = null
    try {
      const check = await checkPhoto(await toJpeg(url), phrase.trim() || task.title)
      found = check.found
      setBoxes(check.boxes)
      setSteps(check.steps)
    } catch {}
    // Saved only once it passes, so a rejected photo can't come back as proof on the next visit.
    if (found === false) updateTask(task.id, { photo: null })
    else saveThumb(url)
    setNote(found === true ? 'verified' : 'skipped')
    setState(found === false ? 'notfound' : 'found')
    // If they changed what to look for, remember it on the task.
    if (phrase.trim() && phrase.trim() !== task.proofOf) updateTask(task.id, { proofOf: phrase.trim() })
  }

  function accept() {
    completeTask(task.id, { proof: true })
    navigate('/')
  }

  function skip() {
    completeTask(task.id)
    navigate('/')
  }

  const message = claimed
    ? `Proof accepted. +${PROOF_BONUS} banked.`
    : state === 'notfound'
      ? `I can't see "${phrase}" in that. Try another angle, or change what I'm looking for.`
      : note === 'verified'
        ? `Found it: ${phrase}.`
        : note === 'skipped'
          ? "Couldn't check this one just now, so I'll take your word."
          : 'Photo added.'

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header>
        <p className="text-sm text-ink/50">{task.title}</p>
        <h1 className="mt-1 font-display text-[1.75rem] leading-tight">Pics or it didn't happen, <em>{name || 'friend'}</em>.</h1>
      </header>

      <Card className="flex flex-col items-center gap-4">
        {!claimed && (
          <label className="flex w-full items-center gap-2 text-sm text-ink/60">
            <span className="shrink-0">I'll look for</span>
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              maxLength={80}
              aria-label="What Nudged should find in the photo"
              className="min-w-0 flex-1 rounded-xl border-[length:var(--bw)] border-line bg-bg px-3 py-1.5 text-[15px] font-medium text-ink outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        )}

        {photo ? (
          <div className="relative w-full overflow-hidden rounded-2xl">
            <img src={photo} alt="Your proof" className="w-full" />
            {/* Where SAM 3.1 found it, so it's clear why the photo passed. */}
            {state === 'found' && boxes.map((b, i) => (
              <span
                key={i}
                aria-hidden
                className="pop-in pointer-events-none absolute rounded-lg border-[3px] border-primary bg-primary/20 shadow-card"
                style={{ left: `${b.left * 100}%`, top: `${b.top * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }}
              />
            ))}
            {state === 'found' && <ProofBadge complete className="absolute left-3 top-3" />}
            {(state === 'found' || state === 'notfound') && !claimed && (
              <label className="absolute bottom-3 right-3 cursor-pointer rounded-full bg-surface/90 px-3 py-1.5 text-xs font-semibold shadow-card backdrop-blur">
                Retake
                <input type="file" accept="image/*" capture="environment" onChange={pick} className="sr-only" />
              </label>
            )}
            {state === 'checking' && (
              <div className="absolute inset-0 grid place-items-center bg-ink/40 px-6 text-center font-display text-xl text-on-primary">
                Looking for {phrase}…
              </div>
            )}
          </div>
        ) : (
          <label className="grid aspect-square w-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-ink/15 bg-bg text-center">
            <span>
              <CameraIcon size={36} className="mx-auto text-primary" />
              <span className="mt-2 block font-display text-xl">Snap proof</span>
              <span className="block text-sm text-ink/50">+{PROOF_BONUS} bonus coins</span>
            </span>
            <input type="file" accept="image/*" capture="environment" onChange={pick} className="sr-only" />
          </label>
        )}

        {(state === 'found' || state === 'notfound') && <p className="pop-in text-center font-display text-lg">{message}</p>}
        {/* What each model really did, so it's clear how the photo was judged. */}
        {(state === 'found' || state === 'notfound') && steps.length > 0 && (
          <ol className="pop-in w-full space-y-1 rounded-xl bg-ink/[0.04] px-3 py-2 text-xs leading-snug text-ink/60">
            {steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        )}
      </Card>

      {claimed ? (
        <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
      ) : state === 'found' ? (
        <Button onClick={accept}>Claim +{PROOF_BONUS} bonus</Button>
      ) : task.physical ? (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate(-1)}>Not now</Button>
          <Button variant="ghost" onClick={skip}>Skip photo (no bonus)</Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={skip}>Skip proof (no bonus)</Button>
      )}
    </div>
  )
}
