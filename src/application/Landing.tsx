import { Link } from 'react-router-dom'
import { ArrowRight, HeartHandshake, Building2, CalendarDays } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { LinkButton } from '../components/ui/Button'
import { useAuth } from '../auth/useAuth'
import { IMG } from '../lib/constants'
export function Landing() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-22 max-w-7xl items-center justify-between px-6">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="flex gap-3">
          <LinkButton to={user ? '/app' : '/login'} variant="secondary">
            {user ? 'My workspace' : 'Log in'}
          </LinkButton>
          {!user && (
            <LinkButton to="/signup" variant="accent">
              Join IndyTeer
            </LinkButton>
          )}
        </nav>
      </header>
      <main>
        <section className="relative overflow-hidden bg-navy-950">
          <img
            src={IMG.volunteer}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[1.3fr_1fr] lg:py-32">
            <div>
              <p className="mb-5 text-xs font-bold tracking-[.22em] text-gold uppercase">
                Indiana · Community · Impact
              </p>
              <h1 className="max-w-2xl text-5xl leading-[1.08] tracking-tight text-white sm:text-6xl">
                Small acts.
                <br />
                <span className="text-gold">Stronger communities.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/75">
                Discover meaningful opportunities, meet the people making a difference, and turn
                your time into lasting local impact.
              </p>
              <LinkButton
                to={user ? '/app/explore' : '/signup'}
                variant="accent"
                size="lg"
                className="mt-9"
                icon={<ArrowRight size={18} />}
              >
                Find your next opportunity
              </LinkButton>
            </div>
            <div className="self-end rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm">
              <HeartHandshake size={38} className="text-gold" />
              <h2 className="mt-5 text-2xl text-white">One account. Many ways to help.</h2>
              <p className="mt-3 leading-relaxed text-white/75">
                Volunteer as yourself, create an organization, or join an existing team. Keep your
                commitments, community updates, and impact in one place.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-16 md:grid-cols-3">
          {[
            [
              CalendarDays,
              'Find your fit',
              'Search events by cause, place, and date. Save opportunities and manage your registrations.',
            ],
            [
              Building2,
              'Build your team',
              'Create organizations, invite members, and coordinate volunteer opportunities.',
            ],
            [
              HeartHandshake,
              'See your impact',
              'Record your hours and receive verification from the organizations you support.',
            ],
          ].map(([Icon, title, text]) => {
            const Graphic = Icon as typeof CalendarDays
            return (
              <article key={String(title)} className="rounded-xl border border-line p-7">
                <Graphic className="text-navy-700" size={26} />
                <h2 className="mt-5 text-xl">{String(title)}</h2>
                <p className="mt-3 leading-relaxed text-muted">{String(text)}</p>
              </article>
            )
          })}
        </section>
      </main>
      <footer className="border-t border-line px-6 py-7 text-center text-sm text-muted">
        IndyTeer · Bringing Indiana together through service.
      </footer>
    </div>
  )
}
