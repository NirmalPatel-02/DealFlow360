import { Link, Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <Link to="/" className="brand-mark">
          DealFlow360
        </Link>
      </header>
      <main className="auth-stage">
        <Outlet />
      </main>
    </div>
  );
}
