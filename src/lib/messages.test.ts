import { describe, expect, it } from 'vitest'
import { plainError } from './messages'

describe('plainError', () => {
  it.each([
    ['This user has opted out of organization invitations.', /chosen not to receive/],
    ['User already has an active or pending membership.', /already in this organization/],
    ['This organization requires an invitation.', /invitation only/],
    ['Organization is being deleted or does not exist.', /being deleted/],
    ['Transfer ownership before removing the last owner.', /owner cannot leave/i],
    ['Organization admin required.', /owner or administrator/],
    ['No pending invitation found.', /no longer waiting/],
  ])('explains %s', (raw, expected) => {
    expect(plainError(raw)).toMatch(expected)
  })

  it('keeps unknown messages and has a friendly fallback', () => {
    expect(plainError('Something specific broke.')).toBe('Something specific broke.')
    expect(plainError(null)).toMatch(/try again/i)
  })
})
