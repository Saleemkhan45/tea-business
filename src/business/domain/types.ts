export type EntityId = string
export type BusinessDate = string
export type IsoTimestamp = string

export type TeaType = 'green' | 'black'
export type MovementType =
  | 'opening_balance'
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'reversal'

export type TransactionStatus = 'pending' | 'completed' | 'cancelled' | 'voided'
export type SaleStatus = TransactionStatus
export type PurchaseStatus = TransactionStatus | 'in_transit'
export type EntityStatus = 'active' | 'inactive'
export type PaymentDirection = 'incoming' | 'outgoing'
export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export type MovementSourceType = 'opening_balance' | 'sale' | 'purchase' | 'adjustment' | 'transfer'

export type DateRange = {
  startDate: BusinessDate
  endDate: BusinessDate
}

export type Operator = {
  id: EntityId
  name: string
  role: string
  status: EntityStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type Region = {
  id: EntityId
  code: string
  name: string
  status: EntityStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type StockLocation = {
  id: EntityId
  regionId: EntityId
  code: string
  name: string
  status: EntityStatus
  lowStockThresholdKg: number
  capacityKg?: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type Supplier = {
  id: EntityId
  sourceRegionId: EntityId
  name: string
  contactPerson: string
  phone?: string
  email?: string
  teaTypes: TeaType[]
  status: EntityStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type Sale = {
  id: EntityId
  reference: string
  businessDate: BusinessDate
  customerName: string
  stockLocationId: EntityId
  teaType: TeaType
  quantityKg: number
  unitPrice: number
  totalAmount: number
  status: SaleStatus
  enteredByUserId: EntityId
  notes?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
  voidedAt?: IsoTimestamp
  voidedByUserId?: EntityId
}

export type Purchase = {
  id: EntityId
  purchaseNumber: number
  businessDate: BusinessDate
  sourceRegionId: EntityId
  destinationLocationId: EntityId
  supplierId: EntityId
  teaType: TeaType
  quantityKg: number
  costPerKg: number
  taxAmount: number
  discountAmount: number
  shippingAmount: number
  totalCost: number
  status: PurchaseStatus
  enteredByUserId: EntityId
  notes?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
  voidedAt?: IsoTimestamp
  voidedByUserId?: EntityId
}

export type InventoryMovement = {
  id: EntityId
  businessDate: BusinessDate
  type: MovementType
  stockLocationId: EntityId
  teaType: TeaType
  quantityDeltaKg: number
  sourceType: MovementSourceType
  sourceId: EntityId
  correlationId: EntityId
  createdByUserId: EntityId
  createdAt: IsoTimestamp
  reason?: string
  reversesMovementId?: EntityId
}

export type Payment = {
  id: EntityId
  transactionType: 'sale' | 'purchase'
  transactionId: EntityId
  direction: PaymentDirection
  amount: number
  method: PaymentMethod
  businessDate: BusinessDate
  reference?: string
  notes?: string
  createdByUserId: EntityId
  createdAt: IsoTimestamp
}

export type BusinessData = {
  regions: Region[]
  locations: StockLocation[]
  suppliers: Supplier[]
  users: Operator[]
  sales: Sale[]
  purchases: Purchase[]
  payments: Payment[]
  inventoryMovements: InventoryMovement[]
}

export type OperationOptions = {
  now?: Date
  idFactory?: (prefix: string) => EntityId
}

export type BusinessOperationResult<TEntity> = {
  state: BusinessData
  entity: TEntity
  movements: InventoryMovement[]
}

export type InventoryMovementFilter = {
  locationId?: EntityId
  teaType?: TeaType
  type?: MovementType
  sourceType?: MovementSourceType
  sourceId?: EntityId
  dateRange?: DateRange
}

export type StockByLocation = {
  locationId: EntityId
  greenKg: number
  blackKg: number
  totalKg: number
}

export type LowStockItem = {
  locationId: EntityId
  teaType: TeaType
  currentStockKg: number
  thresholdKg: number
  status: 'low_stock' | 'out_of_stock'
}
