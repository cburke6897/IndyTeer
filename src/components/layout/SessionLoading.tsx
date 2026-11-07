import { LogoMark } from '../ui/Logo'

export function SessionLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface" role="status" aria-live="polite">
      <LogoMark size={44} className="animate-pulse" />
      <p className="text-sm font-medium text-muted">Loading your account…</p>
    </div>
  )
}
