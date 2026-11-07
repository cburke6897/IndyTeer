import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export function ChipSelect({ options, value, onChange, label, error }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; label?: string; error?: string }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  return (
    <div>
      {label && <p className="mb-2 text-[13px] font-semibold text-ink">{label}</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => {
          const on = value.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors',
                on ? 'border-navy bg-navy text-white' : 'border-line-strong bg-white text-ink hover:border-navy-200 hover:bg-navy-50',
              )}
            >
              {on && <Check size={13} strokeWidth={3} />}
              {o}
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
    </div>
  )
}
