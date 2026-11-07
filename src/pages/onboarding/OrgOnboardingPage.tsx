import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2 } from 'lucide-react'
import { OnboardingLayout, Stepper } from './OnboardingLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ChipSelect } from '../../components/ui/ChipSelect'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { SelectInput, TextArea, TextInput } from '../../components/ui/Field'
import { CATEGORIES, INDIANA_CITIES, ORG_TYPES } from '../../lib/constants'
import { completeOrgOnboarding } from '../../store/actions'
import { useSession } from '../../store/session'
import { toast } from '../../store/toast'
import { isEmail, normalizeUrl } from '../../lib/utils'
import { useProfileContext } from '../../auth/useProfileContext'
import { finishOrganizationSetup } from '../../auth/onboardingService'
import { TermsConsent } from './TermsConsent'
import { useTermsConsent } from './useTermsConsent'

const STEPS = ['Organization', 'Mission', 'Contact']

export default function OrgOnboardingPage() {
  const { user } = useSession()
  const { profile, memberships, setProfile, retry } = useProfileContext()
  const consent = useTermsConsent()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [f, setF] = useState({
    name: '', logo: null as string | null, type: '', city: '', description: '', mission: '', focus: [] as string[],
    website: '', email: user?.email ?? '', phone: '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  function validate(s: number) {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!f.name.trim()) e.name = 'Enter your organization’s name.'
      if (!f.type) e.type = 'Select an organization type.'
      if (!f.city) e.city = 'Choose a city.'
    }
    if (s === 1) {
      if (f.description.trim().length < 30) e.description = 'Add a description (at least 30 characters).'
      if (f.mission.trim().length < 10) e.mission = 'Share your mission statement.'
      if (!f.focus.length) e.focus = 'Select at least one area of focus.'
    }
    if (s === 2) {
      if (!isEmail(f.email.trim())) e.email = 'Enter a valid contact email.'
      if (f.website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(f.website.trim())) e.website = 'Enter a valid website, e.g. yourgroup.org'
      if (f.phone && !/^[\d\s().+-]{7,}$/.test(f.phone)) e.phone = 'Enter a valid phone number or leave this blank.'
      if (consent.needed && !consent.checked) e.terms = 'You need to accept the terms to continue.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function next() {
    if (!validate(step)) return
    if (step < STEPS.length - 1) return setStep(step + 1)
    if (!user || !profile) return
    const input = { ...f, name: f.name.trim(), description: f.description.trim(), mission: f.mission.trim(), website: normalizeUrl(f.website.trim()), email: f.email.trim() }
    setSaving(true)
    try {
      // complete_user_onboarding then create_organization (RPCs): the user becomes the owner.
      const { organizationId } = await finishOrganizationSetup(profile, memberships, input, consent.accepted, setProfile)
      completeOrgOnboarding(user.id, input, organizationId)
      retry()
      toast(`${input.name} is live on IndyTeer.`)
      navigate('/org', { replace: true })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create your organization. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingLayout>
      <p className="text-sm font-semibold text-navy-700">Step {step + 1} of {STEPS.length}</p>
      <h1 className="mt-1 mb-6 text-[26px] leading-tight">Set up your organization</h1>
      <p className="-mt-3 mb-6 text-sm text-muted">Not the right account type? <Link to="/onboarding/account-type" className="font-semibold text-navy-700 hover:underline">Change it</Link></p>
      <Stepper steps={STEPS} current={step} />

      <Card className="p-6 sm:p-8">
        {step === 0 && (
          <div className="space-y-5">
            <ImageUpload label="Organization logo" shape="square" value={f.logo} onChange={(v) => set('logo', v)} placeholder={<Building2 size={26} />} hint="Square images work best. You can change this later." />
            <TextInput label="Organization name" placeholder="e.g. Hoosier Harvest Network" value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Organization type" value={f.type} onChange={(e) => set('type', e.target.value)} error={errors.type}>
                <option value="">Select a type</option>
                {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
              </SelectInput>
              <SelectInput label="City (Indiana)" value={f.city} onChange={(e) => set('city', e.target.value)} error={errors.city}>
                <option value="">Select a city</option>
                {INDIANA_CITIES.map((c) => <option key={c}>{c}</option>)}
              </SelectInput>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-5">
            <TextArea label="Description" placeholder="What does your organization do, and who does it serve?" value={f.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
            <TextArea label="Mission statement" rows={2} placeholder="One or two sentences." value={f.mission} onChange={(e) => set('mission', e.target.value)} error={errors.mission} />
            <ChipSelect label="Areas of focus" options={CATEGORIES} value={f.focus} onChange={(v) => set('focus', v)} error={errors.focus} />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <TextInput label="Website" optional placeholder="yourorganization.org" value={f.website} onChange={(e) => set('website', e.target.value)} error={errors.website} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Contact email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
              <TextInput label="Phone number" optional type="tel" placeholder="(317) 555-0100" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
            </div>
            {consent.needed && <TermsConsent checked={consent.checked} onChange={consent.setChecked} error={errors.terms} />}
          </div>
        )}
      </Card>

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" size="lg" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</Button>
        <Button variant={step === STEPS.length - 1 ? 'accent' : 'primary'} size="lg" disabled={saving} onClick={() => void next()}>
          {step === STEPS.length - 1 ? 'Launch organization' : <>Continue <ArrowRight size={16} /></>}
        </Button>
      </div>
    </OnboardingLayout>
  )
}
