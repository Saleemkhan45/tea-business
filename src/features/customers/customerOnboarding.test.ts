import { describe, expect, it } from 'vitest'
import { calculateFirstSaleTotal, firstSaleAmountPaid, initialFirstSaleDraft, validateFirstSaleDraft } from './customerOnboarding'

const valid = {
  ...initialFirstSaleDraft(),
  enabled: true,
  stockLocationId: '507f1f77bcf86cd799439012',
  quantity: '2',
  unitPrice: '750',
  businessDate: '2026-10-14',
}

describe('customer onboarding first sale', () => {
  it('validates purchase notes and salesperson separately from customer details', () => {
    expect(validateFirstSaleDraft({ ...valid, salespersonName: 'Ali', notes: 'First purchase' })).toEqual({})
    expect(validateFirstSaleDraft({ ...valid, salespersonName: 'a'.repeat(161) }).salespersonName).toBeDefined()
    expect(validateFirstSaleDraft({ ...valid, notes: 'a'.repeat(501) }).notes).toBeDefined()
  })
  it('keeps the optional section valid when it is disabled', () => {
    expect(validateFirstSaleDraft(initialFirstSaleDraft())).toEqual({})
  })

  it('calculates whole-PKR totals, cash paid and remaining Khata', () => {
    expect(calculateFirstSaleTotal(valid)).toBe(1500)
    expect(firstSaleAmountPaid(valid, 1500)).toBe(1500)
    expect(firstSaleAmountPaid({ ...valid, paymentMode: 'khata' }, 1500)).toBe(0)
    expect(firstSaleAmountPaid({ ...valid, paymentMode: 'mixed', amountPaid: '500' }, 1500)).toBe(500)
  })

  it('requires product, positive quantity and price, a valid date, and sufficient stock', () => {
    expect(validateFirstSaleDraft({ ...valid, stockLocationId: '' }).stockLocationId).toBeDefined()
    expect(validateFirstSaleDraft({ ...valid, quantity: '0' }).quantity).toBeDefined()
    expect(validateFirstSaleDraft({ ...valid, quantity: '3' }, 2).quantity).toContain('2 kg')
    expect(validateFirstSaleDraft({ ...valid, unitPrice: '0' }).unitPrice).toBeDefined()
    expect(validateFirstSaleDraft({ ...valid, businessDate: '2026-02-30' }).businessDate).toBeDefined()
  })

  it('requires a mixed payment to be positive and lower than the total', () => {
    expect(validateFirstSaleDraft({ ...valid, paymentMode: 'mixed', amountPaid: '0' }).amountPaid).toBeDefined()
    expect(validateFirstSaleDraft({ ...valid, paymentMode: 'mixed', amountPaid: '1500' }).amountPaid).toBeDefined()
    expect(validateFirstSaleDraft({ ...valid, paymentMode: 'mixed', amountPaid: '500' })).toEqual({})
  })
})
