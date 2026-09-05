import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const profileRoles = ['sales_rep', 'sales_manager', 'finance_ops', 'finance'];

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div style={{ display: 'flex', alignItem: 'center' }}>
          <Link to="/dashboard" className="brand-mark">
            DealFlow360
          </Link>
          <nav className="app-topbar-nav">
            <Link
              to="/dashboard"
              className={`topbar-nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
            >
              Dashboard
            </Link>
            {profileRoles.includes(user?.role) && (
              <>
                <Link
                  to="/fulfillment"
                  className={`topbar-nav-link ${location.pathname.startsWith('/fulfillment') ? 'active' : ''}`}
                >
                  Fulfillment & Logistics
                </Link>
                <Link
                  to="/billing"
                  className={`topbar-nav-link ${
                    location.pathname.startsWith('/billing') || location.pathname.startsWith('/invoices')
                      ? 'active'
                      : ''
                  }`}
                >
                  Billing & Invoicing
                </Link>
              </>
            )}
          </nav>
        </div>
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
