import { describe, expect, it, vi } from 'vitest'
import { createSaleSubmission } from './saleSubmission'
import { SalesApiError } from './services/sales.service'
import type { CreateSaleInput, SaleDto } from './types/salesApi'
import { sale, saleInput } from './test/fixtures'

function setup() {
  const send = vi.fn<(input: CreateSaleInput) => Promise<{ sale: SaleDto }>>().mockResolvedValue({ sale })
  const keys = vi.fn().mockReturnValueOnce('key-a').mockReturnValueOnce('key-b')
  return { send, keys, submission: createSaleSubmission(send, keys) }
}

describe('form-scoped sale submission lifecycle', () => {
  it('generates only on intentional submit, then discards the active key on success', async () => {
    const { submission, send, keys } = setup()
    expect(submission.getSnapshot()).toEqual({ status: 'idle', error: null, hasActiveRequest: false })
    expect(keys).not.toHaveBeenCalled()
    expect(await submission.submit(saleInput)).toEqual(sale)
    expect(send).toHaveBeenCalledWith({ ...saleInput, idempotencyKey: 'key-a' })
    expect(submission.getSnapshot()).toEqual({ status: 'success', error: null, hasActiveRequest: false })
  })

  it('keeps the same frozen request and key after a recoverable network failure', async () => {
    const { submission, send, keys } = setup()
    send.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await submission.submit(saleInput)
    expect(submission.getSnapshot()).toMatchObject({ status: 'error', hasActiveRequest: true })
    await submission.submit({ ...saleInput, quantityKg: 99 })
    expect(send.mock.calls[0][0]).toBe(send.mock.calls[1][0])
    expect(send.mock.calls[1][0]).toEqual({ ...saleInput, idempotencyKey: 'key-a' })
    expect(Object.isFrozen(send.mock.calls[0][0])).toBe(true)
    expect(keys).toHaveBeenCalledOnce()
  })

  it('keeps staged customer details in the frozen retry request', async () => {
    const { submission, send, keys } = setup()
    const withNewCustomer = { ...saleInput, salespersonName: 'Ali', notes: 'First purchase', newCustomer: { name: 'New Retailer', phone: '0300 1234567' } }
    send.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await submission.submit(withNewCustomer)
    await submission.submit({ ...saleInput, newCustomer: { name: 'Changed Customer' } })
    expect(send.mock.calls[1][0]).toEqual({ ...withNewCustomer, idempotencyKey: 'key-a' })
    expect(keys).toHaveBeenCalledOnce()
  })

  it('retries a server failure with the original key and accepts an existing-sale replay', async () => {
    const { submission, send, keys } = setup()
    send.mockRejectedValueOnce(new SalesApiError('Internal server error.', 500))
    await submission.submit(saleInput)
    expect(submission.getSnapshot().error?.message).toBe('Internal server error.')
    expect(await submission.submit(saleInput)).toEqual(sale)
    expect(submission.getSnapshot().status).toBe('success')
    expect(keys).toHaveBeenCalledOnce()
  })

  it('synchronously blocks two submissions before a React rerender', async () => {
    const { submission, send, keys } = setup()
    let finish: ((result: { sale: SaleDto }) => void) | undefined
    send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const first = submission.submit(saleInput)
    expect(submission.getSnapshot().status).toBe('submitting')
    expect(await submission.submit(saleInput)).toBeUndefined()
    expect(submission.reset()).toBe(false)
    expect(send).toHaveBeenCalledOnce()
    expect(keys).toHaveBeenCalledOnce()
    finish?.({ sale })
    await first
  })

  it('reset after success starts a new sale with a new key', async () => {
    const { submission, send } = setup()
    await submission.submit(saleInput)
    expect(await submission.submit(saleInput)).toBeUndefined()
    expect(submission.reset()).toBe(true)
    await submission.submit({ ...saleInput, quantityKg: 3 })
    expect(send.mock.calls.map(([input]) => input.idempotencyKey)).toEqual(['key-a', 'key-b'])
  })

  it('explicit abandonment after failure discards the old intent', async () => {
    const { submission, send } = setup()
    send.mockRejectedValueOnce(new SalesApiError('Invalid quantity.', 400))
    await submission.submit(saleInput)
    submission.reset()
    await submission.submit({ ...saleInput, quantityKg: 3 })
    expect(send.mock.calls[1][0]).toMatchObject({ quantityKg: 3, idempotencyKey: 'key-b' })
  })

  it('surfaces a business conflict and preserves the intent until explicit reset', async () => {
    const { submission, send } = setup()
    send.mockRejectedValueOnce(new SalesApiError('Insufficient stock for sale.', 409))
    await submission.submit(saleInput)
    expect(submission.getSnapshot()).toMatchObject({ status: 'error', hasActiveRequest: true, error: { status: 409 } })
    expect(send).toHaveBeenCalledOnce()
  })

  it('does not share keys between form instances and generates opaque UUIDs', async () => {
    const send = vi.fn().mockResolvedValue({ sale })
    await createSaleSubmission(send).submit(saleInput)
    await createSaleSubmission(send).submit(saleInput)
    const keys = send.mock.calls.map(([input]) => input.idempotencyKey)
    expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('notifies the form of pending/error/retry/success transitions without regenerating keys', async () => {
    const { submission, send, keys } = setup()
    const states: string[] = []
    const unsubscribe = submission.subscribe(() => states.push(submission.getSnapshot().status))
    send.mockRejectedValueOnce(new Error('Offline'))
    await submission.submit(saleInput)
    submission.getSnapshot()
    submission.getSnapshot()
    await submission.submit(saleInput)
    unsubscribe()
    submission.reset()
    expect(states).toEqual(['submitting', 'error', 'submitting', 'success'])
    expect(keys).toHaveBeenCalledOnce()
  })
})
