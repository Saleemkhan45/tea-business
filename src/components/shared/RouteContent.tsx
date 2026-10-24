import { Component, Suspense, type ReactNode } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

export function RouteLoading() {
  return <div className="state-block route-loading"><LoadingSpinner size="lg" label="Loading page..." showLabel /></div>
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="state-block" role="alert"><strong>This page could not be loaded.</strong><p>Check your connection, then reload to download the current application.</p><button type="button" className="ui-button" onClick={() => window.location.reload()}>Reload page</button></div>
    return this.props.children
  }
}

export function RouteContent({ children }: { children: ReactNode }) {
  return <RouteErrorBoundary><Suspense fallback={<RouteLoading />}>{children}</Suspense></RouteErrorBoundary>
}
