export const NOTIFICATION_TYPES = ['LOW_STOCK', 'PURCHASE_ADDED', 'SALES_UP', 'NO_PAYMENT_TODAY', 'KHATA_COLLECTION', 'WHATSAPP_MESSAGE'] as const
export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'danger'] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number]

export type NotificationMeta = {
  itemName?: string
  stockKg?: number
  thresholdKg?: number
  supplierName?: string
  quantityKg?: number
  totalAmount?: number
  customerName?: string
  phone?: string
  balanceDue?: number
  idleDays?: number | null
  whatsAppUrl?: string
  todayTotal?: number
  yesterdayTotal?: number
  increasePercent?: number
  businessDate?: string
}

export type AppNotification = {
  id: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  entityType: string
  entityId: string
  meta: NotificationMeta
  dedupeKey: string
  createdAt: string
  read: boolean
}

export type NotificationListFilters = {
  unread?: boolean
  type?: NotificationType | ''
  page?: number
  limit?: number
}

export type NotificationListResponse = {
  data: AppNotification[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export type NotificationSettings = {
  enabled: Record<NotificationType, boolean>
  lowStockThresholds: Array<{
    itemId: string
    itemName: string
    stockKg: number
    threshold: number
  }>
  noPaymentCutoffTime: string
  muteUntil: string | null
  soundEnabled: boolean
}

export type NotificationSettingsUpdate = {
  enabled?: Partial<Record<NotificationType, boolean>>
  lowStockThresholds?: Array<{ itemId: string; threshold: number }>
  noPaymentCutoffTime?: string
  muteUntil?: string | null
  soundEnabled?: boolean
}
