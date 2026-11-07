export type AccountType = 'volunteer' | 'organization'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  accountType: AccountType | null
  onboarded: boolean
  profileId: string | null
  demo?: boolean
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
  joinedAt: string
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
  followerBoost: number
  color: string
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
    reminders: boolean
    newOpportunities: boolean
    orgUpdates: boolean
    confirmations: boolean
  }
  privacy: {
    publicProfile: boolean
    showHours: boolean
    showHistory: boolean
    visibility: 'everyone' | 'members' | 'organizations'
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
  sessionUserId: string | null
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
