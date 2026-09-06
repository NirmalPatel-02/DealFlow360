import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import SalesRepDashboard from '../components/SalesRepDashboard';
import SalesManagerDashboard from '../components/SalesManagerDashboard';
import FinanceDashboard from '../components/FinanceDashboard';

export default function DashboardPage() {
  const { user, isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="page-status">
        <p>Loading dashboard…</p>
      </div>
    );
  }

  // Route to role-based dashboard
  switch (user?.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'sales_rep':
      return <SalesRepDashboard />;
    case 'sales_manager':
      return <SalesManagerDashboard />;
    case 'finance_ops':
    case 'finance':
    case 'operations':
      return <FinanceDashboard />;
    case 'customer':
      return <CustomerDashboard />;
    default:
      return (
        <section className="auth-card dashboard-panel">
          <h1 className="page-title">Welcome, {user?.full_name}</h1>
          <p className="subheading">Role: {user?.role || 'Unknown'}</p>
          <p className="body-copy">Dashboard not configured for your role.</p>
        </section>
      );
  }
}

// Placeholder Customer Dashboard (to be implemented with customer-specific APIs)
function CustomerDashboard() {
  return (
    <section className="auth-card dashboard-panel">
      <h1 className="page-title">Customer Portal</h1>
      <p className="subheading">View and respond to quotations from your sales representative.</p>
      <p className="body-copy" style={{ marginTop: '1rem' }}>
        Customer portal features:
      </p>
      <ul style={{ marginTop: '1rem', marginLeft: '2rem' }}>
        <li>View quotations sent to you</li>
        <li>Request modifications to quote lines</li>
        <li>Negotiate discounts and terms</li>
        <li>Confirm final quotation</li>
        <li>View order history</li>
      </ul>
    </section>
  );
}
