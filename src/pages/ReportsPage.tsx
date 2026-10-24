import { CashPanel } from '../features/cashbook/CashPanel'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { CollectionsPanel } from '../features/collections/CollectionsPanel'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileClock,
  ListChecks,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { Badge, Button, ExportMenu, PageContainer, SelectMenu, StateBlock, Table, TableBody, TableHead } from '../components/shared'
import { getReports, REPORT_CATEGORIES } from '../features/reports'
import type { ReportCategory, SalesReportRecord, SalesReportStatus } from '../features/reports'
import { useSales } from '../features/sales/useSales'
import { toSalesReportRecord } from '../features/reports/salesReport'
import { useRegions } from '../features/regions/regionalInventory.api'
import { RegionSelector } from '../features/regions/components/RegionSelector'
import '../features/sales/sales.css'
import '../features/sales/responsive.css'
import '../features/reports/reports.css'
import '../features/regions/regions.css'

type ReportTab = 'earnings' | 'orders' | 'sales' | 'customers' | 'audit'
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest'
type PageSizeOption = '10' | '15' | '25'
type SearchScope = 'all' | 'reference' | 'region' | 'status'
type StatusFilter = 'all' | SalesReportStatus
type ReportFilters = { startDate: string; endDate: string; category: '' | ReportCategory }

const EMPTY_FILTERS: ReportFilters = { startDate: '', endDate: '', category: '' }
const CUSTOMER_NAMES = ['Ayesha Traders', 'Karachi Tea House', 'Noor Foods', 'Khan Super Store', 'Royal Cafe', 'Chai Junction']
const AUDIT_ACTIONS = ['Sale marked complete', 'Invoice generated', 'Order updated', 'Refund reviewed', 'Payment verified']

const REPORT_TABS = [
  { id: 'earnings' as const, label: 'Earning Report', icon: BadgeDollarSign },
  { id: 'orders' as const, label: 'Order Report', icon: ListChecks },
  { id: 'sales' as const, label: 'Sales Report', icon: ClipboardList },
  { id: 'customers' as const, label: 'Customer Report', icon: Users },
  { id: 'audit' as const, label: 'Audit Logs', icon: FileClock },
]

function isReportTab(value: string | null): value is ReportTab {
  return REPORT_TABS.some(tab => tab.id === value)
}

const CATEGORY_OPTIONS: Array<{ value: '' | ReportCategory; label: string }> = [
  { value: '', label: 'Select category' },
  ...REPORT_CATEGORIES.map(category => ({ value: category, label: category })),
]

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest total' },
  { value: 'lowest', label: 'Lowest total' },
]

const SEARCH_SCOPE_OPTIONS: Array<{ value: SearchScope; label: string }> = [
  { value: 'all', label: 'All fields' },
  { value: 'reference', label: 'Reference / name' },
  { value: 'region', label: 'Region' },
  { value: 'status', label: 'Status' },
]

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Voided', label: 'Voided' },
]

const PAGE_SIZE_OPTIONS: Array<{ value: PageSizeOption; label: string }> = [
  { value: '10', label: '10' },
  { value: '15', label: '15' },
  { value: '25', label: '25' },
]

const REPORT_HEADERS: Record<ReportTab, string[]> = {
  earnings: ['Report ID', 'Date', 'Region', 'Gross Revenue', 'Costs', 'Net Earnings', 'Status'],
  orders: ['Order ID', 'Date', 'Region', 'Tea Type', 'Items', 'Order Total', 'Status'],
  sales: ['Sales ID', 'Date', 'Selling Region', 'Category', 'Quantity (kg)', 'Grand Total', 'Sold By', 'Entered By', 'Status'],
  customers: ['Customer', 'Region', 'Tea Preference', 'Orders', 'Total Spend', 'Last Order', 'Status'],
  audit: ['Log ID', 'Date & Time', 'User', 'Action', 'Module', 'IP Address', 'Status'],
}

const formatCurrency = (value: number) => `PKR ${value.toLocaleString('en-PK')}`

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function recordSeed(record: SalesReportRecord) {
  return Number(record.id.replace(/\D/g, '')) || 0
}

