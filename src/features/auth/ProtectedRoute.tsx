import { Navigate, Outlet } from 'react-router-dom'
import { Button, LoadingSpinner, StateBlock } from '../../components/shared'
import { restoreSession, logout } from './auth.api'
import { useAuthStore } from './auth.store'
import './connection.css'

export function ProtectedRoute() {
  const { status, error, session, sessionCheckPending } = useAuthStore()
  if (status === 'loading') return <div className="auth-session-state"><StateBlock variant="loading" title="Checking session" message="Please wait." /></div>
  if (status === 'error') return <div className="auth-session-state"><StateBlock variant={sessionCheckPending ? 'loading' : 'error'} title={sessionCheckPending ? 'Reconnecting to Tea Business server...' : 'Unable to check session'} message={error} action={<Button disabled={sessionCheckPending} onClick={() => void restoreSession()}>Retry</Button>} /></div>
  return status === 'authenticated' ? <>{error && <div className="auth-connection-banner" role="status">{sessionCheckPending && <LoadingSpinner size="sm" decorative />}<span>{sessionCheckPending ? 'Reconnecting to Tea Business server...' : error} Unsaved entries remain on this page.</span><Button disabled={sessionCheckPending} onClick={() => void restoreSession()}>Retry connection</Button></div>}{session?.accessMode === 'trusted-view' && <div className="trusted-view-banner">Trusted shop viewing. Changes require an individual operator’s password. <Button onClick={() => void logout()}>Sign in individually</Button></div>}<Outlet /></> : <Navigate to="/login" replace />
}
