import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('../auth/auth.api', () => ({ API_BASE_URL: '/api/v1', authenticatedFetch: vi.fn() }))
import { authenticatedFetch } from '../auth/auth.api'
import { searchDashboard, resultPath } from './search.api'
import { Highlight } from './GlobalSearchModal'
const fetchMock = vi.mocked(authenticatedFetch)
beforeEach(() => vi.clearAllMocks())
describe('global search transport and navigation', () => {
  it.each(['customers', 'sales', 'purchases'] as const)('uses bounded authenticated GET for %s with cancellation', async category => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(category === 'customers' ? { customers: [{ id: 'customer', name: 'Customer', phone: '123' }] } : { results: [{ id: 'record', title: 'Record', description: 'Tea' }] })))
    const signal = new AbortController().signal
    expect(await searchDashboard(category, 'tea', signal)).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('search=tea&page=1&limit=6'), { method: 'GET', signal })
  })
  it('uses existing resource routes and selected-record contracts', () => {
    expect(resultPath('customers', 'abc')).toBe('/customers/abc')
    expect(resultPath('sales', 'abc')).toBe('/sales?record=abc')
    expect(resultPath('purchases', 'abc')).toBe('/purchases?record=abc')
    for (const category of ['customers', 'sales', 'purchases'] as const) expect(resultPath(category)).toBe('/' + category)
  })
  it('handles empty results and API errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"results":[]}'))
    expect(await searchDashboard('sales', 'tea', new AbortController().signal)).toEqual([])
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 403 }))
    await expect(searchDashboard('sales', 'tea', new AbortController().signal)).rejects.toThrow('permission')
  })
  it('highlights text with React escaping', () => {
    const html = renderToStaticMarkup(<Highlight text={'<script>Tea</script>'} term="tea" />)
    expect(html).toContain('<mark>Tea</mark>'); expect(html).not.toContain('<script>')
  })
})
