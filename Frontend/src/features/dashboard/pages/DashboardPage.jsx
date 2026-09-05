import { useAuth } from '../../../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <section className="auth-card dashboard-panel">
      <h1 className="page-title">Hello, {user?.full_name}</h1>
      <p className="subheading">You are signed in as a Sales Representative.</p>
      <p className="body-copy">{user?.email}</p>
    </section>
  );
}
