import { cn } from '../../lib/utils'

export interface TabItem<T extends string> { id: T; label: string; count?: number }

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('scrollbar-thin flex gap-1 overflow-x-auto overflow-y-hidden overflow-y-hidden border-b border-line', className)}>
      {tabs.map((t) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
              on ? 'border-gold text-navy' : 'border-transparent text-muted hover:text-navy',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded px-1.5 text-xs leading-5', on ? 'bg-navy text-white' : 'bg-surface text-muted')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
