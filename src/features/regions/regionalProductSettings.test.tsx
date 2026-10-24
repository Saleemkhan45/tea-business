import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ states: [] as any[], refs: [] as any[], cursor: 0, refCursor: 0, send: vi.fn(), invalidate: vi.fn() }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: any) => { const index = fixture.cursor++; if (!(index in fixture.states)) fixture.states[index] = typeof initial === 'function' ? initial() : initial; return [fixture.states[index], (next: any) => { fixture.states[index] = typeof next === 'function' ? next(fixture.states[index]) : next }] },
  useRef: (initial: unknown) => { const index = fixture.refCursor++; fixture.refs[index] ??= { current: initial }; return fixture.refs[index] },
}))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: fixture.invalidate }), useMutation: (options: any) => ({ isPending: false, isSuccess: false, reset: vi.fn(), mutateAsync: async (input: unknown) => { const value = await options.mutationFn(input); await options.onSuccess?.(value); return value } }) }))
vi.mock('./regionalInventory.api', () => ({ regionalRequest: fixture.send }))
import { RegionalProductSettings } from './components/RegionalProductSettings'
import { RegionalConfigurationFields } from './components/RegionalConfigurationFields'
import type { RegionalInventoryRow } from './regionalInventory.api'

const row: RegionalInventoryRow = { id: 'stock', regionId: 'region', itemId: 'tea', regionName: 'Islamabad', name: 'Tea', teaType: 'Green Tea', availableKg: 500, sellingPrice: 850, lowStockThreshold: 50, sellingPriceOverride: 850, lowStockThresholdOverride: 50, catalogSellingPrice: 800, catalogLowStockThreshold: 100, status: 'available', updatedAt: '2026-10-16T00:00:00Z' }
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
function render() { fixture.cursor = 0; fixture.refCursor = 0; return nodes(RegionalProductSettings({ row, disabled: false })) }
const fields = () => render().find(node => node.type === RegionalConfigurationFields)!
const save = async () => render().find(node => typeof node.props.onClick === 'function')!.props.onClick()
beforeEach(() => { fixture.states = []; fixture.refs = []; fixture.send.mockReset(); fixture.invalidate.mockReset() })

describe('edit regional product settings (offline event harness)', () => {
  it('shows stored overrides and saves a reset without sending quantities or catalog mutations', async () => {
    expect(fields().props.draft).toEqual({ price: '850', threshold: '50' })
    fields().props.onChange({ price: '', threshold: '' }); await save()
    expect(fixture.send).toHaveBeenCalledWith('/regions/region/products/tea', { sellingPriceOverride: null, lowStockThresholdOverride: null }, 'PATCH')
    expect(fixture.invalidate).toHaveBeenCalledWith({ queryKey: ['sales'] })
  })
  it('rejects invalid settings and preserves entered values', async () => {
    fields().props.onChange({ price: '0', threshold: '50' }); await save()
    expect(fixture.send).not.toHaveBeenCalled()
    expect(fields().props.draft.price).toBe('0')
  })
  it('reuses the same settings after an uncertain failure', async () => {
    fixture.send.mockRejectedValueOnce(new TypeError('Network failed'))
    await save(); const first = fixture.send.mock.calls[0][1]
    expect(fields().props.disabled).toBe(true)
    await save(); expect(fixture.send.mock.calls[1][1]).toBe(first)
  })
})
