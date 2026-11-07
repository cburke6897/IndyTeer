import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  // Move focus into the dialog when it opens, and put it back where it was when it closes.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const first = body.current?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog.current?.querySelector<HTMLElement>('footer ' + FOCUSABLE.split(',').join(',footer ')) ?? dialog.current
    first?.focus()
    return () => { previous?.focus?.() }
  }, [open])

  // Escape closes; Tab and Shift+Tab stay inside the dialog; the page behind does not scroll.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return }
      if (e.key !== 'Tab' || !dialog.current) return
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 animate-fade-in bg-navy-950/55" onClick={onClose} />
      <div ref={dialog} tabIndex={-1} className={cn('relative flex max-h-[92vh] w-full animate-slide-up flex-col rounded-t-xl bg-white shadow-pop outline-none sm:rounded-lg', widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-xl leading-tight">{title}</h2>
            {description && <p className="mt-1 text-base text-muted">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-md p-2 text-muted hover:bg-surface hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <div ref={body} className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-line bg-surface/60 px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={destructive ? 'danger' : 'primary'} size="lg" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-base leading-relaxed text-ink/90">{message}</div>
    </Modal>
  )
}
