import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CalendarCheck, Check, MapPin, Search } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { LinkButton } from '../components/ui/Button'
import { SafeImage } from '../components/ui/Avatar'
import { oppImage } from '../components/domain/oppImage'
import { IMG } from '../lib/constants'
import { formatDate } from '../lib/utils'
import { useDB } from '../store/store'
import { getOrg, openOpps } from '../store/selectors'

export default function LandingPage() {
  const db = useDB()
  const featured = openOpps(db).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)

  return (
    <div className="bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="flex items-center gap-2">
            <LinkButton to="/login" variant="ghost">Log in</LinkButton>
            <LinkButton to="/signup" variant="primary">Sign up</LinkButton>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-navy-950">
        <img src={IMG.volunteer} alt="" className="absolute inset-0 size-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/30" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <div className="mb-5 h-1 w-14 bg-gold" />
          <h1 className="max-w-2xl text-[40px] leading-[1.1] font-extrabold tracking-tight !text-white sm:text-[52px]">Find your purpose. Make an impact.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
            IndyTeer is Indiana’s volunteer network. Discover opportunities near you, track every hour you give, and help nonprofits find the people they need.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton to="/signup" variant="accent" size="lg" icon={<ArrowRight size={18} />} className="flex-row-reverse">Get started free</LinkButton>
            <LinkButton to="/login" variant="secondary" size="lg" className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20">Log in</LinkButton>
          </div>
          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-white/15 pt-6">
            {[[String(db.organizations.length), 'Organizations'], [String(openOpps(db).length), 'Open opportunities'], [String(new Set(openOpps(db).map((o) => o.city)).size), 'Indiana cities']].map(([n, l]) => (
              <div key={l}><dt className="text-2xl font-bold text-gold">{n}</dt><dd className="text-xs text-white/65">{l}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-[28px]">How IndyTeer works</h2>
        <ol className="mt-8 divide-y divide-line border-y border-line">
          {[
            [Search, 'Discover', 'Search by cause, city, date, or skill. Follow the organizations you trust and see their opportunities in your feed.'],
            [CalendarCheck, 'Register', 'Sign up in one click. Organizations approve registrations and keep you informed about every detail.'],
            [BadgeCheck, 'Get verified', 'Organizations verify your hours so your impact is on the record and on your public volunteer profile.'],
          ].map(([Icon, title, text], i) => {
            const I = Icon as typeof Search
            return (
              <li key={title as string} className="grid gap-3 py-6 sm:grid-cols-[64px_200px_1fr] sm:items-center">
                <span className="flex size-11 items-center justify-center rounded-md bg-navy text-gold"><I size={20} /></span>
                <h3 className="text-lg"><span className="mr-2 text-muted">0{i + 1}</span>{title as string}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{text as string}</p>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="bg-surface py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-end justify-between">
            <h2 className="text-[28px]">Happening across Indiana</h2>
            <Link to="/signup" className="hidden text-sm font-semibold text-navy-700 hover:underline sm:block">See all opportunities</Link>
          </div>
          {featured.length === 0 && <p className="mt-8 rounded-lg border border-dashed border-line-strong bg-white p-8 text-center text-muted">No opportunities have been posted yet. Organizations that join IndyTeer will appear here.</p>}
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {featured.map((o) => {
              const org = getOrg(db, o.orgId)
              return (
                <Link key={o.id} to="/signup" className="group overflow-hidden rounded-lg border border-line bg-white shadow-card transition-shadow hover:shadow-pop">
                  <SafeImage src={oppImage(o)} alt="" className="aspect-[16/10] w-full" />
                  <div className="p-5">
                    <p className="text-xs font-semibold text-navy-700">{o.category}</p>
                    <h3 className="mt-1 text-[17px] leading-snug group-hover:underline">{o.title}</h3>
                    <p className="mt-1 text-sm text-muted">{org?.name}</p>
                    <p className="mt-3 flex items-center gap-4 text-[13px] text-muted"><span>{formatDate(o.date, { month: 'short', day: 'numeric' })}</span><span className="inline-flex items-center gap-1"><MapPin size={13} />{o.virtual ? 'Virtual' : o.city}</span></p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden px-5 py-20 md:grid-cols-2 md:gap-12">
        {[
          ['For volunteers', ['Personalized feed of local opportunities', 'One place for events and hours', 'A verified, shareable volunteer profile']],
          ['For organizations', ['Post opportunities in minutes', 'Approve registrations and take attendance', 'Verify hours and see your impact']],
        ].map(([title, points]) => (
          <div key={title as string} className="py-6">
            <h2 className="text-xl">{title as string}</h2>
            <ul className="mt-4 space-y-3">
              {(points as string[]).map((p) => <li key={p} className="flex gap-3 text-[15px] text-ink"><Check size={18} className="mt-0.5 shrink-0 text-success" />{p}</li>)}
            </ul>
          </div>
        ))}
      </section>

      <section className="bg-navy">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-14">
          <div>
            <h2 className="text-2xl !text-white">Ready to make an impact?</h2>
            <p className="mt-1 text-white/70">Join IndyTeer in under two minutes.</p>
          </div>
          <LinkButton to="/signup" variant="accent" size="lg">Create your account</LinkButton>
        </div>
      </section>
      <footer className="border-t border-line py-8 text-center text-sm text-muted">© {new Date().getFullYear()} IndyTeer · Made for Hoosiers, by Hoosiers.</footer>
    </div>
  )
}
