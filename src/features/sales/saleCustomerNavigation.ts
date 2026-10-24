import { z } from 'zod'
import type { AuthSession } from '../auth/auth.store'
import { salePaymentMethodSchema, saleTeaTypeSchema } from './types/salesApi'
import type { SaleFormValues } from './saleForm'

const optionalId = z.union([z.literal(''), z.string().regex(/^[a-f\d]{24}$/i)])
const draftSchema = z.object({
  sellingRegion: optionalId,
  form: z.object({
    salespersonName: z.string().max(160), businessDate: z.string().max(10),
    customerName: z.string().max(160), customerId: optionalId, stockLocationId: optionalId,
    teaType: z.union([z.literal(''), saleTeaTypeSchema]), quantity: z.string().max(64),
    unitPrice: z.string().max(64), amountPaid: z.string().max(64),
    receivedPaymentMethod: salePaymentMethodSchema.exclude(['credit']), paymentMethod: salePaymentMethodSchema,
    status: z.enum(['completed', 'pending']), notes: z.string().max(500),
  }),
})
const flowSchema = z.object({
  version: z.literal(1), id: z.uuid(), stage: z.enum(['create-customer', 'resume-sale']),
  scope: z.object({ userId: z.string(), shopId: z.string(), expiresAt: z.string() }),
  draft: draftSchema,
  createdCustomerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
})
export type SaleDraft = { form: SaleFormValues; sellingRegion: string }
export type SaleCustomerFlow = z.infer<typeof flowSchema>
const finishedFlowIds = new Set<string>()
const finishedFlowsKey = 'tea-business-finished-sale-customer-flows'
const finishedFlowsSchema = z.array(z.object({ id: z.uuid(), expiresAt: z.string() }))
function finishedFlows() {
  try {
    if (typeof window === 'undefined') return []
    const parsed = finishedFlowsSchema.safeParse(JSON.parse(window.sessionStorage.getItem(finishedFlowsKey) ?? '[]'))
    return parsed.success ? parsed.data.filter(entry => Date.parse(entry.expiresAt) > Date.now()) : []
  } catch { return [] }
}
export function finishSaleCustomerFlow(flow: SaleCustomerFlow) {
  finishedFlowIds.add(flow.id)
  try {
    // Only completion IDs/expiry are stored here, never draft or financial data.
    if (typeof window !== 'undefined') window.sessionStorage.setItem(finishedFlowsKey, JSON.stringify([
      ...finishedFlows().filter(entry => entry.id !== flow.id), { id: flow.id, expiresAt: flow.scope.expiresAt },
    ]))
  } catch { /* In-memory completion still protects Back when storage is unavailable. */ }
}

export function createSaleCustomerFlow(draft: SaleDraft, session: AuthSession): SaleCustomerFlow {
  return { version: 1, id: crypto.randomUUID(), stage: 'create-customer',
    scope: { userId: session.user.id, shopId: session.user.shopId, expiresAt: session.expiresAt },
    draft: { form: { ...draft.form }, sellingRegion: draft.sellingRegion } }
}
export function readSaleCustomerFlow(state: unknown, session: AuthSession | null): SaleCustomerFlow | undefined {
  const parsed = z.object({ saleCustomerFlow: flowSchema }).safeParse(state)
  if (!session || !parsed.success) return undefined
  const flow = parsed.data.saleCustomerFlow
  if (flow.scope.userId !== session.user.id || flow.scope.shopId !== session.user.shopId || flow.scope.expiresAt !== session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) return undefined
  if (finishedFlowIds.has(flow.id) || finishedFlows().some(entry => entry.id === flow.id)) return undefined
  return flow
}
export function resumeSaleCustomerFlow(flow: SaleCustomerFlow, createdCustomerId?: string): SaleCustomerFlow {
  return { ...flow, stage: 'resume-sale', createdCustomerId,
    draft: createdCustomerId ? { ...flow.draft, form: { ...flow.draft.form, customerId: createdCustomerId, customerName: '' } } : flow.draft }
}
export function withoutSaleCustomerFlow(state: unknown) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const { saleCustomerFlow: ignored, ...rest } = state as Record<string, unknown>
  return rest
}
