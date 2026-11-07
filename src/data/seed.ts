import type {
  AppNotification, DB, Follow, ManualHourLog, Opportunity, OrgProfile, Post, Recurrence,
  Registration, SavedOpp, Settings, User, VolunteerProfile,
} from '../types'
import { CATEGORIES, IMG, ORG_COLORS } from '../lib/constants'
import { addDays, todayISO } from '../lib/utils'

export const DEMO_PASSWORD = 'demo1234'
export const DEMO_VOLUNTEER_EMAIL = 'volunteer@indyteer.demo'
export const DEMO_ORG_EMAIL = 'org@indyteer.demo'
export const DEMO_VOLUNTEER_ID = 'u_demo_vol'
export const DEMO_ORG_ID = 'u_demo_org'

export function defaultSettings(): Settings {
  return {
    notifications: { email: true, reminders: true, newOpportunities: true, orgUpdates: false, confirmations: true },
    privacy: { publicProfile: true, showHours: true, showHistory: true, visibility: 'everyone' },
  }
}

// Small deterministic PRNG so seeded data is stable between runs.
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

export function buildSeed(): DB {
  const today = todayISO()
  const day = (n: number) => addDays(today, n)
  const rand = rng(42)

  /* ------------------------------ Organizations ------------------------------ */
  const orgDefs: Omit<OrgProfile, 'userId' | 'logo' | 'color' | 'state'>[] = [
    {
      id: 'org_1', name: 'Hoosier Harvest Network', type: 'Nonprofit', city: 'Indianapolis', verified: true, founded: 2009,
      focus: ['Food & Hunger', 'Community Development'], cover: IMG.warehouse, followerBoost: 1184,
      description: 'Hoosier Harvest Network rescues surplus food from grocers, farms, and restaurants and delivers it to neighborhood pantries across central Indiana. Volunteers run every part of our operation, from the warehouse floor to our mobile markets.',
      mission: 'To make sure no Hoosier family has to choose between a meal and a bill, by moving good food to the neighbors who need it most.',
      website: 'https://hoosierharvest.org', email: 'volunteer@hoosierharvest.org', phone: '(317) 555-0142',
    },
    {
      id: 'org_2', name: 'White River Conservancy', type: 'Nonprofit', city: 'Indianapolis', verified: true, founded: 1998,
      focus: ['Environment'], cover: IMG.cleanup, followerBoost: 2310,
      description: 'We protect and restore the White River corridor through habitat restoration, litter cleanups, and public education. Over 4,000 volunteers join us each year.',
      mission: 'A clean, healthy, and accessible White River for every Indiana community it touches.',
      website: 'https://whiteriverconservancy.org', email: 'hello@whiteriverconservancy.org', phone: '(317) 555-0177',
    },
    {
      id: 'org_3', name: 'Fort Wayne Paws Rescue', type: 'Nonprofit', city: 'Fort Wayne', verified: true, founded: 2012,
      focus: ['Animal Welfare'], cover: IMG.animals, followerBoost: 968,
      description: 'A foster-based rescue placing more than 1,200 dogs and cats in loving homes every year. Volunteers help with socialization, adoption events, transport, and fostering.',
      mission: 'Every adoptable animal deserves a safe place to land and a family to call their own.',
      website: 'https://fwpawsrescue.org', email: 'volunteer@fwpawsrescue.org', phone: '(260) 555-0188',
    },
    {
      id: 'org_4', name: 'Bloomington Reading Bridge', type: 'Nonprofit', city: 'Bloomington', verified: true, founded: 2015,
      focus: ['Education', 'Youth & Mentoring'], cover: IMG.books, followerBoost: 742,
      description: 'Reading Bridge pairs trained volunteers with elementary students who are building their literacy skills. We also host family reading nights and community book drives.',
      mission: 'Closing the literacy gap in Monroe County, one reading buddy at a time.',
      website: 'https://readingbridge.org', email: 'buddies@readingbridge.org', phone: '(812) 555-0121',
    },
    {
      id: 'org_5', name: 'Lakeshore Health Outreach', type: 'Nonprofit', city: 'Gary', verified: true, founded: 2004,
      focus: ['Healthcare', 'Community Development'], cover: IMG.doctor, followerBoost: 655,
      description: 'Lakeshore Health Outreach brings free screenings, vaccinations, and wellness education to Northwest Indiana neighborhoods with limited access to care.',
      mission: 'Quality health information and preventive care within reach of every family in Lake County.',
      website: 'https://lakeshorehealth.org', email: 'volunteer@lakeshorehealth.org', phone: '(219) 555-0165',
    },
    {
      id: 'org_6', name: 'Carmel Senior Companions', type: 'Community Organization', city: 'Carmel', verified: false, founded: 2017,
      focus: ['Seniors'], cover: IMG.seniors, followerBoost: 318,
      description: 'We match older adults with friendly visitors and organize social activities in memory care and assisted living communities around Hamilton County.',
      mission: 'Ending loneliness among older Hoosiers through consistent, caring connection.',
      website: 'https://carmelseniorcompanions.org', email: 'connect@carmelseniorcompanions.org', phone: '(317) 555-0133',
    },
    {
      id: 'org_7', name: 'South Bend Neighborhood Builders', type: 'Nonprofit', city: 'South Bend', verified: true, founded: 2006,
      focus: ['Community Development'], cover: IMG.group, followerBoost: 1022,
      description: 'Neighbors helping neighbors. We make critical home repairs for low-income homeowners and transform vacant lots into gardens and play spaces.',
      mission: 'Safe homes and strong blocks, built together by the people who live on them.',
      website: 'https://sbbuilders.org', email: 'build@sbbuilders.org', phone: '(574) 555-0109',
    },
    {
      id: 'org_8', name: 'Evansville Arts Collective', type: 'Community Organization', city: 'Evansville', verified: false, founded: 2019,
      focus: ['Arts & Culture', 'Youth & Mentoring'], cover: IMG.civic, followerBoost: 276,
      description: 'A volunteer-run collective bringing public murals, gallery nights, and free art classes to the Evansville riverfront and surrounding neighborhoods.',
      mission: 'Making art accessible to everyone in Southwest Indiana.',
      website: 'https://evansvillearts.org', email: 'create@evansvillearts.org', phone: '(812) 555-0194',
    },
    {
      id: 'org_9', name: 'Lafayette Youth Mentors', type: 'Nonprofit', city: 'Lafayette', verified: true, founded: 2011,
      focus: ['Youth & Mentoring', 'Education'], cover: IMG.soccer, followerBoost: 589,
      description: 'Lafayette Youth Mentors provides one-on-one mentoring, sports clinics, and career exploration programs for middle and high school students.',
      mission: 'Every young person deserves a caring adult who believes in them.',
      website: 'https://lafayettementors.org', email: 'mentor@lafayettementors.org', phone: '(765) 555-0152',
    },
    {
      id: 'org_10', name: 'Midwest Tech for Good', type: 'Business', city: 'Indianapolis', verified: false, founded: 2020,
      focus: ['Education', 'Community Development'], cover: IMG.laptops, followerBoost: 204,
      description: 'A group of Indianapolis tech employees donating their professional skills to nonprofits and job seekers through website sprints and digital literacy workshops.',
      mission: 'Putting technology talent to work for community good.',
      website: 'https://midwesttechforgood.com', email: 'hello@midwesttechforgood.com', phone: '(317) 555-0118',
    },
  ]
  const organizations: OrgProfile[] = orgDefs.map((o, i) => ({
    ...o, state: 'IN', logo: null, color: ORG_COLORS[i % ORG_COLORS.length], userId: o.id === 'org_1' ? DEMO_ORG_ID : null,
  }))

  /* ------------------------------- Volunteers -------------------------------- */
  const firsts = ['Marcus', 'Priya', 'Daniel', 'Sofia', 'Aiden', 'Hannah', 'Tyrese', 'Emily', 'Caleb', 'Olivia', 'Noah', 'Grace', 'Isaiah', 'Chloe', 'Mateo', 'Abigail', 'Elijah', 'Zoe', 'Ethan', 'Naomi', 'Lucas', 'Amara', 'Owen', 'Leah']
  const lasts = ['Reed', 'Patel', 'Kowalski', 'Ramirez', 'Brooks', 'Schultz', 'Johnson', 'Chen', 'Miller', 'Nguyen', 'Bennett', 'Hayes', 'Washington', 'Albright', 'Torres', 'Yoder', 'Carter', 'Okafor', 'Fischer', 'Singh', 'Hall', 'Mensah', 'Lindgren', 'Foster']
  const jobs = ['Registered nurse', 'High school teacher', 'Software engineer', 'Graduate student', 'Marketing coordinator', 'Retired educator', 'Small business owner', 'Accountant', 'IU undergraduate', 'Purdue undergraduate', 'Electrician', 'Librarian']
  const cities = ['Indianapolis', 'Indianapolis', 'Indianapolis', 'Carmel', 'Fishers', 'Fort Wayne', 'Bloomington', 'Lafayette', 'South Bend', 'Evansville', 'Gary', 'Noblesville', 'Muncie']
  const skillPool = ['Event Planning', 'Tutoring', 'Gardening', 'Cooking', 'Photography', 'Spanish', 'First Aid / CPR', 'Public Speaking', 'Carpentry', 'Driving', 'Social Media', 'Animal Care', 'Heavy Lifting', 'Writing']
  const availabilities = ['Weekends', 'Weekday evenings', 'Flexible', 'Weekday mornings']

  const maya: VolunteerProfile = {
    id: 'vol_1', userId: DEMO_VOLUNTEER_ID, firstName: 'Maya', lastName: 'Thompson',
    headline: 'Public health graduate · Volunteer since 2023', avatar: null, city: 'Indianapolis', state: 'IN',
    bio: 'Born and raised in Indianapolis. I studied public health at IUPUI and spend most weekends volunteering with food, environment, and youth programs around the city. Always happy to lend a hand and bring snacks.',
    interests: ['Food & Hunger', 'Environment', 'Youth & Mentoring', 'Healthcare'],
    skills: ['Event Planning', 'First Aid / CPR', 'Spanish', 'Public Speaking'],
    phone: '(317) 555-0199', availability: 'Weekends', joinedAt: '2023-03-14',
  }
  const volunteers: VolunteerProfile[] = [maya]
  for (let i = 0; i < 47; i++) {
    const first = firsts[i % firsts.length]
    const last = lasts[(i * 7 + 3 + Math.floor(i / firsts.length) * 5) % lasts.length]
    const ints = [CATEGORIES[i % CATEGORIES.length], CATEGORIES[(i * 3 + 2) % CATEGORIES.length]]
    volunteers.push({
      id: `vol_${i + 2}`, userId: null, firstName: first, lastName: last,
      headline: `${jobs[i % jobs.length]} · ${cities[i % cities.length]}`, avatar: null,
      city: cities[(i * 5) % cities.length], state: 'IN',
      bio: `Hoosier volunteer passionate about ${ints[0].toLowerCase()} and ${ints[1].toLowerCase()}. Happy to jump in wherever a hand is needed.`,
      interests: ints, skills: [skillPool[i % skillPool.length], skillPool[(i * 4 + 1) % skillPool.length], skillPool[(i * 2 + 5) % skillPool.length]],
      phone: `(317) 555-${String(1000 + i * 37).slice(-4)}`, availability: availabilities[i % availabilities.length],
      joinedAt: addDays(today, -(120 + i * 23)),
    })
  }
  const volIds = volunteers.map((v) => v.id)
  const others = volIds.slice(1)

  /* ------------------------------- Opportunities ------------------------------ */
  const opportunities: Opportunity[] = []
  let n = 0
  const makeOpp = (
    orgId: string, title: string, category: string, off: number, start: string, end: string,
    city: string, location: string, address: string, spots: number, hours: number, image: string | null, description: string,
    x: Partial<Opportunity> = {},
  ): string => {
    const id = `opp_${++n}`
    opportunities.push({
      id, orgId, title, description, category, image, date: day(off), startTime: start, endTime: end, location, address, city,
      virtual: false, spots, minAge: null, skills: [], hours, deadline: day(off > 0 ? off - 1 : off),
      recurrence: 'none' as Recurrence, instructions: 'Wear closed-toe shoes and bring a water bottle. Check in with the volunteer lead at the front table when you arrive.',
      status: 'published', createdAt: hoursAgo(off < 0 ? Math.abs(off) * 24 + 96 : Math.max(2, 70 - off * 4)), ...x,
    })
    return id
  }

  // org_1 (demo organization) — history
  const o1Past: string[] = [
    makeOpp('org_1', 'Spring Pantry Restock', 'Food & Hunger', -165, '09:00', '12:00', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 30, 3, IMG.warehouse, 'Help sort, inspect, and shelve donated food for our partner pantries.'),
    makeOpp('org_1', 'Summer Meals Kickoff Packing', 'Food & Hunger', -135, '10:00', '13:00', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 35, 3, IMG.hearts, 'Pack shelf-stable summer meal kits for kids who rely on school lunches.'),
    makeOpp('org_1', 'Mobile Market Distribution', 'Food & Hunger', -105, '08:00', '12:00', 'Indianapolis', 'Garfield Park Pavilion', '2345 Raymond St, Indianapolis, IN 46203', 25, 4, IMG.distribution, 'Set up and run our produce-forward mobile market for neighbors in the Garfield Park area.'),
    makeOpp('org_1', 'Back-to-School Backpack Packing', 'Youth & Mentoring', -78, '09:00', '13:00', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 40, 4, IMG.kids, 'Fill 600 backpacks with school supplies and snacks for local students.'),
    makeOpp('org_1', 'Community Garden Harvest Day', 'Environment', -50, '09:00', '12:00', 'Indianapolis', 'Eastside Community Garden', '1200 N Rural St, Indianapolis, IN 46201', 20, 3, IMG.soil, 'Harvest late-season vegetables and deliver them directly to neighborhood pantries.'),
    makeOpp('org_1', 'Warehouse Sorting Night', 'Food & Hunger', -30, '17:30', '20:30', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 30, 3, IMG.warehouse, 'An evening shift sorting rescued grocery donations by category and date.'),
    makeOpp('org_1', 'Mobile Market Distribution – Eastside', 'Food & Hunger', -14, '08:00', '12:00', 'Indianapolis', 'Brookside Community Center', '1301 E 10th St, Indianapolis, IN 46201', 28, 4, IMG.distribution, 'Welcome neighbors, bag groceries, and help carry food to cars at our Eastside mobile market.'),
  ]
  const o1Today = makeOpp('org_1', 'Pantry Open Hours Support', 'Food & Hunger', 0, '16:00', '19:00', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 12, 3, IMG.warehouse, 'Greet clients, help with intake, and keep shelves stocked during our weekly evening open hours.')
  const o1Thanks = makeOpp('org_1', 'Thanksgiving Meal Box Assembly', 'Food & Hunger', 3, '09:00', '13:00', 'Indianapolis', 'Indiana State Fairgrounds – Blue Ribbon Hall', '1202 E 38th St, Indianapolis, IN 46205', 40, 4, IMG.hearts, 'Join us as we assemble 2,000 Thanksgiving meal boxes with turkeys, sides, and pies for families across Marion County. No experience needed – just energy and a good attitude. Teams of friends and coworkers welcome.', { instructions: 'Park in Lot 9. Wear closed-toe shoes. Lunch is provided for all volunteers.', minAge: 14 })
  const o1Mobile = makeOpp('org_1', 'Mobile Market Distribution – Westside', 'Food & Hunger', 9, '08:00', '12:00', 'Indianapolis', 'Haughville Community Center', '1250 W 8th St, Indianapolis, IN 46222', 25, 4, IMG.distribution, 'Set up and run our free produce market. Volunteers help with tables, bagging, translation, and carrying groceries.', { skills: ['Spanish'] })
  makeOpp('org_1', 'Holiday Warehouse Sorting Night', 'Food & Hunger', 16, '17:30', '20:30', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 30, 3, IMG.warehouse, 'Sort holiday food donations and build family-sized boxes for the December distribution.')
  makeOpp('org_1', 'Winter Coat & Blanket Drive Sorting', 'Community Development', 28, '10:00', '14:00', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 20, 4, IMG.group, 'Help sort and bundle donated coats and blankets for distribution through partner shelters.')
  const o1Weekly = makeOpp('org_1', 'Weekly Pantry Packing Crew', 'Food & Hunger', 2, '18:00', '20:00', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 15, 2, IMG.warehouse, 'Our reliable weekly crew packs pantry boxes every week. Come once or become a regular – we would love to have you.', { recurrence: 'weekly' })
  makeOpp('org_1', 'Volunteer Orientation Workshop', 'Community Development', 21, '18:00', '19:30', 'Indianapolis', 'Hoosier Harvest Warehouse', '2401 E Raymond St, Indianapolis, IN 46203', 30, 1.5, null, 'A new-volunteer orientation covering food safety, warehouse procedures, and how to get involved.', { status: 'draft', createdAt: hoursAgo(20) })

  // other organizations
  const pastOthers: Record<string, string> = {}
  const mk = (orgId: string, key: string | null, ...args: Parameters<typeof makeOpp> extends [string, ...infer R] ? R : never) => {
    const id = makeOpp(orgId, ...args)
    if (key) pastOthers[key] = id
    return id
  }
  const rb = 'Indianapolis'
  mk('org_2', 'o2p', 'Riverbank Cleanup at Broad Ripple', 'Environment', -21, '09:00', '12:00', rb, 'Broad Ripple Park', '1550 Broad Ripple Ave, Indianapolis, IN 46220', 40, 3, IMG.cleanup, 'Grab a pair of gloves and help clear litter from the White River shoreline.')
  const o2Tree = mk('org_2', null, 'Native Tree Planting Day', 'Environment', 6, '09:00', '13:00', rb, 'Eagle Creek Park', '7840 W 56th St, Indianapolis, IN 46254', 60, 4, IMG.soil, 'We are planting 500 native saplings along the reservoir to restore habitat and prevent erosion. Tools, training, and snacks provided.')
  mk('org_2', null, 'Invasive Species Removal Workshop', 'Environment', 20, '10:00', '14:00', rb, 'Holliday Park', '6363 Spring Mill Rd, Indianapolis, IN 46260', 25, 4, IMG.soil, 'Learn to identify and remove bush honeysuckle and other invasive plants with our restoration ecologists.')
  mk('org_3', 'o3p', 'Adoption Weekend Helpers', 'Animal Welfare', -40, '10:00', '15:00', 'Fort Wayne', 'Jefferson Pointe Shops', '1 Jefferson Pointe, Fort Wayne, IN 46804', 20, 5, IMG.animals, 'Help match pets with families, handle animals, and answer visitors’ questions.')
  const o3Dog = mk('org_3', null, 'Dog Walking & Socialization Shift', 'Animal Welfare', 4, '10:00', '12:00', 'Fort Wayne', 'Paws Rescue Shelter', '3010 Maplecrest Rd, Fort Wayne, IN 46815', 15, 2, IMG.animals, 'Walk and socialize shelter dogs to keep them happy, healthy, and adoption-ready.', { minAge: 16, skills: ['Animal Care'] })
  mk('org_3', null, 'Adoption Day at Johnny Appleseed Park', 'Animal Welfare', 12, '11:00', '16:00', 'Fort Wayne', 'Johnny Appleseed Park', '1500 Hobson Rd, Fort Wayne, IN 46805', 30, 5, IMG.animals, 'Our biggest adoption event of the season. Volunteers help with setup, greeting, and animal handling.')
  mk('org_4', 'o4p', 'Family Literacy Night', 'Education', -25, '17:30', '20:00', 'Bloomington', 'Monroe County Public Library', '303 E Kirkwood Ave, Bloomington, IN 47408', 25, 2.5, IMG.books, 'Read with children and run activity tables during our free family literacy night.')
  mk('org_4', null, 'After-School Reading Buddies', 'Education', 5, '15:30', '17:30', 'Bloomington', 'Rogers Elementary School', '2001 S Rogers St, Bloomington, IN 47403', 20, 2, IMG.school, 'Spend two hours a week reading one-on-one with a 2nd or 3rd grader. Training provided.', { recurrence: 'weekly' })
  mk('org_4', null, 'Book Fair Setup Crew', 'Education', 18, '09:00', '12:00', 'Bloomington', 'Bloomington High School North', '3901 N Kinser Pike, Bloomington, IN 47404', 15, 3, IMG.books, 'Unbox, sort, and shelve thousands of donated books for our annual community book fair.')
  mk('org_5', 'o5p', 'Community Health Screening Day', 'Healthcare', -35, '08:00', '14:00', 'Gary', 'Glen Park Community Center', '3550 W 5th Ave, Gary, IN 46406', 20, 6, IMG.doctor, 'Support free blood pressure, glucose, and vision screenings for neighbors.')
  mk('org_5', null, 'Free Health Fair Registration Desk', 'Healthcare', 8, '08:00', '14:00', 'Gary', 'Genesis Convention Center', '1 Genesis Convention Center Plaza, Gary, IN 46402', 18, 6, IMG.doctor, 'Welcome attendees, help with intake forms, and guide families to screening stations. Bilingual volunteers are especially valuable.', { skills: ['Spanish'] })
  mk('org_5', null, 'Flu Shot Clinic Greeters', 'Healthcare', 25, '09:00', '13:00', 'Gary', 'Lakeshore Health Clinic', '2100 Broadway, Gary, IN 46407', 12, 4, IMG.seniors, 'Greet patients, manage the line, and help with paperwork at our free flu shot clinic.')
  mk('org_6', 'o6p', 'Memory Care Craft Afternoon', 'Seniors', -18, '14:00', '16:00', 'Carmel', 'Brookdale Carmel Memory Care', '12351 Pennsylvania St, Carmel, IN 46032', 12, 2, IMG.seniors, 'Craft and conversation with residents at a local memory care community.')
  mk('org_6', null, 'Friendly Visitor Program Orientation', 'Seniors', 7, '18:00', '19:30', 'Carmel', 'Online via Zoom', 'Link sent after registration', 25, 1.5, IMG.seniors, 'A virtual orientation for new Friendly Visitors covering communication tips and visit guidelines.', { virtual: true })
  mk('org_6', null, 'Holiday Card Making with Residents', 'Seniors', 14, '13:00', '15:00', 'Carmel', 'Carmel Senior Center', '1 Civic Square, Carmel, IN 46032', 15, 2, IMG.hearts, 'Make holiday cards alongside residents and deliver them to homebound seniors.')
  mk('org_7', 'o7p', 'Porch Repair Day', 'Community Development', -45, '08:00', '15:00', 'South Bend', 'Near Westside Neighborhood', '1100 W Washington St, South Bend, IN 46601', 25, 7, IMG.group, 'Rebuild porches and steps for three low-income homeowners.', { skills: ['Carpentry'] })
  mk('org_7', null, 'Home Repair Saturday', 'Community Development', 10, '08:00', '15:00', 'South Bend', 'Near Westside Neighborhood', '1100 W Washington St, South Bend, IN 46601', 25, 7, IMG.group, 'Join a crew making critical repairs – painting, weatherproofing, and small carpentry. No experience necessary; team leads will train you.', { minAge: 16, skills: ['Carpentry'] })
  mk('org_7', null, 'Vacant Lot Garden Build', 'Environment', 22, '09:00', '14:00', 'South Bend', 'Lincoln Way West Lot', '2500 Lincoln Way W, South Bend, IN 46628', 30, 5, IMG.soil, 'Build raised beds and plant a community garden on a once-vacant lot.')
  mk('org_8', 'o8p', 'Mural Paint Day', 'Arts & Culture', -28, '09:00', '16:00', 'Evansville', 'Downtown Evansville Riverfront', '100 NW Riverside Dr, Evansville, IN 47708', 30, 6, IMG.civic, 'Paint a 100-foot community mural along the Ohio River.')
  mk('org_8', null, 'Gallery Night Volunteers', 'Arts & Culture', 11, '17:00', '21:00', 'Evansville', 'Evansville Arts Collective Gallery', '300 Main St, Evansville, IN 47708', 14, 4, IMG.civic, 'Greet guests, pour water, and help artists with setup and teardown at our monthly gallery night.')
  mk('org_9', 'o9p', 'Mentor Match Kickoff', 'Youth & Mentoring', -33, '10:00', '13:00', 'Lafayette', 'Lafayette Community Center', '1301 S 9th St, Lafayette, IN 47905', 25, 3, IMG.youth, 'Meet your mentee and kick off the school year with games and conversation.')
  mk('org_9', null, 'Saturday Sports Clinic Coaches', 'Youth & Mentoring', 13, '09:00', '12:00', 'Lafayette', 'Columbian Park', '1915 Scott St, Lafayette, IN 47904', 18, 3, IMG.soccer, 'Coach drills and games for middle schoolers. All skill levels welcome.')
  mk('org_9', null, 'Career Panel Volunteers', 'Youth & Mentoring', 30, '13:00', '15:00', 'Lafayette', 'Jefferson High School', '1801 S 18th St, Lafayette, IN 47905', 10, 2, IMG.civic, 'Share your career story with high school juniors in a friendly panel format.', { skills: ['Public Speaking'] })
  mk('org_10', 'o10p', 'Nonprofit Website Sprint', 'Education', -22, '09:00', '16:00', 'Indianapolis', 'Launch Fishers Coworking', '9 Municipal Dr, Fishers, IN 46038', 15, 7, IMG.laptops, 'A one-day sprint building websites for five local nonprofits.', { skills: ['Web Development'] })
  mk('org_10', null, 'Digital Skills Workshop for Job Seekers', 'Education', 15, '18:00', '20:30', 'Indianapolis', 'Central Library – Indianapolis', '40 E St Clair St, Indianapolis, IN 46204', 12, 2.5, IMG.laptops, 'Teach résumé building, email, and online job search basics to adults returning to the workforce.', { skills: ['Tutoring'] })
  mk('org_10', null, 'Remote Grant-Writing Circle', 'Community Development', 9, '12:00', '13:30', 'Indianapolis', 'Online via Google Meet', 'Link sent after registration', 20, 1.5, IMG.laptops, 'Help small Indiana nonprofits polish grant applications in a collaborative virtual working session.', { virtual: true, skills: ['Writing'] })

  /* ------------------------------- Registrations ------------------------------ */
  const registrations: Registration[] = []
  let rn = 0
  const oppById = (id: string) => opportunities.find((o) => o.id === id)!
  const addReg = (oppId: string, volunteerId: string, status: Registration['status'], attended = false, verified = false) => {
    if (registrations.some((r) => r.oppId === oppId && r.volunteerId === volunteerId)) return
    const opp = oppById(oppId)
    registrations.push({
      id: `reg_${++rn}`, oppId, volunteerId, status, attended, hoursVerified: verified, hours: opp.hours,
      createdAt: new Date(Math.min(new Date(opp.date + 'T12:00:00').getTime() - (4 + Math.floor(rand() * 10)) * 86400000, Date.now() - (2 + Math.floor(rand() * 150)) * 3600000)).toISOString(),
    })
  }

  // org_1 past events: attended, mostly verified; most recent two have unverified hours for the demo
  o1Past.forEach((oid, i) => {
    const count = 8 + ((i * 3) % 7)
    for (let k = 0; k < count; k++) {
      const vid = others[(i * 5 + k * 2) % others.length]
      const verified = i <= 4 ? true : rand() < 0.25
      if (k === count - 1 && i < 5) addReg(oid, vid, 'approved', false, false) // no-show
      else addReg(oid, vid, 'approved', true, verified)
    }
  })
  addReg(o1Past[3], 'vol_1', 'approved', true, true)
  addReg(o1Past[5], 'vol_1', 'approved', true, false)
  addReg(o1Past[1], 'vol_1', 'approved', true, true)

  // org_1 upcoming
  for (let k = 0; k < 5; k++) addReg(o1Today, others[(k * 4 + 1) % others.length], 'approved')
  for (let k = 0; k < 17; k++) addReg(o1Thanks, others[(k * 3) % others.length], 'approved')
  for (let k = 0; k < 4; k++) addReg(o1Thanks, others[(k * 7 + 2) % others.length], 'pending')
  addReg(o1Thanks, 'vol_1', 'approved')
  for (let k = 0; k < 6; k++) addReg(o1Mobile, others[(k * 5 + 4) % others.length], k < 2 ? 'pending' : 'approved')
  for (let k = 0; k < 6; k++) addReg(o1Weekly, others[(k * 6 + 1) % others.length], 'approved')
  addReg(o1Weekly, 'vol_1', 'approved')

  // Other orgs: past events attended & verified; upcoming have a handful of signups
  opportunities.filter((o) => o.orgId !== 'org_1' && o.status === 'published').forEach((o, idx) => {
    const past = o.date < today
    const count = past ? 6 + (idx % 6) : 3 + (idx % 8)
    for (let k = 0; k < count; k++) {
      const vid = others[(idx * 3 + k * 4) % others.length]
      if (past) addReg(o.id, vid, 'approved', true, true)
      else addReg(o.id, vid, k % 5 === 4 ? 'pending' : 'approved')
    }
  })
  // Maya's history & upcoming across other orgs
  addReg(pastOthers.o2p, 'vol_1', 'approved', true, true)
  addReg(pastOthers.o3p, 'vol_1', 'approved', true, true)
  addReg(pastOthers.o4p, 'vol_1', 'approved', true, true)
  addReg(pastOthers.o6p, 'vol_1', 'approved', true, true)
  addReg(o2Tree, 'vol_1', 'pending')
  addReg(o3Dog, 'vol_1', 'cancelled')

  const manualHours: ManualHourLog[] = [
    { id: 'mh_1', volunteerId: 'vol_1', orgName: 'Habitat for Humanity (Indianapolis)', title: 'Home build weekend', date: addDays(today, -60), hours: 6, notes: 'Framing and drywall with a team from my church.', createdAt: hoursAgo(24 * 58) },
  ]

  /* --------------------------------- Follows ---------------------------------- */
  const follows: Follow[] = [
    { volunteerId: 'vol_1', orgId: 'org_1' }, { volunteerId: 'vol_1', orgId: 'org_2' }, { volunteerId: 'vol_1', orgId: 'org_4' },
  ]
  others.forEach((vid, i) => {
    follows.push({ volunteerId: vid, orgId: 'org_1' })
    if (i % 2 === 0) follows.push({ volunteerId: vid, orgId: `org_${2 + (i % 9)}` })
  })
  const dedupFollows = follows.filter((f, i) => follows.findIndex((x) => x.volunteerId === f.volunteerId && x.orgId === f.orgId) === i)
  const saved: SavedOpp[] = [{ volunteerId: 'vol_1', oppId: o1Mobile }]

  /* ----------------------------------- Posts ---------------------------------- */
  const posts: Post[] = [
    { id: 'post_1', orgId: null, kind: 'announcement', title: 'Welcome to IndyTeer', body: 'Thanks for joining Indiana’s volunteer network. Follow organizations you care about, register for events, and track every hour you give. Your verified hours build your public volunteer profile.', image: null, createdAt: hoursAgo(26) },
    { id: 'post_2', orgId: 'org_1', kind: 'update', title: 'We hit 1 million meals!', body: 'Thanks to you, Hoosier Harvest Network crossed 1,000,000 meals delivered this year. Thank you to every volunteer who packed, sorted, and drove. Thanksgiving box assembly is next – we still need hands.', image: IMG.hearts, createdAt: hoursAgo(9) },
    { id: 'post_3', orgId: 'org_2', kind: 'update', title: 'Tree planting day: tools & training provided', body: 'New to planting? No problem. Our restoration crew will walk you through technique before we head to the riverbank. Dress for the weather and bring a reusable bottle.', image: IMG.soil, createdAt: hoursAgo(30) },
    { id: 'post_4', orgId: 'org_3', kind: 'update', title: 'Meet this week’s adoptable pups', body: 'Our shelter is full and our dogs are ready for walks. Join a socialization shift this week and help them shine at Saturday’s adoption event.', image: IMG.animals, createdAt: hoursAgo(52) },
    { id: 'post_5', orgId: null, kind: 'announcement', title: 'New: verified volunteer hours', body: 'Organizations can now verify your hours directly in IndyTeer. Look for the green “Verified” badge on your hours page and public profile.', image: null, createdAt: hoursAgo(75) },
    { id: 'post_6', orgId: 'org_4', kind: 'update', title: 'Reading Buddies needs 10 more volunteers', body: 'Our after-school program is growing. If you can give two hours a week, you can change a child’s relationship with reading.', image: null, createdAt: hoursAgo(98) },
  ]

  /* ----------------------------------- Users ---------------------------------- */
  const users: User[] = [
    { id: DEMO_VOLUNTEER_ID, email: DEMO_VOLUNTEER_EMAIL, firstName: 'Maya', lastName: 'Thompson', accountType: 'volunteer', onboarded: true, profileId: 'vol_1', demo: true, createdAt: '2023-03-14T12:00:00.000Z' },
    { id: DEMO_ORG_ID, email: DEMO_ORG_EMAIL, firstName: 'Rachel', lastName: 'Donovan', accountType: 'organization', onboarded: true, profileId: 'org_1', demo: true, createdAt: '2022-06-01T12:00:00.000Z' },
  ]

  const notifications: AppNotification[] = [
    { id: 'n_1', userId: DEMO_VOLUNTEER_ID, text: 'You’re confirmed for Thanksgiving Meal Box Assembly.', link: `/app/opportunities/${o1Thanks}`, read: false, createdAt: hoursAgo(5) },
    { id: 'n_2', userId: DEMO_VOLUNTEER_ID, text: 'Hoosier Harvest Network verified your hours for Back-to-School Backpack Packing.', link: '/app/hours', read: true, createdAt: hoursAgo(24 * 60) },
    { id: 'n_3', userId: DEMO_ORG_ID, text: '4 volunteers are waiting for approval on Thanksgiving Meal Box Assembly.', link: '/org/registrations', read: false, createdAt: hoursAgo(3) },
    { id: 'n_4', userId: DEMO_ORG_ID, text: 'Mobile Market Distribution – Eastside hours are ready to verify.', link: '/org/registrations', read: false, createdAt: hoursAgo(30) },
  ]

  return {
    users, volunteers, organizations, opportunities, registrations, manualHours, follows: dedupFollows, saved, posts, notifications,
    settings: { [DEMO_VOLUNTEER_ID]: defaultSettings(), [DEMO_ORG_ID]: defaultSettings() },
    sessionUserId: null,
  }
}
