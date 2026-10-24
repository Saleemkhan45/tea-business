import { useEffect, useState } from 'react'
export function retryAfterSeconds(value: string | null, fallback = 900) {
  const seconds = value && /^\d+$/.test(value) ? Number(value) : value ? Math.ceil((Date.parse(value) - Date.now()) / 1000) : fallback
  return Math.min(86400, Math.max(1, Number.isFinite(seconds) ? seconds : fallback))
}
export function useRetryAfter() {
  const [until, setUntil] = useState(0), [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    update()
    if (!until) return
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [until])
  return { remaining, block: (seconds: number) => { setRemaining(seconds); setUntil(Date.now() + seconds * 1000) } }
}
