import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, Lock, LogOut, ShieldCheck, Trash2, User, UserCog } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { DeleteAccountModal } from '../../components/domain/DeleteAccountModal'
import { OrganizationDangerZone } from '../../components/domain/OrganizationDangerZone'
import { TextInput } from '../../components/ui/Field'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { ToggleRow } from '../../components/ui/Toggle'
import { OrgProfileForm, VolunteerProfileForm } from '../../components/domain/ProfileForms'
import { cn, isEmail } from '../../lib/utils'
import { useSession } from '../../store/session'
import { defaultSettings } from '../../data/defaults'
import { removeAvatar, saveSettings, uploadOrgImage, updateOrgProfile } from '../../store/actions'
import { act } from '../../store/act'
import { saveFullName, updateEmail, updatePassword, verifyPassword } from '../../auth/accountService'
import { useProfileContext } from '../../auth/useProfileContext'
import { useLogout } from '../../auth/useLogout'
import { useAvatarUpload } from '../../media/useAvatarUpload'
import { toast } from '../../store/toast'
import type { Settings } from '../../types'
import { getSettings as getBackendSettings, updateSettings as updateBackendSettings } from '../../lib/api/settings'
import { acceptOrganizationInvite, declineOrganizationInvite, listMyOrganizationInvitations } from '../../lib/api/organizations'
import type { UserSettings } from '../../types/models'

type Section = 'account' | 'profile' | 'notifications' | 'privacy'
const sections: { id: Section; label: string; icon: typeof User }[] = [
  { id: 'account', label: 'Account', icon: UserCog },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Lock },
]

export default function SettingsPage() {
  const { user } = useSession()
  const [searchParams] = useSearchParams()
  const requestedSection = searchParams.get('section')
  const [section, setSection] = useState<Section>(() => requestedSection === 'notifications' ? 'notifications' : 'account')
  useEffect(() => {
    if (requestedSection === 'notifications') setSection('notifications')
  }, [requestedSection])
  return (
    <div>
      <PageHeader title="Settings" description="Manage your account, profile, notifications, and privacy." />
      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="scrollbar-thin flex gap-1 overflow-x-auto overflow-y-hidden lg:flex-col">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)} aria-current={section === s.id} className={cn('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors', section === s.id ? 'bg-white text-navy shadow-card ring-1 ring-line' : 'text-muted hover:bg-white/70 hover:text-navy')}>
              <s.icon size={17} /> {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          {section === 'account' && <AccountSection key={user!.id} />}
          {section === 'profile' && <ProfileSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'privacy' && <PrivacySection />}
        </div>
      </div>
    </div>
  )
}

