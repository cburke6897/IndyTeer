import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../ui/Logo'
import { IMG } from '../../lib/constants'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-950 lg:block">
        <img src={IMG.volunteer} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-950/30" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <Link to="/"><Logo light /></Link>
          <div>
            <div className="mb-5 h-1 w-12 bg-gold" />
            <p className="max-w-md text-3xl leading-tight font-bold tracking-tight">Find your purpose. Make an impact.</p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
              IndyTeer connects Hoosiers with nonprofits, schools, and community groups that need a helping hand — from Evansville to Fort Wayne.
            </p>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/15 pt-6">
              {[['12,400+', 'Volunteer hours logged'], ['180', 'Indiana organizations'], ['92', 'Counties reached']].map(([n, l]) => (
                <div key={l}>
                  <dt className="text-xl font-bold text-gold">{n}</dt>
                  <dd className="mt-0.5 text-xs text-white/65">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </aside>
      <main className="flex flex-col bg-white">
        <div className="p-5 lg:hidden"><Link to="/"><Logo /></Link></div>
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-8 sm:py-12">
          <h1 className="text-[26px] leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
