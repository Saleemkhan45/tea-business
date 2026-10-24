import { Banknote, HandCoins, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Panel, QueryFreshness } from '../../components/shared'
import { formatPKR } from '../../business/utils/formatters'
import { ROUTES } from '../../constants/routes'
import { CashHistoryPanel } from './CashHistoryPanel'
import { CashSetupStatus } from './CashSetupStatus'
import { cashErrorMessage, useCashAccess, useCashQuery, type CashDay, type CashOverview, type CashStatus, type DayResult } from './api'
import './cashbook.css'

export function CashSkeleton() {
  return <div className="cash-stats cash-kpis cash-skeleton" role="status" aria-label="Loading saved cash amounts">
    <div /><div /><div /><span className="sr-only">Loading saved cash amounts</span>
  </div>
}

export function ManualCashValues({ record, today = false }: { record: CashDay | null; today?: boolean }) {
  const cards = [
    { label: today ? "Today's Shop Cash" : 'Shop Cash', value: record?.shopCashAmount, icon: Wallet },
    { label: today ? "Today's Boss Added Money" : 'Boss Added Money', value: record?.bossAddedAmount, icon: HandCoins },
    { label: today ? "Today's Total Cash Collected" : 'Total Cash Collected', value: record?.totalCollected, icon: Banknote },
  ]
  return <dl className="cash-stats cash-kpis">{cards.map(({ label, value, icon: Icon }) => <div key={label}>
    <dt><span className="cash-kpi-icon"><Icon size={19} aria-hidden="true" /></span>{label}</dt>
    <dd>{value === undefined ? <span aria-label="No confirmed saved amount">—</span> : formatPKR(value)}</dd>
  </div>)}</dl>
}

export function CashPanel({ report = false, businessDate }: { report?: boolean; businessDate?: string }) {
  const access = useCashAccess(), status = useCashQuery<CashStatus>('/status')
  const query = useCashQuery<CashOverview | DayResult>(businessDate ? `/records/by-date/${businessDate}` : '/overview', !report && status.data?.ready === true, report ? false : 60000)
  if (!access) return null
  if (report) return status.isPending ? <Panel><CashSkeleton /></Panel> : status.isError
    ? <Panel><p role="alert">{cashErrorMessage(status.error)} <Button onClick={() => void status.refetch()}>Retry</Button></p></Panel>
    : <>{!status.data?.ready && <CashSetupStatus />}<CashHistoryPanel ready={status.data?.ready === true} /></>
  const record = query.data && ('record' in query.data ? query.data.record : query.data.today.record)
  const today = !businessDate || businessDate === status.data?.today
  return <Panel className="cash-panel manual-cash-panel">
    <div className="cash-heading"><div><h2>{today ? "Today's Cash Position" : 'Cash Position'}</h2><p>{businessDate && `${businessDate} · `}Saved daily cash, entered manually.</p></div>
      <div className="manual-row-actions"><Button loading={status.isFetching || query.isFetching} disabled={status.isFetching || query.isFetching} onClick={() => { void status.refetch(); if (status.data?.ready) void query.refetch() }}>Refresh</Button><Link className="ui-button ui-button-secondary cash-setup-action" to={ROUTES.cashBook}>View Cash Book</Link></div>
    </div>
    <QueryFreshness query={query} label="manual cash figures" onRetry={() => void query.refetch()} />
    {status.isError && <QueryFreshness query={status} label="Cash Book readiness" onRetry={() => void status.refetch()} />}
    {status.isPending || (status.data?.ready && query.isPending) ? <CashSkeleton />
      : (status.isError && !status.data) || (query.isError && !query.data) ? <p role="alert">{cashErrorMessage(status.error ?? query.error)} <Button onClick={() => { void status.refetch(); if (status.data?.ready) void query.refetch() }}>Retry</Button></p>
        : !status.data?.ready ? <CashSetupStatus setup={status.data?.setup} />
          : record ? <><ManualCashValues record={record} today={today} /><p>Saved for {record.businessDate} by {record.enteredBy?.name ?? 'Former operator'}.</p></>
            : <p className="cash-empty">No cash entry recorded for this date.</p>}
    <div className="cash-actions"><Link className="ui-button ui-button-primary cash-setup-action" to={`${ROUTES.cashBook}?date=${businessDate ?? status.data?.today ?? ''}`}>{record ? 'View / Correct Record' : today ? "Add Today's Entry" : 'Add Entry for This Date'}</Link></div>
  </Panel>
}
