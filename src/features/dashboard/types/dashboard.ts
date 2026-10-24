export type SalesPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
export type CategoryStatistic = {
  label: string
  orders: number
  percent: number
  color: string
  tone: 'blue' | 'orange' | 'green'
}

