import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useAccount } from './context'
import { Page, Panel } from './ui'
import { splitList } from './format'
import { useAction, useResource } from './hooks'
import { TextInput, TextArea, SelectInput } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { completeUserOnboarding, updateUser } from '../lib/api/users'
import { uploadAvatar, removeAvatar } from '../lib/api/storage'
import { supabase } from '../lib/supabase'
import { getSettings, updateSettings } from '../lib/api/settings'
import { DeleteAccountModal } from '../components/domain/DeleteAccountModal'
import { db } from '../lib/api/client'
import { useCallback } from 'react'
import type { ProfileVisibility } from '../types/models'

export function ProfilePage({ onboarding = false }: { onboarding?: boolean }) {
  const account = useAccount()
  const profile = account.data!.profile
  const action = useAction()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: profile.first_name,
    last_name: profile.last_name,
    headline: profile.headline || '',
    bio: profile.bio || '',
    city: profile.city || '',
    phone: profile.phone || '',
    timezone: profile.timezone,
    interests: profile.interests.join(', '),
    skills: profile.skills.join(', '),
    date_of_birth: profile.date_of_birth || '',
    availability:
      typeof profile.availability === 'object' && profile.availability !== null
        ? String(
            (profile.availability as Record<string, unknown>).notes ||
              (profile.availability as Record<string, unknown>).summary ||
              '',
          )
        : '',
    terms: false,
  })
  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    const saved = await action.run(
      async () => {
        const { terms, date_of_birth, ...rest } = form
        const patch = {
          ...rest,
          full_name: (form.first_name + ' ' + form.last_name).trim(),
          interests: splitList(form.interests),
          skills: splitList(form.skills),
          availability: { notes: form.availability },
        }
        if (!profile.onboarded)
          return completeUserOnboarding({ ...patch, date_of_birth, terms_accepted: terms })
        const saved = await updateUser(patch)
        if (!profile.date_of_birth && date_of_birth) {
          const { error } = await db.rpc('set_missing_birth_date', { p_date: date_of_birth })
          if (error) throw error
        }
        return saved
      },
      onboarding ? 'Your profile is ready.' : 'Profile saved.',
    )
    if (saved.ok) {
      account.refresh()
      if (onboarding) navigate('/app')
    }
  }
  async function avatar(file: File | undefined) {
    if (!file) return
    await action.run(() => uploadAvatar(file), 'Profile photo saved.')
    account.refresh()
  }
  return (
    <Page
      title={onboarding ? 'Welcome to IndyTeer' : 'My profile'}
      subtitle={
        onboarding
          ? 'Tell us a little about yourself. Organization membership is managed separately.'
          : 'Your details are saved securely to your account.'
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
        <Panel title="Personal details">
          <form className="space-y-5" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="First name"
                required
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
              />
              <TextInput
                label="Last name"
                required
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
              />
            </div>
            <TextInput
              label="Headline"
              maxLength={80}
              value={form.headline}
              onChange={(e) => set('headline', e.target.value)}
            />
            <TextArea
              label="Biography"
              minLength={20}
              maxLength={400}
              required
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="City"
                required
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
              <SelectInput
                label="Time zone"
                value={form.timezone}
                onChange={(e) => set('timezone', e.target.value)}
              >
                <option value="America/Indiana/Indianapolis">Eastern — Indianapolis</option>
                <option value="America/Chicago">Central — Chicago</option>
              </SelectInput>
            </div>
            <TextInput
              label="Interests"
              hint="Separate causes with commas."
              required
              value={form.interests}
              onChange={(e) => set('interests', e.target.value)}
            />
            <TextInput
              label="Skills"
              hint="Separate skills with commas."
              value={form.skills}
              onChange={(e) => set('skills', e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
              {(!profile.onboarded || !profile.date_of_birth) && (
                <TextInput
                  label="Date of birth"
                  type="date"
                  required
                  value={form.date_of_birth}
                  onChange={(e) => set('date_of_birth', e.target.value)}
                />
              )}
            </div>
            <TextArea
              label="Availability"
              value={form.availability}
              onChange={(e) => set('availability', e.target.value)}
            />
            {!profile.onboarded && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  required
                  checked={form.terms}
                  onChange={(e) => set('terms', e.target.checked)}
                />
                I agree to use IndyTeer responsibly and confirm these details are accurate.
              </label>
            )}
            <Button type="submit" disabled={action.busy}>
              {action.busy ? 'Saving…' : onboarding ? 'Complete account setup' : 'Save profile'}
            </Button>
          </form>
        </Panel>
        <div className="space-y-6">
          <Panel title="Profile photo">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name + ' profile'}
                className="mb-5 size-28 rounded-full object-cover"
              />
            ) : (
              <div className="mb-5 grid size-28 place-items-center rounded-full bg-gold-50 text-4xl font-bold text-navy">
                {profile.full_name.charAt(0) || 'I'}
              </div>
            )}
            <label className="block text-sm font-semibold">
              Upload photo
              <input
                aria-label="Upload profile photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={action.busy}
                onChange={(e) => {
                  void avatar(e.target.files?.[0])
                  e.target.value = ''
                }}
                className="mt-3 block w-full text-sm"
              />
            </label>
            <p className="mt-3 text-xs text-muted">
              JPEG, PNG, WebP · up to 2 MB. Photos are public.
            </p>
            {(profile.avatar_path || profile.avatar_url) && (
              <Button
                variant="ghost"
                disabled={action.busy}
                onClick={async () => {
                  await action.run(removeAvatar, 'Photo removed.')
                  account.refresh()
                }}
              >
                Remove photo
              </Button>
            )}
          </Panel>
          <Panel title="Your user ID">
            <Link
              className="mb-4 block font-semibold text-navy-700 underline"
              to={'/people/' + profile.id}
            >
              View my shared profile
            </Link>
            <p className="break-all font-mono text-xs text-muted">{profile.id}</p>
            <p className="mt-3 text-xs text-muted">
              Share this ID with an organization administrator to receive an invitation.
            </p>
          </Panel>
        </div>
      </div>
    </Page>
  )
}

