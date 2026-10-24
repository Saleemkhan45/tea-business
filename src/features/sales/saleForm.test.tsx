import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SaleEntryForm } from './components/SaleEntryForm'
import { clearSaleStockSelection, initialSaleForm, validateSaleForm } from './saleForm'
import { SalesApiError } from './services/sales.service'
import { toSaleRecord } from './types/sales'
import { saleDtoSchema } from './types/salesApi'
import { customerId, sale, stockLocationId } from './test/fixtures'
import type { SaleStockItem } from './types/salesApi'

const form = {
  ...initialSaleForm(), businessDate: '2026-10-02', customerName: 'Counter customer',
  teaType: 'green' as const, stockLocationId, quantity: '2', unitPrice: '500',
}

const catalog = vi.hoisted(() => ({
  isPending: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  data: {
    operator: { name: 'Admin' },
    inventorySummary: undefined as { totalItems: number; activeItems: number; inactiveItems: number; sellableItems: number; outOfStockItems: number } | undefined,
    items: [] as SaleStockItem[],
  },
}))

vi.mock('./useSales', () => ({ useSaleEntryOptions: () => catalog }))
vi.mock('../customer-ledger', () => ({
  useCustomerLedgerSummary: () => ({ isPending: false, isError: false, data: { summary: { currentBalancePkr: 20000 } } }),
  useCustomerDirectory: () => ({ isPending: false, isError: false, data: { customers: [], pagination: { pages: 1 } } }),
  useCustomerById: () => ({ isError: false, data: { customer: { name: 'Ahmed Traders', phone: '0300 1112223' } } }),
  useCreateCustomer: () => ({ isPending: false }),
}))

beforeEach(() => {
  catalog.isPending = false
  catalog.isFetching = false
  catalog.isError = false
  catalog.refetch.mockReset()
  catalog.data.inventorySummary = undefined
  catalog.data.items = []
})

describe('Sales form and server presentation', () => {
  it('validates and trims Sold By without sending an operator override', () => {
    expect(validateSaleForm({ ...form, salespersonName: '  Ali  ' }).input).toMatchObject({ salespersonName: 'Ali' })
    expect(validateSaleForm({ ...form, salespersonName: 'A'.repeat(161) }).errors?.salespersonName).toBeDefined()
    expect(initialSaleForm({ ...sale, salespersonName: 'Kamran' }).salespersonName).toBe('Kamran')
    expect(toSaleRecord({ ...sale, salespersonName: 'Ali', enteredByName: 'Admin' })).toMatchObject({ soldBy: 'Ali', enteredBy: 'Admin' })
  })
  it('requires a real customer ID for credit, not just a name', () => {
    expect(validateSaleForm({ ...form, paymentMethod: 'credit' }).errors?.customerId).toBeDefined()
    expect(validateSaleForm({ ...form, paymentMethod: 'credit', customerId }).input).toMatchObject({ customerId, paymentMethod: 'credit' })
  })

  it('accepts a validated staged customer for an atomic new-customer credit sale', () => {
    const newCustomer = { name: 'New Retailer', city: 'Lahore', phone: '0300 1234567' }
    const result = validateSaleForm({ ...form, paymentMethod: 'credit' }, undefined, newCustomer)
    expect(result.input).toMatchObject({ newCustomer, customerId: undefined, paymentMethod: 'credit' })
  })

  it('permits cash without customer ID and never includes a preview total in the draft', () => {
    const result = validateSaleForm(form)
    expect(result.errors).toBeUndefined()
    expect(result.input).toMatchObject({ customerId: undefined, quantityKg: 2, unitPrice: 500 })
    for (const field of ['idempotencyKey', 'amountPkr', 'totalAmount', 'balance', 'createdBy', 'shop', 'operator', 'region']) {
      expect(result.input).not.toHaveProperty(field)
    }
  })

  it('validates calendar dates, stock IDs, quantity precision and whole PKR totals', () => {
    expect(validateSaleForm({ ...form, businessDate: '2026-02-30' }).errors?.businessDate).toBeDefined()
    expect(validateSaleForm({ ...form, businessDate: 'invalid' }).errors?.businessDate).toBeDefined()
    expect(validateSaleForm({ ...form, stockLocationId: 'main' }).errors?.stockLocationId).toBeDefined()
    expect(validateSaleForm({ ...form, quantity: '0.0001' }).errors?.quantity).toBeDefined()
    expect(validateSaleForm({ ...form, unitPrice: '500.5' }).errors?.unitPrice).toBeDefined()
    expect(validateSaleForm({ ...form, quantity: '0.001', unitPrice: '500' }).errors?.unitPrice).toBeDefined()
    expect(validateSaleForm({ ...form, quantity: '0.002', unitPrice: '500' }).input).toMatchObject({ quantityKg: 0.002 })
  })

  it('accepts exact whole-PKR fractional kilogram sales without floating-point payment errors', () => {
    const fractional = { ...form, quantity: '1.001', unitPrice: '1000' }
    expect(validateSaleForm(fractional).input).toMatchObject({ quantityKg: 1.001, unitPrice: 1000, amountPaid: 1001 })
    expect(validateSaleForm({ ...fractional, customerId, paymentMethod: 'credit', amountPaid: '1001' }).input?.amountPaid).toBe(1001)
    expect(validateSaleForm({ ...fractional, customerId, paymentMethod: 'credit', amountPaid: '1002' }).errors?.amountPaid).toBeDefined()
  })

  it('keeps existing linked customers rather than pretending an omitted ID unlinks a sale', () => {
    expect(validateSaleForm(form, customerId).errors?.customerId).toBeDefined()
    expect(initialSaleForm({ ...sale, customer: customerId }).customerId).toBe(customerId)
  })

  it('supports legacy optional fields without inventing stock, price, quantity, region or operator', () => {
    const legacy = saleDtoSchema.parse({ ...sale, teaType: undefined, quantityKg: undefined, unitPrice: undefined, createdBy: undefined })
    expect(toSaleRecord(legacy)).toMatchObject({ quantityKg: undefined, unitPrice: undefined, teaType: '-', enteredBy: '-', region: '-' })
    expect(toSaleRecord({ ...sale, status: 'voided' }).status).toBe('Voided')
  })

  it('disables submit and fields while saving and does not display an idempotency key', () => {
    const html = renderToStaticMarkup(<SaleEntryForm submitting error={null} onClose={() => {}} onSubmit={async () => {}} />)
    expect(html).toMatch(/<fieldset[^>]*disabled/)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Saving sale...')
    expect(html.toLowerCase()).not.toContain('idempotency')
  })

  it('locks the original intent during retry and offers an explicit reset', () => {
    const html = renderToStaticMarkup(<SaleEntryForm locked submitting={false} error={new SalesApiError('Conflict from server.', 409)} onReset={() => {}} onClose={() => {}} onSubmit={async () => {}} />)
    expect(html).toMatch(/<fieldset[^>]*disabled/)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Conflict from server.')
    expect(html).toContain('Retry Sale')
    expect(html).toContain('aria-label="Reset sale submission"')
  })

  it('uses customer search and read-only operator identity without manual IDs', () => {
    const html = renderToStaticMarkup(<SaleEntryForm initialCustomerId={customerId} submitting={false} error={null} onClose={() => {}} onSubmit={async () => {}} />)
    expect(html).toContain('Ahmed Traders')
    expect(html).toContain('Current Khata Due')
    expect(html).toContain('PKR 20,000')
    expect(html).toContain('readOnly="" value="Admin"')
    expect(html).not.toContain('Customer ID')
    expect(html).not.toContain('Stock Item ID')
    expect(html).not.toContain(customerId)
  })

  it('distinguishes an empty catalog, inactive products and inventory request failures', () => {
    expect(renderToStaticMarkup(<SaleEntryForm submitting={false} error={null} onClose={() => {}} onSubmit={async () => {}} />))
      .toContain('Select a selling region to view its inventory.')

    catalog.data.inventorySummary = { totalItems: 2, activeItems: 0, inactiveItems: 2, sellableItems: 0, outOfStockItems: 0 }
    expect(renderToStaticMarkup(<SaleEntryForm submitting={false} error={null} onClose={() => {}} onSubmit={async () => {}} />))
      .toContain('Select a selling region to view its inventory.')

    catalog.isError = true
    expect(renderToStaticMarkup(<SaleEntryForm sale={{ ...sale, sellingRegion: stockLocationId }} submitting={false} error={null} onClose={() => {}} onSubmit={async () => {}} />))
      .toContain('Unable to load inventory.')
  })

  it('accepts zero or partial received amounts and rejects overpayment', () => {
    const credit = { ...form, customerId, paymentMethod: 'credit' as const }
    expect(validateSaleForm({ ...credit, amountPaid: '0' }).input?.amountPaid).toBe(0)
    expect(validateSaleForm({ ...credit, amountPaid: '400' }).input?.amountPaid).toBe(400)
    expect(validateSaleForm({ ...credit, amountPaid: '1001' }).errors?.amountPaid).toBeDefined()
  })

  it('reflects cancellation and sale receipts without allocating later payments', () => {
    expect(toSaleRecord({ ...sale, status: 'voided' }).paymentStatus).toBe('Cancelled')
    expect(toSaleRecord({ ...sale, paymentMethod: 'credit', amountPaid: 400 })).toMatchObject({ paymentStatus: 'Partial', amountPaid: 400, amountDue: 600 })
  })
})

vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [], isPending: false, isError: false }) }))

it('clears product, quantity and price on a region change while preserving the customer and payment', () => {
  expect(clearSaleStockSelection(form)).toEqual({ ...form, stockLocationId: '', teaType: '', quantity: '', unitPrice: '' })
})

it('shows only products belonging to the explicitly selected fulfillment region', () => {
  const sellingRegion = '507f1f77bcf86cd799439020'
  catalog.data.items = [
    { id: stockLocationId, name: 'Islamabad Green', teaType: 'green', availableKg: 500, sellingPrice: 800, lowStockThreshold: 0, updatedAt: null, regionId: sellingRegion },
    { id: '507f1f77bcf86cd799439021', name: 'Peshawar Black', teaType: 'black', availableKg: 350, sellingPrice: 700, lowStockThreshold: 0, updatedAt: null, regionId: '507f1f77bcf86cd799439022' },
  ]
  const html = renderToStaticMarkup(<SaleEntryForm sale={{ ...sale, sellingRegion }} submitting={false} error={null} onClose={() => {}} onSubmit={async () => {}} />)
  expect(html).toContain('Islamabad Green')
  expect(html).not.toContain('Peshawar Black')
})
it('shows the requested empty-region message and a management link', () => {
  const sellingRegion = '507f1f77bcf86cd799439020'
  const html = renderToStaticMarkup(<SaleEntryForm sale={{ ...sale, sellingRegion }} submitting={false} error={null} onClose={() => {}} onSubmit={async () => {}} />)
  expect(html).toContain('No active regional products are assigned here.')
  expect(html).toContain('/regions?region=507f1f77bcf86cd799439020')
})
it('displays the fulfillment region independently from the customer region', () => {
  expect(toSaleRecord({ ...sale, customerRegion: 'Customer address', sellingRegion: stockLocationId, sellingRegionName: 'Islamabad' }).region).toBe('Islamabad')
})
