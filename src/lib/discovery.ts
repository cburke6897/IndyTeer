export interface PublicOpportunity {
  id: string
  title: string
  organizer: string
  sourceId: string
  sourceUrl: string
  applicationUrl: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  state: string
  city: string
  location: string
  category: string
  summary: string
  observedAt: string
  reasons: string[]
}

export function publicSourceLink(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

/** Public, same-origin feed. No Auth token, account or browser storage is required. */
export async function getPublicOpportunities(signal?: AbortSignal): Promise<PublicOpportunity[]> {
  const response = await fetch('/api/discovery/listings', {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000),
    credentials: 'omit',
  })
  if (!response.ok)
    throw new Error('Public discovery is temporarily unavailable. Please try again later.')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items))
    throw new Error('Public discovery is temporarily unavailable. Please try again later.')
  return data.items.filter(
    (item): item is PublicOpportunity =>
      item &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      !!publicSourceLink(item.sourceUrl),
  )
}
