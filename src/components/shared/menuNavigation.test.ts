import { expect, it, vi } from 'vitest'
import { navigateActionMenu } from './menuNavigation'

it('supports arrow wrapping, Home/End and Escape with focus restoration', () => {
  const first = { focus: vi.fn() }, last = { focus: vi.fn() }, trigger = { focus: vi.fn() }, close = vi.fn()
  const event = (key: string, target: unknown) => ({ key, target, preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: { querySelector: () => trigger, querySelectorAll: () => [first, last] } }) as unknown as Parameters<typeof navigateActionMenu>[0]
  navigateActionMenu(event('ArrowDown', last), close)
  expect(first.focus).toHaveBeenCalledOnce()
  navigateActionMenu(event('End', first), close)
  expect(last.focus).toHaveBeenCalledOnce()
  navigateActionMenu(event('Escape', last), close)
  expect(close).toHaveBeenCalledOnce()
  expect(trigger.focus).toHaveBeenCalledOnce()
})

it('leaves native input arrow keys alone', () => {
  const preventDefault = vi.fn()
  navigateActionMenu({ key: 'ArrowDown', target: {}, preventDefault, currentTarget: { querySelector: () => null, querySelectorAll: () => [] } } as unknown as Parameters<typeof navigateActionMenu>[0], vi.fn())
  expect(preventDefault).not.toHaveBeenCalled()
})
