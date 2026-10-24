import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Receipt, Search, ShoppingBag, Users, X } from 'lucide-react'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'
import { useAuthStore } from '../auth/auth.store'
import { resultPath, searchDashboard, type SearchCategory } from './search.api'
import './globalSearch.css'

const categories = [{ id: 'customers', label: 'Customers', icon: Users }, { id: 'sales', label: 'Sales', icon: Receipt }, { id: 'purchases', label: 'Purchases', icon: ShoppingBag }] as const

export function Highlight({ text, term }: { text: string; term: string }) {
  const index = text.toLowerCase().indexOf(term.toLowerCase())
  return !term || index < 0 ? <>{text}</> : <>{text.slice(0, index)}<mark>{text.slice(index, index + term.length)}</mark>{text.slice(index + term.length)}</>
}

export function GlobalSearchModal({ onClose, triggerRef }: { onClose: () => void; triggerRef?: React.RefObject<HTMLButtonElement | null> }) {
  const [category, setCategory] = useState<SearchCategory>('customers')
  const [input, setInput] = useState('')
  const [term, setTerm] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const session = useAuthStore(state => state.session)
  const revision = useAuthStore(state => state.revision)
  useEffect(() => { const timer = setTimeout(() => setTerm(input.trim()), 300); return () => clearTimeout(timer) }, [input])
  const ready = term.length >= 2 && term === input.trim()
  const query = useQuery({ queryKey: ['global-search', session?.user.shopId, session?.user.id, revision, category, term], queryFn: ({ signal }) => searchDashboard(category, term, signal), enabled: ready && Boolean(session), retry: false, staleTime: 15000, gcTime: 0 })
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog.current?.showModal()
    field.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow; (triggerRef?.current ?? previous)?.focus() }
  }, [])
  function go(id?: string) { onClose(); navigate(resultPath(category, id)) }
  function moveResult(event: React.KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const buttons = Array.from(results.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    if (!buttons.length) return
    event.preventDefault()
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    buttons[(current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
  }
  return createPortal(<dialog ref={dialog} className="global-search-dialog" aria-labelledby="global-search-title" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [href]') ?? [])
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) { const rect = dialog.current!.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }}>
    <header><h2 id="global-search-title">Search</h2><button type="button" aria-label="Close search" onClick={onClose}><X size={20} /></button></header>
    <div className="global-search-field"><Search size={19} aria-hidden="true" /><input ref={field} aria-label="Search records" placeholder="Search names, references or dates…" maxLength={100} value={input} onChange={event => setInput(event.target.value)} onKeyDown={moveResult} /></div>
    <div role="tablist" aria-label="Search category" className="global-search-tabs">{categories.map(({ id, label, icon: Icon }, index) => <button key={id} type="button" role="tab" id={`search-tab-${id}`} aria-selected={category === id} aria-controls="search-results" tabIndex={category === id ? 0 : -1} onClick={() => setCategory(id)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3
      setCategory(categories[next].id)
      document.getElementById(`search-tab-${categories[next].id}`)?.focus()
    }}><Icon size={17} aria-hidden="true" />{label}</button>)}</div>
    <div id="search-results" role="tabpanel" aria-labelledby={`search-tab-${category}`} className="global-search-results" ref={results} onKeyDown={moveResult} aria-busy={ready && query.isFetching}>
      {!ready ? <p className="global-search-message" role="status">Type at least 2 characters to search {category}.</p> : query.isFetching ? <div className="global-search-message"><LoadingSpinner label="Searching records" showLabel /></div> : query.isError ? <div className="global-search-message" role="alert"><p>{query.error.message}</p><button type="button" onClick={() => void query.refetch()}>Retry search</button></div> : !query.data?.length ? <p className="global-search-message" role="status">No {category} found. Try another search.</p> : <><span className="sr-only" role="status">{query.data.length} results</span>{query.data.map(row => <button type="button" className="global-search-result" key={row.id} onClick={() => go(row.id)}><span className="global-search-result-copy"><strong><Highlight text={row.title} term={term} /></strong>{row.reference && <small><Highlight text={row.reference} term={term} /></small>}<small><Highlight text={row.description} term={term} />{row.date && ` · ${row.date}`}</small></span>{row.total !== undefined && <span className="global-search-amount"><strong>PKR {row.total.toLocaleString('en-PK')}</strong><small>{row.status}</small></span>}</button>)}</>}
    </div>
    <footer><span>↑ ↓ Navigate · Enter Open</span><button type="button" onClick={() => go()}>View All {category}</button></footer>
  </dialog>, document.body)
}
