import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

// Offline event-handler harness; browser geometry is verified separately.
const hooks = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0, effects: [] as Array<() => any>, layouts: [] as Array<() => any>, rect: { top: 100, bottom: 144, left: 200, width: 240 } }))
vi.mock('react-dom', () => ({ createPortal: (node: any, target: any) => ({ ...node, props: { ...node.props, 'data-portal-target': target } }) }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++
    if (!(index in hooks.cells)) hooks.cells[index] = initial
    return [hooks.cells[index], (value: unknown) => { hooks.cells[index] = value }]
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
  useId: () => 'offline-options',
  useEffect: (effect: () => any) => hooks.effects.push(effect),
  useLayoutEffect: (effect: () => any) => hooks.layouts.push(effect),
  useCallback: (callback: unknown) => callback,
}))
import { SelectMenu } from './SelectMenu'

type Element = ReactElement<Record<string, any>>
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!isValidElement<Record<string, any>>(node)) return []
  return [node, ...nodes(node.props.children)]
}
const options = [
  { value: '', label: 'Select region' },
  { value: 'islamabad', label: 'Islamabad' },
  { value: 'peshawar', label: 'Peshawar' },
  { value: 'empty', label: 'Unavailable', disabled: true },
]
const change = vi.fn()
const focus = new Map<string, ReturnType<typeof vi.fn>>()
function render(value = '', disabled = false, floating = false) {
  hooks.cursor = 0; hooks.effects = []; hooks.layouts = []
  const tree = SelectMenu({ value, options, onChange: change, ariaLabel: 'Selling region', searchable: true, inline: true, disabled, floating })
  const elements = nodes(tree)
  for (const node of elements) {
    const key = node.props['aria-label'] ?? node.props.className
    const spy = focus.get(key) ?? vi.fn()
    focus.set(key, spy)
    const target = { getBoundingClientRect: () => hooks.rect, scrollHeight: 280, focus: spy, contains: (node: unknown) => node === spy }
    if (typeof node.props.ref === 'function') node.props.ref(target)
    else if (node.props.ref) node.props.ref.current = target
  }
  return elements
}
const event = (key: string) => ({ key, preventDefault: vi.fn(), stopPropagation: vi.fn() })
beforeEach(() => {
  vi.stubGlobal('document', { body: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  hooks.cells = []; focus.clear(); change.mockReset()
  vi.stubGlobal('window', { innerHeight: 800, innerWidth: 1200, addEventListener: vi.fn(), removeEventListener: vi.fn(), requestAnimationFrame: (callback: () => void) => callback() })
})
afterEach(() => vi.unstubAllGlobals())

describe('searchable form select interactions (offline)', () => {
  it('positions below, flips above, and bounds a mobile overlay within the viewport', () => {
    hooks.rect = { top: 100, bottom: 144, left: 200, width: 240 }
    render('', false, true).find(node => node.props['aria-haspopup'])!.props.onClick()
    render('', false, true); hooks.layouts.forEach(effect => effect())
    let menu = render('', false, true).find(node => node.props.className?.includes('select-menu-floating'))!
    expect(menu.props.style).toMatchObject({ top: 150, left: 200, width: 240, maxHeight: 280 })
    hooks.rect = { top: 700, bottom: 744, left: 200, width: 240 }
    render('', false, true); hooks.layouts.forEach(effect => effect())
    menu = render('', false, true).find(node => node.props.className?.includes('select-menu-floating'))!
    expect(menu.props.style.top).toBe(414)
    window.innerWidth = 375
    hooks.rect = { top: 100, bottom: 144, left: 20, width: 400 }
    render('', false, true); hooks.layouts.forEach(effect => effect())
    menu = render('', false, true).find(node => node.props.className?.includes('select-menu-floating'))!
    expect(menu.props.style.left).toBe(8)
    expect(menu.props.style.width).toBe(359)
  })
  it('portals floating options outside the filter row and closes on selection', () => {
    render('', false, true).find(node => node.props['aria-haspopup'])!.props.onClick()
    let tree = render('', false, true)
    const menu = tree.find(node => node.props.className?.includes('select-menu-floating'))!
    expect(menu.props['data-portal-target']).toBe(document.body)
    expect(menu.props.style.maxHeight).toBe(280)
    tree.find(node => node.props.type === 'search')!.props.onChange({ target: { value: 'PESH' } })
    tree = render('', false, true)
    expect(tree.filter(node => node.props.role === 'option')).toHaveLength(1)
    tree.find(node => node.props.role === 'option')!.props.onClick()
    expect(change).toHaveBeenCalledWith('peshawar')
    expect(render('peshawar', false, true).some(node => node.props.role === 'listbox')).toBe(false)
  })
  it('keeps portaled pointers inside and dismisses outside pointers', () => {
    render('', false, true).find(node => node.props['aria-haspopup'])!.props.onClick()
    render('', false, true)
    hooks.effects.forEach(effect => effect())
    const listener = vi.mocked(document.addEventListener).mock.calls.find(call => call[0] === 'pointerdown')![1] as (event: any) => void
    listener({ target: focus.get('select-menu-popover select-menu-floating') })
    expect(render('', false, true).some(node => node.props.role === 'listbox')).toBe(true)
    listener({ target: {} })
    expect(render('', false, true).some(node => node.props.role === 'listbox')).toBe(false)
  })
  it('opens by pointer, searches by name and retains the selected label', () => {
    let tree = render('islamabad')
    tree.find(node => node.props['aria-haspopup'])!.props.onClick()
    tree = render('islamabad')
    expect(tree.find(node => node.props['aria-haspopup'])!.props['aria-expanded']).toBe(true)
    tree.find(node => node.props.type === 'search')!.props.onChange({ target: { value: ' PESH ' } })
    tree = render('islamabad')
    expect(tree.filter(node => node.props.role === 'option').map(node => node.props.children[0].props.children)).toEqual(['Peshawar'])
    expect(tree.find(node => node.props['aria-haspopup'])!.props['aria-label']).toContain('Islamabad')
    tree.find(node => node.props.role === 'option')!.props.onClick()
    expect(change).toHaveBeenCalledWith('peshawar')
    expect(render('peshawar').some(node => node.props.role === 'listbox')).toBe(false)
  })

  it('opens by keyboard, prevents form submission while searching, and restores focus on Escape', () => {
    let tree = render()
    tree.find(node => node.props['aria-haspopup'])!.props.onKeyDown(event('ArrowDown'))
    tree = render()
    const search = tree.find(node => node.props.type === 'search')!
    const enter = event('Enter'); search.props.onKeyDown(enter)
    expect(enter.preventDefault).toHaveBeenCalledOnce()
    search.props.onKeyDown(event('ArrowDown'))
    expect(focus.get('select-menu-option is-selected')!).toHaveBeenCalled()
    const escape = event('Escape'); tree[0].props.onKeyDown(escape)
    expect(escape.stopPropagation).toHaveBeenCalledOnce()
    expect(focus.get('Selling region: Select region')).toHaveBeenCalled()
    expect(render().some(node => node.props.role === 'listbox')).toBe(false)
  })

  it('blocks disabled inventory options and disabled controls', () => {
    let tree = render()
    tree.find(node => node.props['aria-haspopup'])!.props.onClick()
    tree = render()
    tree.find(node => node.props.role === 'option' && node.props.disabled)!.props.onClick()
    expect(change).not.toHaveBeenCalled()
    hooks.cells = []
    tree = render('', true)
    expect(tree.find(node => node.props['aria-haspopup'])!.props.disabled).toBe(true)
    tree.find(node => node.props['aria-haspopup'])!.props.onClick()
    expect(render('', true).some(node => node.props.role === 'listbox')).toBe(false)
  })
})
