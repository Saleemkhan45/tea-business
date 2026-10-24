import { useQuery } from '@tanstack/react-query'
import { Button, StateBlock } from '../../components/shared'
import { whatsappRequest, chatTime } from './api'
import './whatsapp.css'
type Setup = { assigned: boolean; enabled: boolean; configured: boolean; mode: string; senderNumber: string; businessId: string; phoneId: string; template: string; language: string; version: string; signingConfigured: boolean; lastVerifiedWebhookAt: string | null; lastInboundAt: string | null; lastDeliveryAt: string | null; retentionDays: number }
export function WhatsAppIntegration() {
  const query = useQuery({ queryKey: ['whatsapp', 'integration'], queryFn: () => whatsappRequest<Setup>('/integration'), retry: false })
  return <section className="wa-card" id="whatsapp-integration" aria-label="WhatsApp Integration"><h2>WhatsApp Integration</h2>
    <p>Official Meta Cloud API. Credentials are managed only in the backend deployment secrets.</p>
    {query.isPending ? <p>Checking configuration…</p> : query.isError ? <StateBlock variant="error" title="Integration status unavailable" message={query.error.message} action={<Button onClick={() => void query.refetch()}>Retry</Button>} /> : <>
      <p><strong>{!query.data.assigned ? 'Sender not assigned to this shop' : !query.data.configured ? 'Meta setup incomplete' : query.data.lastVerifiedWebhookAt ? 'Configured · signed webhook observed' : 'Configured · webhook not yet verified'}</strong> · {query.data.enabled ? 'Customer messaging enabled' : 'Customer messaging disabled'} · {query.data.mode}</p>
      <dl className="wa-setup-grid"><div><dt>Business sender number</dt><dd>{query.data.senderNumber || 'Not configured'}</dd></div><div><dt>WhatsApp Business Account ID</dt><dd>{query.data.businessId || 'Not configured'}</dd></div><div><dt>Phone Number ID</dt><dd>{query.data.phoneId || 'Not configured'}</dd></div><div><dt>Approved customer template</dt><dd>{query.data.template || 'Not configured'} · {query.data.language}</dd></div><div><dt>Cloud API version</dt><dd>{query.data.version || 'Not configured'}</dd></div><div><dt>Webhook signing / verification secrets</dt><dd>{query.data.signingConfigured ? 'Configured on server' : 'Setup required'}</dd></div><div><dt>Last verified signed webhook</dt><dd>{query.data.lastVerifiedWebhookAt ? chatTime(query.data.lastVerifiedWebhookAt) : 'Not observed'}</dd></div><div><dt>Last delivery callback</dt><dd>{query.data.lastDeliveryAt ? chatTime(query.data.lastDeliveryAt) : 'Not observed'}</dd></div></dl>
      <p>Message content retention: {query.data.retentionDays} days. Status and idempotency metadata are retained for audit.</p>
    </>}
    <p>Registration, approved templates, sender eligibility and any migration/coexistence requirements must be reviewed in Meta. An existing personal WhatsApp account is not automatically usable here. Configuration is shown read-only; tokens are never entered into this page.</p>
  </section>
}
