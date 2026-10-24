export const REGION_NAMES = ['Islamabad', 'Lahore', 'Peshawar', 'Karachi', 'Rawalpindi'] as const
export const REGION_STATUSES = ['Active', 'Paused'] as const

export type RegionName = string
export type RegionStatus = (typeof REGION_STATUSES)[number]

export type RegionTransaction = { date: string; type: string; teaType: 'Green Tea' | 'Black Tea'; amount: string }
export type RegionRecord = {
  id: string
  name: RegionName
  city: string
  manager: string
  status: RegionStatus
  sales: number
  todaySales: number
  orders: number
  teaSoldKg: number
  purchaseCost: number
  profit: number
  performance: number
  greenTeaSales: number
  blackTeaSales: number
  currentStock: number
  recentTransactions: RegionTransaction[]
}