function AccountSection() {
  const { user, volunteer, org } = useSession()
  const logout = useLogout()
  const uploadAvatar = useAvatarUpload()
  const { setProfile } = useProfileContext()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ firstName: user!.firstName, lastName: user!.lastName, email: user!.email })
  const [err, setErr] = useState<Record<string, string>>({})
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwErr, setPwErr] = useState<Record<string, string>>({})
  const [del, setDel] = useState(false)

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault()
    const x: Record<string, string> = {}
    if (!f.firstName.trim()) x.firstName = 'Required'
    if (!f.lastName.trim()) x.lastName = 'Required'
    if (!isEmail(f.email.trim())) x.email = 'Enter a valid email.'
    setErr(x)
    if (Object.keys(x).length) return
    setSaving(true)
    try {
      const emailChanged = f.email.trim().toLowerCase() !== user!.email.toLowerCase()
      if (emailChanged) await updateEmail(f.email)
      setProfile(await saveFullName(f.firstName, f.lastName))
      toast(emailChanged ? 'Saved. Confirm your new email address using the link we sent.' : 'Account details saved.')
    } catch (cause) {
      setErr({ email: cause instanceof Error ? cause.message : 'Could not save your account details.' })
    } finally {
      setSaving(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    const x: Record<string, string> = {}
    if (!pw.current) x.current = 'Enter your current password.'
    if (pw.next.length < 8) x.next = 'Use at least 8 characters.'
    if (pw.confirm !== pw.next) x.confirm = 'Passwords don’t match.'
    setPwErr(x)
    if (Object.keys(x).length) return
    try {
      await verifyPassword(user!.email, pw.current)
      await updatePassword(pw.next)
      setPw({ current: '', next: '', confirm: '' })
      toast('Password updated.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not update your password.'
      setPwErr(/current password/i.test(message) ? { current: message } : { next: message })
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Account" subtitle="Your sign-in details" action={org ? <Badge tone="gold">Organization admin</Badge> : undefined} />
        <form onSubmit={saveAccount} noValidate className="space-y-5 p-5">
          {volunteer && <ImageUpload label="Profile picture" shape="circle" upload={uploadAvatar} value={volunteer.avatar} hint="JPG, PNG or WebP, up to 2 MB." onChange={(v) => { if (v === null) void act(removeAvatar().then(setProfile), 'Profile picture removed.', 'info') }} />}
          {org && <ImageUpload label="Organization logo" value={org.logo} upload={(file) => uploadOrgImage(org.id, 'logo', file)} hint="JPG, PNG or WebP, up to 2 MB." onChange={(v) => { if (v === null) void act(updateOrgProfile(org.id, { name: org.name, type: org.type, description: org.description, mission: org.mission, website: org.website, city: org.city, email: org.email, phone: org.phone, focus: org.focus, logo: null }), 'Logo removed.', 'info') }} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={org ? 'Admin first name' : 'First name'} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} error={err.firstName} />
            <TextInput label={org ? 'Admin last name' : 'Last name'} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} error={err.lastName} />
          </div>
          <TextInput label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={err.email} />
          <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save account'}</Button></div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Change password" subtitle="Confirms your current password first" />
        <form onSubmit={savePassword} noValidate className="space-y-4 p-5">
          <PasswordInput label="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwErr.current} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordInput label="New password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={pwErr.next} />
            <PasswordInput label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErr.confirm} />
          </div>
          <div className="flex justify-end"><Button type="submit" variant="secondary">Update password</Button></div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Account actions" />
        <div className="divide-y divide-line">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><p className="text-sm font-semibold text-ink">Log out</p><p className="text-[13px] text-muted">End this session on this device.</p></div>
            <Button variant="secondary" icon={<LogOut size={16} />} onClick={() => void logout()}>Log out</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><p className="text-sm font-semibold text-danger">Delete account</p><p className="text-[13px] text-muted">Permanently delete your account, sign-in, and data.</p></div>
            <Button variant="dangerOutline" icon={<Trash2 size={16} />} onClick={() => setDel(true)}>Delete account</Button>
          </div>
        </div>
      </Card>

      {org && <OrganizationDangerZone org={org} />}
      {del && <DeleteAccountModal userId={user!.id} onClose={() => setDel(false)} />}
    </>
  )
}

function ProfileSection() {
  const { volunteer, org } = useSession()
  return (
    <Card>
      <CardHeader title={org ? 'Organization information' : 'Profile information'} subtitle={org ? 'What volunteers see on your public page' : 'Your biography, skills, and interests'} />
      <div className="p-5">
        {volunteer && <VolunteerProfileForm key={volunteer.id} volunteer={volunteer} />}
        {org && <OrgProfileForm key={org.id} org={org} />}
      </div>
    </Card>
  )
}

function useSettings() {
  const { db, user } = useSession()
  const { setProfile } = useProfileContext()
  const s: Settings = db.settings[user!.id] ?? defaultSettings()
  return { s, update: (fn: (x: Settings) => Settings) => { void act(saveSettings(fn(s)).then(setProfile)) } }
}

