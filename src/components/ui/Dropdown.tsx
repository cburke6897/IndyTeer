import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface DropdownProps {
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  panelClassName?: string
  label: string
}

export function Dropdown({ trigger, children, align = 'right', panelClassName, label }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)} className="block">
        {trigger(open)}
      </button>
      {open && (
        <div role="menu" className={cn('absolute z-40 mt-2 min-w-48 animate-pop-in rounded-lg border border-line bg-white py-1.5 shadow-pop', align === 'right' ? 'right-0' : 'left-0', panelClassName)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn('flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-surface', danger ? 'text-danger' : 'text-ink')}
    >
      {icon}
      {children}
    </button>
  )
}
