import { useEffect, useLayoutEffect, useRef, useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { Button } from '../../../components/shared'
import { formatPKR } from '../../../business/utils/formatters'
import { getCustomerLedgerErrorMessage, useCustomerById, useCustomerDirectory, type CustomerDirectoryItem, type CustomerProfile } from '../../customer-ledger'

type Props = {
  value: string
  onSelect: (customer: CustomerProfile) => void
  onAddNewCustomer?: () => void
  error?: string
  allowNew?: boolean
}

export function customerMatchesSearch(customer: Pick<CustomerDirectoryItem, 'name' | 'phone'>, search: string) {
  const query = search.trim().toLocaleLowerCase()
  return !query || customer.name.toLocaleLowerCase().includes(query) || customer.phone.toLocaleLowerCase().includes(query)
}
export function moveCustomerHighlight(current: number, count: number, key: 'ArrowDown' | 'ArrowUp') {
  if (count <= 0) return -1
  if (key === 'ArrowDown') return current < 0 || current >= count - 1 ? 0 : current + 1
  return current <= 0 ? count - 1 : current - 1
}

export function CustomerSelector({ value, onSelect, onAddNewCustomer, error, allowNew = true }: Props) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [changing, setChanging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 })
  const query = search.trim()
  const visible = open && Boolean(query) && (!value || changing)
  const directory = useCustomerDirectory({ search: debouncedSearch, status: 'active', page, limit: 8 }, visible && query === debouncedSearch)
  const profile = useCustomerById(value || undefined)
  const customers = (query === debouncedSearch ? directory.data?.customers ?? [] : []).filter(customer => customerMatchesSearch(customer, query)).slice(0, 8)
  const resultsId = useId()

  useEffect(() => {
    const timeout = window.setTimeout(() => { setDebouncedSearch(search.trim()) }, 250)
    return () => window.clearTimeout(timeout)
  }, [search])
  useEffect(() => setActiveIndex(customers.length > 0 ? 0 : -1), [debouncedSearch, directory.data, search])

  useLayoutEffect(() => {
    if (!visible) return
    function positionMenu() {
      const rect = inputRef.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom - 12
      const above = rect.top - 12
      const flip = below < 280 && above > below
      const maxHeight = Math.min(280, Math.max(0, flip ? above : below))
      const height = Math.min(menuRef.current?.scrollHeight ?? maxHeight, maxHeight)
      setPosition({ top: flip ? rect.top - height - 6 : rect.bottom + 6, left: Math.max(6, Math.min(rect.left, window.innerWidth - rect.width - 6)), width: Math.min(rect.width, window.innerWidth - 12), maxHeight })
    }
    function outside(event: PointerEvent) {
      const target = event.target as Node
      if (!inputRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    positionMenu()
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [visible, directory.data, directory.isFetching, directory.isError, query])
  useEffect(() => {
    if (visible && activeIndex >= 0) menuRef.current?.querySelectorAll('[role="option"]')[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [visible, activeIndex])

  function selectCustomer(customer: CustomerProfile) { onSelect(customer); setOpen(false); setChanging(false); setSearch(''); setDebouncedSearch(''); window.requestAnimationFrame(() => selectionRef.current?.focus()) }
  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!query) return
      event.preventDefault(); setOpen(true)
      setActiveIndex(current => moveCustomerHighlight(current, customers.length, event.key as 'ArrowDown' | 'ArrowUp'))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (visible && activeIndex >= 0 && customers[activeIndex]) selectCustomer(customers[activeIndex])
    } else if (event.key === 'Tab') {
      const action = menuRef.current?.querySelector<HTMLButtonElement>('button:not([role="option"]):not(:disabled)')
      if (!event.shiftKey && visible && action) { event.preventDefault(); action.focus() } else setOpen(false)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false)
    }
  }

  return <div className="form-field form-field-wide sale-customer-selector">
    <span>Customer</span>
    {value && <button ref={selectionRef} type="button" className="sale-selection-summary" onClick={() => { setChanging(true); setSearch(''); setPage(1); setOpen(false); window.requestAnimationFrame(() => inputRef.current?.focus()) }} aria-label="Change selected customer">
      <strong>{profile.isError ? 'Customer unavailable' : profile.data?.customer.name ?? 'Loading customer...'}</strong><span className="sale-customer-change">Change Customer</span>
      <small>{profile.data?.customer.phone || 'No phone recorded'}</small>
      <small>{profile.data?.customer.address || [profile.data?.customer.region, profile.data?.customer.city].filter(Boolean).join(' | ') || 'Address not recorded'}</small>
    </button>}
    {(!value || changing) && <label className="sale-selector-search"><Search size={16} aria-hidden="true" /><input ref={inputRef} role="combobox" aria-label="Search customer by name or phone" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? resultsId : undefined} aria-activedescendant={visible && activeIndex >= 0 && customers[activeIndex] ? `${resultsId}-${customers[activeIndex]?.id}` : undefined} placeholder="Search customer by name..." maxLength={80} autoComplete="off" value={search} onFocus={() => setOpen(true)} onChange={event => { setSearch(event.target.value); setPage(1); setActiveIndex(-1); setOpen(true) }} onKeyDown={handleSearchKeyDown} /></label>}
    {visible && typeof document !== 'undefined' && createPortal(<div ref={menuRef} className="sale-customer-popover" style={position} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== inputRef.current) setOpen(false) }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); inputRef.current?.focus() } }}>
      <div id={resultsId} className="sale-selector-results" role="listbox" aria-label="Customer search results" aria-busy={directory.isFetching}>
        {query !== debouncedSearch || directory.isPending ? <p role="status">Searching customers...</p> : directory.isError ? <div role="alert">Unable to search customers. {getCustomerLedgerErrorMessage(directory.error)} <Button type="button" onClick={() => void directory.refetch()}>Retry</Button></div> : customers.length === 0 ? <p>No customers found.</p> : customers.map((customer, index) => <button type="button" role="option" id={`${resultsId}-${customer.id}`} key={customer.id} aria-selected={customer.id === value} className={index === activeIndex ? 'is-active' : ''} tabIndex={-1} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectCustomer(customer)}>
          <span><strong>{customer.name}</strong><small>{customer.phone || 'No phone recorded'}</small><small>{customer.address || [customer.region, customer.city].filter(Boolean).join(' | ') || 'Address not recorded'}</small></span>
          <small>{formatPKR(Math.abs(customer.currentBalancePkr))} {customer.currentBalancePkr < 0 ? 'credit' : 'due'}</small>
        </button>)}
      </div>
      {query === debouncedSearch && !directory.isError && directory.data && directory.data.pagination.pages > 1 && <div className="sale-selector-pagination">
        <Button type="button" aria-label="Previous customers" title="Previous customers" disabled={page <= 1 || directory.isFetching} onClick={() => setPage(current => current - 1)}><ChevronLeft size={16} /></Button>
        <span>{page} / {directory.data.pagination.pages}</span>
        <Button type="button" aria-label="Next customers" title="Next customers" disabled={page >= directory.data.pagination.pages || directory.isFetching} onClick={() => setPage(current => current + 1)}><ChevronRight size={16} /></Button>
      </div>}
    </div>, document.body)}
    {allowNew && onAddNewCustomer && <Button type="button" variant="ghost" className="sale-add-customer-action" onClick={onAddNewCustomer}><Plus size={15} /> Add New Customer</Button>}
    {profile.isError && <small className="field-error" role="alert">Customer unavailable. <button type="button" onClick={() => void profile.refetch()}>Retry</button></small>}
    {error && <small className="field-error" role="alert">{error}</small>}
  </div>
}
