import { useEffect } from 'react'

export function useCloseOnEscape(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onClose])
}