function NotificationsSection() {
  const { s, update } = useSettings()
  const { user } = useSession()
  const [inviteOptOut, setInviteOptOut] = useState(false)
  const [invitePreferenceLoaded, setInvitePreferenceLoaded] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [invitations, setInvitations] = useState<Array<{ membership: import('../../types/models').OrganizationMembership; organizationName: string }>>([])
  const [invitationsLoaded, setInvitationsLoaded] = useState(false)
  const n = s.notifications
  const set = (k: keyof Settings['notifications']) => (v: boolean) => { update((x) => ({ ...x, notifications: { ...x.notifications, [k]: v } })); toast('Notification preference saved.', 'info') }
  useEffect(() => {
    let alive = true
    void getBackendSettings().then((settings) => {
      if (alive) { setInviteOptOut(settings.opt_out_organization_invites); setInvitePreferenceLoaded(true) }
    }).catch((error: unknown) => {
      if (alive) toast(error instanceof Error ? error.message : 'Could not load invitation settings.', 'error')
    })
    void listMyOrganizationInvitations().then((pending) => {
      if (alive) { setInvitations(pending); setInvitationsLoaded(true) }
    }).catch((error: unknown) => {
      if (alive) toast(error instanceof Error ? error.message : 'Could not load organization invitations.', 'error')
    })
    return () => { alive = false }
  }, [user?.id])
  const toggleInviteOptOut = async (value: boolean) => {
    setInviteBusy(true)
    try {
      const saved: UserSettings = await updateBackendSettings({ opt_out_organization_invites: value })
      setInviteOptOut(saved.opt_out_organization_invites)
      toast(value ? 'New organization invitations are blocked.' : 'You can receive organization invitations again.', 'info')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update invitation preference.', 'error')
    } finally { setInviteBusy(false) }
  }
  const handleInvitation = async (organizationId: string, accept: boolean) => {
    setInviteBusy(true)
    try {
      if (accept) await acceptOrganizationInvite(organizationId)
      else await declineOrganizationInvite(organizationId)
      setInvitations(await listMyOrganizationInvitations())
      toast(accept ? 'Organization invitation accepted.' : 'Organization invitation declined.', 'info')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update invitation.', 'error')
    } finally { setInviteBusy(false) }
  }
  return (
    <Card>
      <CardHeader title="Notifications" subtitle="Choose what IndyTeer tells you about" />
      <div className="divide-y divide-line px-5">
        <ToggleRow title="Email notifications" description="Receive notifications by email as well as in the app." checked={n.email} onChange={set('email')} />
        <ToggleRow title="New opportunity notifications" description="When organizations you follow post new opportunities." checked={n.newOpportunities} onChange={set('newOpportunities')} />
        <ToggleRow title="Registration updates" description="When a registration is approved, declined, or your hours are verified." checked={n.confirmations} onChange={set('confirmations')} />
        <ToggleRow title="Block organization invitations" description="Stop organizations from sending you new invitations. Existing invitations stay available to accept or decline." checked={inviteOptOut} onChange={toggleInviteOptOut} disabled={!invitePreferenceLoaded || inviteBusy} />
      </div>
      {invitationsLoaded && invitations.length > 0 && <div className="border-t border-line px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">Organization invitations</h3>
        <div className="mt-2 divide-y divide-line">
          {invitations.map(({ membership, organizationName }) => <div key={membership.organization_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="text-sm font-semibold text-ink">{organizationName}</p><p className="text-xs text-muted">Invited as {membership.role}</p></div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={inviteBusy || !invitationsLoaded} onClick={() => void handleInvitation(membership.organization_id, false)}>Decline</Button>
              <Button size="sm" variant="primary" disabled={inviteBusy || !invitationsLoaded} onClick={() => void handleInvitation(membership.organization_id, true)}>Accept</Button>
            </div>
          </div>)}
        </div>
      </div>}
    </Card>
  )
}

function PrivacySection() {
  const { org } = useSession()
  const { s, update } = useSettings()
  const p = s.privacy
  const set = <K extends keyof Settings['privacy']>(k: K) => (v: Settings['privacy'][K]) => { update((x) => ({ ...x, privacy: { ...x.privacy, [k]: v } })) }
  if (org) {
    return (
      <Card>
        <CardHeader title="Privacy" subtitle="Control who can see your information" action={<ShieldCheck size={18} className="text-navy-700" />} />
        <p className="p-5 text-sm text-muted">Organization pages are public to every signed-in volunteer. Your personal profile settings apply to your own volunteer-style profile only.</p>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader title="Privacy" subtitle="Control who can see your information" action={<ShieldCheck size={18} className="text-navy-700" />} />
      <div className="divide-y divide-line px-5">
        <ToggleRow title="Public profile" description="Let organizations view your volunteer profile. If off, organizations you have a pending or approved registration with can still view it." checked={p.publicProfile} onChange={set('publicProfile')} />
        <ToggleRow title="Display volunteer hours publicly" description="Show your total verified hours on your profile." checked={p.showHours} onChange={set('showHours')} />
        <ToggleRow title="Display volunteer history publicly" description="Show events you’ve volunteered at." checked={p.showHistory} onChange={set('showHistory')} />
      </div>
    </Card>
  )
}
