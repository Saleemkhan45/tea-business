import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, StateBlock } from '../../components/shared'
import { whatsappRequest, chatTime, type Contact } from './api'
import './whatsapp.css'
export function CustomerWhatsAppCard({ customerId }: { customerId: string }) {
  const query = useQuery({ queryKey: ['whatsapp', 'contact', customerId], queryFn: () => whatsappRequest<Contact>(`/customers/${customerId}`) })
  if (query.isPending) return <StateBlock variant="loading" title="Loading WhatsApp contact" message="Checking saved contact and consent." />
  if (query.isError) return <StateBlock variant="error" title="WhatsApp contact unavailable" message={query.error.message} action={<Button onClick={() => void query.refetch()}>Retry</Button>} />
  return <ContactEditor key={`${customerId}:${query.data.revision}`} customerId={customerId} contact={query.data} />
}
function ContactEditor({ customerId, contact }: { customerId: string; contact: Contact }) {
  const [phone, setPhone] = useState(contact.phone)
  const [optedIn, setOptedIn] = useState(contact.optedIn)
  const [source, setSource] = useState('')
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: () => whatsappRequest(`/customers/${customerId}`, 'PUT', { phone, optedIn, consentSource: source, revision: contact.revision }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['whatsapp'] }) })
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate() }
  return <section className="wa-card" aria-label="Customer WhatsApp Contact"><h2>Customer WhatsApp</h2>
    <p>Existing customer phone: <strong>{contact.existingPhone || 'Not recorded'}</strong></p>
    <p>Reminder consent: <strong>{contact.optedIn ? 'Opted in' : 'Not enabled'}</strong>{contact.consentAt && ` · Recorded ${chatTime(contact.consentAt)}`}</p>
    <form className="wa-contact-form" onSubmit={submit}><label>Customer WhatsApp number<input type="tel" required maxLength={40} placeholder="0300 1234567 or +923001234567" value={phone} onChange={e => setPhone(e.target.value)} /></label>
      <label className="wa-checkbox"><input type="checkbox" checked={optedIn} onChange={e => setOptedIn(e.target.checked)} />Customer explicitly opted in to WhatsApp collection reminders</label>
      <label>Consent source / evidence<input maxLength={300} required={optedIn} value={source} onChange={e => setSource(e.target.value)} placeholder="For example: verbal consent received in person on the stated date" /></label>
      <p>A saved phone number is not consent. Record renewed consent when changing or re-enabling a number. Untick the box and save to disable customer reminders.</p>
      <div className="wa-actions"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save WhatsApp contact'}</Button></div>
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
    </form>
  </section>
}
