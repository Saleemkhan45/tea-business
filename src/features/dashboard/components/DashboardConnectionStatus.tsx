import type { UseQueryResult } from '@tanstack/react-query'
import { Button, LoadingSpinner } from '../../../components/shared'
import { useAuthStore } from '../../auth/auth.store'

type Props = { query: Pick<UseQueryResult<unknown>, 'data' | 'isFetching' | 'isError' | 'error' | 'dataUpdatedAt' | 'failureCount'>; onRetry: () => void }
export function DashboardConnectionStatus({ query, onRetry }: Props) {
  const provisional = useAuthStore(state => state.sessionNeedsValidation)
  const checking = useAuthStore(state => state.sessionCheckPending)
  const hasData = query.data !== undefined
  const pending = query.isFetching || checking
  const interrupted = query.isError || query.failureCount > 0 || provisional
  const timestamp = query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }) : ''
  return <div className={`dashboard-connection-status${interrupted ? ' is-interrupted' : ''}`} role={interrupted && !pending ? 'alert' : 'status'}>
    {pending && <LoadingSpinner size="sm" decorative />}
    <div>
      {pending ? <span>{interrupted || hasData ? 'Reconnecting to Tea Business server...' : 'Loading dashboard figures...'}</span> : interrupted ? <span>{query.error instanceof Error ? query.error.message : 'Connection could not be confirmed. Please retry.'}</span> : null}
      {hasData ? <span>{pending || interrupted ? 'Previously loaded data. ' : ''}Last confirmed {timestamp || 'time unavailable'} (Karachi).</span> : interrupted && <span>No confirmed dashboard figures are available.</span>}
    </div>
    {interrupted && <Button onClick={onRetry} disabled={pending}>Retry</Button>}
  </div>
}
