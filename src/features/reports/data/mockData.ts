import type { ReportsData } from '../types/reports'

export const reportsMockData: ReportsData = {
  salesTrend: [{ label: '01 Jun', value: 62 }, { label: '05 Jun', value: 75 }, { label: '10 Jun', value: 68 }, { label: '15 Jun', value: 88 }, { label: '20 Jun', value: 72 }, { label: '25 Jun', value: 95 }, { label: '30 Jun', value: 108 }],
  purchaseTrend: [{ label: '01 Jun', value: 48 }, { label: '05 Jun', value: 58 }, { label: '10 Jun', value: 54 }, { label: '15 Jun', value: 72 }, { label: '20 Jun', value: 65 }, { label: '25 Jun', value: 82 }, { label: '30 Jun', value: 76 }],
  regions: [
    { region: 'Islamabad', sales: 420000, purchases: 248000, teaSold: 320, profit: 172000 },
    { region: 'Lahore', sales: 310000, purchases: 190000, teaSold: 250, profit: 120000 },
    { region: 'Peshawar', sales: 205000, purchases: 129000, teaSold: 180, profit: 76000 },
    { region: 'Karachi', sales: 650000, purchases: 360000, teaSold: 410, profit: 290000 },
    { region: 'Rawalpindi', sales: 165000, purchases: 98000, teaSold: 80, profit: 67000 },
  ],
  tea: [
    { teaType: 'Green Tea', quantitySold: 620, revenue: 670000, averagePrice: 1081 },
    { teaType: 'Black Tea', quantitySold: 580, revenue: 580000, averagePrice: 1000 },
  ],
  sales: [
    { id: 'TS-0024', date: '2026-09-28', category: 'Green Tea', region: 'Islamabad', itemsSold: 48, totalOrders: 42, grandTotal: 186000, status: 'Completed' },
    { id: 'TS-0023', date: '2026-09-28', category: 'Black Tea', region: 'Lahore', itemsSold: 36, totalOrders: 31, grandTotal: 144000, status: 'Completed' },
    { id: 'TS-0022', date: '2026-09-27', category: 'Herbal Tea', region: 'Karachi', itemsSold: 29, totalOrders: 25, grandTotal: 121000, status: 'Pending' },
    { id: 'TS-0021', date: '2026-09-27', category: 'Kashmiri Chai', region: 'Rawalpindi', itemsSold: 41, totalOrders: 38, grandTotal: 168000, status: 'Completed' },
    { id: 'TS-0020', date: '2026-09-26', category: 'Green Tea', region: 'Peshawar', itemsSold: 34, totalOrders: 29, grandTotal: 137000, status: 'Completed' },
    { id: 'TS-0019', date: '2026-09-26', category: 'Black Tea', region: 'Islamabad', itemsSold: 27, totalOrders: 24, grandTotal: 108000, status: 'Refunded' },
    { id: 'TS-0018', date: '2026-09-25', category: 'Herbal Tea', region: 'Lahore', itemsSold: 38, totalOrders: 33, grandTotal: 152000, status: 'Completed' },
    { id: 'TS-0017', date: '2026-09-24', category: 'Green Tea', region: 'Karachi', itemsSold: 52, totalOrders: 47, grandTotal: 214000, status: 'Completed' },
    { id: 'TS-0016', date: '2026-09-23', category: 'Kashmiri Chai', region: 'Peshawar', itemsSold: 31, totalOrders: 28, grandTotal: 126000, status: 'Completed' },
    { id: 'TS-0015', date: '2026-09-22', category: 'Black Tea', region: 'Rawalpindi', itemsSold: 44, totalOrders: 39, grandTotal: 176000, status: 'Completed' },
    { id: 'TS-0014', date: '2026-09-21', category: 'Green Tea', region: 'Islamabad', itemsSold: 47, totalOrders: 43, grandTotal: 193000, status: 'Pending' },
    { id: 'TS-0013', date: '2026-09-20', category: 'Herbal Tea', region: 'Lahore', itemsSold: 24, totalOrders: 21, grandTotal: 98000, status: 'Completed' },
    { id: 'TS-0012', date: '2026-09-19', category: 'Kashmiri Chai', region: 'Karachi', itemsSold: 55, totalOrders: 49, grandTotal: 228000, status: 'Completed' },
    { id: 'TS-0011', date: '2026-09-18', category: 'Black Tea', region: 'Peshawar', itemsSold: 33, totalOrders: 30, grandTotal: 132000, status: 'Completed' },
    { id: 'TS-0010', date: '2026-09-17', category: 'Green Tea', region: 'Rawalpindi', itemsSold: 28, totalOrders: 26, grandTotal: 116000, status: 'Refunded' },
    { id: 'TS-0009', date: '2026-09-16', category: 'Herbal Tea', region: 'Islamabad', itemsSold: 39, totalOrders: 34, grandTotal: 157000, status: 'Completed' },
    { id: 'TS-0008', date: '2026-09-15', category: 'Black Tea', region: 'Lahore', itemsSold: 46, totalOrders: 41, grandTotal: 184000, status: 'Completed' },
    { id: 'TS-0007', date: '2026-09-14', category: 'Kashmiri Chai', region: 'Karachi', itemsSold: 35, totalOrders: 32, grandTotal: 149000, status: 'Completed' },
  ],
}
