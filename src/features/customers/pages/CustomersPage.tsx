import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Plus, RefreshCw, Search, UsersRound, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, PageContainer, Panel, SelectMenu, StateBlock, SuccessToast, Table, TableBody, TableHead } from '../../../components/shared'
import { formatPKR } from '../../../business/utils/formatters'
import { ROUTES } from '../../../constants/routes'
import { useCustomerDirectory, type CustomerDirectoryStatus } from '../../customer-ledger'
import { AddCustomerModal } from '../components/AddCustomerModal'
import { useSaleCustomerNavigation } from '../../sales/useSaleCustomerNavigation'
import '../customers.css'

const PAGE_LIMIT = 20
const STATUS_OPTIONS: Array<{ value: CustomerDirectoryStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function pageFromParam(value: string | null) {
  const page = Number(value ?? 1)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function statusFromParam(value: string | null): CustomerDirectoryStatus | '' {
  return value === 'active' || value === 'inactive' ? value : ''
}

function statusLabel(status: CustomerDirectoryStatus) {
  return status === 'active' ? 'Active' : 'Inactive'
}

export function CustomersPage() {
  const navigation = useSaleCustomerNavigation()
  const fromSale = navigation.flow?.stage === 'create-customer'
  const [searchParams, setSearchParams] = useSearchParams()
  const search = (searchParams.get('search') ?? '').trim()
  const status = statusFromParam(searchParams.get('status'))
  const page = pageFromParam(searchParams.get('page'))
  const [searchInput, setSearchInput] = useState(search)
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(fromSale)
  const [successMessage, setSuccessMessage] = useState('')
  const filters = useMemo(() => ({ search, status, page, limit: PAGE_LIMIT }), [page, search, status])
  const customersQuery = useCustomerDirectory(filters)
  const customers = customersQuery.data?.customers ?? []
  const pagination = customersQuery.data?.pagination

  useEffect(() => {
    setSearchInput(search)
  }, [search])
  useEffect(() => {
    if (fromSale) setIsAddCustomerOpen(true)
  }, [fromSale, navigation.flow?.id])

  function closeCustomerModal() {
    if (fromSale) navigation.returnToSale()
    else setIsAddCustomerOpen(false)
  }

  function updateDirectoryParams(nextValues: { search?: string; status?: CustomerDirectoryStatus | ''; page?: number }) {
    const next = new URLSearchParams(searchParams)
    if (nextValues.search !== undefined) {
      const trimmed = nextValues.search.trim()
      if (trimmed) next.set('search', trimmed)
      else next.delete('search')
    }
    if (nextValues.status !== undefined) {
      if (nextValues.status) next.set('status', nextValues.status)
      else next.delete('status')
    }
    if (nextValues.page !== undefined && nextValues.page > 1) next.set('page', String(nextValues.page))
    else if (nextValues.page !== undefined) next.delete('page')
    setSearchParams(next)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateDirectoryParams({ search: searchInput, page: 1 })
  }

  function updateStatus(nextStatus: CustomerDirectoryStatus | '') {
    updateDirectoryParams({ status: nextStatus, page: 1 })
  }

  function clearFilters() {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  const currentPage = pagination?.page ?? page
  const totalPages = pagination?.pages ?? 1
  const hasFilters = Boolean(search || status)

  return <PageContainer className="customers-page"><div className="customer-list-header"><div><h1>Customers</h1><p>Customer ledger accounts</p></div><div className="customer-header-actions">{fromSale && <Button onClick={() => navigation.returnToSale()}>Back to Sale</Button>}<Button variant="primary" onClick={() => setIsAddCustomerOpen(true)}><Plus size={15} /> Add Customer</Button><Button onClick={() => void customersQuery.refetch()} disabled={customersQuery.isFetching}><RefreshCw size={15} /> Refresh</Button></div></div>
    <Panel className="customer-directory-panel">
      <div className="customer-directory-heading"><div><h2>Customer Directory</h2><p>{pagination ? `${pagination.total} customers matching your view` : 'Search customers by name or phone'}</p></div>{hasFilters && <button type="button" className="text-link" onClick={clearFilters}><X size={14} /> Clear filters</button>}</div>
      <div className="customer-directory-toolbar">
        <form className="customer-search-form" onSubmit={submitSearch} role="search" aria-label="Search customers"><label htmlFor="customer-directory-search" className="sr-only">Search customers by name or phone</label><Search size={16} aria-hidden="true" /><input id="customer-directory-search" type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search name or phone" autoComplete="off" /><Button type="submit" variant="primary"><span>Search</span><ArrowRight size={15} /></Button></form>
        <SelectMenu value={status} options={STATUS_OPTIONS} onChange={updateStatus} ariaLabel="Filter customers by status" className="customer-directory-status" />
      </div>

      {customersQuery.isPending && <StateBlock variant="loading" title="Loading customers" message="Fetching customer directory from the server." />}
      {customersQuery.isError && <StateBlock variant="error" title="Customer directory unavailable" message={customersQuery.error.message} action={<Button onClick={() => void customersQuery.refetch()}>Retry</Button>} />}
      {!customersQuery.isPending && !customersQuery.isError && customers.length === 0 && <StateBlock icon={<UsersRound size={24} />} title="No customers found" message={hasFilters ? 'Try changing search or status filters.' : 'No customers have been added for this shop yet.'} action={hasFilters ? <button type="button" className="text-link" onClick={clearFilters}><X size={14} /> Clear filters</button> : <Button variant="primary" onClick={() => setIsAddCustomerOpen(true)}><Plus size={15} /> Add Customer</Button>} />}

      {!customersQuery.isPending && !customersQuery.isError && customers.length > 0 && <>
        <Table className="customer-directory-table"><caption className="sr-only">Customer directory results</caption><TableHead><tr><th scope="col">Customer</th><th scope="col">Phone</th><th scope="col">Address</th><th scope="col">Current Khata</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></TableHead><TableBody>{customers.map(customer => <tr key={customer.id}><td><Link className="customer-name-link" to={`${ROUTES.customers}/${customer.id}`}><strong>{customer.name}</strong></Link></td><td>{customer.phone || 'Not recorded'}</td><td>{customer.address || 'Not recorded'}</td><td><strong className={customer.currentBalancePkr > 0 ? 'customer-balance-due' : 'customer-balance-clear'}>{formatPKR(customer.currentBalancePkr)}</strong></td><td><Badge tone={customer.status === 'active' ? 'success' : 'warning'}>{statusLabel(customer.status)}</Badge></td><td><Link className="customer-open-link" to={`${ROUTES.customers}/${customer.id}`} aria-label={`Open ${customer.name} ledger`}>Open <ArrowRight size={14} aria-hidden="true" /></Link></td></tr>)}</TableBody></Table>
        {pagination && <div className="customer-directory-footer"><span>Page {currentPage} of {totalPages} | {pagination.total} total</span><div><Button disabled={currentPage <= 1} onClick={() => updateDirectoryParams({ page: currentPage - 1 })} aria-label="Previous customer page"><ChevronLeft size={15} /> Previous</Button><Button disabled={currentPage >= totalPages} onClick={() => updateDirectoryParams({ page: currentPage + 1 })} aria-label="Next customer page">Next <ChevronRight size={15} /></Button></div></div>}
      </>}
    </Panel>
    {isAddCustomerOpen && <AddCustomerModal fromSale={fromSale} onClose={closeCustomerModal} onSaved={(customerName, customerId) => {
      setIsAddCustomerOpen(false)
      if (fromSale && customerId) navigation.returnToSale(customerId)
      else setSuccessMessage(`${customerName} was added successfully.`)
    }} />}
    <SuccessToast message={successMessage} onDismiss={() => setSuccessMessage('')} />
  </PageContainer>
}
