import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type RevealDirection = 'left' | 'right' | 'up'

type RevealOnScrollProps = {
  children: ReactNode
  className?: string
  direction?: RevealDirection
  delayMs?: number
  eager?: boolean
}

export function RevealOnScroll({ children, className = '', direction = 'left', delayMs = 0, eager = false }: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [visible, setVisible] = useState(eager)

  useEffect(() => {
    if (visible || prefersReducedMotion) {
      setVisible(true)
      return undefined
    }

    const element = ref.current
    if (!element) return undefined

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true)
        observer.unobserve(element)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: .14 })

    observer.observe(element)
    return () => observer.disconnect()
  }, [prefersReducedMotion, visible])

  return <div
    ref={ref}
    className={`dashboard-reveal dashboard-reveal-${direction} ${visible ? 'is-visible' : ''} ${className}`}
    style={{ '--reveal-delay': `${delayMs}ms` } as CSSProperties}
  >
    {children}
  </div>
}
