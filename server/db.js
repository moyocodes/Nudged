// Storage for accounts, logins and each user's synced data.
// DATABASE_URL picks the database: postgres://… (e.g. Neon) or mysql://… (e.g. cPanel).
// Without it, the old JSON file (server/data/db.json), so the repo still runs locally with no setup.
// Session tokens are stored hashed: a leaked database can't be used to sign in.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const hashSession = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    email VARCHAR(200) PRIMARY KEY,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(200) NOT NULL,
    name VARCHAR(60) NOT NULL,
    session_hash CHAR(64) NOT NULL UNIQUE,
    confirmed_at BIGINT NOT NULL,
    last_seen BIGINT NOT NULL,
    INDEX (email)
  )`,
  `CREATE TABLE IF NOT EXISTS pending_logins (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(200) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(60) NOT NULL,
    code CHAR(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    sent_at BIGINT NOT NULL,
    expires BIGINT NOT NULL,
    INDEX (email), INDEX (device_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_state (
    email VARCHAR(200) PRIMARY KEY,
    state LONGTEXT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  // Badge art and photo thumbnails, one row each, so the synced state carries a link instead of the picture.
  `CREATE TABLE IF NOT EXISTS images (
    email VARCHAR(200) NOT NULL,
    image_key VARCHAR(100) NOT NULL,
    mime VARCHAR(40) NOT NULL,
    data MEDIUMBLOB NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (email, image_key)
  )`,
  // Which task reminders were already emailed, so each one goes out once.
  `CREATE TABLE IF NOT EXISTS emailed_reminders (
    email VARCHAR(200) NOT NULL,
    reminder_key VARCHAR(200) NOT NULL,
    sent_at BIGINT NOT NULL,
    PRIMARY KEY (email, reminder_key)
  )`,
]

async function mysqlStore(url) {
  const mysql = (await import('mysql2/promise')).default
  const pool = mysql.createPool({ uri: url, connectionLimit: 5, ssl: process.env.DB_SSL === 'true' ? {} : undefined })
  for (const sql of SCHEMA) await pool.query(sql)
  const one = async (sql, args) => (await pool.query(sql, args))[0][0] ?? null
  const run = (sql, args) => pool.query(sql, args)
  const device = (r) => r && { id: r.id, email: r.email, name: r.name, confirmedAt: Number(r.confirmed_at), lastSeen: Number(r.last_seen) }
  const pending = (r) => r && { id: r.id, email: r.email, deviceId: r.device_id, deviceName: r.device_name, code: r.code, attempts: r.attempts, sentAt: Number(r.sent_at), expires: Number(r.expires) }
  console.log('[db] using MySQL')
  return {
    deviceBySession: async (session) => device(await one('SELECT * FROM devices WHERE session_hash = ?', [hashSession(session)])),
    deviceById: async (id) => device(await one('SELECT * FROM devices WHERE id = ?', [id])),
    async saveDevice(id, { email, name, session }) {
      const now = Date.now()
      await run('INSERT IGNORE INTO users (email, created_at) VALUES (?, ?)', [email, now])
      await run(
        `INSERT INTO devices (id, email, name, session_hash, confirmed_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name), session_hash = VALUES(session_hash), confirmed_at = VALUES(confirmed_at), last_seen = VALUES(last_seen)`,
        [id, email, name, hashSession(session), now, now],
      )
    },
    deleteDevice: (id) => run('DELETE FROM devices WHERE id = ?', [id]),
    touchDevice: (id) => run('UPDATE devices SET last_seen = ? WHERE id = ?', [Date.now(), id]),
    userExists: async (email) => !!(await one('SELECT email FROM users WHERE email = ?', [email])),
    savePending: (p) =>
      run(
        `INSERT INTO pending_logins (id, email, device_id, device_name, code, attempts, sent_at, expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE attempts = VALUES(attempts)`,
        [p.id, p.email, p.deviceId, p.deviceName, p.code, p.attempts, p.sentAt, p.expires],
      ),
    pendingById: async (id) => pending(await one('SELECT * FROM pending_logins WHERE id = ?', [id])),
    recentPending: async (email, since) => pending(await one('SELECT * FROM pending_logins WHERE email = ? AND sent_at > ?', [email, since])),
    hasPendingFor: async (deviceId) => !!(await one('SELECT id FROM pending_logins WHERE device_id = ? AND expires > ?', [deviceId, Date.now()])),
    deletePending: (id) => run('DELETE FROM pending_logins WHERE id = ?', [id]),
    async getState(email) {
      const r = await one('SELECT state, updated_at FROM user_state WHERE email = ?', [email])
      return r && { state: JSON.parse(r.state), updatedAt: Number(r.updated_at) }
    },
    async getImage(email, key) {
      const r = await one('SELECT mime, data FROM images WHERE email = ? AND image_key = ?', [email, key])
      return r && { mime: r.mime, data: r.data }
    },
    putImage: (email, key, mime, data) =>
      run('INSERT INTO images (email, image_key, mime, data, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE mime = VALUES(mime), data = VALUES(data), updated_at = VALUES(updated_at)', [email, key, mime, data, Date.now()]),
    putState: (email, state) =>
      run('INSERT INTO user_state (email, state, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE state = VALUES(state), updated_at = VALUES(updated_at)', [email, JSON.stringify(state), Date.now()]),
    allStates: async () => (await pool.query('SELECT email, state FROM user_state'))[0].map((r) => ({ email: r.email, state: JSON.parse(r.state) })),
    emailedReminders: async (email) => new Set((await pool.query('SELECT reminder_key FROM emailed_reminders WHERE email = ?', [email]))[0].map((r) => r.reminder_key)),
    async markRemindersEmailed(email, keys) {
      for (const key of keys) await run('INSERT IGNORE INTO emailed_reminders (email, reminder_key, sent_at) VALUES (?, ?, ?)', [email, key, Date.now()])
    },
  }
}

// Postgres: same tables as MySQL, in Postgres spelling. Pool can be swapped for tests.
const PG_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (email VARCHAR(200) PRIMARY KEY, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(100) PRIMARY KEY, email VARCHAR(200) NOT NULL, name VARCHAR(60) NOT NULL,
    session_hash CHAR(64) NOT NULL UNIQUE, confirmed_at BIGINT NOT NULL, last_seen BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS devices_email ON devices (email)`,
  `CREATE TABLE IF NOT EXISTS pending_logins (
    id VARCHAR(64) PRIMARY KEY, email VARCHAR(200) NOT NULL, device_id VARCHAR(100) NOT NULL, device_name VARCHAR(60) NOT NULL,
    code CHAR(6) NOT NULL, attempts INT NOT NULL DEFAULT 0, sent_at BIGINT NOT NULL, expires BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS pending_email ON pending_logins (email)`,
  `CREATE INDEX IF NOT EXISTS pending_device ON pending_logins (device_id)`,
  `CREATE TABLE IF NOT EXISTS user_state (email VARCHAR(200) PRIMARY KEY, state TEXT NOT NULL, updated_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS images (
    email VARCHAR(200) NOT NULL, image_key VARCHAR(100) NOT NULL, mime VARCHAR(40) NOT NULL, data TEXT NOT NULL,
    updated_at BIGINT NOT NULL, PRIMARY KEY (email, image_key)
  )`,
  `CREATE TABLE IF NOT EXISTS emailed_reminders (email VARCHAR(200) NOT NULL, reminder_key VARCHAR(200) NOT NULL, sent_at BIGINT NOT NULL, PRIMARY KEY (email, reminder_key))`,
]

export async function pgStore(url, Pool) {
  Pool ??= (await import('pg')).default.Pool
  // Images are kept as base64 text: plain and portable across Postgres hosts.
  // Hosted Postgres (Neon, Render) needs TLS; a local one usually doesn't.
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url)
  const pool = new Pool({ connectionString: url, max: 5, ssl: local ? false : { rejectUnauthorized: false } })
  for (const sql of PG_SCHEMA) await pool.query(sql)
  const one = async (sql, args) => (await pool.query(sql, args)).rows[0] ?? null
  const run = (sql, args) => pool.query(sql, args)
  const device = (r) => r && { id: r.id, email: r.email, name: r.name, confirmedAt: Number(r.confirmed_at), lastSeen: Number(r.last_seen) }
  const pending = (r) => r && { id: r.id, email: r.email, deviceId: r.device_id, deviceName: r.device_name, code: r.code, attempts: r.attempts, sentAt: Number(r.sent_at), expires: Number(r.expires) }
  console.log('[db] using Postgres')
  return {
    deviceBySession: async (session) => device(await one('SELECT * FROM devices WHERE session_hash = $1', [hashSession(session)])),
    deviceById: async (id) => device(await one('SELECT * FROM devices WHERE id = $1', [id])),
    async saveDevice(id, { email, name, session }) {
      const now = Date.now()
      await run('INSERT INTO users (email, created_at) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING', [email, now])
      await run(
        `INSERT INTO devices (id, email, name, session_hash, confirmed_at, last_seen) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, session_hash = EXCLUDED.session_hash, confirmed_at = EXCLUDED.confirmed_at, last_seen = EXCLUDED.last_seen`,
        [id, email, name, hashSession(session), now, now],
      )
    },
    deleteDevice: (id) => run('DELETE FROM devices WHERE id = $1', [id]),
    touchDevice: (id) => run('UPDATE devices SET last_seen = $1 WHERE id = $2', [Date.now(), id]),
    userExists: async (email) => !!(await one('SELECT email FROM users WHERE email = $1', [email])),
    savePending: (p) =>
      run(
        `INSERT INTO pending_logins (id, email, device_id, device_name, code, attempts, sent_at, expires) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET attempts = EXCLUDED.attempts`,
        [p.id, p.email, p.deviceId, p.deviceName, p.code, p.attempts, p.sentAt, p.expires],
      ),
    pendingById: async (id) => pending(await one('SELECT * FROM pending_logins WHERE id = $1', [id])),
    recentPending: async (email, since) => pending(await one('SELECT * FROM pending_logins WHERE email = $1 AND sent_at > $2', [email, since])),
    hasPendingFor: async (deviceId) => !!(await one('SELECT id FROM pending_logins WHERE device_id = $1 AND expires > $2', [deviceId, Date.now()])),
    deletePending: (id) => run('DELETE FROM pending_logins WHERE id = $1', [id]),
    async getImage(email, key) {
      const r = await one('SELECT mime, data FROM images WHERE email = $1 AND image_key = $2', [email, key])
      return r && { mime: r.mime, data: Buffer.from(r.data, 'base64') }
    },
    putImage: (email, key, mime, data) =>
      run('INSERT INTO images (email, image_key, mime, data, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email, image_key) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at', [email, key, mime, data.toString('base64'), Date.now()]),
    async getState(email) {
      const r = await one('SELECT state, updated_at FROM user_state WHERE email = $1', [email])
      return r && { state: JSON.parse(r.state), updatedAt: Number(r.updated_at) }
    },
    putState: (email, state) =>
      run('INSERT INTO user_state (email, state, updated_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at', [email, JSON.stringify(state), Date.now()]),
    allStates: async () => (await pool.query('SELECT email, state FROM user_state')).rows.map((r) => ({ email: r.email, state: JSON.parse(r.state) })),
    emailedReminders: async (email) => new Set((await pool.query('SELECT reminder_key FROM emailed_reminders WHERE email = $1', [email])).rows.map((r) => r.reminder_key)),
    async markRemindersEmailed(email, keys) {
      for (const key of keys) await run('INSERT INTO emailed_reminders (email, reminder_key, sent_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [email, key, Date.now()])
    },
  }
}

// The same interface over one JSON file.
function fileStore() {
  const file = process.env.NUDGY_DB || path.join(import.meta.dirname, 'data', 'db.json')
  let db
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { db = {} }
  db = { users: db.users ?? {}, devices: db.devices ?? {}, pending: db.pending ?? {}, data: db.data ?? {}, images: db.images ?? {}, emailed: db.emailed ?? {} }
  const save = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(db)) }
  const device = (id) => { const d = db.devices[id]; return d && { id, email: d.email, name: d.name, confirmedAt: d.confirmedAt, lastSeen: d.lastSeen } }
  console.log('[db] using the JSON file (set DATABASE_URL for Postgres or MySQL)')
  return {
    deviceBySession: async (session) => device(Object.keys(db.devices).find((id) => db.devices[id].sessionHash === hashSession(session))),
    deviceById: async (id) => device(id),
    async saveDevice(id, { email, name, session }) {
      const now = Date.now()
      db.users[email] ??= { createdAt: now }
      db.devices[id] = { email, name, sessionHash: hashSession(session), confirmedAt: now, lastSeen: now }
      save()
    },
    async deleteDevice(id) { delete db.devices[id]; save() },
    async touchDevice(id) { if (db.devices[id]) db.devices[id].lastSeen = Date.now() },
    userExists: async (email) => !!db.users[email] || !!db.data[email],
    async savePending(p) { db.pending[p.id] = p; save() },
    pendingById: async (id) => db.pending[id] ?? null,
    recentPending: async (email, since) => Object.values(db.pending).find((p) => p.email === email && p.sentAt > since) ?? null,
    hasPendingFor: async (deviceId) => Object.values(db.pending).some((p) => p.deviceId === deviceId && p.expires > Date.now()),
    async deletePending(id) { delete db.pending[id]; save() },
    async getImage(email, key) {
      const i = db.images[`${email}|${key}`]
      return i && { mime: i.mime, data: Buffer.from(i.data, 'base64') }
    },
    async putImage(email, key, mime, data) { db.images[`${email}|${key}`] = { mime, data: data.toString('base64') }; save() },
    getState: async (email) => db.data[email] ?? null,
    async putState(email, state) { db.data[email] = { state, updatedAt: Date.now() }; save() },
    allStates: async () => Object.entries(db.data).map(([email, d]) => ({ email, state: d.state })),
    emailedReminders: async (email) => new Set(db.emailed[email] ?? []),
    async markRemindersEmailed(email, keys) { db.emailed[email] = [...(db.emailed[email] ?? []), ...keys]; save() },
  }
}

const url = process.env.DATABASE_URL
export const store = !url ? fileStore() : /^postgres(ql)?:\/\//.test(url) ? await pgStore(url) : await mysqlStore(url)
