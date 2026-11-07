export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

export function nowISO() {
  return new Date().toISOString()
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number) {
  const d = parseDate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return ''
  return parseDate(iso).toLocaleDateString('en-US', opts)
}

export function formatDateLong(iso: string) {
  return formatDate(iso, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${pad(m)} ${suffix}`
}

export function timeRange(a: string, b: string) {
  return `${formatTime(a)} – ${formatTime(b)}`
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso.slice(0, 10), { month: 'short', day: 'numeric' })
}

export function initials(first: string, last = '') {
  const a = first.trim()[0] ?? ''
  const b = last.trim()[0] ?? (last ? '' : first.trim().split(/\s+/)[1]?.[0] ?? '')
  return (a + b).toUpperCase()
}

export function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`
}

export function formatHours(h: number) {
  return Number.isInteger(h) ? String(h) : h.toFixed(1)
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function normalizeUrl(u: string) {
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

export function displayUrl(u: string) {
  return u.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

/** Read an image file, downscale it, and return a compressed data URL (keeps localStorage small). */
export function readImage(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That image could not be loaded.'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(reader.result as string)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
