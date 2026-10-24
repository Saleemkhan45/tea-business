export type CustomerDraft = {
  name: string
  phone: string
  city: string
  region: string
  address: string
  notes: string
}

export type CustomerDraftErrors = Partial<Record<keyof CustomerDraft, string>>

export const EMPTY_CUSTOMER_DRAFT: CustomerDraft = {
  name: '', phone: '', city: '', region: '', address: '', notes: '',
}

export function isValidOptionalPhone(phone: string) {
  const trimmed = phone.trim()
  return !trimmed || (/^\+?[0-9\s().-]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 7)
}

export function validateCustomerDraft(draft: CustomerDraft): CustomerDraftErrors {
  const errors: CustomerDraftErrors = {}
  if (!draft.name.trim()) errors.name = 'Customer name is required.'
  else if (draft.name.trim().length > 160) errors.name = 'Customer name must be at most 160 characters.'
  if (draft.phone.trim().length > 40) errors.phone = 'Phone number must be at most 40 characters.'
  else if (!isValidOptionalPhone(draft.phone)) errors.phone = 'Enter a valid phone number.'
  if (draft.city.trim().length > 120) errors.city = 'Location / city must be at most 120 characters.'
  if (draft.region.trim().length > 120) errors.region = 'Region must be at most 120 characters.'
  if (draft.address.trim().length > 300) errors.address = 'Address must be at most 300 characters.'
  if (draft.notes.trim().length > 1000) errors.notes = 'Notes must be at most 1000 characters.'
  return errors
}

export function normalizeCustomerDraft(draft: CustomerDraft) {
  return {
    name: draft.name.trim(),
    phone: draft.phone.trim() || undefined,
    city: draft.city.trim() || undefined,
    region: draft.region.trim() || undefined,
    address: draft.address.trim() || undefined,
    notes: draft.notes.trim() || undefined,
  }
}

export function validateOpeningBalance(value: string) {
  if (!value.trim()) return undefined
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0) return 'Old Khata must be a non-negative whole PKR amount.'
  return undefined
}

export function normalizeOpeningBalance(value: string) {
  return value.trim() ? Number(value) : 0
}

export async function runSingleCustomerSubmission<T>(guard: { current: boolean }, action: () => Promise<T>) {
  if (guard.current) return undefined
  guard.current = true
  try {
    return await action()
  } finally {
    guard.current = false
  }
}
