import { useState } from 'react'
import { cn, initials } from '../../lib/utils'
import type { OrgProfile, VolunteerProfile } from '../../types'

const sizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-24 text-3xl', '2xl': 'size-32 text-4xl' }
type Size = keyof typeof sizes

const palette = ['#244B85', '#1F6F5C', '#7A3E1D', '#5B2A86', '#8A2C3F', '#2B5F75', '#4A5A1F', '#142C5B']
function colorFor(seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}

export function Avatar({ person, size = 'md', className }: { person: Pick<VolunteerProfile, 'firstName' | 'lastName' | 'avatar' | 'id'>; size?: Size; className?: string }) {
  return <Face src={person.avatar} text={initials(person.firstName, person.lastName)} bg={colorFor(person.id)} size={size} className={cn('rounded-full', className)} alt={`${person.firstName} ${person.lastName}`} />
}

export function OrgLogo({ org, size = 'md', className }: { org: Pick<OrgProfile, 'name' | 'logo' | 'color'>; size?: Size; className?: string }) {
  return <Face src={org.logo} text={initials(org.name)} bg={org.color} size={size} className={cn('rounded-md', className)} alt={`${org.name} logo`} />
}

function Face({ src, text, bg, size, className, alt }: { src: string | null; text: string; bg: string; size: Size; className?: string; alt: string }) {
  if (src) return <img src={src} alt={alt} className={cn(sizes[size], 'shrink-0 bg-white object-cover ring-1 ring-black/5', className)} />
  return (
    <span aria-label={alt} role="img" style={{ background: bg }} className={cn(sizes[size], 'inline-flex shrink-0 select-none items-center justify-center font-bold tracking-wide text-white', className)}>
      {text}
    </span>
  )
}

/** Image with graceful fallback if a remote photo fails to load. */
export function SafeImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div role="img" aria-label={alt} className={cn('bg-navy-800 bg-[radial-gradient(circle_at_30%_20%,#244b85,transparent_60%)]', className)} />
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn('object-cover', className)} />
}
