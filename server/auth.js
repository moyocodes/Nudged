// Accounts without passwords: each device is confirmed by an emailed link or 6-digit code,
// then gets its own session. The session lives in an HTTP-only cookie, so page scripts can't read it.
// Tasks, chat, points and streak sync per account. Storage is in db.js (MySQL, or a JSON file locally).
// Email goes through Resend when RESEND_API_KEY is set; otherwise the link and code are logged here.
import crypto from 'node:crypto'
import { store } from './db.js'
import { sendDoneEmail, sendLoginEmail } from './reminders.js'

const CODE_TTL_MS = 15 * 60 * 1000
const RESEND_GAP_MS = 60 * 1000
const COOKIE = 'nudgy_session'
const COOKIE_DAYS = 180

// A fixed code for demos. On when no email service is connected (nobody could receive a real one), or when
// DEMO_CODE is set. Set DEMO_CODE= (empty) to switch it off. Real emails still work either way.
const demoCode = () => (process.env.DEMO_CODE !== undefined ? process.env.DEMO_CODE.trim() : process.env.RESEND_API_KEY ? '' : '123456')

const token = () => crypto.randomBytes(24).toString('base64url')
const validEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length < 200

async function sendEmail(to, link, code) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[auth] no RESEND_API_KEY, so here's the confirmation for ${to}: ${link} (code ${code})`)
    return
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Nudgy <onboarding@resend.dev>',
      to,
      subject: `Your Nudgy code: ${code}`,
      text: `Someone (hopefully you) wants to use Nudgy on a new device.\n\nConfirm it: ${link}\nOr type this code: ${code}\n\nNot you? Ignore this and nothing happens.`,
    }),
  })
  if (!r.ok) throw new Error(`Email failed: ${r.status} ${await r.text()}`)
}

// A welcome note for new accounts. It never blocks signing up: if it can't be sent, the failure is only logged.
// The email wears the app's look: cream page, white card, Geist-ish type, purple button and the mascot icon.
const welcomeHtml = (url) => `<!doctype html><html><body style="margin:0;background:#faf6f0;padding:32px 16px;font-family:Geist,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1726">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #ece6dc">
<tr><td style="padding:32px 32px 8px"><a href="${url}"><img src="${url}/icon-192.png" width="56" height="56" alt="Nudgy" style="display:block;border-radius:14px;border:0"></a></td></tr>
<tr><td style="padding:8px 32px 0"><h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.02em">Welcome aboard! 👋</h1></td></tr>
<tr><td style="padding:16px 32px 0;font-size:16px;line-height:1.6">I'm Nudgy, and I'll poke you about the things you'd rather not forget.<br><br>Tell me what's on your plate and I'll keep track. No judgement, just gentle nudges.</td></tr>
<tr><td style="padding:24px 32px 0"><a href="${url}" style="display:inline-block;background:#5b4be8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:999px">Set your first reminder</a></td></tr>
<tr><td style="padding:24px 32px 32px;font-size:13px;line-height:1.5;color:#1b1726;opacity:.6">You're all signed in, so just pick up where you left off.<br><a href="${url}" style="color:#5b4be8;text-decoration:underline">${url.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`

async function sendWelcome(to) {
  if (!process.env.RESEND_API_KEY) return console.log(`[auth] no RESEND_API_KEY, so no welcome email for ${to}`)
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Nudgy <onboarding@resend.dev>',
        to,
        subject: 'Welcome to Nudgy',
        html: welcomeHtml(process.env.APP_URL || 'https://getnudged.chat'),
        text: `Welcome aboard! I'm Nudgy, and I'll nudge you about the things you'd rather not forget.\n\nTell me what's on your plate and I'll keep track. No judgement, just gentle pokes.\n\nYou're all signed in, so just pick up where you left off.\n\nSet your first reminder: ${process.env.APP_URL || 'https://getnudged.chat'}`,
      }),
    })
    if (!r.ok) console.error('[auth] welcome email failed:', r.status, await r.text())
  } catch (err) {
    console.error('[auth] welcome email failed:', err.message)
  }
}

const readCookie = (req, name) =>
  (req.get('cookie') ?? '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1]

// HttpOnly: scripts can't read it. SameSite=Lax: other sites can't send it with their requests. Secure on https.
function setSession(req, res, session) {
  const secure = req.secure || req.get('x-forwarded-proto') === 'https'
  res.cookie(COOKIE, session, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: COOKIE_DAYS * 86400000 })
}

// The device behind a request: the session cookie (or an "Authorization: Bearer" header, for scripts).
async function deviceFor(req) {
  const session = readCookie(req, COOKIE) || req.get('authorization')?.replace(/^Bearer /, '')
  return session ? store.deviceBySession(session) : null
}

