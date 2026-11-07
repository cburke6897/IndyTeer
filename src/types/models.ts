import type { Database } from './database'

type Tables = Database['public']['Tables']
export type Profile = Tables['profiles']['Row']
export type ProfileUpdate = Tables['profiles']['Update']
export type Opportunity = Tables['opportunities']['Row']
export type OpportunityInsert = Tables['opportunities']['Insert']
export type Application = Tables['applications']['Row']
export type Post = Tables['posts']['Row']
export type AccountType = Database['public']['Enums']['account_type']
export type ApplicationStatus = Database['public']['Enums']['application_status']

type PersonSummary = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'headline'>
export type OpportunityWithOrg = Opportunity & { org: PersonSummary | null }
export type PostWithAuthor = Post & { author: PersonSummary | null }
export type ApplicationWithVolunteer = Application & { volunteer: PersonSummary | null }
export type ApplicationWithOpportunity = Application & {
  opportunity: (Pick<Opportunity, 'id' | 'title' | 'starts_at' | 'neighborhood'> & {
    org: Pick<Profile, 'id' | 'full_name'> | null
  }) | null
}

export const CAUSES = [
  'Hunger & Food', 'Education & Youth', 'Environment', 'Animals', 'Health',
  'Housing & Homelessness', 'Seniors', 'Arts & Culture', 'Community Events',
] as const

export const NEIGHBORHOODS = [
  'Downtown', 'Mass Ave', 'Fountain Square', 'Fletcher Place', 'Irvington',
  'Broad Ripple', 'Meridian-Kessler', 'Near Eastside', 'Garfield Park', 'Haughville', 'Other',
] as const
