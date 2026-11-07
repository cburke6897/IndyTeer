import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Check, Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge, VerifiedMark } from '../ui/Badge'
import { ConfirmDialog } from '../ui/Modal'
import { OrgLogo } from '../ui/Avatar'
import { cn } from '../../lib/utils'
import { useSession } from '../../store/session'
import { cancelRegistration, registerForOpportunity, toggleFollow, toggleSave } from '../../store/actions'
import { getOrg, isFollowing, isSaved, myRegistration, registrationClosed, spotsLeft } from '../../store/selectors'
import { act } from '../../store/act'
import { toast } from '../../store/toast'
import type { Opportunity, OrgProfile, RegStatus } from '../../types'

export function MetaItem({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] text-muted', className)}>
      <span className="shrink-0 text-navy-700/70">{icon}</span>
      {children}
    </span>
  )
}

export function OrgNameLink({ org, base = '/app' }: { org: OrgProfile; base?: string }) {
  return (
    <Link to={`${base}/organizations/${org.id}`} className="inline-flex min-w-0 items-center gap-1 font-semibold text-navy hover:underline">
      <span className="truncate">{org.name}</span>
      {org.verified && <VerifiedMark />}
    </Link>
  )
}

export function OrgIdentity({ org, subtitle }: { org: OrgProfile; subtitle?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link to={`/app/organizations/${org.id}`} aria-label={org.name}><OrgLogo org={org} size="md" /></Link>
      <div className="min-w-0">
        <div className="text-sm"><OrgNameLink org={org} /></div>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  )
}

export function FollowButton({ orgId, size = 'sm' }: { orgId: string; size?: 'sm' | 'md' }) {
  const { db, volunteer } = useSession()
  if (!volunteer) return null
  const following = isFollowing(db, volunteer.id, orgId)
  const org = getOrg(db, orgId)
  return (
    <Button
      size={size}
      variant={following ? 'secondary' : 'ghost'}
      className={following ? '' : 'border border-navy-200'}
      aria-pressed={following}
      icon={following ? <Check size={14} /> : <Plus size={14} />}
      onClick={() => void act(toggleFollow(orgId), (now) => (now ? `You’re now following ${org?.name}.` : `Unfollowed ${org?.name}.`))}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  )
}

export function SaveButton({ oppId, className }: { oppId: string; className?: string }) {
  const { db, volunteer } = useSession()
  if (!volunteer) return null
  const saved = isSaved(db, volunteer.id, oppId)
  return (
    <button
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save opportunity'}
      title={saved ? 'Saved' : 'Save for later'}
      onClick={() => void act(toggleSave(oppId), (now) => (now ? 'Saved to your list.' : 'Removed from saved.'))}
      className={cn('inline-flex size-9 items-center justify-center rounded-md border transition-colors', saved ? 'border-gold bg-gold-50 text-gold-700' : 'border-line-strong bg-white text-muted hover:border-navy-200 hover:text-navy', className)}
    >
      <Bookmark size={16} className={saved ? 'fill-gold' : ''} />
    </button>
  )
}

const regLabels: Record<RegStatus, { text: string; tone: 'gold' | 'success' | 'danger' | 'neutral' }> = {
  pending: { text: 'Pending approval', tone: 'gold' },
  approved: { text: 'Registered', tone: 'success' },
  declined: { text: 'Declined', tone: 'danger' },
  removed: { text: 'Removed', tone: 'danger' },
  cancelled: { text: 'Canceled', tone: 'neutral' },
}

export function RegStatusBadge({ status }: { status: RegStatus }) {
  const l = regLabels[status]
  return <Badge tone={l.tone}>{l.text}</Badge>
}

export function SpotsLabel({ opp, className }: { opp: Opportunity; className?: string }) {
  const { db } = useSession()
  const left = spotsLeft(db, opp)
  return (
    <span className={cn('text-[13px] font-semibold', left === 0 ? 'text-danger' : left <= 5 ? 'text-gold-700' : 'text-muted', className)}>
      {left === 0 ? 'Full' : `${left} ${left === 1 ? 'spot' : 'spots'} left`}
    </span>
  )
}

/** Register / cancel control with confirm dialog. Only renders for volunteer sessions. */
export function RegistrationControl({ opp, block }: { opp: Opportunity; block?: boolean }) {
  const { db, volunteer } = useSession()
  const [confirm, setConfirm] = useState(false)
  if (!volunteer) return null
  const reg = myRegistration(db, volunteer.id, opp.id)
  const active = reg && (reg.status === 'pending' || reg.status === 'approved')
  const closed = registrationClosed(opp)
  const full = spotsLeft(db, opp) === 0
  const cls = block ? 'w-full' : ''

  async function register() {
    const res = await registerForOpportunity(volunteer!.id, opp.id)
    if (res.ok) toast(`You’re registered for ${opp.title}. The organization will confirm your spot.`)
    else toast(res.error, 'error')
  }

  if (active) {
    return (
      <div className={cn('flex items-center gap-2', block && 'flex-col items-stretch')}>
        <RegStatusBadge status={reg.status} />
        <Button size="sm" variant="dangerOutline" className={cls} onClick={() => setConfirm(true)}>Cancel registration</Button>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          destructive
          title="Cancel your registration?"
          message={<>You’ll give up your spot for <strong>{opp.title}</strong>. You can register again later if spots remain.</>}
          confirmLabel="Cancel registration"
          cancelLabel="Keep my spot"
          onConfirm={() => void act(cancelRegistration(reg.id), 'Registration canceled.', 'info')}
        />
      </div>
    )
  }
  if (reg && (reg.status === 'declined' || reg.status === 'removed')) return <RegStatusBadge status={reg.status} />
  if (closed) return <Button size="sm" variant="secondary" disabled className={cls}>Registration closed</Button>
  if (full) return <Button size="sm" variant="secondary" disabled className={cls}>Event full</Button>
  return <Button size="sm" variant="accent" className={cls} onClick={() => void register()}>{reg?.status === 'cancelled' ? 'Register again' : 'Register'}</Button>
}
