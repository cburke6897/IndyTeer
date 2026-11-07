import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera } from 'lucide-react'
import { OnboardingLayout, Stepper } from './OnboardingLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ChipSelect } from '../../components/ui/ChipSelect'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { SelectInput, TextArea, TextInput } from '../../components/ui/Field'
import { AVAILABILITY_OPTIONS, CATEGORIES, INDIANA_CITIES, SKILLS } from '../../lib/constants'
import { useSession } from '../../store/session'
import { toast } from '../../store/toast'
import { useAvatarUpload } from '../../media/useAvatarUpload'
import { useProfileContext } from '../../auth/useProfileContext'
import { saveFullName } from '../../auth/accountService'
import { finishVolunteerOnboarding } from '../../auth/onboardingService'
import { TermsConsent } from './TermsConsent'
import { useTermsConsent } from './useTermsConsent'

const STEPS = ['About you', 'Interests & skills', 'Availability']

export default function ProfileOnboardingPage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const uploadAvatar = useAvatarUpload()
  const { profile, setProfile } = useProfileContext()
  const consent = useTermsConsent()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [f, setF] = useState({
    firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', avatar: null as string | null, city: '', bio: '',
    interests: [] as string[], skills: [] as string[], phone: '', availability: '', dob: '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  function validate(s: number) {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!f.firstName.trim()) e.firstName = 'Required'
      if (!f.lastName.trim()) e.lastName = 'Required'
      if (!f.city) e.city = 'Choose your city.'
      if (f.bio.trim().length < 20) e.bio = 'Tell us a little more (at least 20 characters).'
      if (!f.dob) e.dob = 'Enter your date of birth.'
    }
    if (s === 1) {
      if (!f.interests.length) e.interests = 'Pick at least one area of interest.'
      if (!f.skills.length) e.skills = 'Pick at least one skill.'
    }
    if (s === 0 && f.dob && f.dob > new Date().toISOString().slice(0, 10)) e.dob = 'Date of birth can’t be in the future.'
    if (s === 2 && f.phone && !/^[\d\s().+-]{7,}$/.test(f.phone)) e.phone = 'Enter a valid phone number or leave this blank.'
    if (s === 2 && consent.needed && !consent.checked) e.terms = 'You need to accept the terms to continue.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function next() {
    if (!validate(step)) return
    if (step < STEPS.length - 1) return setStep(step + 1)
    if (!user || !profile) return
    setSaving(true)
    try {
      const first = f.firstName.trim()
      const last = f.lastName.trim()
      // complete_user_onboarding (RPC) saves the profile, records the terms and marks the user onboarded.
      let saved = await finishVolunteerOnboarding(profile, {
        firstName: first, lastName: last, city: f.city, bio: f.bio.trim(), interests: f.interests,
        skills: f.skills, phone: f.phone.trim(), availability: f.availability, dateOfBirth: f.dob,
      }, consent.accepted)
      // An already-onboarded row skips the RPC, so keep the display name in step with what was typed.
      if (`${first} ${last}`.trim() !== saved.full_name.trim()) saved = await saveFullName(first, last)
      setProfile(saved)
      toast('Your volunteer profile is ready. Welcome to IndyTeer!')
      navigate('/app', { replace: true })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save your profile. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingLayout>
      <p className="text-sm font-semibold text-navy-700">Step {step + 1} of {STEPS.length}</p>
      <h1 className="mt-1 mb-6 text-[26px] leading-tight">Set up your profile</h1>
      <Stepper steps={STEPS} current={step} />

      <Card className="p-6 sm:p-8">
        {step === 0 && (
          <div className="space-y-5">
            <ImageUpload label="Profile picture" shape="circle" upload={uploadAvatar} value={f.avatar} onChange={(v) => set('avatar', v)} placeholder={<Camera size={26} />} hint="Optional. A friendly photo helps organizations recognize you." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="First name" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} />
              <TextInput label="Last name" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <SelectInput label="City" value={f.city} onChange={(e) => set('city', e.target.value)} error={errors.city}>
                <option value="">Select a city</option>
                {INDIANA_CITIES.map((c) => <option key={c}>{c}</option>)}
              </SelectInput>
              <TextInput label="State" value="Indiana" disabled readOnly />
            </div>
            <TextInput label="Date of birth" required type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} error={errors.dob} hint="Only used to check age requirements. Never shown publicly." />
            <TextArea label="Short bio" placeholder="What motivates you to volunteer? What do you enjoy doing?" value={f.bio} onChange={(e) => set('bio', e.target.value)} error={errors.bio} maxLength={400} hint={`${f.bio.length}/400`} />
          </div>
        )}
        {step === 1 && (
          <div className="space-y-7">
            <ChipSelect label="Areas of interest" options={CATEGORIES} value={f.interests} onChange={(v) => set('interests', v)} error={errors.interests} />
            <ChipSelect label="Skills you can offer" options={SKILLS} value={f.skills} onChange={(v) => set('skills', v)} error={errors.skills} />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <TextInput label="Phone number" optional type="tel" placeholder="(317) 555-0100" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} hint="Only shared with organizations you register with." />
            <SelectInput label="Availability" optional value={f.availability} onChange={(e) => set('availability', e.target.value)}>
              <option value="">Select when you’re usually free</option>
              {AVAILABILITY_OPTIONS.map((a) => <option key={a}>{a}</option>)}
            </SelectInput>
            {consent.needed && <TermsConsent checked={consent.checked} onChange={consent.setChecked} error={errors.terms} />}
            <div className="rounded-md bg-navy-50 p-4 text-sm text-navy-800">
              <p className="font-semibold text-navy">Almost there</p>
              <p className="mt-1 text-navy-700">{f.firstName} {f.lastName} · {f.city}, IN · {f.interests.length} interests · {f.skills.length} skills</p>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" size="lg" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</Button>
        <Button variant={step === STEPS.length - 1 ? 'accent' : 'primary'} size="lg" disabled={saving} onClick={() => void next()}>
          {step === STEPS.length - 1 ? 'Finish setup' : <>Continue <ArrowRight size={16} /></>}
        </Button>
      </div>
    </OnboardingLayout>
  )
}
