import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getNotificationSettings,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationSettings,
} from '../services/notifications.api'
import type { NotificationListFilters, NotificationListResponse, NotificationSettingsUpdate } from '../types'
import { notificationKeys } from '../queryKeys'
export { notificationKeys } from '../queryKeys'

export function useNotifications(filters: NotificationListFilters = {}) {
  const normalizedFilters = {
    unread: filters.unread,
    type: filters.type ?? '',
    page: filters.page ?? 1,
    limit: filters.limit ?? 12,
  }

  return useQuery({
    queryKey: notificationKeys.list(normalizedFilters),
    queryFn: () => getNotifications(normalizedFilters),
    refetchInterval: 30000,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadCount,
    refetchInterval: 30000,
  })
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: getNotificationSettings,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async notificationId => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })
      queryClient.setQueriesData<NotificationListResponse>({ queryKey: notificationKeys.lists() }, current => {
        if (!current) return current
        return {
          ...current,
          data: current.data.map(notification => notification.id === notificationId ? { ...notification, read: true } : notification),
        }
      })
      queryClient.setQueryData<{ count: number }>(notificationKeys.unreadCount(), current => ({ count: Math.max((current?.count ?? 1) - 1, 0) }))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })
      queryClient.setQueriesData<NotificationListResponse>({ queryKey: notificationKeys.lists() }, current => {
        if (!current) return current
        return { ...current, data: current.data.map(notification => ({ ...notification, read: true })) }
      })
      queryClient.setQueryData(notificationKeys.unreadCount(), { count: 0 })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: NotificationSettingsUpdate) => updateNotificationSettings(payload),
    onSuccess: settings => {
      queryClient.setQueryData(notificationKeys.settings(), settings)
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
