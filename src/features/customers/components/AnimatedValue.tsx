import { useAnimatedNumber } from '../../../components/shared'
import { formatPKR } from '../../../business/utils/formatters'
import { formatLedgerQuantity } from '../utils/customerLedgerUi'

type AnimatedValueProps = { value: number; format?: 'pkr' | 'kg' | 'integer' }

export function AnimatedValue({ value, format = 'pkr' }: AnimatedValueProps) {
  const { displayValue, highlight } = useAnimatedNumber(value, { animationKey: value, initialFromZero: false })
  const formatValue = (number: number) => format === 'kg'
    ? formatLedgerQuantity(number)
    : format === 'integer'
      ? new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(number)
      : formatPKR(Math.round(number))

  return <span className={`customer-animated-value ${highlight ? 'is-updated' : ''}`} aria-label={formatValue(value)}>
    <span aria-hidden="true">{formatValue(displayValue)}</span>
  </span>
}
