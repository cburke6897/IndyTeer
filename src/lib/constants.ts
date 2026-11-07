export const CATEGORIES = [
  'Environment',
  'Education',
  'Animal Welfare',
  'Food & Hunger',
  'Healthcare',
  'Community Development',
  'Youth & Mentoring',
  'Arts & Culture',
  'Seniors',
  'Veterans',
] as const

export const SKILLS = [
  'Event Planning', 'Tutoring', 'Gardening', 'Cooking', 'Photography', 'Graphic Design',
  'Web Development', 'Spanish', 'Sign Language', 'First Aid / CPR', 'Public Speaking',
  'Fundraising', 'Carpentry', 'Driving', 'Data Entry', 'Social Media', 'Writing',
  'Animal Care', 'Translation', 'Counseling', 'Project Management', 'Heavy Lifting',
]

export const ORG_TYPES = [
  'Nonprofit',
  'Business',
  'School or University',
  'Community Organization',
  'Faith-Based Organization',
  'Government Agency',
]

export const INDIANA_CITIES = [
  'Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Fishers', 'Bloomington',
  'Lafayette', 'Muncie', 'Gary', 'Noblesville', 'Terre Haute', 'Greenwood', 'Kokomo', 'Anderson',
  'Elkhart', 'Richmond', 'Columbus', 'Jeffersonville', 'Valparaiso',
]

export const AVAILABILITY_OPTIONS = [
  'Weekday mornings', 'Weekday evenings', 'Weekends', 'Flexible', 'One-time events only',
]

export const OPP_TYPES = ['One-time', 'Recurring', 'Virtual', 'Skills-based'] as const

const U = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

export const IMG = {
  animals: U('1450778869180-41d0601e046e'),
  books: U('1497633762265-9d179a990aa6'),
  school: U('1503676260728-1c00da094a0b'),
  soil: U('1542601906990-b4d3fb778b09'),
  cleanup: U('1618477461853-cf6ed80faba5'),
  warehouse: U('1593113598332-cd288d649433'),
  distribution: U('1593113630400-ea4288922497'),
  hearts: U('1469571486292-0ba58a3f068b'),
  doctor: U('1576091160399-112ba8d25d1d'),
  seniors: U('1576765608535-5f04d1e3f289'),
  group: U('1491438590914-bc09fcaaf77a'),
  youth: U('1517486808906-6ca8b3f04846'),
  volunteer: U('1559027615-cd4628902d4a'),
  laptops: U('1522202176988-66273c2fd55f'),
  civic: U('1524178232363-1fb2b075b655'),
  soccer: U('1587329310686-91414b8e3cb7'),
  kids: U('1488521787991-ed7bbaae773c'),
  veteran: U('1508847154043-be5407fcaa5a'),
}

export const CATEGORY_IMAGE: Record<string, string> = {
  Environment: IMG.cleanup,
  Education: IMG.school,
  'Animal Welfare': IMG.animals,
  'Food & Hunger': IMG.warehouse,
  Healthcare: IMG.doctor,
  'Community Development': IMG.group,
  'Youth & Mentoring': IMG.youth,
  'Arts & Culture': IMG.civic,
  Seniors: IMG.seniors,
  Veterans: IMG.veteran,
}

export const ORG_COLORS = ['#142C5B', '#244B85', '#1F6F5C', '#7A3E1D', '#5B2A86', '#8A2C3F', '#2B5F75', '#3B4A1F']
