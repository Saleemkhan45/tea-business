import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy } from 'react'
import { RouteContent } from '../components/shared/RouteContent'
import { MainLayout } from '../layouts/MainLayout'
import { ROUTES } from '../constants/routes'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { NotificationProvider } from '../features/notifications'

const CashBookPage = lazy(() => import('../features/cashbook/CashBookPage').then(module => ({ default: module.CashBookPage })))
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const SalesPage = lazy(() => import('../pages/SalesPage').then(module => ({ default: module.SalesPage })))
const PurchasesPage = lazy(() => import('../pages/PurchasesPage').then(module => ({ default: module.PurchasesPage })))
const PurchaseHistoryPage = lazy(() => import('../pages/PurchaseHistoryPage').then(module => ({ default: module.PurchaseHistoryPage })))
const InventoryPage = lazy(() => import('../pages/InventoryPage').then(module => ({ default: module.InventoryPage })))
const RegionsPage = lazy(() => import('../pages/RegionsPage').then(module => ({ default: module.RegionsPage })))
const SuppliersPage = lazy(() => import('../pages/SuppliersPage').then(module => ({ default: module.SuppliersPage })))
const ReportsPage = lazy(() => import('../pages/ReportsPage').then(module => ({ default: module.ReportsPage })))
const NotificationsPage = lazy(() => import('../pages/NotificationsPage').then(module => ({ default: module.NotificationsPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(module => ({ default: module.SettingsPage })))
const CustomersPage = lazy(() => import('../features/customers/pages/CustomersPage').then(module => ({ default: module.CustomersPage })))
const CustomerDetailPage = lazy(() => import('../features/customers/pages/CustomerDetailPage').then(module => ({ default: module.CustomerDetailPage })))
const VerifyEmailPage = lazy(() => import('../features/auth/VerifyEmailPage').then(module => ({ default: module.VerifyEmailPage })))
const LoginPage = lazy(() => import('../features/auth/LoginPage').then(module => ({ default: module.LoginPage })))
const PlaceholderPage = lazy(() => import('../pages/PlaceholderPage').then(module => ({ default: module.PlaceholderPage })))

function AuthenticatedLayout() {
  return <NotificationProvider><MainLayout /></NotificationProvider>
}

export function AppRouter() {
  return <RouteContent><Routes>
    <Route path="/login" element={<LoginPage />} /><Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AuthenticatedLayout />}>
        <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        <Route path={ROUTES.sales} element={<SalesPage />} />
        <Route path={ROUTES.customers} element={<CustomersPage />} />
        <Route path={`${ROUTES.customers}/whatsapp`} element={<Navigate to={ROUTES.customers} replace />} />
        <Route path={`${ROUTES.customers}/:customerId`} element={<CustomerDetailPage />} />
        <Route path={ROUTES.purchases} element={<PurchasesPage />} />
        <Route path={ROUTES.purchaseHistory} element={<PurchaseHistoryPage />} />
        <Route path={ROUTES.inventory} element={<InventoryPage />} />
        <Route path={ROUTES.cashBook} element={<CashBookPage />} />
        <Route path={ROUTES.regions} element={<RegionsPage />} />
        <Route path={ROUTES.suppliers} element={<SuppliersPage />} />
        <Route path={ROUTES.reports} element={<ReportsPage />} />
        <Route path={ROUTES.notifications} element={<NotificationsPage />} />
        <Route path={ROUTES.settings} element={<SettingsPage />} />
        <Route path="*" element={<PlaceholderPage />} />
      </Route>
    </Route>
  </Routes></RouteContent>
}
