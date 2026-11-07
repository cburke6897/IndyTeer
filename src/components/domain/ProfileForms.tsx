import { useState } from 'react'
import { Button } from '../ui/Button'
import { ChipSelect } from '../ui/ChipSelect'
import { ImageUpload } from '../ui/ImageUpload'
import { SelectInput, TextArea, TextInput } from '../ui/Field'
import { AVAILABILITY_OPTIONS, CATEGORIES, INDIANA_CITIES, ORG_TYPES, SKILLS } from '../../lib/constants'
import { isEmail, normalizeUrl } from '../../lib/utils'
import { updateOrgProfile, updateVolunteerProfile } from '../../store/actions'
import { toast } from '../../store/toast'
import type { OrgProfile, VolunteerProfile } from '../../types'

const phoneOk = (p: string) => !p || /^[\d\s().+-]{7,}$/.test(p)

export function VolunteerProfileForm({ volunteer, onDone, onCancel, id }: { volunteer: VolunteerProfile; onDone?: () => void; onCancel?: () => void; id?: string }) {
  const [f, setF] = useState({
    firstName: volunteer.firstName, lastName: volunteer.lastName, headline: volunteer.headline, avatar: volunteer.avatar, city: volunteer.city,
    bio: volunteer.bio, interests: volunteer.interests, skills: volunteer.skills, phone: volunteer.phone, availability: volunteer.availability,
  })
  const [err, setErr] = useState<Record<string, string>>({})
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const x: Record<string, string> = {}
    if (!f.firstName.trim()) x.firstName = 'Required'
    if (!f.lastName.trim()) x.lastName = 'Required'
    if (!f.city) x.city = 'Choose a city.'
    if (f.bio.trim().length < 20) x.bio = 'Add at least 20 characters.'
    if (!f.interests.length) x.interests = 'Pick at least one interest.'
    if (!phoneOk(f.phone)) x.phone = 'Enter a valid phone number.'
    setErr(x)
    if (Object.keys(x).length) return
    updateVolunteerProfile(volunteer.id, { ...f, firstName: f.firstName.trim(), lastName: f.lastName.trim(), headline: f.headline.trim(), bio: f.bio.trim() })
    toast('Profile updated.')
    onDone?.()
  }

  return (
    <form id={id} onSubmit={submit} noValidate className="space-y-5">
      <ImageUpload label="Profile picture" shape="circle" value={f.avatar} onChange={(v) => set('avatar', v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="First name" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} error={err.firstName} />
        <TextInput label="Last name" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} error={err.lastName} />
      </div>
      <TextInput label="Headline" optional placeholder="e.g. Nurse · weekend volunteer" value={f.headline} onChange={(e) => set('headline', e.target.value)} maxLength={80} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="City" value={f.city} onChange={(e) => set('city', e.target.value)} error={err.city}>
          <option value="">Select a city</option>
          {[...new Set([...INDIANA_CITIES, f.city].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}
        </SelectInput>
        <TextInput label="State" value="Indiana" disabled readOnly />
      </div>
      <TextArea label="Biography" value={f.bio} onChange={(e) => set('bio', e.target.value)} error={err.bio} maxLength={400} />
      <ChipSelect label="Areas of interest" options={CATEGORIES} value={f.interests} onChange={(v) => set('interests', v)} error={err.interests} />
      <ChipSelect label="Skills" options={SKILLS} value={f.skills} onChange={(v) => set('skills', v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Phone" optional value={f.phone} onChange={(e) => set('phone', e.target.value)} error={err.phone} />
        <SelectInput label="Availability" optional value={f.availability} onChange={(e) => set('availability', e.target.value)}>
          <option value="">Not specified</option>
          {AVAILABILITY_OPTIONS.map((a) => <option key={a}>{a}</option>)}
        </SelectInput>
      </div>
      {!id && (
        <div className="flex justify-end gap-2">
          {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
          <Button type="submit">Save changes</Button>
        </div>
      )}
    </form>
  )
}

export function OrgProfileForm({ org, onDone, onCancel, id }: { org: OrgProfile; onDone?: () => void; onCancel?: () => void; id?: string }) {
  const [f, setF] = useState({
    name: org.name, logo: org.logo, cover: org.cover, type: org.type, description: org.description, mission: org.mission,
    website: org.website, city: org.city, email: org.email, phone: org.phone, focus: org.focus,
  })
  const [err, setErr] = useState<Record<string, string>>({})
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const x: Record<string, string> = {}
    if (!f.name.trim()) x.name = 'Required'
    if (f.description.trim().length < 30) x.description = 'Add at least 30 characters.'
    if (f.mission.trim().length < 10) x.mission = 'Share your mission.'
    if (!f.focus.length) x.focus = 'Select at least one focus area.'
    if (!isEmail(f.email.trim())) x.email = 'Enter a valid email.'
    if (f.website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(f.website.trim())) x.website = 'Enter a valid website.'
    if (!phoneOk(f.phone)) x.phone = 'Enter a valid phone number.'
    setErr(x)
    if (Object.keys(x).length) return
    updateOrgProfile(org.id, { ...f, name: f.name.trim(), description: f.description.trim(), mission: f.mission.trim(), website: normalizeUrl(f.website.trim()), email: f.email.trim() })
    toast('Organization profile updated.')
    onDone?.()
  }

  return (
    <form id={id} onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-6 sm:grid-cols-2">
        <ImageUpload label="Logo" value={f.logo} onChange={(v) => set('logo', v)} />
        <ImageUpload label="Cover image" shape="wide" value={f.cover} onChange={(v) => set('cover', v)} hint="Optional banner for your profile page." />
      </div>
      <TextInput label="Organization name" value={f.name} onChange={(e) => set('name', e.target.value)} error={err.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Type" value={f.type} onChange={(e) => set('type', e.target.value)}>
          {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
        </SelectInput>
        <SelectInput label="City" value={f.city} onChange={(e) => set('city', e.target.value)}>
          {[...new Set([...INDIANA_CITIES, f.city].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}
        </SelectInput>
      </div>
      <TextArea label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} error={err.description} />
      <TextArea label="Mission" rows={2} value={f.mission} onChange={(e) => set('mission', e.target.value)} error={err.mission} />
      <ChipSelect label="Areas of focus" options={CATEGORIES} value={f.focus} onChange={(v) => set('focus', v)} error={err.focus} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput label="Website" optional value={f.website} onChange={(e) => set('website', e.target.value)} error={err.website} />
        <TextInput label="Contact email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} error={err.email} />
        <TextInput label="Phone" optional value={f.phone} onChange={(e) => set('phone', e.target.value)} error={err.phone} />
      </div>
      {!id && (
        <div className="flex justify-end gap-2">
          {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
          <Button type="submit">Save changes</Button>
        </div>
      )}
    </form>
  )
}
