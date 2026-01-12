import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect based on role
    if (user.role === 'driver') {
      return <Navigate to="/dashboard/admin/routes" replace />;
    } else if (['admin', 'manager', 'dispatcher'].includes(user.role)) {
      return <Navigate to="/dashboard/admin/overview" replace />;
    }
    return <Navigate to="/dashboard/customer" replace />;
  }

  return <>{children}</>;
}
