import { Link } from 'react-router-dom';
import SketchHighlight from '../../../components/ui/SketchHighlight.jsx';

export default function LandingPage() {
  return (
    <section className="landing">
      <p className="eyebrow">Deal operating system</p>
      <h1 className="display-title">
        Close cleaner deals with{' '}
        <SketchHighlight>DealFlow360</SketchHighlight>
      </h1>
      <p className="subheading">Built for sales teams that need control, not clutter.</p>
      <p className="body-copy landing-copy">
        Registration and access are limited to{' '}
        <SketchHighlight>Sales Representatives</SketchHighlight>. Choose how you want to
        continue.
      </p>
      <div className="landing-actions">
        <Link to="/login" className="btn btn-primary btn-xl">
          Login
        </Link>
        <Link to="/register" className="btn btn-outline btn-xl">
          Register
        </Link>
      </div>
    </section>
  );
}
