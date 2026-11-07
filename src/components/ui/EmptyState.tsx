import type { ReactNode } from 'react'

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-navy-50 text-navy-700">{icon}</div>}
      <h3 className="text-base">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
