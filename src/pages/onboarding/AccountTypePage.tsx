import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Check, HeartHandshake } from 'lucide-react'
import { OnboardingLayout } from './OnboardingLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { chooseAccountType } from '../../store/actions'
import { useSession } from '../../store/session'
import { cn } from '../../lib/utils'
import type { AccountType } from '../../types'

const OPTIONS = [
  ['volunteer', 'A volunteer', 'Find opportunities, register for events, and track your hours.', HeartHandshake],
  ['organization', 'An organization', 'Post opportunities, manage registrations, and verify volunteer hours.', Building2],
] as const

/**
 * The first onboarding step. The database does not store an account type: this only decides which
 * setup flow runs next. Organization access itself comes from an organization membership that the
 * create_organization function grants.
 */
export default function AccountTypePage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const [choice, setChoice] = useState<AccountType | null>(user?.accountType ?? null)
  const [error, setError] = useState('')

  function next() {
    if (!user) return
    if (!choice) return setError('Choose how you will use IndyTeer.')
    chooseAccountType(user.id, choice)
    navigate(`/onboarding/${choice}`, { replace: true })
  }

  return (
    <OnboardingLayout>
      <h1 className="mb-2 text-[26px] leading-tight">How will you use IndyTeer?</h1>
      <p className="mb-6 text-muted">Pick the one that fits best. You can set up the other kind of account later.</p>
      <Card className="p-6 sm:p-8">
        <div role="radiogroup" aria-label="Account type" className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map(([type, title, blurb, Icon]) => {
            const on = choice === type
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => { setChoice(type); setError('') }}
                className={cn('relative flex flex-col items-start gap-3 rounded-md border-2 p-4 text-left transition-colors', on ? 'border-navy bg-navy-50' : 'border-line hover:border-navy-200')}
              >
                <span className={cn('flex size-10 items-center justify-center rounded', on ? 'bg-gold text-navy-950' : 'bg-navy-50 text-navy-700')}><Icon size={20} /></span>
                <span>
                  <span className="block font-semibold text-navy">{title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{blurb}</span>
                </span>
                {on && <Check size={16} className="absolute top-3 right-3 text-navy" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
        {error && <p role="alert" className="mt-3 text-xs font-medium text-danger">{error}</p>}
      </Card>
      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={next}>Continue <ArrowRight size={16} /></Button>
      </div>
    </OnboardingLayout>
  )
}
