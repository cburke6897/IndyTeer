import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Check, MoreHorizontal, UserCheck, UserMinus, X } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Dropdown, MenuItem } from '../ui/Dropdown'
import { TextInput } from '../ui/Field'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { RegStatusBadge } from './OpportunityParts'
import { formatDate, formatHours } from '../../lib/utils'
import { markAttended, setRegistrationStatus, unverifyHours, verifyHours } from '../../store/actions'
import { toast } from '../../store/toast'
import type { Opportunity, Registration, VolunteerProfile } from '../../types'

export interface RegRow { reg: Registration; volunteer: VolunteerProfile; opp: Opportunity }

export function RegistrationTable({ rows }: { rows: RegRow[] }) {
  const [removing, setRemoving] = useState<RegRow | null>(null)
  const [verifying, setVerifying] = useState<RegRow | null>(null)
  const [hours, setHours] = useState('')
  const [hoursError, setHoursError] = useState('')

  function openVerify(row: RegRow) {
    setVerifying(row)
    setHours(String(row.reg.hours))
    setHoursError('')
  }

  function confirmVerify() {
    if (!verifying) return
    const h = Number(hours)
    if (!(h > 0) || h > 24) return setHoursError('Enter hours between 0.5 and 24.')
    verifyHours(verifying.reg.id, h)
    toast(`Verified ${formatHours(h)} hours for ${verifying.volunteer.firstName}.`)
    setVerifying(null)
  }

  return (
    <>
      <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-white shadow-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface/70 text-xs font-semibold tracking-wide text-muted uppercase">
              <th className="px-4 py-3">Volunteer</th>
              <th className="px-4 py-3">Opportunity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attendance</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const { reg, volunteer, opp } = row
              return (
                <tr key={reg.id} className="align-middle hover:bg-surface/40">
                  <td className="px-4 py-3">
                    <Link to={`/org/volunteers/${volunteer.id}`} className="flex items-center gap-3">
                      <Avatar person={volunteer} size="md" />
                      <span>
                        <span className="block font-semibold text-navy hover:underline">{volunteer.firstName} {volunteer.lastName}</span>
                        <span className="block text-xs text-muted">{volunteer.city}, {volunteer.state}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/org/opportunities/${opp.id}`} className="font-medium text-ink hover:underline">{opp.title}</Link>
                    <p className="text-xs text-muted">{formatDate(opp.date)}</p>
                  </td>
                  <td className="px-4 py-3"><RegStatusBadge status={reg.status} /></td>
                  <td className="px-4 py-3">
                    {reg.status !== 'approved' ? <span className="text-muted">—</span> : reg.attended ? <Badge tone="success" icon={<Check size={12} />}>Attended</Badge> : <Badge>Not yet</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {reg.status === 'approved' && reg.attended ? (
                      reg.hoursVerified
                        ? <Badge tone="success" icon={<BadgeCheck size={12} />}>{formatHours(reg.hours)} verified</Badge>
                        : <Badge tone="gold">{formatHours(reg.hours)} pending</Badge>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {reg.status === 'pending' && (
                        <>
                          <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={() => { setRegistrationStatus(reg.id, 'approved'); toast(`Approved ${volunteer.firstName} ${volunteer.lastName}.`) }}>Approve</Button>
                          <Button size="sm" variant="secondary" icon={<X size={14} />} onClick={() => { setRegistrationStatus(reg.id, 'declined'); toast(`Declined ${volunteer.firstName}’s registration.`, 'info') }}>Decline</Button>
                        </>
                      )}
                      {reg.status === 'approved' && !reg.attended && (
                        <Button size="sm" variant="secondary" icon={<UserCheck size={14} />} onClick={() => { markAttended(reg.id, true); toast(`${volunteer.firstName} marked as attended.`) }}>Mark attended</Button>
                      )}
                      {reg.status === 'approved' && reg.attended && !reg.hoursVerified && (
                        <Button size="sm" variant="accent" icon={<BadgeCheck size={14} />} onClick={() => openVerify(row)}>Verify hours</Button>
                      )}
                      {(reg.status === 'approved' || reg.status === 'declined') && (
                        <Dropdown label="More actions" trigger={() => <span className="flex size-8 items-center justify-center rounded-md border border-line-strong text-muted hover:bg-surface hover:text-navy"><MoreHorizontal size={16} /></span>}>
                          {(close) => (
                            <>
                              <MenuItem icon={<Check size={15} />} onClick={() => { close(); setRegistrationStatus(reg.id, 'approved'); toast('Registration approved.') }}>{reg.status === 'declined' ? 'Approve instead' : 'Keep approved'}</MenuItem>
                              {reg.status === 'approved' && reg.attended && (
                                <MenuItem icon={<X size={15} />} onClick={() => { close(); markAttended(reg.id, false); toast('Attendance cleared.', 'info') }}>Undo attended</MenuItem>
                              )}
                              {reg.hoursVerified && (
                                <MenuItem icon={<BadgeCheck size={15} />} onClick={() => { close(); unverifyHours(reg.id); toast('Hours set back to pending.', 'info') }}>Unverify hours</MenuItem>
                              )}
                              {reg.status === 'approved' && <MenuItem icon={<UserMinus size={15} />} danger onClick={() => { close(); setRemoving(row) }}>Remove volunteer</MenuItem>}
                            </>
                          )}
                        </Dropdown>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        destructive
        title="Remove this volunteer?"
        message={<><strong>{removing?.volunteer.firstName} {removing?.volunteer.lastName}</strong> will be removed from <strong>{removing?.opp.title}</strong> and any attendance or verified hours for this event will be cleared.</>}
        confirmLabel="Remove volunteer"
        onConfirm={() => { if (!removing) return; setRegistrationStatus(removing.reg.id, 'removed'); toast('Volunteer removed.', 'info') }}
      />

      <Modal
        open={!!verifying}
        onClose={() => setVerifying(null)}
        size="sm"
        title="Verify volunteer hours"
        description={verifying ? `${verifying.volunteer.firstName} ${verifying.volunteer.lastName} · ${verifying.opp.title}` : ''}
        footer={<><Button variant="secondary" onClick={() => setVerifying(null)}>Cancel</Button><Button variant="accent" onClick={confirmVerify}>Verify hours</Button></>}
      >
        <TextInput label="Hours contributed" type="number" step={0.5} min={0.5} value={hours} onChange={(e) => setHours(e.target.value)} error={hoursError} hint="Adjust if the volunteer worked more or less than the estimate. This will appear as verified on their profile." />
      </Modal>
    </>
  )
}
