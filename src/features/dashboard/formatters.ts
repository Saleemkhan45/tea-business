export const formatDashboardPkr = (value: number) => `PKR ${value.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`
export const formatDashboardKg = (value: number) => `${value.toLocaleString('en-PK', { maximumFractionDigits: 3 })} kg`
