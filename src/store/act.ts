import { toast, type ToastKind } from './toast'

/**
 * Runs a write to the database from an event handler. Shows `success` when it works and the error
 * message when it does not, and resolves to undefined on failure so callers can stop.
 */
export async function act<T>(
  task: Promise<T>,
  success?: string | ((result: T) => string),
  kind: ToastKind = 'success',
): Promise<T | undefined> {
  try {
    const result = await task
    if (success) toast(typeof success === 'function' ? success(result) : success, kind)
    return result
  } catch (cause) {
    toast(cause instanceof Error && cause.message ? cause.message : 'Something went wrong. Try again.', 'error')
    return undefined
  }
}
