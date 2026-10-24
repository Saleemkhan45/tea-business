export const SUPPLIER_REGIONS = ['Swat', 'Chitral', 'Peshawar', 'Mansehra', 'Lahore'] as const
export const SUPPLIER_TEA_TYPES = ['Green Tea', 'Black Tea'] as const
export const SUPPLIER_STATUSES = ['Active', 'Inactive'] as const

export type SupplierRegion = (typeof SUPPLIER_REGIONS)[number]
export type SupplierTeaType = (typeof SUPPLIER_TEA_TYPES)[number]
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number]
export type SupplierPurchase = { date: string; quantityKg: number; amount: number; teaType: SupplierTeaType }
export type SupplierRecord = { id: string; name: string; region: SupplierRegion; contactPerson: string; phone: string; email: string; teaTypes: SupplierTeaType[]; status: SupplierStatus; totalPurchasedKg: number; totalCost: number; lastPurchase: string; purchases: SupplierPurchase[]; notes?: string }
export type SupplierFilters = { region: SupplierRegion | ''; teaType: SupplierTeaType | ''; status: SupplierStatus | '' }