export function SettingsPage() {
  const account = useAccount()
  const profile = account.data!.profile
  const auth = useAuth()
  const query = useResource(useCallback(() => getSettings(), []))
  const action = useAction()
  const [email, setEmail] = useState(auth.user?.email || '')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  async function changePassword(e: FormEvent) {
    e.preventDefault()
    const result = await action.run(async () => {
      if (password !== confirm) throw new Error('Passwords do not match.')
      const check = await supabase.auth.signInWithPassword({
        email: auth.user!.email!,
        password: current,
      })
      if (check.error) throw new Error('Your current password is incorrect.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    }, 'Password updated.')
    if (result.ok) {
      setCurrent('')
      setPassword('')
      setConfirm('')
    }
  }
  async function privacy(key: 'public_profile' | 'show_hours' | 'show_history', value: boolean) {
    await action.run(() => updateUser({ [key]: value }), 'Privacy setting saved.')
    account.refresh()
  }
  return (
    <Page title="Settings" subtitle="Control your account, privacy, and notifications.">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Email">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              await action.run(async () => {
                const { error } = await supabase.auth.updateUser(
                  { email: email.trim() },
                  { emailRedirectTo: window.location.origin + '/app/settings' },
                )
                if (error) throw error
              }, 'Check your email to confirm the address change.')
            }}
          >
            <TextInput
              label="Email address"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={action.busy}>
              Update email
            </Button>
          </form>
        </Panel>
        <Panel title="Change password">
          <form onSubmit={changePassword} className="space-y-4">
            <TextInput
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <TextInput
              label="New password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextInput
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" disabled={action.busy}>
              Update password
            </Button>
          </form>
        </Panel>
        <Panel title="Privacy">
          <SelectInput
            label="Who can view my profile"
            value={
              profile.profile_visibility || (profile.public_profile ? 'everyone' : 'organizations')
            }
            disabled={action.busy}
            onChange={async (e) => {
              const visibility = e.target.value as ProfileVisibility
              const result = await action.run(
                () => updateUser({ profile_visibility: visibility }),
                'Profile visibility saved.',
              )
              if (result.ok) account.refresh()
            }}
          >
            <option value="everyone">Everyone, including visitors</option>
            <option value="members">Signed-in IndyTeer members</option>
            <option value="organizations">Organizations I volunteer with</option>
          </SelectInput>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Phone and availability are shared only with active owners/admins of organizations where
            you have a pending or approved registration.
          </p>
          {(
            [
              ['show_hours', 'Share my volunteer hours'],
              ['show_history', 'Share my attended event history'],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-4 border-b border-line py-4 text-sm"
            >
              {label}
              <input
                type="checkbox"
                checked={profile[key]}
                disabled={action.busy}
                onChange={(e) => void privacy(key, e.target.checked)}
              />
            </label>
          ))}
        </Panel>
        <Panel title="Notifications">
          {query.loading ? (
            <p role="status">Loading preferences…</p>
          ) : query.error ? (
            <>
              <p role="alert" className="text-danger">
                {query.error}
              </p>
              <Button onClick={query.refresh}>Retry</Button>
            </>
          ) : (
            query.data &&
            (
              [
                ['new_opportunity_notifications', 'New opportunities from followed organizations'],
                ['registration_notifications', 'Registration updates'],
                ['email_notifications', 'Email notifications'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-4 border-b border-line py-4 text-sm"
              >
                {label}
                <input
                  type="checkbox"
                  checked={query.data![key]}
                  disabled={action.busy}
                  onChange={async (e) => {
                    await action.run(
                      () => updateSettings({ [key]: e.target.checked }),
                      'Preference saved.',
                    )
                    query.refresh()
                  }}
                />
              </label>
            ))
          )}
          <p className="mt-4 text-xs text-muted">
            Email delivery also depends on the project's email provider configuration.
          </p>
        </Panel>
      </div>
      <Panel title="Delete account">
        <p className="mb-4 text-sm text-muted">
          This permanently deletes your account and personal data. Organizations you solely own and
          their data will be deleted. Transfer shared organization ownership before continuing;
          deletion is blocked while others depend on your ownership.
        </p>
        <Button variant="danger" onClick={() => setDeleting(true)}>
          Review account deletion
        </Button>
        {deleting && <DeleteAccountModal userId={profile.id} onClose={() => setDeleting(false)} />}
      </Panel>
    </Page>
  )
}
