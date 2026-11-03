import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// npm test: no model calls. npm run test:live: real model calls.
// Blank DATABASE_URL and a temp NUDGY_DB, so a test run can never reach the real database.
export default defineConfig({
  test: {
    include: process.env.TEST_LIVE ? ['test/live/**/*.test.js'] : ['test/*.test.js'],
    env: {
      DATABASE_URL: '',
      NUDGY_DB: path.join(os.tmpdir(), `nudgy-test-${process.pid}.json`),
      RESEND_API_KEY: '',
    },
    testTimeout: process.env.TEST_LIVE ? 240000 : 15000,
    hookTimeout: 30000,
  },
})
