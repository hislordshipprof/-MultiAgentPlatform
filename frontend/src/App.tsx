import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import CustomerDashboard from './pages/customer/Dashboard'
import Layout from './components/Layout'
import { ProtectedRoute } from './components/common/ProtectedRoute'

// Admin pages
import AdminOverview from './pages/admin/Overview'
import AdminShipments from './pages/admin/Shipments'
import AdminRoutes from './pages/admin/Routes'
import AdminIssues from './pages/admin/Issues'
import AdminEscalations from './pages/admin/Escalations'
import AdminDeliveryChanges from './pages/admin/DeliveryChanges'
import AdminMetrics from './pages/admin/Metrics'
import AdminMetricsAdmin from './pages/admin/MetricsAdmin'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        {/* Customer Routes */}
        <Route path="customer" element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerDashboard />
          </ProtectedRoute>
        } />
        
        {/* Admin Routes */}
        <Route path="admin" element={<Navigate to="/dashboard/admin/overview" replace />} />
        <Route path="admin/overview" element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'dispatcher']}>
            <AdminOverview />
          </ProtectedRoute>
        } />
        <Route path="admin/shipments" element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'dispatcher']}>
            <AdminShipments />
          </ProtectedRoute>
        } />
        <Route path="admin/routes" element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'dispatcher', 'driver']}>
            <AdminRoutes />
          </ProtectedRoute>
        } />
        <Route path="admin/issues" element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'dispatcher']}>
            <AdminIssues />
          </ProtectedRoute>
        } />
        <Route path="admin/escalations" element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <AdminEscalations />
          </ProtectedRoute>
        } />
        <Route path="admin/delivery-changes" element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <AdminDeliveryChanges />
          </ProtectedRoute>
        } />
        <Route path="admin/metrics" element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'dispatcher']}>
            <AdminMetrics />
          </ProtectedRoute>
        } />
        <Route path="admin/metrics-admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminMetricsAdmin />
          </ProtectedRoute>
        } />
        
        {/* Default redirect */}
        <Route index element={<Navigate to="/dashboard/customer" replace />} />
      </Route>
    </Routes>
  )
}

export default App
