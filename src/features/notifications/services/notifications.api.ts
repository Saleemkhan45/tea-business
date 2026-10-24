import type { AppNotification, NotificationListFilters, NotificationListResponse, NotificationSettings, NotificationSettingsUpdate } from '../types'
import { API_BASE_URL, authenticatedFetch } from '../../auth/auth.api'


export class NotificationApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function getNotificationSocketUrl() {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, '')
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    let message = 'Notification request failed.'
    try {
      const payload = await response.json() as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      message = response.statusText || message
    }
    throw new NotificationApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export function getNotifications(filters: NotificationListFilters = {}) {
  const params = new URLSearchParams()
  if (filters.unread) params.set('unread', 'true')
  if (filters.type) params.set('type', filters.type)
  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 12))
  return request<NotificationListResponse>(`/notifications?${params.toString()}`)
}

export function getUnreadCount() {
  return request<{ count: number }>('/notifications/unread-count')
}

export function markNotificationRead(notificationId: string) {
  return request<{ ok: true }>(`/notifications/${notificationId}/read`, { method: 'PATCH' })
}

export function markAllNotificationsRead() {
  return request<{ ok: true; marked: number }>('/notifications/read-all', { method: 'PATCH' })
}

export function getNotificationSettings() {
  return request<NotificationSettings>('/notifications/settings')
}

export function updateNotificationSettings(payload: NotificationSettingsUpdate) {
  return request<NotificationSettings>('/notifications/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function toNotificationListItem(notification: AppNotification): AppNotification {
  return notification
}
