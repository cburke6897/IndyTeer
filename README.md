# IndyTeer

Indiana's volunteer networking platform — **frontend-only prototype**. Volunteers discover and register for opportunities and track hours; organizations post opportunities, manage registrations, and verify hours. Everything runs on mock data and browser state (no backend, no real auth).

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router · lucide-react

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Volunteer (Maya Thompson) | `volunteer@indyteer.demo` | `demo1234` |
| Organization (Hoosier Harvest Network) | `org@indyteer.demo` | `demo1234` |

The login page also has one-click demo buttons. You can create new accounts too (any password ≥ 8 characters; nothing is stored securely — it is a prototype). **Settings → Account → Reset demo data** restores the seed data.

### End-to-end flow to try
1. Log in as the organization → **Create Opportunity** → publish.
2. Log out, log in as the volunteer → find it in the feed / Explore → **Register**.
3. Log back in as the organization → **Registrations** → Approve → Mark attended → Verify hours.
4. Log in as the volunteer → **My Volunteer Hours** shows the newly verified hours.

## Project structure

```
src/
  types.ts              Domain types
  data/seed.ts          Seeded Indiana orgs, volunteers, opportunities, registrations (dates are relative to today)
  store/
    store.ts            External store + localStorage persistence (useDB)
    actions.ts          All mutations — the future API boundary (swap for Supabase/Node calls)
    selectors.ts        Derived data (hours, spots, buckets, org stats)
    session.ts          useSession() → current user/volunteer/org
    toast.ts            Toast notifications
  components/
    ui/                 Design-system primitives (Button, Field, Modal, Dropdown, Tabs, Toggle, …)
    layout/             AppShell, AuthLayout, route guards
    domain/             Opportunity cards, registration table, charts, profile headers/forms
  pages/                auth · onboarding · volunteer · org · shared
```

UI components never mutate data directly; they call functions in `store/actions.ts`. To connect a backend, replace the bodies of those actions (and `store.ts` loading) with API calls.

## Design tokens

Defined in `src/index.css` (`@theme`): navy `#142C5B`, secondary blue `#244B85`, accent yellow `#F5C542`, light yellow `#FFF7DC`, background `#F7F8FA`, text `#202938` / `#687385`, borders `#E5E8ED`. Photos are loaded from Unsplash with a graceful fallback.
