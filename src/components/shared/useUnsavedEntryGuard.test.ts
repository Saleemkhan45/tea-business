import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const effects = vi.hoisted(() => [] as Array<() => undefined | (() => void)>)
vi.mock('react', () => ({ useEffect: (effect: () => undefined | (() => void)) => effects.push(effect) }))
import { useUnsavedEntryGuard } from './useUnsavedEntryGuard'
let browser: { confirm: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn>; history: { state: { idx: number }; go: ReturnType<typeof vi.fn> } }
let documentMock: { addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> }
beforeEach(() => {
  effects.length = 0
  browser = { confirm: vi.fn().mockReturnValue(false), addEventListener: vi.fn(), removeEventListener: vi.fn(), history: { state: { idx: 0 }, go: vi.fn() } }
  documentMock = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('window', browser); vi.stubGlobal('document', documentMock)
  vi.stubGlobal('location', { pathname: '/sales', search: '' })
})
afterEach(() => vi.unstubAllGlobals())
it('keeps dirty forms open after canceled discard and prevents leaving during an active save', () => {
  expect(useUnsavedEntryGuard(true, false)()).toBe(false)
  expect(browser.confirm).toHaveBeenCalledWith('Discard the unsaved changes in this form?')
  browser.confirm.mockClear()
  expect(useUnsavedEntryGuard(true, true)()).toBe(false)
  expect(browser.confirm).not.toHaveBeenCalled()
  expect(useUnsavedEntryGuard(false, false)()).toBe(true)
})
it('warns that an unconfirmed operation must be checked before re-entry', () => {
  expect(useUnsavedEntryGuard(true, false, true)()).toBe(false)
  expect(browser.confirm).toHaveBeenCalledWith(expect.stringContaining('in-memory retry request'))
})
it('guards unload and restores cancelled Back/Forward navigation without storing draft data', () => {
  useUnsavedEntryGuard(true, false)
  const cleanup = effects[0]()
  const unload = browser.addEventListener.mock.calls.find(([name]) => name === 'beforeunload')![1]
  const event = { preventDefault: vi.fn(), returnValue: undefined as string | undefined }
  unload(event)
  expect(event.preventDefault).toHaveBeenCalledOnce()
  const back = browser.addEventListener.mock.calls.find(([name]) => name === 'popstate')![1]
  const navigation = { state: { idx: 1 }, stopImmediatePropagation: vi.fn() }
  back(navigation)
  expect(browser.history.go).toHaveBeenCalledWith(-1)
  expect(navigation.stopImmediatePropagation).toHaveBeenCalledOnce()
  cleanup?.()
  expect(browser.removeEventListener).toHaveBeenCalledWith('beforeunload', unload)
  expect(documentMock.removeEventListener).toHaveBeenCalled()
})
