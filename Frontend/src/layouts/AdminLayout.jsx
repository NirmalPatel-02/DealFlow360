import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/admin" className="brand-mark">
            DealFlow360 <span>Admin</span>
          </Link>
          <Link
            to="/dashboard"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.85rem' }}
          >
            ← View Sales App
          </Link>
        </div>
        <div className="admin-topbar-actions">
          <span className="admin-mode-badge" style={{ textTransform: 'capitalize' }}>
            {user?.role?.replace('_', ' ') || 'Admin'}
          </span>
          <span>{user?.full_name || user?.email}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
