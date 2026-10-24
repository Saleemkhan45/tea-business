import { ShieldAlert } from 'lucide-react'
import { useAuthStore } from '../auth/auth.store'
import type { CashStatus } from './api'

export function CashSetupStatus({ setup }: { setup?: CashStatus['setup'] }) {
  const owner = useAuthStore(state => state.session?.user.role === 'owner')
  return <div className="cash-setup-status" role="status">
    <div className="cash-availability"><ShieldAlert size={18} aria-hidden="true" /><div><strong>Saving unavailable</strong><p>Cash Book saving is not available yet. Database setup is required.</p></div></div>
    {owner ? <details><summary>Administrator setup steps</summary>
      <p>Review the approved activation procedure in <code>docs/manual-cash-book-setup.md</code> with your database administrator. Existing records and constraints must be inspected first. This screen never performs database setup.</p>
      {setup && <p>Readiness finding: {setup.collection ?? 'manual Cash Book'} — {setup.reason === 'collection_missing' ? 'collection missing' : 'required index configuration needs review'}.</p>}
    </details> : <p className="cash-setup-contact">Contact the shop owner to arrange approved activation.</p>}
  </div>
}
