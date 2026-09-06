import { Link, Outlet, useLocation } from 'react-router-dom';

export default function AuthLayout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className={`auth-shell ${isLanding ? 'landing-auth-shell' : ''}`}>
      <header className="auth-topbar">
        <Link to="/" className="brand-mark">
          DealFlow360
        </Link>
      </header>
      <main className={`auth-stage ${isLanding ? 'landing-auth-stage' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
