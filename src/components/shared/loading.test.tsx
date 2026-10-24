import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoadingSpinner } from './LoadingSpinner'
import { Button } from './Button'
import { QueryFreshness } from './QueryFreshness'

describe('shared TailChase loading states', () => {
  it.each([['sm', 20], ['md', 28], ['lg', 40]] as const)('renders the React TailChase at %s size with an accessible label', (size, pixels) => {
    const html = renderToStaticMarkup(<LoadingSpinner size={size} label="Loading business data..." showLabel />)
    expect(html).toContain(`--uib-size:${pixels}px`)
    expect(html).toContain('--uib-speed:1.75s')
    expect(html).toContain('--uib-color:currentColor')
    expect(html).toContain('role="status"'); expect(html).toContain('Loading business data...')
    expect(html).not.toContain('<l-')
  })
  it('disables a pending button, retains its name, and removes the spinner when finished', () => {
    const pending = renderToStaticMarkup(<Button loading>Save Daily Record</Button>)
    expect(pending).toContain('disabled'); expect(pending).toContain('aria-busy="true"')
    expect(pending).toContain('Save Daily Record'); expect(pending).toContain('--uib-size:20px')
    expect(pending).not.toContain('role="status"') // The form already announces its busy state.
    const done = renderToStaticMarkup(<Button>Save Daily Record</Button>)
    expect(done).not.toContain('loading-spinner'); expect(done).not.toContain('disabled')
  })
  it('does not fabricate a timestamp before data loads and labels both background refresh and stale data', () => {
    const base = { data: undefined, isFetching: true, isError: false, dataUpdatedAt: 0 }
    expect(renderToStaticMarkup(<QueryFreshness query={base} />)).toBe('')
    const query = { ...base, data: { total: 10000 }, dataUpdatedAt: Date.parse('2026-10-22T10:00:00Z') }
    const refreshing = renderToStaticMarkup(<QueryFreshness query={query} label="cash history" />)
    expect(refreshing).toContain('Showing confirmed values'); expect(refreshing).toContain('Karachi')
    const failed = renderToStaticMarkup(<QueryFreshness query={{ ...query, isFetching: false, isError: true }} onRetry={() => {}} />)
    expect(failed).toContain('may be outdated'); expect(failed).toContain('Retry')
    expect(failed).not.toContain('loading-spinner')
  })
})
