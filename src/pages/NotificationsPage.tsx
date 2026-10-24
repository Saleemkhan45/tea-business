import { Bell, Check, ChevronLeft, ChevronRight, CircleAlert, Filter, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, PageContainer, Panel } from '../components/shared'
import { NOTIFICATION_TYPES, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, type NotificationType } from '../features/notifications'

const TYPE_OPTIONS: Array<{ value: NotificationType | ''; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'PURCHASE_ADDED', label: 'Purchase added' },
  { value: 'SALES_UP', label: 'Sales up' },
  { value: 'NO_PAYMENT_TODAY', label: 'No payment today' },
  { value: 'KHATA_COLLECTION', label: 'Khata collections' },
  { value: 'WHATSAPP_MESSAGE', label: 'WhatsApp messages' },
]

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Karachi',
  }).format(new Date(value))
}

export function NotificationsPage() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState<NotificationType | ''>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const filters = useMemo(() => ({ page, limit: 10, type, unread: unreadOnly }), [page, type, unreadOnly])
  const notificationsQuery = useNotifications(filters)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const notifications = notificationsQuery.data?.data ?? []
  const pagination = notificationsQuery.data?.pagination

  function updateType(value: string) {
    setType(NOTIFICATION_TYPES.includes(value as NotificationType) ? value as NotificationType : '')
    setPage(1)
  }

  return <PageContainer className="notifications-page">
    <div className="page-heading notifications-heading">
      <div><div className="eyebrow"><span className="pulse" /> Operations alerts</div><h1>Notifications</h1><p>Review stock, purchases, sales, and customer payment alerts.</p></div>
      <div className="page-actions">
        <Button onClick={() => notificationsQuery.refetch()} disabled={notificationsQuery.isFetching}><RefreshCw size={15} /> Refresh</Button>
        <Button variant="primary" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || notifications.length === 0}><Check size={15} /> Mark all read</Button>
      </div>
    </div>

    <Panel className="notifications-list-panel">
      <div className="notifications-filter-bar">
        <label><Filter size={15} /><select value={type} onChange={event => updateType(event.target.value)} aria-label="Filter notifications by type">{TYPE_OPTIONS.map(option => <option value={option.value} key={option.value || 'all'}>{option.label}</option>)}</select></label>
        <button type="button" className={unreadOnly ? 'active' : ''} aria-pressed={unreadOnly} onClick={() => { setUnreadOnly(current => !current); setPage(1) }}>Unread only</button>
      </div>

      {notificationsQuery.isLoading && <div className="notifications-state"><RefreshCw className="spin" size={18} /><strong>Loading notifications</strong></div>}
      {notificationsQuery.isError && <div className="notifications-state"><CircleAlert size={18} /><strong>Notifications unavailable</strong><button type="button" onClick={() => notificationsQuery.refetch()}>Retry</button></div>}
      {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 && <div className="notifications-state"><Bell size={18} /><strong>No notifications found</strong><span>Change filters or wait for new server alerts.</span></div>}

      <div className="notifications-page-list">
        {notifications.map(notification => <article className={`notifications-page-row severity-${notification.severity} ${notification.read ? 'is-read' : 'is-unread'}`} key={notification.id}>
          <span className="notifications-page-icon" aria-hidden="true" />
          <div>
            <div className="notifications-page-row-title"><strong>{notification.title}</strong>{!notification.read && <span>Unread</span>}</div>
            <p>{notification.message}</p>
            {notification.type === 'KHATA_COLLECTION' && <Link to={`/customers/${notification.entityId}`}>View customer / Receive payment</Link>}
            <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
          </div>
          <button type="button" disabled={notification.read || markRead.isPending} onClick={() => markRead.mutate(notification.id)}>{notification.read ? 'Read' : 'Mark read'}</button>
        </article>)}
      </div>

      {pagination && <div className="notifications-pagination">
        <span>Page {pagination.page} of {pagination.pages} • {pagination.total} total</span>
        <div>
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} aria-label="Previous notifications page"><ChevronLeft size={16} /></button>
          <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPage(current => current + 1)} aria-label="Next notifications page"><ChevronRight size={16} /></button>
        </div>
      </div>}
    </Panel>
  </PageContainer>
}
