import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Lock, LogOut, RotateCcw, ShieldCheck, Trash2, User, UserCog } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { SelectInput, TextInput } from '../../components/ui/Field'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { ToggleRow } from '../../components/ui/Toggle'
import { OrgProfileForm, VolunteerProfileForm } from '../../components/domain/ProfileForms'
import { cn, isEmail } from '../../lib/utils'
import { useSession } from '../../store/session'
import { defaultSettings } from '../../data/seed'
import { deleteAccount, logout, resetDemoData, updateOrgProfile, updateSettings, updateUser, updateVolunteerProfile } from '../../store/actions'
import { toast } from '../../store/toast'
import type { Settings } from '../../types'

type Section = 'account' | 'profile' | 'notifications' | 'privacy'
const sections: { id: Section; label: string; icon: typeof User }[] = [
  { id: 'account', label: 'Account', icon: UserCog },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Lock },
]

export default function SettingsPage() {
  const { user } = useSession()
  const [section, setSection] = useState<Section>('account')
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
  const { db, user, volunteer, org } = useSession()
  const navigate = useNavigate()
  const [f, setF] = useState({ firstName: user!.firstName, lastName: user!.lastName, email: user!.email })
  const [err, setErr] = useState<Record<string, string>>({})
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwErr, setPwErr] = useState<Record<string, string>>({})
  const [del, setDel] = useState(false)
  const [reset, setReset] = useState(false)
  const [typed, setTyped] = useState('')

  function saveAccount(e: React.FormEvent) {
    e.preventDefault()
    const x: Record<string, string> = {}
    if (!f.firstName.trim()) x.firstName = 'Required'
    if (!f.lastName.trim()) x.lastName = 'Required'
    if (!isEmail(f.email.trim())) x.email = 'Enter a valid email.'
    else if (db.users.some((u) => u.id !== user!.id && u.email.toLowerCase() === f.email.trim().toLowerCase())) x.email = 'That email is already in use.'
    setErr(x)
    if (Object.keys(x).length) return
    updateUser(user!.id, { firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim() })
    if (volunteer) updateVolunteerProfile(volunteer.id, { firstName: f.firstName.trim(), lastName: f.lastName.trim() })
    toast('Account details saved.')
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault()
    const x: Record<string, string> = {}
    if (!pw.current) x.current = 'Enter your current password.'
    if (pw.next.length < 8) x.next = 'Use at least 8 characters.'
    if (pw.confirm !== pw.next) x.confirm = 'Passwords don’t match.'
    setPwErr(x)
    if (Object.keys(x).length) return
    setPw({ current: '', next: '', confirm: '' })
    toast('Password updated. (Prototype: nothing is stored.)')
  }

  return (
    <>
      <Card>
        <CardHeader title="Account" subtitle="Your sign-in details" action={<Badge tone="gold">{user!.accountType === 'volunteer' ? 'Volunteer account' : 'Organization account'}</Badge>} />
        <form onSubmit={saveAccount} noValidate className="space-y-5 p-5">
          {volunteer && <ImageUpload label="Profile picture" shape="circle" value={volunteer.avatar} onChange={(v) => updateVolunteerProfile(volunteer.id, { avatar: v })} />}
          {org && <ImageUpload label="Organization logo" value={org.logo} onChange={(v) => updateOrgProfile(org.id, { logo: v })} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={org ? 'Admin first name' : 'First name'} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} error={err.firstName} />
            <TextInput label={org ? 'Admin last name' : 'Last name'} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} error={err.lastName} />
          </div>
          <TextInput label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={err.email} />
          <div className="flex justify-end"><Button type="submit">Save account</Button></div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Change password" subtitle="Visual prototype only" />
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
            <Button variant="secondary" icon={<LogOut size={16} />} onClick={() => { logout(); navigate('/login'); toast('You’ve been logged out.', 'info') }}>Log out</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><p className="text-sm font-semibold text-ink">Reset demo data</p><p className="text-[13px] text-muted">Restore the original sample data and sign out. Handy before a demo.</p></div>
            <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setReset(true)}>Reset</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><p className="text-sm font-semibold text-danger">Delete account</p><p className="text-[13px] text-muted">Permanently remove your account and all of its data.</p></div>
            <Button variant="dangerOutline" icon={<Trash2 size={16} />} onClick={() => { setTyped(''); setDel(true) }}>Delete account</Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog open={reset} onClose={() => setReset(false)} destructive title="Reset all demo data?" message="Everything you created in this browser (accounts, opportunities, registrations) will be replaced with the original sample data." confirmLabel="Reset demo data" onConfirm={() => { resetDemoData(); navigate('/login'); toast('Demo data reset.', 'info') }} />
      <Modal
        open={del}
        onClose={() => setDel(false)}
        size="sm"
        title="Delete your account?"
        footer={<><Button variant="secondary" onClick={() => setDel(false)}>Cancel</Button><Button variant="danger" disabled={typed !== 'DELETE'} onClick={() => { deleteAccount(user!.id); navigate('/login'); toast('Your account was deleted.', 'info') }}>Delete my account</Button></>}
      >
        <p className="mb-4 text-sm text-ink/90">
          {org ? 'Your organization profile, opportunities, and registrations will be permanently removed.' : 'Your profile, registrations, and volunteer hours will be permanently removed.'} This can’t be undone.
        </p>
        <TextInput label="Type DELETE to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Modal>
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
  const s: Settings = db.settings[user!.id] ?? defaultSettings()
  return { s, update: (fn: (x: Settings) => Settings) => updateSettings(user!.id, fn) }
}

