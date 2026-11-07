import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const root = fileURLToPath(new URL('../', import.meta.url))
try {
  process.loadEnvFile(resolve(root, '.env.local'))
} catch (e) {
  if (e.code !== 'ENOENT') throw e
}
export function publicConfig(env = process.env) {
  const url = env.SUPABASE_URL || ''
  const key = env.SUPABASE_PUBLISHABLE_KEY || ''
  let serverKey = key.startsWith('sb_secret_')
  try {
    serverKey ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'service_role'
  } catch {
    /* publishable key */
  }
  if (serverKey)
    throw new Error('A server credential was configured as a publishable key. Remove it.')
  if (url && !/^https:\/\/[a-z]{20}\.supabase\.co$/.test(url))
    throw new Error('Use a hosted Supabase project URL without a path.')
  return {
    supabaseUrl: url,
    publishableKey: key,
    importsEnabled: env.DISCOVERY_ENABLE_IMPORTS === 'true' && !!url && !!key,
  }
}
export function config(env = process.env) {
  const stateValue = (env.DISCOVERY_STATES || 'IN').toUpperCase()
  const states = stateValue === 'ALL' ? [] : stateValue.split(',').map((s) => s.trim())
  if (states.some((s) => !/^[A-Z]{2}$/.test(s)))
    throw new Error('Use comma-separated two-letter states.')
  const horizon = Number(env.DISCOVERY_HORIZON_DAYS || 30)
  const port = Number(env.DISCOVERY_PORT || 5188)
  if (
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    horizon > 90 ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  )
    throw new Error('Invalid horizon or local port.')
  const sources = JSON.parse(readFileSync(resolve(root, 'sources.json'), 'utf8'))
  return {
    ...publicConfig(env),
    port,
    states,
    horizon,
    sources,
    contact: env.DISCOVERY_CONTACT || '',
    npsKey: env.NPS_API_KEY || 'DEMO_KEY',
    dbPath: resolve(root, 'data/discovery.sqlite'),
  }
}
