import { describe, expect, it } from 'vitest'
import { customerLedgerKeys } from './queryKeys'

describe('customer ledger query keys', () => {
  it('includes customer directory filters in the query key', () => {
    expect(customerLedgerKeys.directory({
      search: ' Ahmed ',
      status: 'active',
      page: 2,
      limit: 10,
    })).toEqual([
      'customerLedger',
      'customer-directory',
      { search: 'Ahmed', status: 'active', page: 2, limit: 10 },
    ])
  })

  it('uses stable customer directory defaults', () => {
    expect(customerLedgerKeys.directory()).toEqual([
      'customerLedger',
      'customer-directory',
      { search: '', status: '', page: 1, limit: 20 },
    ])
  })
})
