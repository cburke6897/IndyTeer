// Compatibility exports for callers that still use the earlier applications terminology.
export {
  registerForOpportunity as applyToOpportunity,
  listMyRegistrations as listMyApplications,
  listApplicants,
  setRegistrationStatus as setApplicationStatus,
  cancelRegistration as withdrawApplication,
} from './registrations'
