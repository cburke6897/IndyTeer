export type OrgRole = 'owner' | 'admin' | 'member'

/** One of the signed-in user's own organization memberships (public.organization_memberships). */
export interface Membership {
  orgId: string
  role: OrgRole
  status: 'invited' | 'pending' | 'active' | 'rejected' | 'removed'
}

/** A person in an organization, as shown to its owners and admins (names come from list_organization_members). */
export interface OrgPerson {
  userId: string
  name: string
  avatar: string | null
  role: OrgRole
  status: 'invited' | 'pending' | 'active' | 'rejected' | 'removed'
}

/** The standard IndyTeer user. There is no account type: organizations come from memberships. */
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  onboarded: boolean
  createdAt: string
}

export interface VolunteerProfile {
  id: string
  userId: string | null
  firstName: string
  lastName: string
  headline: string
  avatar: string | null
  city: string
  state: string
  bio: string
  interests: string[]
  skills: string[]
  phone: string
  availability: string
  /** ISO date the account was created; empty when the viewer cannot see it. */
  joinedAt: string
  /** What the profile owner has chosen to share (always true for your own profile). */
  privacy: { showHours: boolean; showHistory: boolean }
  /** Hours and history exposed to an organization by the database; null when not shared. */
  shared: { verifiedHours: number | null; history: { oppId: string; status: string; hours: number | null }[] | null } | null
}

export interface OrgProfile {
  id: string
  userId: string | null
  name: string
  logo: string | null
  cover: string | null
  type: string
  description: string
  mission: string
  website: string
  city: string
  state: string
  email: string
  phone: string
  focus: string[]
  verified: boolean
  founded: number
  color: string
  /** 'approval': anyone may ask to join; 'invite_only': only people an admin invites. */
  joinPolicy: 'approval' | 'invite_only'
}

export type Recurrence = 'none' | 'weekly' | 'biweekly' | 'monthly'

export interface Opportunity {
  id: string
  orgId: string
  title: string
  description: string
  category: string
  image: string | null
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string
  location: string // venue name
  address: string
  city: string
  virtual: boolean
  spots: number
  minAge: number | null
  skills: string[]
  hours: number
  deadline: string // YYYY-MM-DD
  recurrence: Recurrence
  instructions: string
  status: 'published' | 'draft'
  createdAt: string // ISO timestamp
}

export type RegStatus = 'pending' | 'approved' | 'declined' | 'cancelled' | 'removed'

export interface Registration {
  id: string
  oppId: string
  volunteerId: string
  status: RegStatus
  attended: boolean
  hoursVerified: boolean
  hours: number
  createdAt: string
}

export interface ManualHourLog {
  id: string
  volunteerId: string
  orgName: string
  title: string
  date: string
  hours: number
  notes: string
  createdAt: string
}

export interface Follow {
  volunteerId: string
  orgId: string
}

export interface SavedOpp {
  volunteerId: string
  oppId: string
}

export interface Post {
  id: string
  orgId: string | null // null = IndyTeer team announcement
  kind: 'update' | 'announcement'
  title: string
  body: string
  image: string | null
  createdAt: string
}

export interface AppNotification {
  id: string
  userId: string
  text: string
  link: string | null
  read: boolean
  createdAt: string
}

export interface Settings {
  notifications: {
    email: boolean
    newOpportunities: boolean
    confirmations: boolean
  }
  privacy: {
    publicProfile: boolean
    showHours: boolean
    showHistory: boolean
  }
}

export interface DB {
  users: User[]
  volunteers: VolunteerProfile[]
  organizations: OrgProfile[]
  opportunities: Opportunity[]
  registrations: Registration[]
  manualHours: ManualHourLog[]
  follows: Follow[]
  saved: SavedOpp[]
  posts: Post[]
  notifications: AppNotification[]
  settings: Record<string, Settings>
  /** Spots left per published opportunity id (from the opportunity_availability view). */
  availability: Record<string, number>
  /** The signed-in user's own memberships, any status. */
  memberships: Membership[]
  /** People in each organization the user manages (owner/admin only; empty when the server cannot list them). */
  orgPeople: Record<string, OrgPerson[]>
  /** The organization currently being managed (one of the user's active owner/admin memberships). */
  activeOrgId: string | null
  sessionUserId: string | null
  /** True once the first snapshot for the current session has loaded. */
  ready: boolean
  /** Identifies the session inputs (profile + memberships) the snapshot was built from. */
  key: string
  loadError: string | null
}

export interface HourEntry {
  id: string
  volunteerId: string
  orgId: string | null
  orgName: string
  title: string
  date: string
  hours: number
  status: 'verified' | 'pending'
  source: 'event' | 'manual'
  notes?: string
}
