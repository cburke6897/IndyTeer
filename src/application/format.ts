export const splitList = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
export function imageUrl(bucket: string, path: string | null | undefined) {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  const base = import.meta.env.VITE_SUPABASE_URL
  return (
    base +
    '/storage/v1/object/public/' +
    bucket +
    '/' +
    path.split('/').map(encodeURIComponent).join('/')
  )
}
export const dateLabel = (date: string) => date.slice(0, 10)
export const shortTime = (time: string) => time.slice(0, 5)
