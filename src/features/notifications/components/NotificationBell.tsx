import { Bell, Check, CheckCheck, CircleAlert, ExternalLink, MessageCircle, PackagePlus, PackageX, RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from '../hooks/useNotifications'
import { useNotificationSocket } from '../context/NotificationSocketContext'
import type { AppNotification, NotificationType } from '../types'

type NotificationTab = 'all' | 'unread'

const TYPE_LABELS: Record<NotificationType, string> = {
  WHATSAPP_MESSAGE: 'WhatsApp reply',
  KHATA_COLLECTION: 'Khata collection',
  LOW_STOCK: 'Stock',
  PURCHASE_ADDED: 'Purchase',
  SALES_UP: 'Sales',
  NO_PAYMENT_TODAY: 'Payment',
}

function formatRelativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (elapsedSeconds < 60) return 'just now'
  const elapsedMinutes = Math.round(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`
  const elapsedHours = Math.round(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} hr ago`
  const elapsedDays = Math.round(elapsedHours / 24)
  return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`
}

function getBucket(value: string) {
  const date = new Date(value)
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)
  if (date >= startToday) return 'Today'
  if (date >= startYesterday) return 'Yesterday'
  return 'Earlier'
}

function groupNotifications(notifications: AppNotification[]) {
  return notifications.reduce<Record<string, AppNotification[]>>((groups, notification) => {
    const bucket = getBucket(notification.createdAt)
    return { ...groups, [bucket]: [...(groups[bucket] ?? []), notification] }
  }, {})
}

function getIcon(type: NotificationType) {
  if (type === 'LOW_STOCK') return <PackageX size={16} />
  if (type === 'PURCHASE_ADDED') return <ShoppingCart size={16} />
  if (type === 'SALES_UP') return <TrendingUp size={16} />
  return <MessageCircle size={16} />
}

function formatPkr(value?: number) {
  return `PKR ${Number(value ?? 0).toLocaleString('en-PK')}`
}

function buildWhatsAppUrl(notification: AppNotification) {
  if (notification.meta.whatsAppUrl) return notification.meta.whatsAppUrl
  const text = `${notification.meta.customerName ?? 'Customer'} has not paid today. Balance due ${formatPkr(notification.meta.balanceDue)}.`
  const phone = String(notification.meta.phone ?? '').replace(/\D/g, '')
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NotificationTab>('all')
  const wrapRef = useRef<HTMLDivElement>(null)
  const { hasNewNotification } = useNotificationSocket()
  const unreadCountQuery = useUnreadCount()
  const notificationsQuery = useNotifications({ unread: tab === 'unread', limit: 8 })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const unreadCount = unreadCountQuery.data?.count ?? 0
  const badge = unreadCount > 9 ? '9+' : String(unreadCount)
  const grouped = useMemo(() => groupNotifications(notificationsQuery.data?.data ?? []), [notificationsQuery.data?.data])

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return <div className="notification-bell-wrap" ref={wrapRef}>
    <button
      type="button"
      className={`icon-button notification-bell ${open ? 'is-active' : ''} ${hasNewNotification ? 'has-new' : ''}`}
      title="Notifications"
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="notification-panel"
      onClick={() => setOpen(current => !current)}
    >
      <Bell size={18} />
      <span className="sr-only">Notifications</span>
      {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{badge}</span>}
    </button>

    {open && <section id="notification-panel" className="notification-panel" role="dialog" aria-label="Notifications">
      <div className="notification-panel-heading">
        <div>
          <strong>Notifications</strong>
          <span>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</span>
        </div>
        <button type="button" className="notification-text-button" disabled={unreadCount === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
          <CheckCheck size={14} /> Mark all
        </button>
      </div>

      <div className="notification-tabs" role="tablist" aria-label="Notification filters">
        <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All</button>
        <button type="button" role="tab" aria-selected={tab === 'unread'} className={tab === 'unread' ? 'active' : ''} onClick={() => setTab('unread')}>Unread</button>
      </div>

      {notificationsQuery.isLoading && <NotificationPanelState icon={<RefreshCw size={16} className="spin" />} title="Loading notifications" />}
      {notificationsQuery.isError && <NotificationPanelState icon={<CircleAlert size={16} />} title="Notifications unavailable" action={<button type="button" onClick={() => notificationsQuery.refetch()}>Retry</button>} />}
      {!notificationsQuery.isLoading && !notificationsQuery.isError && notificationsQuery.data?.data.length === 0 && <NotificationPanelState icon={<Check size={16} />} title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'} />}

      {!notificationsQuery.isLoading && !notificationsQuery.isError && <div className="notification-groups">
        {(['Today', 'Yesterday', 'Earlier'] as const).map(bucket => grouped[bucket]?.length ? <div className="notification-group" key={bucket}>
          <span className="notification-group-label">{bucket}</span>
          {grouped[bucket].map(notification => <NotificationRow
            key={notification.id}
            notification={notification}
            onClose={() => setOpen(false)}
            onMarkRead={() => markRead.mutate(notification.id)}
            markingRead={markRead.isPending}
          />)}
        </div> : null)}
      </div>}

      <div className="notification-panel-footer">
        <Link to={ROUTES.notifications} onClick={() => setOpen(false)}>View all <ExternalLink size={13} /></Link>
      </div>
    </section>}
  </div>
}

function NotificationPanelState({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return <div className="notification-panel-state">{icon}<span>{title}</span>{action}</div>
}

function NotificationRow({ notification, onClose, onMarkRead, markingRead }: { notification: AppNotification; onClose: () => void; onMarkRead: () => void; markingRead: boolean }) {
  return <article className={`notification-row severity-${notification.severity} ${notification.read ? 'is-read' : 'is-unread'}`}>
    <span className="notification-row-icon" aria-hidden="true">{getIcon(notification.type)}</span>
    <div className="notification-row-body">
      <div className="notification-row-title">
        <strong>{notification.title}</strong>
        {!notification.read && <span className="unread-dot" aria-label="Unread notification" />}
      </div>
      <p>{notification.message}</p>
      <div className="notification-row-meta">
        <span>{TYPE_LABELS[notification.type]}</span>
        <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
      </div>
      <div className="notification-row-actions">
        {notification.type === 'KHATA_COLLECTION' && <Link to={`/customers/${notification.entityId}`} onClick={onClose}>View customer / Receive payment</Link>}
        {notification.type === 'LOW_STOCK' && <Link to={`${ROUTES.purchases}?restock=${notification.entityId}`} onClick={onClose}><PackagePlus size={13} /> Restock</Link>}
        {notification.type === 'NO_PAYMENT_TODAY' && <>
          <a href={buildWhatsAppUrl(notification)} target="_blank" rel="noreferrer"><MessageCircle size={13} /> Send WhatsApp</a>
          <Link to={`${ROUTES.sales}?customer=${encodeURIComponent(notification.meta.customerName ?? '')}`} onClick={onClose}>View customer</Link>
        </>}
        {notification.type === 'SALES_UP' && <Link to={ROUTES.reports} onClick={onClose}><TrendingUp size={13} /> View report</Link>}
        {notification.type === 'PURCHASE_ADDED' && <Link to={ROUTES.purchases} onClick={onClose}><ShoppingCart size={13} /> View purchase</Link>}
        {!notification.read && <button type="button" disabled={markingRead} onClick={onMarkRead}><Check size={13} /> Mark read</button>}
      </div>
    </div>
  </article>
}
