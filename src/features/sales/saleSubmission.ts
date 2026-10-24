import type { CreateSaleInput, SaleDto, SaleWriteInput } from './types/salesApi'

export type SaleSubmissionState = {
  status: 'idle' | 'submitting' | 'success' | 'error'
  error: Error | null
  hasActiveRequest: boolean
}

export function createSaleSubmission(
  send: (input: CreateSaleInput) => Promise<{ sale: SaleDto }>,
  createKey: () => string = () => crypto.randomUUID(),
) {
  let request: Readonly<CreateSaleInput> | undefined
  let state: SaleSubmissionState = { status: 'idle', error: null, hasActiveRequest: false }
  const listeners = new Set<() => void>()

  function publish(next: SaleSubmissionState) {
    state = next
    listeners.forEach(listener => listener())
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    reset: () => {
      if (state.status === 'submitting') return false
      request = undefined
      publish({ status: 'idle', error: null, hasActiveRequest: false })
      return true
    },
    submit: async (input: SaleWriteInput): Promise<SaleDto | undefined> => {
      if (state.status === 'submitting' || state.status === 'success') return undefined
      // Freeze the intent as well as its key: edits must explicitly reset the operation.
      request ??= Object.freeze({ ...input, idempotencyKey: createKey() })
      publish({ status: 'submitting', error: null, hasActiveRequest: true })
      try {
        const { sale } = await send(request)
        request = undefined
        publish({ status: 'success', error: null, hasActiveRequest: false })
        return sale
      } catch (error) {
        publish({ status: 'error', error: error instanceof Error ? error : new Error('Sale could not be saved.'), hasActiveRequest: true })
        return undefined
      }
    },
  }
}
