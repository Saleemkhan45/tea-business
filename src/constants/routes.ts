export const ROUTES = {
  dashboard: '/dashboard',
  sales: '/sales',
  customers: '/customers',
  purchases: '/purchases',
  purchaseHistory: '/purchases/history',
  inventory: '/inventory',
  cashBook: '/cash-book',
  regions: '/regions',
  suppliers: '/suppliers',
  reports: '/reports',
  notifications: '/notifications',
  settings: '/settings',
} as const

export const ROUTE_LABELS: Record<string, string> = {
  [ROUTES.dashboard]: 'Dashboard',
  [ROUTES.sales]: 'Sales',
  [ROUTES.customers]: 'Customers',
  [ROUTES.purchases]: 'Purchases',
  [ROUTES.purchaseHistory]: 'Purchase History',
  [ROUTES.inventory]: 'Inventory',
  [ROUTES.cashBook]: 'Cash Book',
  [ROUTES.regions]: 'Regions',
  [ROUTES.suppliers]: 'Suppliers',
  [ROUTES.reports]: 'Reports',
  [ROUTES.notifications]: 'Notifications',
  [ROUTES.settings]: 'Settings',
}
