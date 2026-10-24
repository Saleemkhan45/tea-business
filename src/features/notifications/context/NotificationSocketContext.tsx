import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { X } from 'lucide-react'
import { getNotificationSocketUrl } from '../services/notifications.api'
import type { AppNotification } from '../types'
import { notificationKeys } from '../queryKeys'
import { useAuthStore } from '../../auth/auth.store'
import '../notifications.css'

type NotificationToast = {
  id: string
  title: string
  message: string
  severity: AppNotification['severity']
}

type NotificationSocketContextValue = {
  connected: boolean
  hasNewNotification: boolean
  toasts: NotificationToast[]
  dismissToast: (id: string) => void
}

const NotificationSocketContext = createContext<NotificationSocketContextValue | null>(null)

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

function playNotificationTone() {
  try {
    const AudioContextCtor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext
    if (!AudioContextCtor) return
    const context = new AudioContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 740
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.24)
  } catch {
    // Browsers can block audio before user interaction; notifications still work.
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const trustedViewing = useAuthStore(state => state.session?.accessMode === 'trusted-view')
  const socketRef = useRef<Socket | null>(null)
  const toastTimers = useRef(new Map<string, number>())
  const pulseTimer = useRef<number | null>(null)
  const [connected, setConnected] = useState(false)
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const [toasts, setToasts] = useState<NotificationToast[]>([])

  function dismissToast(id: string) {
    const timer = toastTimers.current.get(id)
    if (timer) window.clearTimeout(timer)
    toastTimers.current.delete(id)
    setToasts(current => current.filter(toast => toast.id !== id))
  }

  useEffect(() => {
    if (trustedViewing) return
    const socket = io(getNotificationSocketUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('notification:new', (notification: AppNotification) => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all })
        setHasNewNotification(true)
        if (pulseTimer.current) window.clearTimeout(pulseTimer.current)
        pulseTimer.current = window.setTimeout(() => setHasNewNotification(false), 1800)

        const toast = {
          id: `${notification.id}-${Date.now()}`,
          title: notification.title,
          message: notification.message,
          severity: notification.severity,
        }
        setToasts(current => [toast, ...current].slice(0, 3))
        toastTimers.current.set(toast.id, window.setTimeout(() => dismissToast(toast.id), 5200))

        const cachedSettings = queryClient.getQueryData<{ soundEnabled?: boolean }>(notificationKeys.settings())
        if (cachedSettings?.soundEnabled) playNotificationTone()
    })

    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current)
      toastTimers.current.forEach(timer => window.clearTimeout(timer))
      toastTimers.current.clear()
    }
  }, [queryClient, trustedViewing])

  const value = useMemo(() => ({ connected, hasNewNotification, toasts, dismissToast }), [connected, hasNewNotification, toasts])

  return <NotificationSocketContext.Provider value={value}>
    {children}
    <div className="notification-live-region sr-only" aria-live="polite" aria-atomic="true">{toasts[0] ? `${toasts[0].title}. ${toasts[0].message}` : ''}</div>
    <div className="notification-toast-stack" aria-hidden={toasts.length === 0}>
      {toasts.map(toast => <div className={`notification-toast severity-${toast.severity}`} key={toast.id}>
        <span aria-hidden="true" />
        <div><strong>{toast.title}</strong><p>{toast.message}</p></div>
        <button type="button" aria-label="Dismiss notification toast" onClick={() => dismissToast(toast.id)}><X size={14} /></button>
      </div>)}
    </div>
  </NotificationSocketContext.Provider>
}

export function useNotificationSocket() {
  const value = useContext(NotificationSocketContext)
  if (!value) return { connected: false, hasNewNotification: false, toasts: [], dismissToast: () => undefined }
  return value
}
