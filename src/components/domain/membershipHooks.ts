import { useState } from 'react'
import { act } from '../../store/act'
import { leaveOrCancelRequest, requestToJoin, respondToInvitation } from '../../store/actions'
import type { OrgProfile, OrgRole } from '../../types'

export const roleLabel = (role: OrgRole) => ({ owner: 'Owner', admin: 'Administrator', member: 'Member' })[role]

/** Runs one membership action at a time, shows the server's answer, and prevents double submits. */
export function useMembershipActions() {
  const [busy, setBusy] = useState(false)
  async function run<T>(task: () => Promise<T>, success: string) {
    if (busy) return undefined
    setBusy(true)
    try {
      return await act(task().then(() => true), success)
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
    join: (org: OrgProfile) => run(() => requestToJoin(org.id), `Your request to join ${org.name} was sent. An administrator will review it.`),
    cancelRequest: (org: OrgProfile) => run(() => leaveOrCancelRequest(org.id), 'Your request was cancelled.'),
    leave: (org: OrgProfile) => run(() => leaveOrCancelRequest(org.id), `You left ${org.name}.`),
    accept: (org: OrgProfile) => run(() => respondToInvitation(org.id, true), `You joined ${org.name}.`),
    decline: (org: OrgProfile) => run(() => respondToInvitation(org.id, false), 'Invitation declined.'),
  }
}

