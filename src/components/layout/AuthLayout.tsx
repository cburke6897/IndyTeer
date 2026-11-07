import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../ui/Logo'

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Link className="brand" to="/" aria-label="IndyTeer home"><Logo light /></Link>
        <div className="auth-story-copy">
          <div className="gold-rule" />
          <h2>Find your purpose.<br />Make an impact.</h2>
          <p>Connect with nonprofits, schools, and community groups across Indiana. Your next opportunity to give back starts here.</p>
          <span className="community-label">Local people. Lasting impact.</span>
        </div>
        <p className="auth-story-footer">Built for Indiana’s volunteer community.</p>
      </aside>
      <main className="auth-content">
        <Link className="brand mobile-brand" to="/" aria-label="IndyTeer home"><Logo /></Link>
        <section className="auth-card" aria-labelledby="auth-title">
          <h1 id="auth-title">{title}</h1>
          {subtitle && <p className="muted auth-subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="switch-auth">{footer}</div>}
        </section>
      </main>
    </div>
  )
}
