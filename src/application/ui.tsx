import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  )
}
export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={'rounded-xl border border-line bg-white p-5 shadow-card sm:p-6 ' + className}
    >
      {title && <h2 className="mb-4 text-lg">{title}</h2>}
      {children}
    </section>
  )
}
export function QueryState({
  loading,
  error,
  refresh,
}: {
  loading: boolean
  error: string | null
  refresh: () => void
}) {
  return loading ? (
    <div className="p-10 text-center text-muted" role="status">
      Loading…
    </div>
  ) : (
    <Panel title="We couldn’t load this page">
      <p className="mb-4 text-danger" role="alert">
        {error ?? 'No data returned.'}
      </p>
      <Button onClick={refresh}>Try again</Button>
    </Panel>
  )
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">
      {children}
    </p>
  )
}
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Panel>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-3 text-3xl font-bold text-navy">{value}</p>
    </Panel>
  )
}
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">
      {children}
    </span>
  )
}
export function PersonLink({ id, name }: { id: string; name?: string }) {
  return (
    <Link className="font-semibold text-navy-700 underline" to={'/people/' + id}>
      {name || id.slice(0, 8)}
    </Link>
  )
}