function getReportCells(tab: ReportTab, record: SalesReportRecord) {
  const seed = recordSeed(record)
  const costs = Math.round(record.grandTotal * 0.62)
  const customer = CUSTOMER_NAMES[seed % CUSTOMER_NAMES.length]
  const action = AUDIT_ACTIONS[seed % AUDIT_ACTIONS.length]
  const time = `${String(9 + (seed % 8)).padStart(2, '0')}:${seed % 2 ? '15' : '40'}`

  switch (tab) {
    case 'earnings':
      return [record.id.replace('TS', 'ER'), formatDate(record.date), record.region, formatCurrency(record.grandTotal), formatCurrency(costs), formatCurrency(record.grandTotal - costs), record.status]
    case 'orders':
      return [record.id.replace('TS', 'OR'), formatDate(record.date), record.region, record.category, record.itemsSold?.toLocaleString() ?? '-', formatCurrency(record.grandTotal), record.status]
    case 'customers':
      return [customer, record.region, record.category, record.totalOrders.toLocaleString(), formatCurrency(record.grandTotal), formatDate(record.date), record.status]
    case 'audit':
      return [record.id.replace('TS', 'LG'), `${formatDate(record.date)}, ${time}`, seed % 3 === 0 ? 'Admin User' : 'Saleem Khan', action, seed % 2 ? 'Sales' : 'Orders', `192.168.1.${20 + (seed % 70)}`, record.status]
    default:
      return [record.id, formatDate(record.date), record.region, record.category, record.itemsSold?.toLocaleString() ?? '-', formatCurrency(record.grandTotal), record.soldBy || 'Not recorded', record.enteredBy || '-', record.status]
  }
}

function getStatusTone(status: SalesReportStatus) {
  if (status === 'Completed') return 'success' as const
  if (status === 'Pending') return 'warning' as const
  return 'danger' as const
}

