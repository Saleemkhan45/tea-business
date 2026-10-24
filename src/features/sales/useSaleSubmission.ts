import { useRef, useSyncExternalStore } from 'react'
import { createSaleSubmission } from './saleSubmission'
import { useCreateSale } from './useSales'

export function useSaleSubmission() {
  const mutation = useCreateSale()
  const sendRef = useRef(mutation.mutateAsync)
  sendRef.current = mutation.mutateAsync
  const submissionRef = useRef<ReturnType<typeof createSaleSubmission> | null>(null)
  submissionRef.current ??= createSaleSubmission(input => sendRef.current(input))
  const submission = submissionRef.current
  const state = useSyncExternalStore(submission.subscribe, submission.getSnapshot, submission.getSnapshot)
  return { ...state, submit: submission.submit, reset: submission.reset }
}
