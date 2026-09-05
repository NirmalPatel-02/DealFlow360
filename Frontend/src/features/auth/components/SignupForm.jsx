import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { getErrorMessage } from '../../../services/api/apiError';
import { useAuth } from '../../../hooks/useAuth';
import { hasErrors, validateRegister } from '../auth.schema';

export default function SignupForm() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [values, setValues] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
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
    const nextErrors = validateRegister(values);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);

    try {
      const response = await register({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
      });

      navigate('/verify-email', {
        state: {
          email: values.email.trim(),
          notice: response?.message || 'Check your email for the verification code.',
        },
      });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to create your account right now.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {formError ? <p className="form-banner">{formError}</p> : null}

      <Field
        label="Full name"
        name="full_name"
        value={values.full_name}
        onChange={handleChange}
        error={errors.full_name}
        autoComplete="name"
        placeholder="Jordan Lee"
      />
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
        autoComplete="new-password"
        placeholder="At least 12 characters"
      />
      <Field
        label="Confirm password"
        name="confirm_password"
        type="password"
        value={values.confirm_password}
        onChange={handleChange}
        error={errors.confirm_password}
        autoComplete="new-password"
      />

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
