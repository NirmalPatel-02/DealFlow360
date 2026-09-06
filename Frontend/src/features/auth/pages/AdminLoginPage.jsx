import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { getErrorMessage } from '../../../services/api/apiError';
import { useAuth } from '../../../hooks/useAuth';
import { hasErrors, validateLogin } from '../auth.schema';
import '../../admin/pages/admin.css';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateLogin(values);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      const user = await login({ email: values.email.trim(), password: values.password });
      if (user.role !== 'admin') {
        await logout();
        setFormError('This sign-in is for administrators only.');
        navigate('/', { replace: true });
        return;
      }
      const target = location.state?.from?.startsWith('/admin') ? location.state.from : '/admin';
      navigate(target, { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to sign in to the admin console.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card admin-login-card">
      <p className="eyebrow">DealFlow360 / Control room</p>
      <h1 className="page-title">Admin Login</h1>
      <p className="subheading">Manage the catalog, access, and commercial tiers.</p>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError ? <p className="form-banner">{formError}</p> : null}
        <Field label="Admin email" name="email" type="email" value={values.email} onChange={handleChange} error={errors.email} autoComplete="username" placeholder="admin@company.com" />
        <Field label="Password" name="password" type="password" value={values.password} onChange={handleChange} error={errors.password} autoComplete="current-password" />
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign In'}</button>
      </form>
    </section>
  );
}