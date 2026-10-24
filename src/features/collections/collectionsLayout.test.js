import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('defines mobile stacking, touch targets and visible keyboard focus', () => {
  const css = readFileSync(new URL('./collections.css', import.meta.url), 'utf8')
  expect(css).toContain('@media(max-width:760px)')
  expect(css).toContain('min-height:44px')
  expect(css).toContain('focus-visible')
})
