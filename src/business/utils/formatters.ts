const PKR_NUMBER_FORMATTER = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const QUANTITY_FORMATTER = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const PERCENTAGE_FORMATTER = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be a finite number.`)
}

export function roundCurrency(value: number): number {
  assertFinite(value, 'Currency value')
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function roundQuantity(value: number): number {
  assertFinite(value, 'Quantity')
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

export function roundPercentage(value: number): number {
  assertFinite(value, 'Percentage')
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatPKR(value: number): string {
  return `PKR ${PKR_NUMBER_FORMATTER.format(roundCurrency(value))}`
}

export function formatQuantity(value: number): string {
  return `${QUANTITY_FORMATTER.format(roundQuantity(value))} kg`
}

export function formatPercentage(value: number): string {
  return `${PERCENTAGE_FORMATTER.format(roundPercentage(value))}%`
}
