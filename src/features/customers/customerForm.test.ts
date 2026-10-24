import { describe, expect, it, vi } from 'vitest'
import { EMPTY_CUSTOMER_DRAFT, normalizeCustomerDraft, normalizeOpeningBalance, runSingleCustomerSubmission, validateCustomerDraft, validateOpeningBalance } from './customerForm'

describe('customer form validation', () => {
  it('requires only a customer name and trims optional contact fields', () => {
    expect(validateCustomerDraft({ ...EMPTY_CUSTOMER_DRAFT, name: '  Ayesha Store  ' })).toEqual({})
    expect(normalizeCustomerDraft({ ...EMPTY_CUSTOMER_DRAFT, name: '  Ayesha Store  ', phone: ' 0300 1234567 ', city: ' Lahore ', region: ' Punjab ', address: ' Main Road ', notes: ' Weekly delivery ' })).toEqual({
      name: 'Ayesha Store', phone: '0300 1234567', city: 'Lahore', region: 'Punjab', address: 'Main Road', notes: 'Weekly delivery',
    })
  })

  it('rejects missing names and fields beyond the server limits', () => {
    expect(validateCustomerDraft({ ...EMPTY_CUSTOMER_DRAFT, name: ' ', phone: '1'.repeat(41), city: 'c'.repeat(121), region: 'r'.repeat(121), address: 'a'.repeat(301), notes: 'n'.repeat(1001) })).toEqual({
      name: 'Customer name is required.',
      phone: 'Phone number must be at most 40 characters.',
      city: 'Location / city must be at most 120 characters.',
      region: 'Region must be at most 120 characters.',
      address: 'Address must be at most 300 characters.',
      notes: 'Notes must be at most 1000 characters.',
    })
  })

  it('validates optional phone and non-negative whole-PKR opening Khata values', () => {
    expect(validateCustomerDraft({ ...EMPTY_CUSTOMER_DRAFT, name: 'Ayesha', phone: 'phone me' }).phone).toBe('Enter a valid phone number.')
    expect(validateOpeningBalance('')).toBeUndefined()
    expect(validateOpeningBalance('0')).toBeUndefined()
    expect(validateOpeningBalance('-1')).toBeDefined()
    expect(validateOpeningBalance('10.5')).toBeDefined()
    expect(normalizeOpeningBalance(' 2500 ')).toBe(2500)
  })

  it('prevents duplicate customer submissions while the first request is pending', async () => {
    const guard = { current: false }
    let finish: ((value: string) => void) | undefined
    const save = vi.fn(() => new Promise<string>(resolve => { finish = resolve }))
    const first = runSingleCustomerSubmission(guard, save)
    await expect(runSingleCustomerSubmission(guard, save)).resolves.toBeUndefined()
    expect(save).toHaveBeenCalledOnce()
    finish?.('saved')
    await expect(first).resolves.toBe('saved')
    expect(guard.current).toBe(false)
  })
})