function escapeSpreadsheet(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function ReportsPage() {
  const data = getReports()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: ReportTab = isReportTab(tabParam) ? tabParam : 'sales'
  const regions = useRegions()
  const [sellingRegion, setSellingRegion] = useState('')
  const salesQuery = useSales({}, activeTab === 'sales')
  const reportRecords = useMemo(() => activeTab === 'sales' ? (salesQuery.data?.sales ?? []).map(toSalesReportRecord) : data.sales, [activeTab, salesQuery.data, data.sales])
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const [pageSize, setPageSize] = useState<PageSizeOption>('10')
  const [page, setPage] = useState(1)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const invalidRange = Boolean(draftFilters.startDate && draftFilters.endDate && draftFilters.startDate > draftFilters.endDate)

  const deferredSearch = useDeferredValue(search)

  const filteredRecords = useMemo(() => {
    const terms = deferredSearch.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const rows = reportRecords.filter(record => {
      if (activeTab === 'sales' && sellingRegion && record.regionId !== sellingRegion) return false
      if (appliedFilters.startDate && record.date < appliedFilters.startDate) return false
      if (appliedFilters.endDate && record.date > appliedFilters.endDate) return false
      if (appliedFilters.category && record.category !== appliedFilters.category) return false
      if (statusFilter !== 'all' && record.status !== statusFilter) return false
      if (terms.length === 0) return true

      const cells = getReportCells(activeTab, record)
      const searchableText = searchScope === 'reference'
        ? cells[0]
        : searchScope === 'region'
          ? record.region
          : searchScope === 'status'
            ? record.status
            : cells.join(' ')

      const normalizedText = searchableText.toLowerCase()
      return terms.every(term => normalizedText.includes(term))
    })

    return [...rows].sort((a, b) => {
      if (sort === 'oldest') return a.date.localeCompare(b.date)
      if (sort === 'highest') return b.grandTotal - a.grandTotal
      if (sort === 'lowest') return a.grandTotal - b.grandTotal
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    })
  }, [activeTab, appliedFilters, reportRecords, deferredSearch, searchScope, sort, statusFilter, sellingRegion])

  const pageSizeNumber = Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSizeNumber))
  const visibleRecords = filteredRecords.slice((page - 1) * pageSizeNumber, page * pageSizeNumber)
  const activeLabel = REPORT_TABS.find(tab => tab.id === activeTab)?.label ?? 'Report'

  useEffect(() => setPage(1), [activeTab, appliedFilters, pageSize, search, searchScope, sort, statusFilter, sellingRegion])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  function applyFilters() {
    if (!invalidRange && draftFilters.category) setAppliedFilters(draftFilters)
  }

  function setActiveTab(tab: ReportTab) {
    setSearchParams(currentParams => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set('tab', tab)
      return nextParams
    }, { replace: true })
  }

  function resetView() {
    setSellingRegion('')
    if (activeTab === 'sales') void salesQuery.refetch()
    setIsRefreshing(true)
    setDraftFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setSearch('')
    setSearchScope('all')
    setStatusFilter('all')
    setSort('newest')
    setPageSize('10')
    window.setTimeout(() => setIsRefreshing(false), 450)
  }

  function exportPdf() {
    const originalTitle = document.title
    document.title = `Tea Business - ${activeLabel}`
    window.print()
    window.setTimeout(() => { document.title = originalTitle }, 100)
  }

  function exportExcel() {
    const headers = REPORT_HEADERS[activeTab]
    const rows = filteredRecords.map(record => getReportCells(activeTab, record))
    const table = [headers, ...rows].map((row, index) => `<tr>${row.map(value => `<${index === 0 ? 'th' : 'td'}>${escapeSpreadsheet(value)}</${index === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')
    const workbook = `<html><head><meta charset="UTF-8"></head><body><table>${table}</table></body></html>`
    const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `tea-business-${activeTab}-report.xls`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <PageContainer className="reports-page">
    <CashPanel report />
    <CollectionsPanel report />
    <div className="reports-heading">
      <div className="reports-title-group">
        <h1>Reports</h1>
        <button type="button" className="report-refresh" onClick={resetView} aria-label="Refresh reports" disabled={isRefreshing}>
          <RefreshCw size={16} className={isRefreshing ? 'is-spinning' : ''} />
        </button>
      </div>
      <ExportMenu onExportPdf={exportPdf} onExportExcel={exportExcel} ariaLabel="Export reports" />
    </div>

    {activeTab === 'sales' && <div className="regional-report-filter"><RegionSelector label="Selling Region" value={sellingRegion} onChange={setSellingRegion} regions={regions} required={false} includeInactive placeholder="All selling regions" description="" /><a href="/inventory">View regional inventory</a></div>}
    <div className="reports-tabs" role="tablist" aria-label="Report type">
      {REPORT_TABS.map(({ id, label, icon: Icon }) => <button
        key={id}
        type="button"
        className={`report-tab ${activeTab === id ? 'active' : ''}`}
        role="tab"
        aria-selected={activeTab === id}
        aria-controls="report-workspace"
        tabIndex={activeTab === id ? 0 : -1}
        onClick={() => setActiveTab(id)}
        onKeyDown={event => {
          const currentIndex = REPORT_TABS.findIndex(tab => tab.id === id)
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const direction = event.key === 'ArrowRight' ? 1 : -1
          const nextTab = REPORT_TABS[(currentIndex + direction + REPORT_TABS.length) % REPORT_TABS.length]
          setActiveTab(nextTab.id)
          document.getElementById(`report-tab-${nextTab.id}`)?.focus()
        }}
        id={`report-tab-${id}`}
      ><Icon size={16} /><span>{label}</span></button>)}
    </div>

    <section id="report-workspace" className="report-workspace" role="tabpanel" aria-labelledby={`report-tab-${activeTab}`}>
      <form className="report-filter-grid" onSubmit={event => { event.preventDefault(); applyFilters() }}>
        <label className="report-field">
          <span>Start Date <i>*</i></span>
          <input type="date" value={draftFilters.startDate} onChange={event => setDraftFilters(current => ({ ...current, startDate: event.target.value }))} aria-invalid={invalidRange} required />
        </label>
        <label className="report-field">
          <span>End Date <i>*</i></span>
          <input type="date" value={draftFilters.endDate} onChange={event => setDraftFilters(current => ({ ...current, endDate: event.target.value }))} aria-invalid={invalidRange} required />
        </label>
        <div className="report-field report-select-field">
          <span>Category <i>*</i></span>
          <SelectMenu value={draftFilters.category} options={CATEGORY_OPTIONS} onChange={category => setDraftFilters(current => ({ ...current, category }))} ariaLabel="Report category" className="report-select-menu report-category-menu" />
        </div>
        <Button variant="primary" className="report-submit" type="submit" disabled={invalidRange || !draftFilters.category}>Submit</Button>
        {invalidRange && <p className="report-filter-error" role="alert">End date must be on or after the start date.</p>}
      </form>

      <div className="report-toolbar">
        <div className="report-search-system" role="search" aria-label={`Search ${activeLabel.toLowerCase()}`}>
          <label className="report-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search {activeLabel.toLowerCase()}</span>
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${activeLabel.toLowerCase()}...`} autoComplete="off" />
            {search && <button type="button" className="report-search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}
          </label>
          <SelectMenu value={searchScope} options={SEARCH_SCOPE_OPTIONS} onChange={setSearchScope} ariaLabel="Search field" className="report-select-menu report-search-scope" />
          <SelectMenu value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} ariaLabel="Filter by status" className="report-select-menu report-status-menu" />
          <span className="report-result-count" aria-live="polite">{filteredRecords.length} {filteredRecords.length === 1 ? 'result' : 'results'}</span>
        </div>
        <div className="report-sort" aria-label="Sort results">
          <SelectMenu value={sort} options={SORT_OPTIONS} onChange={setSort} ariaLabel="Sort report" className="report-select-menu report-sort-menu" />
        </div>
      </div>

      <div className="report-table-area" aria-busy={isRefreshing}>
        {activeTab === 'sales' && salesQuery.isError ? <StateBlock variant="error" title="Sales report unavailable" message="Unable to load sales records." action={<Button onClick={() => void salesQuery.refetch()}>Retry</Button>} /> : isRefreshing || activeTab === 'sales' && salesQuery.isPending ? <StateBlock variant="loading" title="Refreshing report" message="Updating the latest report view." /> : visibleRecords.length > 0 ? <Table className="report-data-table">
          <caption className="sr-only">{activeLabel} results</caption>
          <TableHead><tr>{REPORT_HEADERS[activeTab].map(header => <th key={header} scope="col">{header}</th>)}</tr></TableHead>
          <TableBody>{visibleRecords.map(record => {
            const cells = getReportCells(activeTab, record)
            return <tr key={`${activeTab}-${record.id}`}>{cells.map((cell, index) => <td key={`${record.id}-${REPORT_HEADERS[activeTab][index]}`}>
              {index === cells.length - 1 ? <Badge tone={getStatusTone(record.status)} className="report-status">{record.status}</Badge> : index === 0 ? <strong>{cell}</strong> : cell}
            </td>)}</tr>
          })}</TableBody>
        </Table> : <StateBlock title="No report records found" message="Try a different search or filter range." action={<button type="button" className="report-clear" onClick={resetView}>Clear filters</button>} />}
      </div>

      <div className="report-table-footer">
        <div className="report-entries"><SelectMenu value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} ariaLabel="Rows per report page" className="report-select-menu report-entries-menu" /><span>Entries</span></div>
        <nav className="report-pagination" aria-label="Report pagination">
          <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}><ChevronLeft size={14} /> Prev</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map(pageNumber => <button key={pageNumber} type="button" className={page === pageNumber ? 'active' : ''} onClick={() => setPage(pageNumber)} aria-current={page === pageNumber ? 'page' : undefined}>{pageNumber}</button>)}
          <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Next <ChevronRight size={14} /></button>
        </nav>
      </div>
    </section>
  </PageContainer>
}
