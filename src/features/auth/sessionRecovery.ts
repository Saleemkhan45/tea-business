// One recovery burst makes at most three attempts. Focus/online and manual Retry remain available.
export const SESSION_RECOVERY_DELAYS_MS = [5000, 10000, 20000] as const
export function sessionRecoveryDelay(attempt: number, notBefore = 0, now = Date.now(), random = Math.random()) {
  const base = SESSION_RECOVERY_DELAYS_MS[attempt]
  return base === undefined ? null : Math.max(Math.round(base * (0.8 + random * 0.4)), notBefore - now)
}
export function startSessionRecovery(options: {
  check: () => Promise<unknown>
  state: () => { connectionRetryable: boolean; sessionRetryAt: number }
  canCheck: () => boolean
}) {
  let stopped = false, attempt = 0, timer: ReturnType<typeof setTimeout>
  const schedule = () => {
    if (stopped || !options.state().connectionRetryable) return
    const delay = sessionRecoveryDelay(attempt++, options.state().sessionRetryAt)
    if (delay === null) return
    timer = setTimeout(async () => {
      if (stopped || !options.state().connectionRetryable) return
      try { if (options.canCheck()) await options.check() } catch { /* An unexpected failed check still consumes this bounded attempt. */ } finally { schedule() }
    }, delay)
  }
  schedule()
  return () => { stopped = true; clearTimeout(timer) }
}
