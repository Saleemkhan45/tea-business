export type ActionRequest = { method: string; path: string; payload: unknown; signal?: AbortSignal }
type Handler = (request: ActionRequest) => Promise<string>
let handler: Handler | undefined
export function installApprovalHandler(value: Handler) { handler = value; return () => { if (handler === value) handler = undefined } }
export function requestActionApproval(request: ActionRequest) {
  if (!handler) return Promise.reject(new Error('Authorization dialog is not available. Reload and retry.'))
  return handler(request)
}
