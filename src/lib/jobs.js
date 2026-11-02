// Model work that survives being interrupted. The server finishes each call and keeps the result under a job id, and the
// id is saved here. If the connection drops, or the page closes or reloads, the result is collected instead of lost.
import { useEffect, useState } from 'react'

const KEY = 'nudgy:jobs'
const POLL_MS = 2500
const GIVE_UP_MS = 5 * 60 * 1000
const live = new Set() // ids this page load is already handling

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? [] } catch { return [] }
}
const save = (jobs) => {
  localStorage.setItem(KEY, JSON.stringify(jobs))
  window.dispatchEvent(new Event('nudgy:jobs'))
}
const finish = (id) => {
  live.delete(id)
  save(load().filter((j) => j.id !== id))
}

// The jobs still running, for the loaders. Updates as they start and finish.
export function useJobs() {
  const [jobs, setJobs] = useState(load)
  useEffect(() => {
    const on = () => setJobs(load())
    window.addEventListener('nudgy:jobs', on)
    return () => window.removeEventListener('nudgy:jobs', on)
  }, [])
  return jobs
}

async function waitFor(id) {
  const start = Date.now()
  while (Date.now() - start < GIVE_UP_MS) {
    let r
    try {
      r = await fetch(`/api/jobs/${id}`)
    } catch {
      r = null // offline for now: keep trying
    }
    if (r?.status === 404) throw new Error('That got lost on my side. Try again?')
    if (r?.ok) {
      const job = await r.json()
      if (job.status === 'done') {
        if (job.code >= 400) throw new Error(job.body?.error || 'Something went wrong on my side.')
        return job.body
      }
    }
    await new Promise((done) => setTimeout(done, POLL_MS))
  }
  throw new Error('That took too long. Try again?')
}

// Runs a model call. label names the model for the loader; meta is whatever's needed to use the result after a reload.
export async function runJob(kind, label, url, body, meta = {}) {
  const id = crypto.randomUUID()
  live.add(id)
  save([...load(), { id, kind, label, meta, at: Date.now() }])
  try {
    let r
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Job-Id': id }, body: JSON.stringify(body) })
    } catch {
      return await waitFor(id) // the connection dropped, but the server carries on
    }
    const json = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(json.error || r.statusText)
    return json
  } finally {
    finish(id)
  }
}

// Picks up jobs of this kind left by an earlier page load. use(result, job) applies each one; failed(job, err) reports it.
export function resumeJobs(kind, use, failed) {
  for (const job of load()) {
    if (job.kind !== kind || live.has(job.id)) continue
    live.add(job.id)
    waitFor(job.id).then((result) => use(result, job)).catch((err) => failed?.(job, err)).finally(() => finish(job.id))
  }
}
