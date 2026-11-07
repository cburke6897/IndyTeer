import { AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import { useLogout } from '../../auth/useLogout'

/** Shown when the user is signed in but their profile row could not be loaded. */
export function SessionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const logout = useLogout()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface px-6 text-center">
      <Logo />
      <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-card">
        <AlertCircle className="mx-auto text-danger" size={26} />
        <h1 className="mt-3 text-lg">We couldn’t load your profile</h1>
        <p role="alert" className="mt-2 text-sm text-muted">{message}</p>
        <p className="mt-2 text-sm text-muted">Your account profile is created when you sign up. If this keeps happening, contact the IndyTeer team.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="secondary" onClick={() => void logout()}>Log out</Button>
        </div>
      </div>
    </div>
  )
}