function NotificationsSection() {
  const { s, update } = useSettings()
  const n = s.notifications
  const set = (k: keyof Settings['notifications']) => (v: boolean) => { update((x) => ({ ...x, notifications: { ...x.notifications, [k]: v } })); toast('Notification preference saved.', 'info') }
  return (
    <Card>
      <CardHeader title="Notifications" subtitle="Choose what IndyTeer tells you about" />
      <div className="divide-y divide-line px-5">
        <ToggleRow title="Email notifications" description="Receive notifications by email as well as in the app." checked={n.email} onChange={set('email')} />
        <ToggleRow title="Event reminders" description="A reminder the day before events you’re registered for." checked={n.reminders} onChange={set('reminders')} />
        <ToggleRow title="New opportunity notifications" description="When organizations you follow post new opportunities." checked={n.newOpportunities} onChange={set('newOpportunities')} />
        <ToggleRow title="Organization updates" description="News and announcements from organizations you follow." checked={n.orgUpdates} onChange={set('orgUpdates')} />
        <ToggleRow title="Registration confirmations" description="Confirmations when registrations are approved or change." checked={n.confirmations} onChange={set('confirmations')} />
      </div>
    </Card>
  )
}

function PrivacySection() {
  const { org } = useSession()
  const { s, update } = useSettings()
  const p = s.privacy
  const set = <K extends keyof Settings['privacy']>(k: K) => (v: Settings['privacy'][K]) => { update((x) => ({ ...x, privacy: { ...x.privacy, [k]: v } })); toast('Privacy setting saved.', 'info') }
  return (
    <Card>
      <CardHeader title="Privacy" subtitle="Control who can see your information" action={<ShieldCheck size={18} className="text-navy-700" />} />
      <div className="divide-y divide-line px-5">
        <ToggleRow title={org ? 'Public organization page' : 'Public profile'} description={org ? 'Let volunteers find your page in Organizations.' : 'Allow organizations to view your profile.'} checked={p.publicProfile} onChange={set('publicProfile')} />
        {!org && <ToggleRow title="Display volunteer hours publicly" description="Show your total verified hours on your profile." checked={p.showHours} onChange={set('showHours')} />}
        {!org && <ToggleRow title="Display volunteer history publicly" description="Show events you’ve volunteered at." checked={p.showHistory} onChange={set('showHistory')} />}
        <div className="py-4">
          <SelectInput label="Profile visibility" value={p.visibility} onChange={(e) => set('visibility')(e.target.value as Settings['privacy']['visibility'])} wrapperClassName="max-w-sm">
            <option value="everyone">Everyone</option>
            <option value="members">IndyTeer members only</option>
            <option value="organizations">Organizations I volunteer with</option>
          </SelectInput>
        </div>
      </div>
    </Card>
  )
}
