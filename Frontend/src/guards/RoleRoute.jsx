import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { SALES_REP_ROLE } from '../config/constants';
import { useAuth } from '../hooks/useAuth';

export default function RoleRoute({ allow = [SALES_REP_ROLE] }) {
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
