import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useResource } from './hooks'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('resource isolation', () => {
  it('hides the previous account data immediately and ignores late requests', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const a = () => first.promise
    const b = () => second.promise
    const hook = renderHook(({ loader }) => useResource(loader), { initialProps: { loader: a } })
    hook.rerender({ loader: b })
    await act(async () => first.resolve('private data for account A'))
    expect(hook.result.current.data).toBeNull()
    expect(hook.result.current.loading).toBe(true)
    await act(async () => second.resolve('account B'))
    expect(hook.result.current.data).toBe('account B')
    hook.rerender({ loader: a })
    expect(hook.result.current.data).toBeNull()
  })

  it('clears failed data and allows a successful retry', async () => {
    let attempt = 0
    const loader = async () => {
      if (++attempt === 1) throw new Error('Network unavailable')
      return 'recovered'
    }
    const hook = renderHook(() => useResource(loader))
    await waitFor(() => expect(hook.result.current.error).toBe('Network unavailable'))
    act(() => hook.result.current.refresh())
    expect(hook.result.current.error).toBeNull()
    await waitFor(() => expect(hook.result.current.data).toBe('recovered'))
  })
})
