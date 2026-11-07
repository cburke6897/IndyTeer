import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Logo } from '../../components/ui/Logo'
import { cn } from '../../lib/utils'
import { logout } from '../../store/actions'

export function OnboardingLayout({ children, width = 'max-w-2xl' }: { children: ReactNode; width?: string }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/"><Logo /></Link>
          <button onClick={() => { logout(); navigate('/login') }} className="text-sm font-semibold text-muted hover:text-navy">Log out</button>
        </div>
      </header>
      <main className={cn('mx-auto px-5 py-8 sm:py-12', width)}>{children}</main>
    </div>
  )
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex items-center" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
            <span className="flex items-center gap-2.5" aria-current={active ? 'step' : undefined}>
              <span className={cn('flex size-7 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-navy text-white' : active ? 'bg-gold text-navy-950 ring-4 ring-gold/25' : 'bg-line text-muted')}>
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('hidden text-sm font-semibold sm:block', active || done ? 'text-navy' : 'text-muted')}>{s}</span>
            </span>
            {i < steps.length - 1 && <span className={cn('mx-3 h-px flex-1', done ? 'bg-navy' : 'bg-line-strong')} />}
          </li>
        )
      })}
    </ol>
  )
}
