import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ states: [] as any[], cursor: 0, invalidate: vi.fn(), remove: vi.fn() }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useState: (initial: any) => {
  const index = fixture.cursor++
  if (!(index in fixture.states)) fixture.states[index] = initial
  return [fixture.states[index], (value: any) => { fixture.states[index] = typeof value === 'function' ? value(fixture.states[index]) : value }]
} }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: fixture.invalidate, removeQueries: fixture.remove }) }))
vi.mock('../auth/auth.store', () => ({ useAuthStore: (select: any) => select({ session: { user: { role: 'admin' } } }) }))
vi.mock('./supplier.api', () => ({ useSuppliers: () => ({ data: { suppliers: [], stats: { quantityKg: 0, valuePkr: 0, outstandingPkr: 0 } } }), useSupplier: () => ({}) }))
vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [] }), useProducts: () => ({ data: [] }) }))
import { SuppliersPage } from '../../pages/SuppliersPage'
import { AddSupplierModal } from './components/AddSupplierModal'
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : []
}
beforeEach(() => {
  fixture.cursor = 0; fixture.invalidate.mockReset(); fixture.remove.mockReset()
  fixture.states = [{ search: 'old search', region: 'region', product: 'product', status: 'inactive', from: '2026-10-01', to: '2026-10-17' }, 'custom', null, true, '']
})
describe('supplier directory actions after confirmed responses', () => {
  it('clears filters and refreshes the directory and purchase picker after save', () => {
    const modal = nodes(SuppliersPage()).find(node => node.type === AddSupplierModal)!
    modal.props.onSave()
    expect(Object.values(fixture.states[0]).every(value => value === '')).toBe(true)
    expect(fixture.states[1]).toBe('all'); expect(fixture.states[3]).toBe(false)
    expect(fixture.states[4]).toContain('saved successfully')
    expect(fixture.invalidate).toHaveBeenCalledWith({ queryKey: ['suppliers'] })
    expect(fixture.invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'options'] })
  })
  it('opens an existing supplier using a fresh ID-scoped read', () => {
    const modal = nodes(SuppliersPage()).find(node => node.type === AddSupplierModal)!
    modal.props.onViewExisting('existing')
    expect(fixture.states[3]).toBe(false)
    expect(fixture.states[2]).toEqual({ id: 'existing', mode: 'view' })
    expect(fixture.remove).toHaveBeenCalledWith({ queryKey: ['suppliers', 'detail', 'existing'] })
    expect(fixture.states[4]).toBe('')
  })
})
