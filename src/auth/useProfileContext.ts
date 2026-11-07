import { useContext } from 'react'
import { ProfileContext } from './ProfileContext'

export function useProfileContext() {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('useProfileContext must be used inside ProfileProvider')
  return context
}
