import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { getErrorMessage } from '../../../services/api/apiError';
import { useAuth } from '../../../hooks/useAuth';
import { validatePassword, validatePasswordConfirmation } from '../../../utils/validation';
import '../../quotations/quotation-pages.css';

const PROFILE_ROLES = new Set(['sales_rep', 'sales_manager', 'finance_ops', 'finance']);
const ROLE_LABELS = { sales_rep: 'Sales Representative', sales_manager: 'Sales Manager', finance_ops: 'Finance Manager', finance: 'Finance Manager' };

export default function ProfilePage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!PROFILE_ROLES.has(user?.role)) {
    return <section className="quotation-page"><h1 className="page-title">Profile unavailable</h1><p className="body-copy">Profile settings are available for internal team members.</p><Link to="/dashboard" className="btn btn-outline">Back to dashboard</Link></section>;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFormError('');
    setNotice('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {
      current_password: values.current_password ? '' : 'Current password is required.',
      new_password: validatePassword(values.new_password),
      confirm_password: validatePasswordConfirmation(values.new_password, values.confirm_password),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const response = await changePassword(values);
      setNotice(response?.message || 'Password changed successfully. Please log in again.');
      setValues({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(async () => {
        await logout();
        navigate('/login', { replace: true });
      }, 900);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to change your password.'));
    } finally {
      setSubmitting(false);
    }
  }

  const initials = (user.full_name || 'User').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
   <section className="quotation-page profile-page">
  <div className="quotation-page-header">
    <div>
      <p className="eyebrow">DealFlow360 / Account</p>
      <h1 className="page-title">Profile</h1>
      <p className="subheading">
        Manage your account details and sign-in security.
      </p>
    </div>

    <Link to="/dashboard" className="btn btn-outline">
      Back to dashboard
    </Link>
  </div>

  <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
    <section className="profile-detail-card">
      <div className="flex items-center gap-5">
        <div className="profile-avatar profile-avatar-large shrink-0">
          {initials}
        </div>

        <div className="min-w-0">
          <p className="eyebrow mb-1">Signed in as</p>
          <h2 className="truncate">{user.full_name}</h2>
          <p className="mt-2">{ROLE_LABELS[user.role] || user.role}</p>
          <p className="truncate opacity-70">{user.email}</p>
        </div>
      </div>

      <div className="my-6 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between gap-4">
          <span className="opacity-60">Email verification</span>
          <span className="font-semibold">
            {user.is_email_verified ? "Verified" : "Pending"}
          </span>
        </div>
      </div>
    </section>

    <section className="quotation-form-section">
      <p className="eyebrow">Security</p>
      <h2>Change password</h2>
      <p className="body-copy">
        Use your current password to choose a new one. You will be signed out
        after the change.
      </p>

      {formError && <p className="form-banner">{formError}</p>}
      {notice && <p className="form-banner form-banner-muted">{notice}</p>}

      <form className="auth-form mt-6" onSubmit={handleSubmit} noValidate>
        <Field
          label="Current password"
          name="current_password"
          type="password"
          value={values.current_password}
          onChange={handleChange}
          error={errors.current_password}
          autoComplete="current-password"
        />

        <Field
          label="New password"
          name="new_password"
          type="password"
          value={values.new_password}
          onChange={handleChange}
          error={errors.new_password}
          autoComplete="new-password"
        />

        <Field
          label="Confirm new password"
          name="confirm_password"
          type="password"
          value={values.confirm_password}
          onChange={handleChange}
          error={errors.confirm_password}
          autoComplete="new-password"
        />

        <button
          type="submit"
          className="btn btn-primary mt-1"
          disabled={submitting}
        >
          {submitting ? "Changing password…" : "Change password"}
        </button>
      </form>
    </section>
  </div>
</section>
  );
}
