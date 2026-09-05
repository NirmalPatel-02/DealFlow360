import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const DASHBOARD_ROLES = ['sales_rep', 'sales_manager', 'finance_ops', 'finance', 'operations', 'customer'];

export default function RoleRoute({ allow = DASHBOARD_ROLES }) {
  const { user, logout } = useAuth();

  // Admin portal is strictly separate at /admin
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const allowed = Boolean(user && allow.includes(user.role));

  useEffect(() => {
    if (!allowed) {
      logout();
    }
  }, [allowed, logout]);

  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
