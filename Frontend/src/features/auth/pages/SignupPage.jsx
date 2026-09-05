import { Link } from 'react-router-dom';
import SketchHighlight from '../../../components/ui/SketchHighlight.jsx';
import SignupForm from '../components/SignupForm.jsx';

export default function SignupPage() {
  return (
    <section className="auth-card">
      <h1 className="page-title">Create your account</h1>
      <p className="subheading">Register as a Sales Representative.</p>
      <p className="body-copy">
        New accounts are created for <SketchHighlight>Sales Representatives</SketchHighlight>{' '}
        only. We will email an 8-digit verification code next.
      </p>
      <SignupForm />
      <p className="auth-footer">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
