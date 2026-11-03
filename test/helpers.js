// Starts the real server (server/index.js) as its own process, on a spare port with a throwaway database.
// DATABASE_URL and RESEND_API_KEY are blanked, so tests can't touch real accounts or send real emails.
// Everything else comes from .env, so model calls in the live tests are real ones.
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const spare = () => new Promise((resolve, reject) => {
  const probe = net.createServer()
  probe.once('error', reject)
  probe.listen(0, () => {
    const { port } = probe.address()
    probe.close(() => resolve(port))
  })
})

export async function startServer() {
  const port = await spare()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nudgy-test-'))
  const dbFile = path.join(dir, 'db.json')
  const child = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(port), DATABASE_URL: '', RESEND_API_KEY: '', NUDGY_DB: dbFile, REQUIRE_SIGNUP_CODE: '', REQUIRE_LOGIN_CODE: '', RENDER: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  child.stdout.on('data', (d) => { logs += d })
  child.stderr.on('data', (d) => { logs += d })

  const url = `http://127.0.0.1:${port}`
  const started = Date.now()
  while (!logs.includes('Nudgy server on')) {
    if (child.exitCode !== null) throw new Error(`Server stopped while starting:\n${logs}`)
    if (Date.now() - started > 20000) throw new Error(`Server took too long to start:\n${logs}`)
    await new Promise((r) => setTimeout(r, 50))
  }
  if (!logs.includes('[db] using the JSON file')) {
    child.kill()
    throw new Error(`Refusing to test against a real database:\n${logs}`)
  }

  const call = async (method, route, { body, session } = {}) => {
    const r = await fetch(url + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: r.status, json, text, headers: r.headers }
  }

  return {
    url,
    port,
    dbFile,
    call,
    logs: () => logs,
    // Signs up through the real route and hands back the session from its cookie.
    async signUp(email = `test-${crypto.randomUUID()}@example.com`, deviceId = crypto.randomUUID()) {
      const r = await call('POST', '/api/auth/start', { body: { email, deviceId, deviceName: 'Test run' } })
      if (r.status !== 200) throw new Error(`Sign up failed: ${r.status} ${r.text}`)
      return { email, deviceId, session: /nudgy_session=([^;]+)/.exec(r.headers.get('set-cookie'))[1] }
    },
    stop() {
      child.kill()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

// The app's own format for "now" and "due": local "YYYY-MM-DDTHH:mm".
export const localIso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
