import { useState } from 'react'
import { CollectionScheduleCard } from '../../collections/CollectionScheduleCard'
import { CollectionsPanel } from '../../collections/CollectionsPanel'
import { CustomerWhatsAppCard } from '../../whatsapp/CustomerWhatsAppCard'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useParams } from 'react-router-dom'
import type { LedgerFilters } from '../../customer-ledger'
import {
  CustomerLedgerApiError,
  getCustomerLedgerErrorMessage,
  isValidCustomerId,
  useCustomerById,
  useCustomerLedger,
  useCustomerLedgerDailyPayments,
  useCustomerLedgerPaymentCalendar,
  useCustomerLedgerPaymentInsights,
  useCustomerLedgerReminderCandidate,
  useCustomerLedgerSummary,
} from '../../customer-ledger'
import { formatBusinessDate, getPakistanBusinessDate } from '../../../business/utils/date'
import { formatPKR } from '../../../business/utils/formatters'
import { Button, createDateRange, DateRangeMenu, PageContainer, StateBlock, SuccessToast, type DateRangeValue } from '../../../components/shared'
import { CustomerHeader } from '../components/CustomerHeader'
import { CustomerSummaryCards } from '../components/CustomerSummaryCards'
import { CustomerInsightCards } from '../components/CustomerInsightCards'
import { CustomerPaymentChart } from '../components/CustomerPaymentChart'
import { CustomerPaymentCalendar } from '../components/CustomerPaymentCalendar'
import { CustomerLedgerTable } from '../components/CustomerLedgerTable'
import { CustomerQuickActions, type QuickActionMode } from '../components/CustomerQuickActions'
import {
  CustomerFinancialPanel,
  CustomerInformationPanel,
  CustomerPaymentHistoryPanel,
  CustomerProductSummaryPanel,
  CustomerPurchaseHistoryPanel,
  CustomerPeriodPanel,
} from '../components/CustomerProfilePanels'
import { monthRange, shiftMonth } from '../utils/customerLedgerUi'
import '../customers.css'

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const today = getPakistanBusinessDate()
  const [range, setRange] = useState<DateRangeValue>(() => createDateRange('thisMonth'))
  const [ledgerFilters, setLedgerFilters] = useState<LedgerFilters>({})
  const [action, setAction] = useState<QuickActionMode | null>(null)
  const [feedback, setFeedback] = useState('')
  const paymentRange = { from: range.startDate, to: range.endDate }
  const profile = useCustomerById(customerId)
  const customer = profile.data?.customer ?? null
  const summary = useCustomerLedgerSummary(customerId, today)
  const ledger = useCustomerLedger(customerId, {})
  const daily = useCustomerLedgerDailyPayments(customerId, paymentRange)
  const insights = useCustomerLedgerPaymentInsights(customerId, { ...paymentRange, referenceDate: today })
  const calendar = useCustomerLedgerPaymentCalendar(customerId, paymentRange)
  const reminder = useCustomerLedgerReminderCandidate(customerId, 30, today)

  if (!isValidCustomerId(customerId)) return <PageContainer className="customers-page"><StateBlock variant="error" title="Invalid customer ID" message="Open a valid account from the Customers page." /></PageContainer>

  const profileStatus = profile.error instanceof CustomerLedgerApiError ? profile.error.status : undefined
  const profileErrorTitle = profileStatus === 404 ? 'Customer not found' : profileStatus === 401 ? 'Session expired' : profileStatus === 400 ? 'Invalid customer request' : 'Customer profile unavailable'

  function goToMonth(offset: number) {
    const target = shiftMonth(range.endDate, offset)
    const next = monthRange(target, today)
    setRange(createDateRange('custom', next.from, next.to))
  }

  return <PageContainer className="customers-page customer-detail-page">
    <CustomerHeader customer={customer} onPurchase={() => setAction('purchase')} onPayment={() => setAction('payment')} onPrint={() => window.print()} />
    {profile.isPending ? <StateBlock variant="loading" title="Loading customer profile" message="Fetching customer details." /> : profile.isError && <StateBlock variant="error" title={profileErrorTitle} message={getCustomerLedgerErrorMessage(profile.error)} action={<Button aria-label="Retry customer profile" disabled={profile.isFetching} onClick={() => void profile.refetch()}><RefreshCw size={15} aria-hidden="true" /> Retry</Button>} />}
    <SuccessToast message={feedback} onDismiss={() => setFeedback('')} />
    {summary.isFetching && !summary.isPending && <p className="customer-refresh-status" role="status">Refreshing Khata...</p>}
    {summary.isPending ? <StateBlock variant="loading" title="Loading account summary" message="Fetching current ledger totals." /> : summary.isError ? <StateBlock variant="error" title="Account summary unavailable" message={getCustomerLedgerErrorMessage(summary.error)} action={<Button aria-label="Retry account summary" disabled={summary.isFetching} onClick={() => void summary.refetch()}><RefreshCw size={15} aria-hidden="true" /> Retry</Button>} /> : summary.data && <CustomerSummaryCards summary={summary.data.summary} />}
    {customer && summary.data?.summary && <div className="customer-profile-grid"><CustomerInformationPanel customer={customer} /><CustomerFinancialPanel summary={summary.data.summary} /></div>}
    {summary.data?.summary && <CustomerProductSummaryPanel summary={summary.data.summary} />}
    {customer && <><CustomerWhatsAppCard customerId={customerId} /><CollectionScheduleCard customerId={customerId} /><CollectionsPanel customerId={customerId} /></>}
    <CustomerPurchaseHistoryPanel transactions={ledger.data?.transactions} isPending={ledger.isPending} isError={ledger.isError} onRetry={() => void ledger.refetch()} />
    <CustomerPaymentHistoryPanel transactions={ledger.data?.transactions} isPending={ledger.isPending} isError={ledger.isError} onRetry={() => void ledger.refetch()} />
    <div className="customer-period-heading"><div><h2>Payment activity</h2><p>Insights for the selected business-date range</p></div><DateRangeMenu value={range} onChange={setRange} /></div>
    <CustomerPeriodPanel transactions={ledger.data?.transactions} rows={ledger.data?.rows} from={range.startDate} to={range.endDate} isPending={ledger.isPending} isError={ledger.isError} onRetry={() => void ledger.refetch()} />
    <CustomerInsightCards insight={insights.data?.insight} isPending={insights.isPending} isError={insights.isError} onRetry={() => void insights.refetch()} />
    <div className="customer-visual-grid"><CustomerPaymentChart buckets={daily.data?.buckets} highestDate={insights.data?.insight.highestPaymentDay?.date ?? null} isPending={daily.isPending} isError={daily.isError} onRetry={() => void daily.refetch()} /><CustomerPaymentCalendar buckets={calendar.data?.buckets} from={range.startDate} to={range.endDate} today={today} isPending={calendar.isPending} isError={calendar.isError} onPrevious={() => goToMonth(-1)} onNext={() => goToMonth(1)} onRetry={() => void calendar.refetch()} /></div>
    <CustomerLedgerTable rows={ledger.data?.rows} transactions={ledger.data?.transactions} filters={ledgerFilters} today={today} isPending={ledger.isPending} isError={ledger.isError} onFiltersChange={setLedgerFilters} onRetry={() => void ledger.refetch()} />
    {reminder.isError ? <StateBlock variant="error" title="Reminder status unavailable" message="Try checking reminder eligibility again." action={<Button onClick={() => void reminder.refetch()}>Retry</Button>} /> : reminder.data?.candidate && <section className="customer-reminder" aria-label="Payment reminder"><AlertTriangle size={20} aria-hidden="true" /><div><h2>Payment reminder recommended</h2><p>Outstanding {formatPKR(reminder.data.candidate.balanceDuePkr)} | {reminder.data.candidate.daysSinceLastPayment === null ? 'No payment recorded' : `${reminder.data.candidate.daysSinceLastPayment} days since payment`}{reminder.data.candidate.lastPaymentDate ? ` | Last paid ${formatBusinessDate(reminder.data.candidate.lastPaymentDate)}` : ''}</p></div></section>}
    {action && <CustomerQuickActions key={action} customerId={customerId} customerName={customer?.name} outstandingPkr={summary.isError ? undefined : summary.data?.summary.currentBalancePkr} mode={action} onClose={() => setAction(null)} onSuccess={message => { setAction(null); setFeedback(message) }} />}
  </PageContainer>
}
