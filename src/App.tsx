import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { PublicOnly, RequireOnboarded, RequireOnboarding, RequireOrganization } from './components/layout/RouteGuards'
import { Toaster } from './components/ui/Toaster'
import { AuthProvider } from './auth/AuthProvider'
import { ProfileProvider } from './auth/ProfileProvider'
import { SessionBridge } from './auth/SessionBridge'
import { LinkButton } from './components/ui/Button'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import ProfileOnboardingPage from './pages/onboarding/ProfileOnboardingPage'
import OrgOnboardingPage from './pages/onboarding/OrgOnboardingPage'
import DashboardPage from './pages/volunteer/DashboardPage'
import ExplorePage from './pages/volunteer/ExplorePage'
import MyEventsPage from './pages/volunteer/MyEventsPage'
import MyHoursPage from './pages/volunteer/MyHoursPage'
import OrganizationsPage from './pages/volunteer/OrganizationsPage'
import OverviewPage from './pages/org/OverviewPage'
import MyOpportunitiesPage from './pages/org/MyOpportunitiesPage'
import OpportunityEditorPage from './pages/org/OpportunityEditorPage'
import RegistrationsPage from './pages/org/RegistrationsPage'
import VolunteersPage from './pages/org/VolunteersPage'
import PeoplePage from './pages/org/PeoplePage'
import AnalyticsPage from './pages/org/AnalyticsPage'
import OpportunityDetailPage from './pages/shared/OpportunityDetailPage'
import OrgProfilePage from './pages/shared/OrgProfileView'
import VolunteerProfilePage from './pages/shared/VolunteerProfileView'
import SettingsPage from './pages/shared/SettingsPage'
import PublicDiscoveryPage from './pages/shared/PublicDiscoveryPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-bold text-navy-700">404</p>
      <h1 className="text-3xl">Page not found</h1>
      <p className="text-muted">That page doesn’t exist or was moved.</p>
      <LinkButton to="/" variant="primary">Back to IndyTeer</LinkButton>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <ProfileProvider>
      <SessionBridge />
      <ScrollToTop />
      <Routes>
        <Route path="/discover" element={<PublicDiscoveryPage />} />
        <Route element={<PublicOnly />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Recovery links sign the user in first, so this route must not bounce signed-in users. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Everyone completes the same standard onboarding. There is no account-type choice. */}
        <Route element={<RequireOnboarding />}>
          <Route path="/onboarding" element={<ProfileOnboardingPage />} />
          <Route path="/onboarding/*" element={<Navigate to="/onboarding" replace />} />
        </Route>

        <Route element={<RequireOnboarded />}>
          {/* Creating an organization is something any standard user can do later. */}
          <Route path="/create-organization" element={<OrgOnboardingPage />} />
          <Route path="/app" element={<AppShell area="user" />}>
            <Route index element={<DashboardPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="events" element={<MyEventsPage />} />
            <Route path="hours" element={<MyHoursPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/:id" element={<OrgProfilePage />} />
            <Route path="profile" element={<VolunteerProfilePage own />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<RequireOrganization />}>
          <Route path="/org" element={<AppShell area="org" />}>
            <Route index element={<OverviewPage />} />
            <Route path="opportunities" element={<MyOpportunitiesPage />} />
            <Route path="opportunities/new" element={<OpportunityEditorPage mode="create" />} />
            <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="opportunities/:id/edit" element={<OpportunityEditorPage mode="edit" />} />
            <Route path="registrations" element={<RegistrationsPage />} />
            <Route path="volunteers" element={<VolunteersPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="volunteers/:id" element={<VolunteerProfilePage />} />
            <Route path="profile" element={<OrgProfilePage own />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
      </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
