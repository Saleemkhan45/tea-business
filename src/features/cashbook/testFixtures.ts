import type { CashDay, CashDetails, CashHistory, CashOverview, CashStatus } from './api'

export const today = '2026-10-21'
export const operator = { _id: '507f1f77bcf86cd799439002', name: 'Offline Owner' }
export const day: CashDay = { _id: '507f1f77bcf86cd799439001', businessDate: today, shopCashAmount: 7000, bossAddedAmount: 3000, totalCollected: 10000, takenHomeAmount: 8000, remainingCash: 2000, notes: 'Offline manually entered count', revision: 0, enteredBy: operator, lastUpdatedBy: operator, createdAt: '2026-10-21T05:00:00Z', updatedAt: '2026-10-21T05:00:00Z' }
export const yesterday = { ...day, _id: '507f1f77bcf86cd799439003', businessDate: '2026-10-20', notes: 'Yesterday is a reference only' }
export const ready: CashStatus = { ready: true, mode: 'manual_daily', today }
export const overview: CashOverview = { today: { date: today, record: day }, yesterday: { date: yesterday.businessDate, record: yesterday } }
export const history: CashHistory = { rows: [day, yesterday], page: 1, limit: 20, total: 2, from: '2026-10-01', to: today, summary: { shopCashAmount: 14000, bossAddedAmount: 6000, totalCollected: 20000, recordedDays: 2, averageDailyCollection: 10000 } }
export const details: CashDetails = { record: { ...day, revision: 1, takenHomeAmount: 10000, remainingCash: 0 }, page: 1, limit: 20, total: 2, audit: [{ _id: 'audit-correction', revision: 1, action: 'correct', previous: day, next: { ...day, takenHomeAmount: 10000, remainingCash: 0 }, reason: 'Corrected manually verified home amount', modifiedBy: operator, createdAt: '2026-10-21T06:00:00Z' }, { _id: 'audit-create', revision: 0, action: 'create', previous: null, next: day, reason: 'Manual daily record finalized', modifiedBy: operator, createdAt: day.createdAt }] }
