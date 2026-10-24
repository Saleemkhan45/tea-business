import { describe, expect, it, vi } from 'vitest'
import { trapNavigationTab } from './navigationFocus'

describe('mobile navigation keyboard containment', () => {
  it('wraps Tab at the end and Shift+Tab at the beginning', () => {
    const first = { focus: vi.fn() } as unknown as HTMLElement
    const last = { focus: vi.fn() } as unknown as HTMLElement
    const preventDefault = vi.fn()
    trapNavigationTab({ key: 'Tab', shiftKey: false, preventDefault } as unknown as KeyboardEvent, [first, last], last)
    expect(first.focus).toHaveBeenCalledOnce()
    trapNavigationTab({ key: 'Tab', shiftKey: true, preventDefault } as unknown as KeyboardEvent, [first, last], first)
    expect(last.focus).toHaveBeenCalledOnce()
    expect(preventDefault).toHaveBeenCalledTimes(2)
  })
  it('preserves normal movement inside the drawer and handles no interactive items', () => {
    const preventDefault = vi.fn()
    const node = { focus: vi.fn() } as unknown as HTMLElement
    const event = { key: 'Tab', shiftKey: false, preventDefault } as unknown as KeyboardEvent
    trapNavigationTab(event, [node, {} as HTMLElement], node)
    trapNavigationTab(event, [], null)
    expect(preventDefault).not.toHaveBeenCalled()
  })
})
