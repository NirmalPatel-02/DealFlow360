import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { getErrorCode, getErrorMessage } from '../../../services/api/apiError';
import { AUTH_ERROR_CODES } from '../../../types/auth';
import { useAuth } from '../../../hooks/useAuth';
import { hasErrors, validateLogin } from '../auth.schema';

export default function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
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
      await login({
        email: values.email.trim(),
        password: values.password,
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (getErrorCode(error) === AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED) {
        navigate('/verify-email', {
          state: {
            email: values.email.trim(),
            notice: getErrorMessage(error, 'Please verify your email before logging in.'),
          },
        });
        return;
      }

      setFormError(getErrorMessage(error, 'Unable to sign in. Check your email and password.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {formError ? <p className="form-banner">{formError}</p> : null}

      <Field
        label="Work email"
        name="email"
        type="email"
        value={values.email}
        onChange={handleChange}
        error={errors.email}
        autoComplete="email"
        placeholder="you@company.com"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        value={values.password}
        onChange={handleChange}
        error={errors.password}
        autoComplete="current-password"
      />

      <div className="form-row-end">
        <Link to="/forgot-password" className="text-link">
          Forgot password?
        </Link>
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Log in'}
      </button>
    </form>
  );
}
