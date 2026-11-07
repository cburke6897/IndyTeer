import type { ReactNode } from 'react'
import { BadgeCheck } from 'lucide-react'
import { cn } from '../../lib/utils'

const tones = {
  neutral: 'bg-surface text-muted border-line',
  navy: 'bg-navy-50 text-navy-700 border-navy-100',
  gold: 'bg-gold-50 text-gold-700 border-gold-100',
  success: 'bg-success-50 text-success border-green-200',
  danger: 'bg-danger-50 text-danger border-red-200',
}

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: keyof typeof tones; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-sm font-semibold leading-5 whitespace-nowrap', tones[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function VerifiedMark({ size = 15 }: { size?: number }) {
  return <BadgeCheck size={size} className="inline shrink-0 fill-navy-700 text-white" aria-label="Verified organization" role="img" />
}
