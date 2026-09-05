import { useLocation, Link } from 'react-router-dom';
import SketchHighlight from '../../../components/ui/SketchHighlight.jsx';
import LoginForm from '../components/LoginForm.jsx';

export default function LoginPage() {
  const location = useLocation();
  const notice = location.state?.notice;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="page-title text-ink text-4xl font-bold">Welcome back</h1>
      <p className="subheading">Sign in to your DealFlow360 workspace.</p>
    <section className="auth-card">
    
      <p className="body-copy">
        Only <SketchHighlight>Sales Representatives</SketchHighlight> can log in here.
      </p>
      {notice ? <p className="form-banner form-banner-muted">{notice}</p> : null}
      <LoginForm />
      <p className="auth-footer">
        Need an account? <Link to="/register">Register</Link> • <Link to="/admin/login">Admin Console</Link>
      </p>
    </section>
    </div>
  );
}
