// Fail before bundling if a server credential was put in a public build variable.
for (const file of ['.env.production.local', '.env.production', '.env.local', '.env']) {
  try {
    process.loadEnvFile(file)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
for (const name of ['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
  const value = process.env[name]
  if (!value) continue
  let serverOnly = value.startsWith('sb_secret_')
  if (value.split('.').length === 3) {
    try {
      serverOnly ||=
        JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role === 'service_role'
    } catch {
      /* Not a legacy Supabase JWT. */
    }
  }
  if (serverOnly)
    throw new Error(
      name +
        ' contains a server-only credential. Replace it with the publishable/anon key before building.',
    )
}
