import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('preserves responsive contact and integration cards, touch targets and keyboard focus', () => {
  const css = readFileSync(new URL('./whatsapp.css', import.meta.url), 'utf8')
  expect(css).toContain('@media(max-width:760px)')
  expect(css).toContain('min-height: 44px')
  expect(css).toContain('focus-visible')
  expect(css).toContain('prefers-reduced-motion')
})
