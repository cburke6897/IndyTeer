import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function StatCard({ label, value, hint, icon, accent }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; accent?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-white p-4 shadow-card', accent ? 'border-gold-100 bg-gold-50/60' : 'border-line')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className={cn('flex size-8 items-center justify-center rounded-md', accent ? 'bg-gold text-navy-950' : 'bg-navy-50 text-navy-700')}>{icon}</span>}
      </div>
      <p className="mt-1.5 text-[28px] leading-none font-bold tracking-tight text-navy">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  )
}
