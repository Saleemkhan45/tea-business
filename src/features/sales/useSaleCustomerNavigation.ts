import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useAuthStore } from '../auth/auth.store'
import { createSaleCustomerFlow, finishSaleCustomerFlow, readSaleCustomerFlow, resumeSaleCustomerFlow, withoutSaleCustomerFlow, type SaleDraft } from './saleCustomerNavigation'

export function useSaleCustomerNavigation() {
  const location = useLocation(), navigate = useNavigate()
  const session = useAuthStore(state => state.session)
  const flow = readSaleCustomerFlow(location.state, session)
  function beginCustomerCreation(draft: SaleDraft) {
    if (!session) return
    if (flow) finishSaleCustomerFlow(flow)
    const next = createSaleCustomerFlow(draft, session)
    // Preserve the originating history entry so browser Back also restores the sale.
    if (location.pathname === ROUTES.sales) navigate(location.pathname + location.search, { replace: true, state: { saleCustomerFlow: resumeSaleCustomerFlow(next) } })
    navigate(ROUTES.customers, { state: { saleCustomerFlow: next } })
  }
  function returnToSale(createdCustomerId?: string) {
    if (flow) navigate(ROUTES.sales, { replace: true, state: { saleCustomerFlow: resumeSaleCustomerFlow(flow, createdCustomerId) } })
  }
  function clearNavigationDraft() {
    if (flow) {
      finishSaleCustomerFlow(flow)
      navigate(location.pathname + location.search, { replace: true, state: withoutSaleCustomerFlow(location.state) })
    }
  }
  return { flow, beginCustomerCreation, returnToSale, clearNavigationDraft }
}
