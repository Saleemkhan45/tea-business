import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, StateBlock } from '../../components/shared'
import { getPakistanBusinessDate } from '../../business/utils/date'
import { collectionRequest, type Schedule } from './collections.api'
import './collections.css'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export function CollectionScheduleCard({ customerId }: { customerId: string }) {
  const query = useQuery({ queryKey: ['collections', 'schedule', customerId],
    queryFn: () => collectionRequest<{ schedule: Schedule | null; nextCollectionDate: string | null }>(`/${customerId}/schedule`) })
  if (query.isPending) return <StateBlock variant="loading" title="Loading collection schedule" message="Fetching saved weekly settings." />
  if (query.isError) return <StateBlock variant="error" title="Schedule unavailable" message={query.error.message} action={<Button onClick={() => void query.refetch()}>Retry</Button>} />
  return <ScheduleEditor key={`${customerId}:${query.data.schedule?.revision ?? 0}`} customerId={customerId} schedule={query.data.schedule} nextDate={query.data.nextCollectionDate} />
}

function ScheduleEditor({ customerId, schedule, nextDate }: { customerId: string; schedule: Schedule | null; nextDate: string | null }) {
  const client = useQueryClient()
  const [editing, setEditing] = useState(!schedule)
  const [draft, setDraft] = useState<Schedule>(schedule ?? { weekdays: [], expectedAmount: 0, time: '',
    startDate: getPakistanBusinessDate(), endDate: '', notes: '', status: 'active', revision: 0, frequency: 'weekly', channels: ['in_app'] })
  const [notice, setNotice] = useState('')
  const mutation = useMutation({ mutationFn: (value: Schedule) => collectionRequest(`/${customerId}/schedule`, value),
    onSuccess: async () => { setEditing(false); setNotice('Schedule saved. Existing due collections retain their original details.'); await client.invalidateQueries({ queryKey: ['collections'] }) } })
  function save(event: FormEvent) { event.preventDefault(); mutation.mutate(draft) }
  return <section className="collection-card" aria-label="Khata Collection Schedule">
    <div className="collection-heading"><div><h2>Khata Collection Schedule</h2><p>{schedule?.frequency === 'one_time' ? 'One-time' : 'Weekly'} · Asia/Karachi · {schedule?.status ?? 'Not configured'}</p></div>
      {!editing && <Button onClick={() => setEditing(true)}>Edit Schedule</Button>}</div>
    {notice && <p role="status">{notice}</p>}
    {!editing && <><p>{schedule?.frequency === 'one_time' ? schedule.startDate : schedule?.weekdays.map(day => DAYS[day]).join(', ')} · Expected PKR {schedule?.expectedAmount.toLocaleString('en-PK')}</p>
      <p>Next collection: {nextDate ?? 'No upcoming collection'}{schedule?.time ? ` at ${schedule.time}` : ''}</p>
      <p>{schedule?.notes}</p><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ ...draft, status: draft.status === 'active' ? 'paused' : 'active' })}>{draft.status === 'active' ? 'Pause' : 'Resume'}</Button></>}
    {editing && <form className="collection-form" onSubmit={save}>
      <label>Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Schedule['status'] })}><option value="active">Enabled / Active</option><option value="paused">Paused</option><option value="disabled">Disabled</option></select></label>
      {(draft.frequency ?? 'weekly') === 'weekly' && <fieldset><legend>Collection days (weekly)</legend><div className="collection-weekdays">{DAYS.map((day, index) => <label key={day}><input type="checkbox" checked={draft.weekdays.includes(index)} onChange={e => setDraft({ ...draft, weekdays: e.target.checked ? [...draft.weekdays, index].sort() : draft.weekdays.filter(value => value !== index) })} />{day}</label>)}</div></fieldset>}
      <label>Schedule frequency<select value={draft.frequency ?? 'weekly'} onChange={e => setDraft({ ...draft, frequency: e.target.value as Schedule['frequency'] })}><option value="weekly">Weekly</option><option value="one_time">One-time (start date)</option></select></label>
      <fieldset><legend>Notification channels</legend><div className="collection-weekdays">{(['in_app', 'push', 'whatsapp', 'customer_whatsapp'] as const).map(channel => <label key={channel}><input type="checkbox" checked={(draft.channels ?? ['in_app']).includes(channel)} onChange={e => { const channels = draft.channels ?? ['in_app']; setDraft({ ...draft, channels: e.target.checked ? [...channels, channel] : channels.filter(value => value !== channel) }) }} />{channel === 'in_app' ? 'Dashboard' : channel === 'push' ? 'Phone push' : channel === 'whatsapp' ? 'WhatsApp (operator)' : 'Send Collection Reminder to Customer via WhatsApp'}</label>)}</div><p>External channels also require authorized setup in Settings. Selecting a channel does not activate sending.</p></fieldset>
      <label>Expected Collection Amount (PKR)<input required type="number" min="1" step="1" value={draft.expectedAmount || ''} onChange={e => setDraft({ ...draft, expectedAmount: Number(e.target.value) })} /></label>
      <label>Collection time (optional)<input type="time" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></label>
      <label>Schedule start date<input required type="date" value={draft.startDate} min={!schedule ? getPakistanBusinessDate() : undefined} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label>
      <label>End date (optional)<input type="date" min={draft.startDate} value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} /></label>
      <label>Reminder notes<textarea maxLength={500} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
      <div className="collection-actions"><Button type="submit" disabled={mutation.isPending || ((draft.frequency ?? 'weekly') === 'weekly' && !draft.weekdays.length) || !(draft.channels ?? ['in_app']).length}>{mutation.isPending ? 'Saving…' : 'Save Schedule'}</Button>{schedule && <Button type="button" disabled={mutation.isPending} onClick={() => { setDraft(schedule); setEditing(false) }}>Cancel</Button>}</div>
    </form>}
    {mutation.isError && <p role="alert">{mutation.error.message} Reload the schedule if another operator changed it.</p>}
  </section>
}
