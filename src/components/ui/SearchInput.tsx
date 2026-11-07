import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function SearchInput({ value, onChange, placeholder = 'Search', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-md border border-line-strong bg-white pr-9 pl-9 text-sm placeholder:text-muted/70 focus:border-navy-700 focus:ring-2 focus:ring-navy-700/25 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink">
          <X size={15} />
        </button>
      )}
    </div>
  )
}
