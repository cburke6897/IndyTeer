import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Check, HeartHandshake } from 'lucide-react'
import { OnboardingLayout } from './OnboardingLayout'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/utils'
import { chooseAccountType } from '../../store/actions'
import { saveAccountType } from '../../auth/accountService'
import { toast } from '../../store/toast'
import { useSession } from '../../store/session'
import type { AccountType } from '../../types'

const options: { type: AccountType; title: string; icon: typeof Building2; blurb: string; points: string[] }[] = [
  {
    type: 'volunteer', title: 'I’m a Volunteer', icon: HeartHandshake,
    blurb: 'Find causes you care about and give your time.',
    points: ['Discover and register for local opportunities', 'Track and verify your volunteer hours', 'Build a public volunteer profile'],
  },
  {
    type: 'organization', title: 'I represent an Organization', icon: Building2,
    blurb: 'Nonprofits, schools, businesses, and community groups.',
    points: ['Post opportunities and recruit volunteers', 'Approve registrations and verify hours', 'Track impact with analytics'],
  },
]

export default function AccountTypePage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const [choice, setChoice] = useState<AccountType | null>(user?.accountType ?? null)

  const [busy, setBusy] = useState(false)

  async function next() {
    if (!choice || !user) return
    setBusy(true)
    try {
      await saveAccountType(choice)
      chooseAccountType(user.id, choice)
      navigate(`/onboarding/${choice}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save your choice. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingLayout width="max-w-3xl">
      <p className="text-sm font-semibold text-navy-700">Welcome{user ? `, ${user.firstName}` : ''}</p>
      <h1 className="mt-1 text-[28px] leading-tight">How will you use IndyTeer?</h1>
      <p className="mt-2 text-[15px] text-muted">Choose the account that fits. You’ll get a dashboard built for it.</p>

      <div role="radiogroup" aria-label="Account type" className="mt-8 grid gap-4 sm:grid-cols-2">
        {options.map((o) => {
          const on = choice === o.type
          return (
            <button
              key={o.type}
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(o.type)}
              className={cn(
                'relative flex flex-col items-start justify-start rounded-lg border-2 bg-white p-6 text-left transition-all',
                on ? 'border-navy shadow-pop' : 'border-line hover:border-navy-200 hover:shadow-card',
              )}
            >
              <span className={cn('absolute top-4 right-4 flex size-5 items-center justify-center rounded-full border-2', on ? 'border-navy bg-navy text-white' : 'border-line-strong')}>
                {on && <Check size={12} strokeWidth={3.5} />}
              </span>
              <span className={cn('flex size-11 items-center justify-center rounded-md', on ? 'bg-gold text-navy-950' : 'bg-navy-50 text-navy-700')}><o.icon size={22} /></span>
              <h2 className="mt-4 text-lg">{o.title}</h2>
              <p className="mt-1 text-sm text-muted">{o.blurb}</p>
              <ul className="mt-4 w-full space-y-2 border-t border-line pt-4">
                {o.points.map((p) => (
                  <li key={p} className="flex gap-2 text-[13px] text-ink"><Check size={15} className="mt-0.5 shrink-0 text-success" />{p}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
      <div className="mt-8 flex justify-end">
        <Button size="lg" disabled={!choice || busy} onClick={next}>
          Continue <ArrowRight size={17} />
        </Button>
      </div>
    </OnboardingLayout>
  )
}
