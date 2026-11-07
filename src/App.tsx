import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { PublicOnly, RequireOnboarding, RequireRole } from './components/layout/RouteGuards'
import { Toaster } from './components/ui/Toaster'
import { LinkButton } from './components/ui/Button'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import AccountTypePage from './pages/onboarding/AccountTypePage'
import VolunteerOnboardingPage from './pages/onboarding/VolunteerOnboardingPage'
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
import AnalyticsPage from './pages/org/AnalyticsPage'
import OpportunityDetailPage from './pages/shared/OpportunityDetailPage'
import OrgProfilePage from './pages/shared/OrgProfileView'
import VolunteerProfilePage from './pages/shared/VolunteerProfileView'
import SettingsPage from './pages/shared/SettingsPage'

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
      <ScrollToTop />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<RequireOnboarding />}>
          <Route path="/onboarding/account-type" element={<AccountTypePage />} />
          <Route path="/onboarding/volunteer" element={<VolunteerOnboardingPage />} />
          <Route path="/onboarding/organization" element={<OrgOnboardingPage />} />
        </Route>

        <Route element={<RequireRole role="volunteer" />}>
          <Route path="/app" element={<AppShell role="volunteer" />}>
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

        <Route element={<RequireRole role="organization" />}>
          <Route path="/org" element={<AppShell role="organization" />}>
            <Route index element={<OverviewPage />} />
            <Route path="opportunities" element={<MyOpportunitiesPage />} />
            <Route path="opportunities/new" element={<OpportunityEditorPage mode="create" />} />
            <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="opportunities/:id/edit" element={<OpportunityEditorPage mode="edit" />} />
            <Route path="registrations" element={<RegistrationsPage />} />
            <Route path="volunteers" element={<VolunteersPage />} />
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
    </BrowserRouter>
  )
}
