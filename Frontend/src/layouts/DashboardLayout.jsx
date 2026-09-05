import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const profileRoles = ['sales_rep', 'sales_manager', 'finance_ops', 'finance'];

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/dashboard" className="brand-mark">
          DealFlow360
        </Link>
        <div className="app-topbar-meta">
          {profileRoles.includes(user?.role) && location.pathname !== '/profile' ? (
            <Link to="/profile" className="profile-icon-link" aria-label="Open profile" title="Profile">
              <span aria-hidden="true">◎</span>
            </Link>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
