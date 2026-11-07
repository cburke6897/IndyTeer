import { describe, expect, it, vi } from 'vitest'
import { withRetry } from './retry'

describe('withRetry', () => {
  it('returns the first success without waiting', async () => {
    const task = vi.fn().mockResolvedValue('ok')
    await expect(withRetry(task, { delaysMs: [1, 1] })).resolves.toBe('ok')
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('retries a transient failure and returns the later success', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('lock stolen')).mockResolvedValue('ok')
    await expect(withRetry(task, { delaysMs: [1, 1] })).resolves.toBe('ok')
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('throws the last error after every try fails', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('first')).mockRejectedValue(new Error('last'))
    await expect(withRetry(task, { delaysMs: [1, 1] })).rejects.toThrow('last')
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('stops retrying when asked to', async () => {
    const task = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withRetry(task, { delaysMs: [1, 1], shouldStop: () => true })).rejects.toThrow('boom')
    expect(task).toHaveBeenCalledTimes(1)
  })
})
