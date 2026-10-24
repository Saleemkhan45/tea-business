import { getSaleById } from '../features/sales/services/sales.service'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronRight, FilePlus2, Filter, RefreshCw, Search, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Badge, Button, ExportMenu, PageContainer, Panel, SelectMenu, StateBlock, SuccessToast, SummaryCard, Table, TableBody, TableHead } from '../components/shared'
import { ROUTES } from '../constants/routes'
import { AddSaleModal } from '../features/sales/components/AddSaleModal'
import { SaleActionsMenu } from '../features/sales/components/SaleActionsMenu'
import { SaleDetailsModal } from '../features/sales/components/SaleDetailsModal'
import { EditSaleModal } from '../features/sales/components/EditSaleModal'
import { useSales, useSalesSummary, useVoidSale } from '../features/sales/useSales'
import { getSalesErrorMessage } from '../features/sales/services/sales.service'
import { todayBusinessDate } from '../features/sales/saleForm'
import { PAYMENT_STATUS_OPTIONS, TEA_TYPES, toSaleRecord } from '../features/sales/types/sales'
import type { SaleFilters, SaleRecord, SalePaymentStatus, TeaType } from '../features/sales/types/sales'
import type { SaleDto } from '../features/sales/types/salesApi'
import type { SaleDraft } from '../features/sales/saleCustomerNavigation'
import { useSaleCustomerNavigation } from '../features/sales/useSaleCustomerNavigation'
import '../features/sales/sales.css'
import '../features/sales/responsive.css'

const INITIAL_FILTERS: SaleFilters = { date: '', region: '', teaType: '', status: '', paymentMethod: '', operator: '', customer: '' }
const TEA_TYPE_OPTIONS: Array<{ value: '' | TeaType; label: string }> = [{ value: '', label: 'All tea types' }, ...TEA_TYPES.map(teaType => ({ value: teaType, label: teaType }))]
const STATUS_OPTIONS: Array<{ value: '' | SalePaymentStatus; label: string }> = [{ value: '', label: 'All statuses' }, ...PAYMENT_STATUS_OPTIONS.map(status => ({ value: status, label: status }))]
const formatCurrency = (value: number | undefined) => value === undefined ? '-' : `PKR ${value.toLocaleString('en-PK')}`
const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const formatReference = (value: string) => value.replace('sale-', 'SL').toUpperCase()
const SALE_EXPORT_HEADERS = ['Reference', 'Date', 'Customer', 'Region', 'Tea Type', 'Quantity (kg)', 'Unit Price', 'Total', 'Paid', 'Due', 'Method', 'Sold By', 'Entered By', 'Status'] as const
const SALE_PDF_WIDTHS = [7, 9, 11, 6, 7, 5, 7, 8, 7, 7, 8, 8, 8, 7] as const
type PdfLine = { text: string; fontSize?: number; lineHeight?: number }

const escapeSpreadsheet = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escapePdfText = (value: string) => value.replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

function getSaleExportRow(sale: SaleRecord) {
  return [
    formatReference(sale.id),
    formatDate(sale.date),
    sale.customerName,
    sale.region,
    sale.teaType,
    sale.quantityKg?.toLocaleString('en-PK') ?? '-',
    formatCurrency(sale.unitPrice),
    formatCurrency(sale.totalAmount),
    formatCurrency(sale.amountPaid),
    formatCurrency(sale.amountDue),
    sale.paymentMethod ?? '-',
    sale.soldBy || 'Not recorded',
    sale.enteredBy,
    sale.paymentStatus ?? sale.status,
  ]
}

function trimPdfCell(value: string, width: number) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim()
  return normalizedValue.length > width ? `${normalizedValue.slice(0, Math.max(1, width - 1))}.` : normalizedValue.padEnd(width, ' ')
}

function createPdfTableRow(values: readonly string[]) {
  return values.map((value, index) => trimPdfCell(value, SALE_PDF_WIDTHS[index])).join('  ')
}

