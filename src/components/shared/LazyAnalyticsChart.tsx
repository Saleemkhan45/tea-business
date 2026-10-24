import { lazy, Suspense } from 'react'
import type { AnalyticsBarChartProps } from './AnalyticsBarChart'
import { LoadingSpinner } from './LoadingSpinner'

const Chart = lazy(() => import('./AnalyticsBarChart'))

export function LazyAnalyticsChart(props: AnalyticsBarChartProps) {
  return <Suspense fallback={<div className="dashboard-analytics-loading"><LoadingSpinner size="md" label="Loading chart..." showLabel /></div>}><Chart {...props} /></Suspense>
}
