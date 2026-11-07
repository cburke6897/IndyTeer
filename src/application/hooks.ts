import { useCallback, useEffect, useState } from 'react'
import { toast } from '../store/toast'

export const errorMessage = (cause: unknown) =>
  cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string'
    ? cause.message
    : 'Something went wrong. Please try again.'

export function useResource<T>(loader: () => Promise<T>) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<{
    loader: typeof loader
    version: number
    data: T | null
    error: string | null
  } | null>(null)
  useEffect(() => {
    let active = true
    void loader()
      .then((data) => {
        if (active) setResult({ loader, version, data, error: null })
      })
      .catch((cause) => {
        if (active) setResult({ loader, version, data: null, error: errorMessage(cause) })
      })
    return () => {
      active = false
    }
  }, [loader, version])
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const current = result?.loader === loader && result.version === version
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    refresh,
  }
}

export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run<T>(
    task: () => Promise<T>,
    success?: string,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    setBusy(true)
    setError(null)
    try {
      const value = await task()
      if (success) toast(success)
      return { ok: true, value }
    } catch (cause) {
      const message = errorMessage(cause)
      setError(message)
      toast(message, 'error')
      return { ok: false }
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}
