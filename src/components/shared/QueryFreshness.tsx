import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from './Button'
import { LoadingSpinner } from './LoadingSpinner'

type Props = {
  query: Pick<UseQueryResult<unknown>, 'data' | 'isFetching' | 'isError' | 'dataUpdatedAt'>
  label?: string
  onRetry?: () => void
}

export function QueryFreshness({ query, label = 'data', onRetry }: Props) {
  if (query.data === undefined) return null
  const updated = query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : null
  return <div className={`query-freshness${query.isError ? ' is-stale' : ''}`} role={query.isError ? 'alert' : 'status'}>
    {query.isFetching && <LoadingSpinner size="sm" decorative />}
    <span>{query.isError ? `Refresh failed. Previously confirmed ${label} may be outdated` : query.isFetching ? `Refreshing ${label}... Showing confirmed values` : 'Last confirmed'}{updated ? ` ${updated} (Karachi).` : '.'}</span>
    {query.isError && onRetry && <Button loading={query.isFetching} onClick={onRetry}>Retry</Button>}
  </div>
}
