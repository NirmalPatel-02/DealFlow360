import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { getErrorMessage } from '../../../services/api/apiError';
import { useAuth } from '../../../hooks/useAuth';
import { hasErrors, validateForgotPassword, validateResetPassword } from '../auth.schema';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { requestPasswordReset, resetPassword } = useAuth();
  const [step, setStep] = useState('request');
  const [values, setValues] = useState({
    email: '',
    otp: '',
    new_password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({
      ...current,
      [name]: name === 'otp' ? value.replace(/\D/g, '').slice(0, 8) : value,
    }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFormError('');
  }

  async function handleRequest(event) {
    event.preventDefault();
    const nextErrors = validateForgotPassword(values);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      const response = await requestPasswordReset(values.email.trim());
      setNotice(response?.message || 'If that email is registered, a reset code will be sent.');
      setStep('reset');
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to start a password reset right now.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    const nextErrors = validateResetPassword(values);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      const response = await resetPassword({
        email: values.email.trim(),
        otp: values.otp,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      });
      navigate('/login', {
        replace: true,
        state: { notice: response?.message || 'Password reset successfully. Please log in again.' },
      });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Invalid or expired reset code.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card">
      <h1 className="page-title">Reset password</h1>
      <p className="subheading">
        {step === 'request' ? 'We will email an 8-digit reset code.' : 'Enter the code and choose a new password.'}
      </p>

      {notice ? <p className="form-banner form-banner-muted">{notice}</p> : null}

      {step === 'request' ? (
        <form className="auth-form" onSubmit={handleRequest} noValidate>
          {formError ? <p className="form-banner">{formError}</p> : null}
          <Field
            label="Work email"
            name="email"
            type="email"
            value={values.email}
            onChange={handleChange}
            error={errors.email}
            autoComplete="email"
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset code'}
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleReset} noValidate>
          {formError ? <p className="form-banner">{formError}</p> : null}
          <Field
            label="Work email"
            name="email"
            type="email"
            value={values.email}
            onChange={handleChange}
            error={errors.email}
            autoComplete="email"
          />
          <Field
            label="Reset code"
            name="otp"
            value={values.otp}
            onChange={handleChange}
            error={errors.otp}
            autoComplete="one-time-code"
            placeholder="12345678"
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
            label="Confirm password"
            name="confirm_password"
            type="password"
            value={values.confirm_password}
            onChange={handleChange}
            error={errors.confirm_password}
            autoComplete="new-password"
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}

      <p className="auth-footer">
        Remembered it? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
