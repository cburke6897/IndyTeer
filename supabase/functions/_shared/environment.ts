export function serverEnvironment() {
  let secretKeys: Record<string, string>, publicKeys: Record<string, string>
  try {
    secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    publicKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
  } catch {
    throw new Error('Server key configuration is invalid.')
  }
  const url = Deno.env.get('SUPABASE_URL')
  const adminKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = publicKeys.default || Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !adminKey || !publicKey) throw new Error('Server configuration is incomplete.')
  return { url, adminKey, publicKey }
}
