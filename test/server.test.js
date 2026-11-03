// The real server over real HTTP, on a throwaway database. Only routes and refusals that never reach a model.
import fs from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { startServer } from './helpers.js'

let server
beforeAll(async () => { server = await startServer() })
afterAll(() => server?.stop())

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('every route that spends model credits needs a login', () => {
  it.each(['test', 'extract', 'proof', 'plan', 'checkin', 'mascot', 'badge', 'nudge'])('POST /api/%s', async (route) => {
    const r = await server.call('POST', `/api/${route}`, { body: { text: 'hi', title: 'hi' } })
    expect(r.status).toBe(401)
    expect(server.logs()).not.toContain('[usage]')
  })

  it('a made-up session is refused too', async () => {
    const r = await server.call('POST', '/api/nudge', { body: { title: 'hi' }, session: 'made-up' })
    expect(r.status).toBe(401)
  })

  it('the voice socket refuses a signed-out browser', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/api/asr`)
    const result = await new Promise((resolve) => {
      ws.on('error', (err) => resolve(err.message))
      ws.on('open', () => resolve('open'))
    })
    expect(result).toContain('401')
  })
})

describe('accounts', () => {
  it('signs up, knows who you are, and logs out', async () => {
    const { email, session } = await server.signUp()
    expect((await server.call('GET', '/api/auth/me', { session })).json).toEqual({ email })
    expect((await server.call('POST', '/api/auth/logout', { session })).status).toBe(200)
    expect((await server.call('GET', '/api/auth/me', { session })).json).toEqual({ email: null })
  })

  it('sets the session as an HttpOnly cookie', async () => {
    const r = await server.call('POST', '/api/auth/start', { body: { email: 'cookie@example.com', deviceId: 'cookie-device' } })
    const cookie = r.headers.get('set-cookie')
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('stores email in lower case', async () => {
    const r = await server.call('POST', '/api/auth/start', { body: { email: ' MixedCase@Example.com ', deviceId: 'case-device' } })
    expect(r.json.email).toBe('mixedcase@example.com')
  })

  it.each([
    ['a bad email', { email: 'nope', deviceId: 'd' }],
    ['no device', { email: 'ok@example.com' }],
    ['an oversized device id', { email: 'ok@example.com', deviceId: 'x'.repeat(101) }],
  ])('refuses %s', async (_, body) => {
    expect((await server.call('POST', '/api/auth/start', { body })).status).toBe(400)
    expect((await server.call('POST', '/api/auth/login', { body })).status).toBe(400)
  })

  it('login only works for an email that has an account', async () => {
    expect((await server.call('POST', '/api/auth/login', { body: { email: 'stranger@example.com', deviceId: 'd1' } })).status).toBe(404)
    const { email } = await server.signUp()
    const r = await server.call('POST', '/api/auth/login', { body: { email, deviceId: 'second-device' } })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ email })
  })

  it('brakes repeated login attempts', async () => {
    const body = { email: 'guess@example.com', deviceId: 'd2' }
    for (let i = 0; i < 10; i++) await server.call('POST', '/api/auth/login', { body })
    expect((await server.call('POST', '/api/auth/login', { body })).status).toBe(429)
  })

  it('never stores the session in the clear', async () => {
    const { email, session } = await server.signUp()
    const saved = fs.readFileSync(server.dbFile, 'utf8')
    expect(saved).toContain(email)
    expect(saved).not.toContain(session)
  })
})

describe('sync', () => {
  it('needs a login', async () => {
    expect((await server.call('GET', '/api/sync')).status).toBe(401)
    expect((await server.call('PUT', '/api/sync', { body: { state: {} } })).status).toBe(401)
  })

  it('saves and returns state', async () => {
    const { session } = await server.signUp()
    const state = { tasks: [{ id: 't', title: 'Rent' }] }
    expect((await server.call('PUT', '/api/sync', { body: { state }, session })).status).toBe(200)
    expect((await server.call('GET', '/api/sync', { session })).json.state).toEqual(state)
  })

  it('keeps accounts apart', async () => {
    const one = await server.signUp()
    const two = await server.signUp()
    await server.call('PUT', '/api/sync', { body: { state: { tasks: ['mine'] } }, session: one.session })
    expect((await server.call('GET', '/api/sync', { session: two.session })).json).toBeNull()
  })

  it('shares state between two devices on one account', async () => {
    const first = await server.signUp()
    const second = await server.signUp(first.email)
    await server.call('PUT', '/api/sync', { body: { state: { tasks: ['shared'] } }, session: first.session })
    expect((await server.call('GET', '/api/sync', { session: second.session })).json.state.tasks).toEqual(['shared'])
  })

  it('refuses a missing state', async () => {
    const { session } = await server.signUp()
    expect((await server.call('PUT', '/api/sync', { body: {}, session })).status).toBe(400)
  })
})

describe('images', () => {
  it('stores per account', async () => {
    const one = await server.signUp()
    const two = await server.signUp()
    const put = await server.call('PUT', '/api/images/badge1', { body: { data: PNG }, session: one.session })
    expect(put.status).toBe(200)
    const got = await server.call('GET', '/api/images/badge1', { session: one.session })
    expect(got.status).toBe(200)
    expect(got.headers.get('content-type')).toContain('image/png')
    expect((await server.call('GET', '/api/images/badge1', { session: two.session })).status).toBe(404)
    expect((await server.call('GET', '/api/images/badge1')).status).toBe(401)
  })

  it('refuses things that are not images, and bad names', async () => {
    const { session } = await server.signUp()
    expect((await server.call('PUT', '/api/images/x', { body: { data: 'data:text/html;base64,PGI+' }, session })).status).toBe(400)
    expect((await server.call('PUT', '/api/images/bad.name', { body: { data: PNG }, session })).status).toBe(400)
  })

  it('refuses images over 1.5 MB', async () => {
    const { session } = await server.signUp()
    const big = `data:image/png;base64,${Buffer.alloc(1.6 * 1024 * 1024).toString('base64')}`
    expect((await server.call('PUT', '/api/images/big', { body: { data: big }, session })).status).toBe(413)
  })
})

describe('input checks in front of the models', () => {
  let session
  beforeAll(async () => { ({ session } = await server.signUp()) })

  it.each([
    ['extract with no text', '/api/extract', { text: '   ' }],
    ['nudge with no task', '/api/nudge', {}],
    ['proof with no photo', '/api/proof', { phrase: 'milk' }],
    ['proof with nothing to look for', '/api/proof', { image: PNG }],
    ['plan with no reminders', '/api/plan', { reminders: [], now: '2026-06-10T12:00' }],
    ['plan with no time', '/api/plan', { reminders: [{ n: 1 }] }],
    ['mascot with no look', '/api/mascot', { look: '   ' }],
    ['an unknown badge', '/api/badge', { badge: 'nope' }],
  ])('refuses %s', async (_, route, body) => {
    expect((await server.call('POST', route, { body, session })).status).toBe(400)
    expect(server.logs()).not.toContain('[usage]')
  })

  it('an unknown background job is a 404', async () => {
    expect((await server.call('GET', '/api/jobs/nope', { session })).status).toBe(404)
  })
})

describe('the cron route', () => {
  it('hides without the secret', async () => {
    expect((await server.call('POST', '/api/cron/reminders')).status).toBe(404)
  })
})
