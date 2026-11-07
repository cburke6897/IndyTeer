import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('Hosted smoke testing requires an explicit disposable-QA opt-in',()=>{
 const result=spawnSync(process.execPath,['scripts/live-smoke.mjs','--project-ref=shiuqwmvvcmorfiyxttg'],{encoding:'utf8'})
 assert.notEqual(result.status,0)
 assert.match(result.stderr,/allow-tagged-qa/)
})

test('Public builds reject secret and service-role keys without logging their values', () => {
  const jwt =
    'header.' +
    Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') +
    '.signature'
  for (const key of ['sb_secret_do_not_print_this_value', jwt]) {
    const result = spawnSync(process.execPath, ['scripts/check-public-env.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, VITE_SUPABASE_ANON_KEY: key },
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /server-only credential/)
    assert.equal(result.stderr.includes(key), false)
  }
})

test('Demo seed refuses hosted project URLs before creating any users', () => {
  const result = spawnSync(process.execPath, ['scripts/seed-demo.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_URL: 'https://example.supabase.co' },
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /restricted to local Supabase/)
})
