import { ArrowLeft, BanknoteArrowDown, PackagePlus, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Button } from '../../../components/shared'
import { ROUTES } from '../../../constants/routes'
import type { CustomerProfile } from '../../customer-ledger'

type Props = {
  customer?: CustomerProfile | null
  onPurchase: () => void
  onPayment: () => void
  onPrint?: () => void
}

function statusTone(status?: CustomerProfile['status']) {
  if (status === 'active') return 'success'
  if (status === 'inactive') return 'warning'
  return 'neutral'
}

function statusLabel(status?: CustomerProfile['status']) {
  if (status === 'active') return 'Active'
  if (status === 'inactive') return 'Inactive'
  return 'Profile unavailable'
}

export function CustomerHeader({ customer, onPurchase, onPayment, onPrint }: Props) {
  const name = customer?.name?.trim() || 'Customer account'
  const phone = customer?.phone?.trim()
  const address = customer?.address?.trim()

  return <header className="customer-detail-header">
    <div className="customer-detail-title">
      <Link className="customer-back-link" to={ROUTES.customers}><ArrowLeft size={16} /> Back to customers</Link>
      <div className="customer-detail-identity">
        <h1>{name}</h1>
        <div className="customer-profile-meta">
          {customer ? <Badge tone={statusTone(customer.status)}>{statusLabel(customer.status)}</Badge> : <Badge tone="neutral">Profile unavailable</Badge>}
          {phone && <span className="customer-detail-pill">{phone}</span>}
          {address && <span className="customer-detail-pill customer-detail-address">{address}</span>}
        </div>
      </div>
    </div>
    <div className="customer-header-actions">
      {onPrint && <Button onClick={onPrint}><Printer size={16} /> Print</Button>}
      <Button onClick={onPurchase} disabled={customer?.status !== 'active'}><PackagePlus size={16} /> Add Sale</Button>
      <Button variant="primary" onClick={onPayment} disabled={customer?.status !== 'active'}><BanknoteArrowDown size={16} /> Receive Payment</Button>
    </div>
  </header>
}
