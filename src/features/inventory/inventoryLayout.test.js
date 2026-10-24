import { readFileSync } from 'node:fs'
import { it, expect } from 'vitest'
it('keeps overlay positioning outside layout and defines intentional responsive columns', () => {
    const css = readFileSync(new URL('./inventory.css', import.meta.url), 'utf8')
    expect(css).toContain('grid-template-columns: minmax(160px, 1fr) minmax(180px, 240px) minmax(140px, 180px) auto')
    expect(css).toContain('align-items: end')
    expect(css).toContain('height: 44px; min-height: 44px')
    expect(css).toContain('@media (max-width: 1050px)')
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(css).toContain('@media (max-width: 600px)')
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)')
    const menus = readFileSync(new URL('../../components/shared/select-menu.css', import.meta.url), 'utf8')
    expect(menus).toContain('.select-menu-popover.select-menu-floating { position: fixed;')
  })