function createSalesPdf(lines: PdfLine[]) {
  const pageWidth = 595
  const pageHeight = 842
  const margin = 34
  const pageBottom = 34
  const pages: PdfLine[][] = []
  let page: PdfLine[] = []
  let cursorY = pageHeight - margin

  lines.forEach(line => {
    const fontSize = line.fontSize ?? 8
    const lineHeight = line.lineHeight ?? (fontSize > 10 ? 18 : 11)
    if (page.length > 0 && cursorY - lineHeight < pageBottom) {
      pages.push(page)
      page = []
      cursorY = pageHeight - margin
    }
    page.push(line)
    cursorY -= lineHeight
  })
  if (page.length > 0) pages.push(page)
  if (pages.length === 0) pages.push([{ text: 'No sales records found.' }])

  function createPageContent(pageLines: PdfLine[]) {
    let y = pageHeight - margin
    return pageLines.map(line => {
      const fontSize = line.fontSize ?? 8
      const command = `BT /F1 ${fontSize} Tf ${margin} ${Math.round(y)} Td (${escapePdfText(line.text)}) Tj ET`
      y -= line.lineHeight ?? (fontSize > 10 ? 18 : 11)
      return command
    }).join('\n')
  }

  const objects: string[] = []
  const fontObjectNumber = 3 + (pages.length * 2)
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + (index * 2)} 0 R`).join(' ')}] /Count ${pages.length} >>`
  pages.forEach((pageLines, index) => {
    const pageObjectNumber = 3 + (index * 2)
    const contentObjectNumber = pageObjectNumber + 1
    const content = createPageContent(pageLines)
    objects[pageObjectNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    objects[contentObjectNumber] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  })
  objects[fontObjectNumber] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    offsets[objectNumber] = pdf.length
    pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`
  }
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function SalesPage() {
  const navigation = useSaleCustomerNavigation()
  const resume = navigation.flow?.stage === 'resume-sale' ? navigation.flow : undefined
  const salesQuery = useSales()
  const summaryQuery = useSalesSummary(todayBusinessDate())
  const daySummary = summaryQuery.data?.summary
  const voidMutation = useVoidSale()
  const voidGuard = useRef(false)
  const sales = useMemo(() => salesQuery.data?.sales.map(toSaleRecord) ?? [], [salesQuery.data])
  const [filters, setFilters] = useState<SaleFilters>(INITIAL_FILTERS)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(Boolean(resume))
  const [restoredDraft, setRestoredDraft] = useState<SaleDraft | undefined>(resume?.draft)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const searchLocation = useLocation()
  const [recordError, setRecordError] = useState('')
  useEffect(() => {
    const id = new URLSearchParams(searchLocation.search).get('record')
    setRecordError('')
    if (!id) return
    const controller = new AbortController()
    getSaleById(id, controller.signal).then(sale => { if (!controller.signal.aborted) setSelectedSale(toSaleRecord(sale)) }).catch(() => { if (!controller.signal.aborted) setRecordError('This sale could not be opened. It may be unavailable or outside your shop.') })
    return () => controller.abort()
  }, [searchLocation.key, searchLocation.search])
  const [editingSale, setEditingSale] = useState<SaleDto | null>(null)
  const [feedback, setFeedback] = useState(resume?.createdCustomerId ? 'Customer was added successfully. Continue your sale.' : '')
  useEffect(() => {
    if (resume) {
      setRestoredDraft(resume.draft)
      setIsModalOpen(true)
      if (resume.createdCustomerId) setFeedback('Customer was added successfully. Continue your sale.')
    }
  }, [resume?.id])
  const isRefreshing = salesQuery.isFetching
  const lastUpdated = salesQuery.dataUpdatedAt ? new Date(salesQuery.dataUpdatedAt) : null

  const filteredSales = useMemo(() => sales.filter(sale => {
    const matchesSearch = `${sale.customerName} ${sale.region} ${sale.teaType} ${sale.enteredBy}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (!filters.date || sale.date === filters.date) && (!filters.region || sale.region === filters.region) && (!filters.teaType || sale.teaType === filters.teaType) && (!filters.status || sale.paymentStatus === filters.status) && (!filters.paymentMethod || sale.paymentMethod === filters.paymentMethod) && (!filters.operator || sale.enteredBy === filters.operator) && (!filters.customer || sale.customerName === filters.customer)
  }), [filters, sales, search])

  function updateFilter(field: keyof SaleFilters, value: string) {
    setFilters(current => ({ ...current, [field]: value }))
  }

  function saveSale() {
    setIsModalOpen(false)
    setRestoredDraft(undefined)
    navigation.clearNavigationDraft()
    setFeedback('Sale recorded.')
  }
  function closeSale() {
    setIsModalOpen(false)
    setRestoredDraft(undefined)
    navigation.clearNavigationDraft()
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS)
    setSearch('')
  }

  async function voidSale(sale: SaleRecord) {
    if (voidGuard.current || voidMutation.isPending) return
    const reason = window.prompt(`Cancel sale for ${sale.customerName}? Its inventory and Khata effects will be reversed if the current balance permits. Enter a reason:`)
    if (reason === null || !reason.trim()) return
    voidGuard.current = true
    try { await voidMutation.mutateAsync({ saleId: sale.id, reason: reason.trim() }); setFeedback('Sale cancelled. Inventory and ledger reversed.') }
    catch { /* Show the server conflict or validation message below the heading. */ }
    finally { voidGuard.current = false }
  }

  function getExportFilterText() {
    const activeFilters = [
      search.trim() ? `Search: ${search.trim()}` : '',
      filters.date ? `Date: ${formatDate(filters.date)}` : '',
      filters.region ? `Region: ${filters.region}` : '',
      filters.teaType ? `Tea Type: ${filters.teaType}` : '',
      filters.status ? `Status: ${filters.status}` : '',
      filters.paymentMethod ? `Payment method: ${filters.paymentMethod}` : '',
      filters.operator ? `Operator: ${filters.operator}` : '',
      filters.customer ? `Customer: ${filters.customer}` : '',
    ].filter(Boolean)
    return activeFilters.length ? `Filters: ${activeFilters.join(' | ')}` : 'Filters: All sales records'
  }

  function exportPdf() {
    const generatedAt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
    const totalAmount = filteredSales.reduce((total, sale) => total + sale.totalAmount, 0)
    const headerRow = createPdfTableRow(SALE_EXPORT_HEADERS)
    const lines: PdfLine[] = [
      { text: 'Tea Business - Sales Records', fontSize: 15, lineHeight: 22 },
      { text: `Generated: ${generatedAt}`, fontSize: 9, lineHeight: 13 },
      { text: `Records: ${filteredSales.length} of ${sales.length} | Total Amount: ${formatCurrency(totalAmount)}`, fontSize: 9, lineHeight: 13 },
      { text: getExportFilterText(), fontSize: 9, lineHeight: 15 },
      { text: '', lineHeight: 9 },
      { text: headerRow, fontSize: 7, lineHeight: 10 },
      { text: '-'.repeat(headerRow.length), fontSize: 7, lineHeight: 10 },
      ...filteredSales.map(sale => ({ text: createPdfTableRow(getSaleExportRow(sale)), fontSize: 7, lineHeight: 10 })),
    ]
    downloadBlob(createSalesPdf(lines), `tea-business-sales-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  function exportExcel() {
    const rows = filteredSales.map(getSaleExportRow)
    const worksheetRows = [Array.from(SALE_EXPORT_HEADERS), ...rows]
    const table = worksheetRows.map((row, index) => `<tr>${row.map(value => `<${index === 0 ? 'th' : 'td'}>${escapeSpreadsheet(value)}</${index === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')
    const workbook = `<html><head><meta charset="UTF-8"></head><body><table>${table}</table></body></html>`
    downloadBlob(new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' }), `tea-business-sales-${new Date().toISOString().slice(0, 10)}.xls`)
  }

  return <PageContainer className="sales-page sales-records-page">
    <div className="page-heading sales-page-heading">
      <div><div className="eyebrow"><span className="pulse" /> Daily operations</div><h1>Sales</h1><p>Daily tea sales</p></div>
      <div className="page-actions">
        <Button variant="primary" className="primary-button" onClick={() => setIsModalOpen(true)}><FilePlus2 size={16} /> Add Daily Sale</Button>
        <ExportMenu onExportPdf={exportPdf} onExportExcel={exportExcel} ariaLabel="Export sales records" />
        <div className="sales-refresh-control"><Button loading={isRefreshing} className={`sales-refresh-button ${isRefreshing ? 'is-refreshing' : ''}`} aria-label={isRefreshing ? 'Refreshing sales' : 'Refresh sales'} onClick={() => void salesQuery.refetch()} disabled={isRefreshing}><RefreshCw size={19} /><span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span></Button>{lastUpdated && <small aria-live="polite">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}</div>
      </div>
    </div>
    <div className="summary-grid">
      <SummaryCard title="Today's Sales" value={formatCurrency(daySummary?.salesPkr)} detail="Today" tone="blue" />
      <SummaryCard title="Green Tea Sold" value={daySummary ? `${daySummary.greenKg.toLocaleString()} kg` : '-'} detail="Today" tone="green" />
      <SummaryCard title="Black Tea Sold" value={daySummary ? `${daySummary.blackKg.toLocaleString()} kg` : '-'} detail="Today" tone="slate" />
      <SummaryCard title="Total Transactions" value={daySummary ? String(daySummary.transactions) : '-'} detail="Today" tone="orange" />
    </div>
    <dl className="sales-financial-summary"><div><dt>Cash Received Today</dt><dd>{formatCurrency(daySummary?.cashReceivedPkr)}</dd></div><div><dt>Khata Sales Today</dt><dd>{formatCurrency(daySummary?.khataPkr)}</dd></div><div><dt>Outstanding Customer Khata</dt><dd>{formatCurrency(daySummary?.outstandingPkr)}</dd></div></dl>
    {summaryQuery.isError && <div className="sale-form-error" role="alert">Sales summary unavailable. <Button onClick={() => void summaryQuery.refetch()}>Retry</Button></div>}
    <SuccessToast message={feedback} onDismiss={() => setFeedback('')} />
    {voidMutation.isError && <div className="sale-form-error" role="alert">{getSalesErrorMessage(voidMutation.error)}</div>}
    <Panel className="sales-table-panel report-style-table">
      <div className="sales-panel-heading"><div><h2>Daily Sales</h2><p>{filteredSales.length} records matching your view</p></div><button type="button" className="text-link" onClick={clearFilters}><Filter size={14} /> Reset filters</button></div>
      <div className="sales-filter-bar">
        <label className="search-input"><Search size={16} /><input aria-label="Search sales" placeholder="Search customer, tea, or operator" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label className="filter-control"><CalendarDays size={14} /><input type="date" aria-label="Filter by date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} /></label>
        <SelectMenu value={filters.teaType} options={TEA_TYPE_OPTIONS} onChange={value => updateFilter('teaType', value)} ariaLabel="Filter by tea type" className="sales-select-menu sales-tea-menu" />
        <SelectMenu value={filters.status} options={STATUS_OPTIONS} onChange={value => updateFilter('status', value)} ariaLabel="Filter by status" className="sales-select-menu sales-status-menu" />
        <SelectMenu value={filters.customer} options={[{ value: '', label: 'All customers' }, ...[...new Set(sales.map(sale => sale.customerName))].sort().map(value => ({ value, label: value }))]} onChange={value => updateFilter('customer', value)} ariaLabel="Filter by customer" className="sales-select-menu" />
        <SelectMenu value={filters.paymentMethod} options={[{ value: '', label: 'All payment methods' }, ...[...new Set(sales.map(sale => sale.paymentMethod ?? '-'))].sort().map(value => ({ value, label: value }))]} onChange={value => updateFilter('paymentMethod', value)} ariaLabel="Filter by payment method" className="sales-select-menu" />
        <SelectMenu value={filters.operator} options={[{ value: '', label: 'All operators' }, ...[...new Set(sales.map(sale => sale.enteredBy))].sort().map(value => ({ value, label: value }))]} onChange={value => updateFilter('operator', value)} ariaLabel="Filter by operator" className="sales-select-menu" />
      </div>
      <p className="sales-table-scroll-hint" id="sales-table-scroll-hint">Scroll sideways in the table to see all columns and sale actions.</p>
      <div className="sales-table-region" role="region" aria-label="Daily sales records" aria-describedby="sales-table-scroll-hint" tabIndex={0}>
      <Table>
        <TableHead><tr><th>Date</th><th>Customer</th><th>Region</th><th>Tea Type</th><th>Quantity</th><th>Unit Price</th><th>Total</th><th>Paid</th><th>Due</th><th>Payment Method</th><th>Entered By</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></TableHead>
        <TableBody>{filteredSales.map(sale => <tr key={sale.id}><td>{formatDate(sale.date)}</td><td><strong>{sale.customerName}</strong></td><td>{sale.region}</td><td><span className={`tea-chip ${sale.teaType === 'Green Tea' ? 'green-chip' : 'black-chip'}`} />{sale.source?.productName ?? sale.teaType}</td><td>{sale.quantityKg === undefined ? '-' : `${sale.quantityKg.toLocaleString()} kg`}</td><td>{formatCurrency(sale.unitPrice)}</td><td><strong>{formatCurrency(sale.totalAmount)}</strong></td><td>{sale.status === 'Voided' ? '-' : formatCurrency(sale.amountPaid)}</td><td>{sale.status === 'Voided' ? '-' : formatCurrency(sale.amountDue)}</td><td>{sale.paymentMethod}</td><td>{sale.enteredBy}</td><td><Badge tone={sale.paymentStatus === 'Paid' ? 'success' : sale.paymentStatus === 'Partial' ? 'warning' : sale.paymentStatus === 'Khata' ? 'danger' : 'neutral'}>{sale.paymentStatus}</Badge></td><td><SaleActionsMenu sale={sale} onViewDetails={setSelectedSale} onEdit={record => record.source && setEditingSale(record.source)} onVoid={record => void voidSale(record)} busy={voidMutation.isPending} /></td></tr>)}</TableBody>
      </Table>
      </div>
      {salesQuery.isPending ? <StateBlock variant="loading" title="Loading sales" message="" /> : salesQuery.isError ? <StateBlock variant="error" title="Sales unavailable" message={getSalesErrorMessage(salesQuery.error)} action={<Button onClick={() => void salesQuery.refetch()} disabled={isRefreshing}>Retry</Button>} /> : filteredSales.length === 0 && <StateBlock title="No sales found" message="" icon={<Search size={21} />} action={<button type="button" className="text-link" onClick={clearFilters}><X size={14} /> Clear all filters</button>} />}
      <div className="table-footer"><span>Showing {filteredSales.length} of {sales.length} records</span><Link className="text-link" to={`${ROUTES.reports}?tab=sales`}>View all <ChevronRight size={15} /></Link></div>
    </Panel>
    {isModalOpen && <AddSaleModal key={resume?.id ?? 'new-sale'} initialDraft={restoredDraft} onClose={closeSale} onSave={saveSale} />}
    {recordError && <p role="alert">{recordError}</p>}
    {selectedSale && <SaleDetailsModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
    {editingSale && <EditSaleModal sale={editingSale} onClose={() => setEditingSale(null)} onSave={() => setEditingSale(null)} />}
  </PageContainer>
}
