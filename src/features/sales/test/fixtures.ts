import type { SaleDto, SaleWriteInput } from '../types/salesApi'

export const customerId = '507f1f77bcf86cd799439011'
export const stockLocationId = '507f1f77bcf86cd799439012'
export const saleId = '507f1f77bcf86cd799439013'
export const saleInput: SaleWriteInput = {
  businessDate: '2026-10-02', customerName: 'Counter customer', teaType: 'green',
  stockLocationId, quantityKg: 2, unitPrice: 500, paymentMethod: 'cash', status: 'completed', notes: null,
}
export const sale: SaleDto = {
  _id: saleId, shop: '507f1f77bcf86cd799439014', customerName: 'Counter customer',
  businessDate: '2026-10-02', teaType: 'green', stockLocationId, quantityKg: 2,
  unitPrice: 500, totalAmount: 1000, status: 'completed', paymentMethod: 'cash',
  createdBy: '507f1f77bcf86cd799439015', notes: null, inventoryMovements: [], editHistory: [],
  createdAt: '2026-10-02T08:00:00.000Z', updatedAt: '2026-10-02T08:00:00.000Z', __v: 0,
}
