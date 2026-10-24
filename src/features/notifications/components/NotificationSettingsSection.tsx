import { BellRing, Clock, Save, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../components/shared'
import { NOTIFICATION_TYPES, useNotificationSettings, useUpdateNotificationSettings, type NotificationSettings, type NotificationType } from '../index'
import { CollectionDeliverySettings } from './CollectionDeliverySettings'
import { WhatsAppIntegration } from '../../whatsapp/WhatsAppIntegration'
import { useAuthStore } from '../../auth/auth.store'

const TYPE_COPY: Record<NotificationType, { label: string; detail: string }> = {
  WHATSAPP_MESSAGE: { label: 'Customer WhatsApp replies', detail: 'Notify when an inbound customer or unlinked message arrives.' },
  KHATA_COLLECTION: { label: 'Khata collections', detail: 'Remind staff on scheduled collection days.' },
  LOW_STOCK: { label: 'Low stock alerts', detail: 'Warn when an item reaches its reorder limit.' },
  PURCHASE_ADDED: { label: 'Purchase added', detail: 'Notify when supplier stock is recorded.' },
  SALES_UP: { label: 'Sales up', detail: 'Notify once daily when sales cross yesterday total.' },
  NO_PAYMENT_TODAY: { label: 'No payment today', detail: 'Remind staff about unpaid customer balances.' },
}

function cloneSettings(settings: NotificationSettings): NotificationSettings {
  return {
    ...settings,
    enabled: { ...settings.enabled },
    lowStockThresholds: settings.lowStockThresholds.map(item => ({ ...item })),
  }
}

export function NotificationSettingsSection() {
  const canManageWhatsApp = useAuthStore(state => ['owner', 'admin'].includes(state.session?.user.role ?? ''))
  const settingsQuery = useNotificationSettings()
  const updateSettings = useUpdateNotificationSettings()
  const [draft, setDraft] = useState<NotificationSettings | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (settingsQuery.data) setDraft(cloneSettings(settingsQuery.data))
  }, [settingsQuery.data])

  function updateEnabled(type: NotificationType, enabled: boolean) {
    setDraft(current => current ? { ...current, enabled: { ...current.enabled, [type]: enabled } } : current)
  }

  function updateThreshold(itemId: string, threshold: number) {
    setDraft(current => current ? {
      ...current,
      lowStockThresholds: current.lowStockThresholds.map(item => item.itemId === itemId ? { ...item, threshold } : item),
    } : current)
  }

  function saveSettings() {
    if (!draft) return
    updateSettings.mutate({
      enabled: draft.enabled,
      noPaymentCutoffTime: draft.noPaymentCutoffTime,
      soundEnabled: draft.soundEnabled,
      muteUntil: draft.muteUntil,
      lowStockThresholds: draft.lowStockThresholds.map(item => ({ itemId: item.itemId, threshold: item.threshold })),
    }, {
      onSuccess: saved => {
        setDraft(cloneSettings(saved))
        setNotice('Notification settings saved.')
        window.setTimeout(() => setNotice(''), 2400)
      },
    })
  }

  if (settingsQuery.isLoading) return <div className="notification-settings-state">Loading notification settings...</div>
  if (settingsQuery.isError) return <div className="notification-settings-state is-error">Notification settings are unavailable. <button type="button" onClick={() => settingsQuery.refetch()}>Retry</button></div>
  if (!draft) return null

  return <div className="notification-settings">
    <CollectionDeliverySettings />
    {canManageWhatsApp && <WhatsAppIntegration />}
    <div className="notification-settings-grid">
      {NOTIFICATION_TYPES.map(type => <div className="notification-setting-toggle" key={type}>
        <span><strong>{TYPE_COPY[type].label}</strong><small>{TYPE_COPY[type].detail}</small></span>
        <button type="button" role="switch" aria-checked={draft.enabled[type]} className={`toggle ${draft.enabled[type] ? 'on' : ''}`} onClick={() => updateEnabled(type, !draft.enabled[type])}><i /></button>
      </div>)}
    </div>

    <div className="notification-settings-row">
      <label><Clock size={15} /><span>No-payment cutoff</span><input type="time" value={draft.noPaymentCutoffTime} onChange={event => setDraft(current => current ? { ...current, noPaymentCutoffTime: event.target.value } : current)} /></label>
      <div className="notification-sound-row"><Volume2 size={15} /><span><strong>Realtime sound</strong><small>Play a quiet sound for new alerts.</small></span><button type="button" role="switch" aria-checked={draft.soundEnabled} className={`toggle ${draft.soundEnabled ? 'on' : ''}`} onClick={() => setDraft(current => current ? { ...current, soundEnabled: !current.soundEnabled } : current)}><i /></button></div>
    </div>

    <div className="notification-thresholds">
      <div className="notification-thresholds-heading"><BellRing size={15} /><strong>Low-stock thresholds</strong></div>
      {draft.lowStockThresholds.map(item => <label key={item.itemId}>
        <span><strong>{item.itemName}</strong><small>{item.stockKg.toLocaleString('en-PK')} kg in stock</small></span>
        <input type="number" min="0" value={item.threshold} onChange={event => updateThreshold(item.itemId, Math.max(Number(event.target.value) || 0, 0))} />
      </label>)}
    </div>

    <div className="notification-settings-actions">
      {notice && <span role="status">{notice}</span>}
      {updateSettings.isError && <span role="alert">Could not save notification settings.</span>}
      <Button variant="primary" onClick={saveSettings} disabled={updateSettings.isPending}><Save size={15} /> {updateSettings.isPending ? 'Saving...' : 'Save notification settings'}</Button>
    </div>
  </div>
}
