import { cn } from '../../lib/utils'

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? 'on' : 'off'}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-navy' : 'bg-line-strong')}
    >
      <span className={cn('inline-block size-6 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[28px]' : 'translate-x-1')} />
    </button>
  )
}

export function ToggleRow({ title, description, checked, onChange, disabled }: { title: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div>
        <p className="text-base font-semibold text-ink">{title}</p>
        {description && <p className="mt-0.5 text-[15px] text-muted">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  )
}
