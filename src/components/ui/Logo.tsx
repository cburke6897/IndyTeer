import { cn } from '../../lib/utils'

/** IndyTeer mark: three volunteers under a gold arc. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="IndyTeer">
      <rect width="100" height="100" rx="22" fill="#031B4E" />
      <rect x=".5" y=".5" width="99" height="99" rx="21.5" fill="none" stroke="#fff" strokeOpacity=".14" />
      <path d="M16,38.8 Q50,2.2 83.9,38.8 Q50,12 16,38.8Z" fill="#FBC13A" />
      <circle cx="50" cy="43.1" r="9.1" fill="#fff" />
      <path d="M29.7,73.4 C30.5,61 39,53.6 50,53.6 C61,53.6 69.5,61 70.3,73.4 Q70.3,73.8 69.8,73.8 H30.2 Q29.7,73.8 29.7,73.4Z" fill="#fff" />
      <g>
        <circle cx="27.4" cy="48.1" r="7.6" fill="#fff" />
        <path d="M10.8,72 C12.5,62 20,57.2 27.4,57.2 C29.5,57.2 31.4,57.5 33.1,58 C29.5,61.5 27.3,66 26.3,70.6 C21,71.4 17.5,72.2 14.8,73.2 H13 Q10.8,73.2 10.8,72Z" fill="#fff" />
      </g>
      <g transform="translate(100,0) scale(-1,1)">
        <circle cx="27.4" cy="48.1" r="7.6" fill="#fff" />
        <path d="M10.8,72 C12.5,62 20,57.2 27.4,57.2 C29.5,57.2 31.4,57.5 33.1,58 C29.5,61.5 27.3,66 26.3,70.6 C21,71.4 17.5,72.2 14.8,73.2 H13 Q10.8,73.2 10.8,72Z" fill="#fff" />
      </g>
    </svg>
  )
}

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={32} />
      <span className={cn('text-[19px] font-extrabold tracking-tight', light ? 'text-white' : 'text-navy')}>
        Indy<span className={light ? 'text-gold' : 'text-navy-700'}>Teer</span>
      </span>
    </span>
  )
}
