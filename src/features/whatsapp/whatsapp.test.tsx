import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CustomerWhatsAppCard } from './CustomerWhatsAppCard'
import { WhatsAppIntegration } from './WhatsAppIntegration'
import { whatsappRequest } from './api'
const auth = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../auth/auth.api', () => ({ API_BASE_URL: '/api/v1', authenticatedFetch: auth.fetch }))
function render(element: React.ReactNode, client: QueryClient, route = '/') {
  return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}>{element}</MemoryRouter></QueryClientProvider>)
}
describe('customer WhatsApp UI offline', () => {
  it('keeps the existing phone distinct from customer reminder consent', () => {
    const client = new QueryClient()
    client.setQueryData(['whatsapp', 'contact', 'customer'], { existingPhone: '03001234567', phone: '', optedIn: false, revision: 0 })
    const html = render(<CustomerWhatsAppCard customerId="customer" />, client)
    expect(html).toContain('03001234567'); expect(html).toContain('not consent')
    expect(html).toContain('Consent source / evidence'); expect(html).toContain('type="tel"')
    expect(html).not.toContain('checked=""')
    expect(html).not.toContain('Open WhatsApp Inbox')
    expect(html).not.toContain('/customers/whatsapp')
  })
  it('renders deployment configuration without access-token inputs or false connection claims', () => {
    const client = new QueryClient()
    client.setQueryData(['whatsapp', 'integration'], { assigned: false, enabled: false, mode: 'dry_run', retentionDays: 90 })
    const html = render(<WhatsAppIntegration />, client)
    expect(html).toContain('Sender not assigned'); expect(html).toContain('backend deployment secrets')
    expect(html).not.toContain('type="password"')
  })
  it('uses the existing authenticated helper for preserved contact settings', async () => {
    auth.fetch.mockResolvedValueOnce(new Response('{"revision":1}', { status: 200 }))
    await whatsappRequest('/customers/id', 'PUT', { phone: '+923001234567', optedIn: false, revision: 0 })
    expect(auth.fetch).toHaveBeenCalledWith('/api/v1/whatsapp/customers/id', expect.objectContaining({ method: 'PUT', body: '{"phone":"+923001234567","optedIn":false,"revision":0}' }))
  })
})
