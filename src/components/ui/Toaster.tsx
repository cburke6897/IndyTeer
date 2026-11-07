import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { dismissToast, useToasts } from '../../store/toast'

export function Toaster() {
  const toasts = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-lg border border-line bg-white p-3.5 shadow-pop">
          {t.kind === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            : t.kind === 'error' ? <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
            : <Info size={18} className="mt-0.5 shrink-0 text-navy-700" />}
          <p className="flex-1 text-sm font-medium text-ink">{t.message}</p>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="text-muted hover:text-ink"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
