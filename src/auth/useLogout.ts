import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { toast } from '../store/toast'

/** Signs out of Supabase, then returns to the login screen. */
export function useLogout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return async (message = 'You’ve been logged out.') => {
    try {
      await signOut()
      navigate('/login')
      toast(message, 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not log out. Try again.', 'error')
    }
  }
}
