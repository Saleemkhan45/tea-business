import type { NewSaleCustomerInput, SaleDto, SalePaymentMethod, SaleWriteInput } from './types/salesApi'
import { getPakistanBusinessDate } from '../../business/utils/date'

export type SaleFormValues = {
  salespersonName: string
  businessDate: string
  customerName: string
  customerId: string
  stockLocationId: string
  teaType: SaleWriteInput['teaType'] | ''
  quantity: string
  unitPrice: string
  amountPaid: string
  receivedPaymentMethod: Exclude<SalePaymentMethod, 'credit'>
  paymentMethod: SalePaymentMethod
  status: 'completed' | 'pending'
  notes: string
}
export type SaleFormErrors = Partial<Record<keyof SaleFormValues, string>>

export function todayBusinessDate() {
  return getPakistanBusinessDate()
}

export function initialSaleForm(sale?: SaleDto): SaleFormValues {
  return {
    salespersonName: sale?.salespersonName ?? '',
    businessDate: sale?.businessDate ?? todayBusinessDate(),
    customerName: sale?.customerName ?? '',
    customerId: sale?.customer ?? '',
    stockLocationId: sale?.stockLocationId ?? '',
    teaType: sale?.teaType ?? '',
    quantity: sale?.quantityKg === undefined ? '' : String(sale.quantityKg),
    unitPrice: sale?.unitPrice === undefined ? '' : String(sale.unitPrice),
    amountPaid: String(sale?.amountPaid ?? 0),
    receivedPaymentMethod: sale?.receivedPaymentMethod === 'credit' ? 'cash' : sale?.receivedPaymentMethod ?? 'cash',
    paymentMethod: sale?.paymentMethod ?? 'cash',
    status: sale?.status === 'pending' ? 'pending' : 'completed',
    notes: sale?.notes ?? '',
  }
}

export function validateSaleForm(form: SaleFormValues, previousCustomerId?: string, newCustomer?: NewSaleCustomerInput):
  { input: SaleWriteInput; errors?: never } | { errors: SaleFormErrors; input?: never } {
  const errors: SaleFormErrors = {}
  if (form.salespersonName.trim().length > 160) errors.salespersonName = 'Salesperson name must be at most 160 characters.'
  const quantityKg = Number(form.quantity)
  const unitPrice = Number(form.unitPrice)
  const customerId = form.customerId.trim()
  const stockLocationId = form.stockLocationId.trim()
  const grams = Math.round(quantityKg * 1000)
  const date = new Date(`${form.businessDate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.businessDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== form.businessDate) {
    errors.businessDate = 'Choose a valid sale date.'
  }
  if (!form.customerName.trim() && !customerId && !newCustomer) errors.customerName = 'Select a customer.'
  if (customerId && !/^[a-fA-F0-9]{24}$/.test(customerId)) errors.customerId = 'Select a valid customer.'
  if (!customerId && !newCustomer && (form.paymentMethod === 'credit' || previousCustomerId)) errors.customerId = 'Select a customer for this sale.'
  if (!/^[a-fA-F0-9]{24}$/.test(stockLocationId)) errors.stockLocationId = 'Select an inventory item.'
  if (!form.teaType) errors.teaType = 'Select a tea type.'
  if (!Number.isFinite(quantityKg) || quantityKg <= 0 || !Number.isSafeInteger(grams) || Math.abs(quantityKg - grams / 1000) >= 1e-9) {
    errors.quantity = 'Enter a positive quantity with up to three decimal places.'
  }
  if (!form.unitPrice.trim() || !Number.isSafeInteger(unitPrice) || unitPrice < 0) errors.unitPrice = 'Enter a non-negative whole PKR price.'
  if (!errors.quantity && !errors.unitPrice && (!Number.isSafeInteger(grams * unitPrice) || (grams * unitPrice) % 1000 !== 0)) {
    errors.unitPrice = 'Quantity and price must produce a whole PKR total.'
  }
  if (form.customerName.trim().length > 160) errors.customerName = 'Customer name must be at most 160 characters.'
  if (form.notes.trim().length > 500) errors.notes = 'Notes must be at most 500 characters.'
  const totalPkr = grams * unitPrice / 1000
  const amountPaid = form.paymentMethod === 'credit' ? Number(form.amountPaid) : totalPkr
  if (!Number.isSafeInteger(amountPaid) || amountPaid < 0 || amountPaid > totalPkr) errors.amountPaid = 'Received amount must be a whole PKR value between zero and the sale total.'
  if (Object.keys(errors).length || !form.teaType) return { errors }
  return { input: {
    salespersonName: form.salespersonName.trim() || null,
    businessDate: form.businessDate,
    customerId: customerId || undefined,
    customerName: form.customerName.trim() || undefined,
    newCustomer,
    stockLocationId,
    teaType: form.teaType,
    quantityKg,
    unitPrice,
    amountPaid,
    receivedPaymentMethod: form.paymentMethod === 'credit' ? form.receivedPaymentMethod : form.paymentMethod,
    paymentMethod: form.paymentMethod,
    status: form.status,
    notes: form.notes.trim() || null,
  } }
}

export function clearSaleStockSelection(form: SaleFormValues): SaleFormValues {
  return { ...form, stockLocationId: '', teaType: '', quantity: '', unitPrice: '' }
}
