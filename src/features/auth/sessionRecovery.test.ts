import { afterEach, describe, expect, it, vi } from 'vitest'
import { sessionRecoveryDelay, startSessionRecovery } from './sessionRecovery'
afterEach(() => vi.useRealTimers())
describe('bounded session recovery', () => {
  it('stops after three failures rather than checking forever', async () => {
    vi.useFakeTimers()
    const check = vi.fn(async () => null)
    const stop = startSessionRecovery({ check, state: () => ({ connectionRetryable: true, sessionRetryAt: 0 }), canCheck: () => true })
    await vi.runAllTimersAsync()
    expect(check).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
    stop()
  })
  it('honors Retry-After, jitters backoff and stops after success or cancellation', async () => {
    expect(sessionRecoveryDelay(0, 20000, 0, 0)).toBe(20000)
    expect(sessionRecoveryDelay(1, 0, 0, 0)).toBe(8000)
    expect(sessionRecoveryDelay(3)).toBeNull()
    vi.useFakeTimers()
    let connectionRetryable = true
    const check = vi.fn(async () => { connectionRetryable = false })
    const stop = startSessionRecovery({ check, state: () => ({ connectionRetryable, sessionRetryAt: 0 }), canCheck: () => true })
    await vi.runAllTimersAsync()
    expect(check).toHaveBeenCalledOnce()
    stop()
    const cancel = startSessionRecovery({ check, state: () => ({ connectionRetryable: true, sessionRetryAt: 0 }), canCheck: () => true })
    cancel(); await vi.runAllTimersAsync()
    expect(check).toHaveBeenCalledOnce()
  })
  it('does not make requests while offline or hidden', async () => {
    vi.useFakeTimers()
    const check = vi.fn()
    startSessionRecovery({ check, state: () => ({ connectionRetryable: true, sessionRetryAt: 0 }), canCheck: () => false })
    await vi.runAllTimersAsync()
    expect(check).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
