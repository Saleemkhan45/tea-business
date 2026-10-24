import { calculateCustomerPurchaseAmountPkr } from '../../business/domain/customer-ledger.types'
import { getPakistanBusinessDate, isValidBusinessDate } from '../../business/utils/date'

export type FirstSalePaymentMode = 'cash' | 'khata' | 'mixed'

export type FirstSaleDraft = {
  salespersonName: string
  notes: string
  enabled: boolean
  stockLocationId: string
  quantity: string
  unitPrice: string
  amountPaid: string
  paymentMode: FirstSalePaymentMode
  businessDate: string
}

export type FirstSaleDraftErrors = Partial<Record<keyof FirstSaleDraft, string>>

export function initialFirstSaleDraft(): FirstSaleDraft {
  return {
    salespersonName: '',
    notes: '',
    enabled: false,
    stockLocationId: '',
    quantity: '',
    unitPrice: '',
    amountPaid: '0',
    paymentMode: 'cash',
    businessDate: getPakistanBusinessDate(),
  }
}

export function calculateFirstSaleTotal(draft: FirstSaleDraft) {
  if (!draft.quantity.trim() || !draft.unitPrice.trim()) return undefined
  try {
    return calculateCustomerPurchaseAmountPkr(Number(draft.quantity), Number(draft.unitPrice))
  } catch {
    return undefined
  }
}

export function firstSaleAmountPaid(draft: FirstSaleDraft, totalPkr: number | undefined) {
  if (totalPkr === undefined) return undefined
  if (draft.paymentMode === 'cash') return totalPkr
  if (draft.paymentMode === 'khata') return 0
  return Number(draft.amountPaid)
}

export function validateFirstSaleDraft(draft: FirstSaleDraft, availableKg?: number): FirstSaleDraftErrors {
  if (!draft.enabled) return {}
  const errors: FirstSaleDraftErrors = {}
  if (draft.salespersonName.trim().length > 160) errors.salespersonName = 'Salesperson name must be at most 160 characters.'
  if (draft.notes.trim().length > 500) errors.notes = 'Notes must be at most 500 characters.'
  const quantity = Number(draft.quantity)
  const unitPrice = Number(draft.unitPrice)
  const totalPkr = calculateFirstSaleTotal(draft)

  if (!draft.stockLocationId) errors.stockLocationId = 'Select a product or tea item.'
  if (!draft.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = 'Quantity must be greater than zero.'
  } else if (Math.abs(quantity * 1000 - Math.round(quantity * 1000)) >= 1e-9) {
    errors.quantity = 'Quantity can use up to three decimal places.'
  } else if (availableKg !== undefined && quantity > availableKg) {
    errors.quantity = `Only ${availableKg.toLocaleString('en-PK')} kg is available.`
  }
  if (!draft.unitPrice.trim() || !Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
    errors.unitPrice = 'Unit price must be a positive whole PKR amount.'
  } else if (!errors.quantity && totalPkr === undefined) {
    errors.unitPrice = 'Quantity and unit price must produce a whole PKR total.'
  }
  if (!isValidBusinessDate(draft.businessDate)) errors.businessDate = 'Choose a valid sale date.'

  if (draft.paymentMode === 'mixed') {
    const amountPaid = Number(draft.amountPaid)
    if (!draft.amountPaid.trim() || !Number.isSafeInteger(amountPaid) || amountPaid <= 0 || (totalPkr !== undefined && amountPaid >= totalPkr)) {
      errors.amountPaid = 'For Mixed payment, enter a whole PKR amount greater than zero and less than the total.'
    }
  }
  return errors
}
