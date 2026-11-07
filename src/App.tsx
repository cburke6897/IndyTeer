import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { Toaster } from './components/ui/Toaster'
import { ProtectedWorkspace } from './application/Workspace'
import { Landing } from './application/Landing'
import { PublicProfileShell } from './application/PublicProfileShell'
import { LegacyOrganizationRoute } from './application/LegacyOrganizationRoute'

const AuthPage = lazy(() =>
  import('./application/AuthPages').then((m) => ({ default: m.AuthPage })),
)
const ProfilePage = lazy(() =>
  import('./application/ProfilePages').then((m) => ({ default: m.ProfilePage })),
)
const SettingsPage = lazy(() =>
  import('./application/ProfilePages').then((m) => ({ default: m.SettingsPage })),
)
const ExplorePage = lazy(() =>
  import('./application/OpportunityPages').then((m) => ({ default: m.ExplorePage })),
)
const OpportunityDetailPage = lazy(() =>
  import('./application/OpportunityPages').then((m) => ({ default: m.OpportunityDetailPage })),
)
const MyEventsPage = lazy(() =>
  import('./application/OpportunityPages').then((m) => ({ default: m.MyEventsPage })),
)
const OpportunityEditorPage = lazy(() =>
  import('./application/OpportunityPages').then((m) => ({ default: m.OpportunityEditorPage })),
)
const OrganizationsPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({ default: m.OrganizationsPage })),
)
const OrganizationDetailPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({ default: m.OrganizationDetailPage })),
)
const CreateOrganizationPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({ default: m.CreateOrganizationPage })),
)
const OrganizationWorkspace = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({ default: m.OrganizationWorkspace })),
)
const OrganizationOverviewPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({ default: m.OrganizationOverviewPage })),
)
const OrganizationOpportunitiesPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({
    default: m.OrganizationOpportunitiesPage,
  })),
)
const OrganizationRegistrationsPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({
    default: m.OrganizationRegistrationsPage,
  })),
)
const OrganizationMembersPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({ default: m.OrganizationMembersPage })),
)
const OrganizationSettingsPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({ default: m.OrganizationSettingsPage })),
)
const OrganizationAnalyticsPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({ default: m.OrganizationAnalyticsPage })),
)
const OrganizationVolunteersPage = lazy(() =>
  import('./application/OrganizationPages').then((m) => ({
    default: m.OrganizationVolunteersPage,
  })),
)
const DashboardPage = lazy(() =>
  import('./application/CommunityPages').then((m) => ({ default: m.DashboardPage })),
)
const HoursPage = lazy(() =>
  import('./application/CommunityPages').then((m) => ({ default: m.HoursPage })),
)
const FeedPage = lazy(() =>
  import('./application/CommunityPages').then((m) => ({ default: m.FeedPage })),
)
const OrganizationPostsPage = lazy(() =>
  import('./application/CommunityPages').then((m) => ({ default: m.OrganizationPostsPage })),
)
const NotificationsPage = lazy(() =>
  import('./application/CommunityPages').then((m) => ({ default: m.NotificationsPage })),
)
const PersonPage = lazy(() =>
  import('./application/CommunityPages').then((m) => ({ default: m.PersonPage })),
)
const AdminPage = lazy(() =>
  import('./application/CommunityPages').then((m) => ({ default: m.AdminPage })),
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <p className="p-12 text-center text-muted" role="status">
              Loading IndyTeer…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
            <Route path="/reset-password" element={<AuthPage mode="reset" />} />
            <Route element={<ProtectedWorkspace />}>
              <Route path="/org/*" element={<LegacyOrganizationRoute/>}/>
              <Route path="/onboarding/*" element={<Navigate to="/onboarding" replace/>}/>
              <Route path="/onboarding" element={<ProfilePage onboarding />} />
              <Route path="/app" element={<DashboardPage />} />
              <Route path="/app/explore" element={<ExplorePage />} />
              <Route path="/app/events" element={<MyEventsPage />} />
              <Route path="/app/hours" element={<HoursPage />} />
              <Route path="/app/feed" element={<FeedPage />} />
              <Route path="/app/notifications" element={<NotificationsPage />} />
              <Route path="/app/profile" element={<ProfilePage />} />
              <Route path="/app/settings" element={<SettingsPage />} />
              <Route path="/app/organizations" element={<OrganizationsPage />} />
              <Route path="/app/organizations/new" element={<CreateOrganizationPage />} />
              <Route
                path="/app/organizations/:organizationId"
                element={<OrganizationDetailPage />}
              />
              <Route path="/app/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/manage/:organizationId" element={<OrganizationWorkspace />}>
                <Route index element={<OrganizationOverviewPage />} />
                <Route path="opportunities" element={<OrganizationOpportunitiesPage />} />
                <Route path="opportunities/new" element={<OpportunityEditorPage />} />
                <Route
                  path="opportunities/:opportunityId/edit"
                  element={<OpportunityEditorPage />}
                />
                <Route path="registrations" element={<OrganizationRegistrationsPage />} />
                <Route path="members" element={<OrganizationMembersPage />} />
                <Route path="volunteers" element={<OrganizationVolunteersPage />} />
                <Route path="analytics" element={<OrganizationAnalyticsPage />} />
                <Route path="posts" element={<OrganizationPostsPage />} />
                <Route path="settings" element={<OrganizationSettingsPage />} />
              </Route>
            </Route>
            <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
            <Route path="/people/:userId" element={<PublicProfileShell><PersonPage/></PublicProfileShell>}/>
            <Route path="/home" element={<Navigate to="/" replace/>}/>
            <Route
              path="*"
              element={
                <div className="grid min-h-screen place-content-center gap-4 text-center">
                  <h1 className="text-4xl">Page not found</h1>
                  <a className="text-navy-700 underline" href="/">
                    Return to IndyTeer
                  </a>
                </div>
              }
            />
          </Routes>
        </Suspense>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
