import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type AnimatedNumberOptions = {
  animationKey: number
  durationMs?: number
  initialFromZero?: boolean
}

const DEFAULT_DURATION_MS = 760
const HIGHLIGHT_MS = 780

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3)
}

export function useAnimatedNumber(targetValue: number, {
  animationKey,
  durationMs = DEFAULT_DURATION_MS,
  initialFromZero = true,
}: AnimatedNumberOptions) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [displayValue, setDisplayValue] = useState(() => initialFromZero ? 0 : targetValue)
  const [highlight, setHighlight] = useState(false)
  const frameRef = useRef<number | null>(null)
  const highlightTimerRef = useRef<number | null>(null)
  const previousKeyRef = useRef(animationKey)
  const hasMountedRef = useRef(false)
  const displayValueRef = useRef(displayValue)

  useEffect(() => {
    displayValueRef.current = displayValue
  }, [displayValue])

  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }

    const keyChanged = previousKeyRef.current !== animationKey
    const shouldAnimate = !hasMountedRef.current || keyChanged
    previousKeyRef.current = animationKey

    if (prefersReducedMotion || !shouldAnimate) {
      setDisplayValue(targetValue)
      setHighlight(false)
      hasMountedRef.current = true
      return undefined
    }

    const startValue = hasMountedRef.current ? displayValueRef.current : initialFromZero ? 0 : targetValue
    const delta = targetValue - startValue
    hasMountedRef.current = true

    if (Math.abs(delta) < Number.EPSILON) {
      setDisplayValue(targetValue)
      setHighlight(true)
      highlightTimerRef.current = window.setTimeout(() => setHighlight(false), HIGHLIGHT_MS)
      return () => {
        if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
      }
    }

    const startedAt = performance.now()

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / durationMs, 1)
      const nextValue = startValue + delta * easeOutCubic(progress)
      setDisplayValue(progress === 1 ? targetValue : nextValue)

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick)
      } else {
        frameRef.current = null
      }
    }

    setHighlight(false)
    frameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [animationKey, durationMs, initialFromZero, prefersReducedMotion, targetValue])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
  }, [])

  return { displayValue, highlight }
}
