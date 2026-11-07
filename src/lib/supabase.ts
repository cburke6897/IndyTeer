import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Match the shared backend configuration. Keep the previous name as a fallback
// so existing local setups continue to work during branch integration.
const supabasePublicKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublicKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local and restart Vite.',
  )
}

// Publishable keys are intended for browser use. Row Level Security and Storage
// policies provide the access controls; never put a service role key here.
export const supabase = createClient<Database>(supabaseUrl, supabasePublicKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    persistSession: true,
  },
})
