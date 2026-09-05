import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const DASHBOARD_ROLES = ['sales_rep', 'sales_manager', 'finance_ops', 'finance', 'operations', 'customer', 'admin'];

export default function RoleRoute({ allow = DASHBOARD_ROLES }) {
  const { user, logout } = useAuth();
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
