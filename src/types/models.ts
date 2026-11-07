export type OrganizationRole = 'owner' | 'admin' | 'member'
export type MembershipStatus = 'invited' | 'pending' | 'active' | 'rejected' | 'removed'
export type OrganizationJoinPolicy = 'approval' | 'invite_only'
export type OpportunityStatus = 'draft' | 'published'
export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly'
export type RegistrationStatus = 'pending' | 'approved' | 'declined' | 'cancelled' | 'removed'
export type PostKind = 'update' | 'announcement'
export type ProfileVisibility = 'everyone' | 'members' | 'organizations'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface User {
  id: string
  first_name: string
  last_name: string
  full_name: string
  headline: string | null
  bio: string | null
  city: string | null
  state: string
  timezone: string
  date_of_birth: string | null
  avatar_url: string | null
  avatar_path: string | null
  phone: string | null
  availability: NonNullable<Json>
  interests: string[]
  skills: string[]
  onboarded: boolean
  is_platform_admin: boolean
  terms_accepted_at: string | null
  public_profile: boolean
  profile_visibility?: ProfileVisibility
  show_hours: boolean
  show_history: boolean
  created_at: string
  updated_at: string
}

export type UserUpdate = Partial<Pick<User,
  'first_name' | 'last_name' | 'full_name' | 'headline' | 'bio' | 'city' | 'state' | 'timezone' |
  'avatar_url' | 'avatar_path' | 'phone' | 'availability' | 'interests' | 'skills' |
  'public_profile' | 'profile_visibility' | 'show_hours' | 'show_history'>>

export interface Organization {
  id: string
  created_by: string
  name: string
  logo_path: string | null
  cover_path: string | null
  type: string | null
  description: string
  mission: string | null
  website: string | null
  city: string | null
  state: string
  contact_email: string | null
  phone: string | null
  focus: string[]
  verified: boolean
  founded_year: number | null
  join_policy: OrganizationJoinPolicy
  created_at: string
  updated_at: string
}

export type PublicOrganization = Pick<Organization,
  'id' | 'name' | 'logo_path' | 'cover_path' | 'type' | 'description' | 'mission' |
  'website' | 'city' | 'state' | 'focus' | 'verified' | 'founded_year' | 'created_at' | 'join_policy'>

export interface OrganizationMembership {
  organization_id: string
  user_id: string
  role: OrganizationRole
  status: MembershipStatus
  invited_by: string | null
  created_at: string
  updated_at: string
}

export interface Opportunity {
  id: string
  organization_id: string
  title: string
  description: string
  category: string
  city: string
  location: string
  address: string | null
  virtual: boolean
  min_age: number | null
  skills: string[]
  hours: number | null
  registration_deadline: string | null
  recurrence: RecurrenceType
  instructions: string | null
  event_date: string
  start_time: string
  end_time: string
  timezone: string
  starts_at: string
  ends_at: string | null
  spots: number
  image_url: string | null
  image_path: string | null
  status: OpportunityStatus
  created_at: string
}

export type OpportunityInsert = Omit<
  import('./database').Database['public']['Tables']['opportunities']['Insert'],
  'starts_at' | 'ends_at' | 'created_at'
> & { status?: OpportunityStatus }

export interface Registration {
  id: string
  opportunity_id: string
  user_id: string
  message: string | null
  status: RegistrationStatus
  attended: boolean
  hours_verified: boolean
  hours: number | null
  verified_at: string | null
  cancelled_at: string | null
  created_at: string
}

export interface Post {
  id: string
  author_user_id: string
  organization_id: string | null
  title: string
  kind: PostKind
  body: string
  image_url: string | null
  image_path: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  message: string
  data: Json
  read_at: string | null
  created_at: string
}

export interface UserSettings {
  user_id: string
  new_opportunity_notifications: boolean
  registration_notifications: boolean
  email_notifications: boolean
  opt_out_organization_invites: boolean
  created_at: string
  updated_at: string
}

export interface ManualHourEntry {
  id: string
  user_id: string
  org_name: string
  title: string
  entry_date: string
  hours: number
  notes: string | null
  created_at: string
}