// A login email goes out only for a device this account hasn't used before.
const isNewDevice = async (deviceId, email) => (await store.deviceById(deviceId))?.email !== email

// Signs a device in: a fresh session, saved hashed, handed back as the cookie.
async function signIn(req, res, deviceId, email, deviceName) {
  const session = token()
  await store.saveDevice(deviceId, { email, name: String(deviceName ?? 'A device').slice(0, 60), session })
  setSession(req, res, session)
  return { email }
}

// Route errors (a dropped database connection, say) answer 500 instead of crashing the server.
const safe = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error('[auth]', err.message)
  res.status(500).json({ error: 'Something went wrong on my side. Try again in a bit.' })
})

export function mountAuth(app) {
  // Behind Render's proxy, so req.secure reflects https.
  app.set('trust proxy', 1)

  // Step 1: email in, confirmation out.
  app.post('/api/auth/start', safe(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const { deviceId, deviceName } = req.body ?? {}
    if (!validEmail(email) || typeof deviceId !== 'string' || deviceId.length > 100) return res.status(400).json({ error: 'Check that email' })
    // Hackathon demo: no code to enter, the device is signed in straight away (new accounts get a welcome email). Set REQUIRE_SIGNUP_CODE=true to confirm by email.
    if (process.env.REQUIRE_SIGNUP_CODE !== 'true') {
      const isNew = !(await store.userExists(email))
      const newDevice = await isNewDevice(deviceId, email)
      const signedIn = await signIn(req, res, deviceId, email, deviceName)
      // Not awaited: the email can't hold up or break signing up.
      if (isNew) sendWelcome(email)
      else if (newDevice) sendLoginEmail(email, String(deviceName ?? 'A device').slice(0, 60))
      return res.json(signedIn)
    }
    if (await store.recentPending(email, Date.now() - RESEND_GAP_MS)) return res.status(429).json({ error: 'Email sent less than a minute ago. Check your inbox (and spam).' })

    const id = token()
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
    await store.savePending({ id, email, deviceId, deviceName: String(deviceName ?? 'A device').slice(0, 60), code, attempts: 0, sentAt: Date.now(), expires: Date.now() + CODE_TTL_MS })
    const link = `${req.get('origin') || `http://${req.get('host')}`}/api/auth/confirm?t=${id}`
    try {
      await sendEmail(email, link, code)
      res.json({ pendingId: id, demoCode: demoCode() || undefined })
    } catch (err) {
      console.error('[auth]', err.message)
      await store.deletePending(id)
      res.status(502).json({ error: "Couldn't send the email. Try again in a bit." })
    }
  }))

  // Log in: an email that already has an account gets in right away, no code. This is for the hackathon demo; it
  // means anyone who knows an email can open that account. Set REQUIRE_LOGIN_CODE=true to ask for the emailed
  // code on login too (the client then falls back to the code flow).
  const loginTries = new Map()
  app.post('/api/auth/login', safe(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const { deviceId, deviceName } = req.body ?? {}
    if (!validEmail(email) || typeof deviceId !== 'string' || deviceId.length > 100) return res.status(400).json({ error: 'Check that email' })
    if (process.env.REQUIRE_LOGIN_CODE === 'true') return res.status(403).json({ error: 'A code is needed', needsCode: true })
    // A little brake on guessing emails: 10 tries a minute per email.
    const now = Date.now()
    const recent = (loginTries.get(email) ?? []).filter((t) => now - t < 60000)
    if (recent.length >= 10) return res.status(429).json({ error: 'Too many tries. Wait a minute.' })
    loginTries.set(email, [...recent, now])

    if (!(await store.userExists(email))) return res.status(404).json({ error: "I don't know that email. Sign up instead?" })
    const newDevice = await isNewDevice(deviceId, email)
    const signedIn = await signIn(req, res, deviceId, email, deviceName)
    if (newDevice) sendLoginEmail(email, String(deviceName ?? 'A device').slice(0, 60))
    res.json(signedIn)
  }))

  // Step 2a: the link in the email. It may be opened on another device, so it confirms the waiting device,
  // which picks up its cookie from /api/auth/status.
  const confirmed = new Map() // deviceId -> email, until the waiting device collects it
  app.get('/api/auth/confirm', safe(async (req, res) => {
    const p = await store.pendingById(String(req.query.t ?? ''))
    const ok = p && p.expires > Date.now()
    if (ok) {
      await store.deletePending(p.id)
      confirmed.set(p.deviceId, { email: p.email, deviceName: p.deviceName, at: Date.now() })
    }
    res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;text-align:center">
      <div><h1>${ok ? 'Device confirmed 👉' : 'That link has expired'}</h1><p>${ok ? 'Head back to Nudgy on that device. It signs itself in.' : 'Ask Nudgy for a new one.'}</p></div>`)
  }))

  // Step 2b: or the 6-digit code typed into the app.
  app.post('/api/auth/code', safe(async (req, res) => {
    const { pendingId, code } = req.body ?? {}
    const p = await store.pendingById(String(pendingId ?? ''))
    if (!p || p.expires < Date.now()) return res.status(400).json({ error: 'That code expired. Send a new one.' })
    p.attempts++
    if (p.attempts > 5) {
      await store.deletePending(p.id)
      return res.status(429).json({ error: 'Too many tries. Send a new code.' })
    }
    const demo = demoCode()
    if (String(code).trim() !== p.code && !(demo && String(code).trim() === demo)) {
      await store.savePending(p)
      return res.status(400).json({ error: "That's not the code. Close, maybe?" })
    }
    await store.deletePending(p.id)
    res.json(await signIn(req, res, p.deviceId, p.email, p.deviceName))
  }))

  // The waiting device polls this until the link is clicked (possibly on another device).
  app.get('/api/auth/status', safe(async (req, res) => {
    const deviceId = String(req.query.deviceId ?? '')
    const c = confirmed.get(deviceId)
    if (c && Date.now() - c.at < CODE_TTL_MS && !(await store.hasPendingFor(deviceId))) {
      confirmed.delete(deviceId)
      return res.json(await signIn(req, res, deviceId, c.email, c.deviceName))
    }
    res.json({ waiting: true })
  }))

  // Who's signed in on this device, from the cookie. The app asks on start instead of keeping a token itself.
  app.get('/api/auth/me', safe(async (req, res) => {
    const device = await deviceFor(req)
    res.json(device ? { email: device.email } : { email: null })
  }))

  app.post('/api/auth/logout', safe(async (req, res) => {
    const device = await deviceFor(req)
    if (device) await store.deleteDevice(device.id)
    res.clearCookie(COOKIE, { path: '/' })
    res.json({ ok: true })
  }))

  // Images (badge art, photo thumbnails), stored per account. Same cookie as everything else, so an <img> on
  // the page loads them and nobody else can.
  const IMAGE_KEY = /^[a-zA-Z0-9_-]{1,100}$/
  const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
  app.put('/api/images/:key', safe(async (req, res) => {
    const device = await deviceFor(req)
    if (!device) return res.status(401).json({ error: 'Signed out' })
    const m = /^data:([a-z/]+);base64,(.+)$/.exec(String(req.body?.data ?? ''))
    if (!IMAGE_KEY.test(req.params.key) || !m || !IMAGE_TYPES.includes(m[1])) return res.status(400).json({ error: 'Not an image' })
    const data = Buffer.from(m[2], 'base64')
    if (data.length > 1.5 * 1024 * 1024) return res.status(413).json({ error: 'Image too big' })
    await store.putImage(device.email, req.params.key, m[1], data)
    res.json({ url: `/api/images/${req.params.key}?v=${Date.now()}` })
  }))

  app.get('/api/images/:key', safe(async (req, res) => {
    const device = await deviceFor(req)
    if (!device) return res.status(401).end()
    const img = IMAGE_KEY.test(req.params.key) && (await store.getImage(device.email, req.params.key))
    if (!img) return res.status(404).end()
    // The ?v= in the link changes whenever the image does, so it can be cached for good.
    res.set('Cache-Control', 'private, max-age=31536000, immutable').type(img.mime).send(img.data)
  }))

  // Sync: the whole saved state per account, last write wins.
  // Finishing a reminder sends one note. Capped, since the app is the only thing vouching for the title.
  const doneEmails = new Map()
  app.post('/api/task-done', safe(async (req, res) => {
    const device = await deviceFor(req)
    if (!device) return res.status(401).json({ error: 'Signed out' })
    const title = String(req.body?.title ?? '').trim().slice(0, 200)
    if (!title) return res.status(400).json({ error: 'No title' })
    const recent = (doneEmails.get(device.email) ?? []).filter((t) => Date.now() - t < 3600000)
    if (recent.length < 20) {
      doneEmails.set(device.email, [...recent, Date.now()])
      sendDoneEmail(device.email, title)
    }
    res.json({ ok: true })
  }))

  app.get('/api/sync', safe(async (req, res) => {
    const device = await deviceFor(req)
    if (!device) return res.status(401).json({ error: 'Signed out' })
    await store.touchDevice(device.id)
    res.json(await store.getState(device.email))
  }))

  app.put('/api/sync', safe(async (req, res) => {
    const device = await deviceFor(req)
    if (!device) return res.status(401).json({ error: 'Signed out' })
    const state = req.body?.state
    if (!state || typeof state !== 'object') return res.status(400).json({ error: 'No state' })
    await store.putState(device.email, state)
    await store.touchDevice(device.id)
    res.json({ ok: true })
  }))
}
