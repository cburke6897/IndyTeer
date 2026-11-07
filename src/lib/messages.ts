/**
 * Turns the database's technical errors into plain sentences a non-technical person can act on.
 * Unknown messages are shown as the server wrote them.
 */
const RULES: [RegExp, string][] = [
  [/opted out of organization invitations/i, 'This person has chosen not to receive organization invitations.'],
  [/already has an active or pending membership/i, 'That person is already in this organization or already has a request waiting.'],
  [/already have a membership or pending request/i, 'You are already in this organization, or your request is already waiting for an answer.'],
  [/requires an invitation/i, 'This organization is invitation only. An administrator has to invite you.'],
  [/being deleted/i, 'This organization is being deleted, so changes are paused.'],
  [/transfer ownership before removing the last owner/i, 'An owner cannot leave. Transfer ownership to someone else first, or delete the organization.'],
  [/only an owner can remove another owner/i, 'Only an owner can remove another owner.'],
  [/organization admin required/i, 'Only an owner or administrator of this organization can do that.'],
  [/only an (active )?(organization )?owner/i, 'Only an owner of this organization can do that.'],
  [/choose another active member or admin|new owner must be an active/i, 'Choose another active member of this organization.'],
  [/no pending invitation/i, 'That invitation is no longer waiting. It may already have been answered or cancelled.'],
  [/no pending membership request/i, 'That request is no longer waiting. It may already have been answered.'],
  [/account deletion is in progress/i, 'An account deletion is in progress, so this cannot be changed right now.'],
  [/user not found|profile unavailable/i, 'We could not find that person.'],
  [/jwt|not authenticated|sign in/i, 'Please sign in again to continue.'],
]

export function plainError(message: string | undefined | null, fallback = 'Something went wrong. Please try again.'): string {
  if (!message) return fallback
  for (const [pattern, text] of RULES) if (pattern.test(message)) return text
  return message
}
