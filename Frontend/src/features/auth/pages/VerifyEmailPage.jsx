import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { getErrorMessage } from '../../../services/api/apiError';
import { useAuth } from '../../../hooks/useAuth';
import { hasErrors, validateVerifyEmail } from '../auth.schema';

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();
  const initialEmail = location.state?.email || '';
  const [values, setValues] = useState({ email: initialEmail, otp: '' });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const canSubmit = useMemo(() => Boolean(values.email && values.otp), [values]);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: name === 'otp' ? value.replace(/\D/g, '').slice(0, 8) : value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateVerifyEmail(values);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      const response = await verifyEmail({
        email: values.email.trim(),
        otp: values.otp,
      });
      navigate('/login', {
        replace: true,
        state: { notice: response?.message || 'Email verified. You can now log in.' },
      });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Invalid or expired verification code.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    const emailError = validateVerifyEmail({ ...values, otp: '00000000' }).email;
    if (emailError) {
      setErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    setResending(true);
    setFormError('');
    try {
      const response = await resendVerification(values.email.trim());
      setNotice(response?.message || 'If the account requires verification, a new code will be sent.');
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to resend the verification code right now.'));
    } finally {
      setResending(false);
    }
  }

  return (
    <section className="auth-card">
      <h1 className="page-title">Verify your email</h1>
      <p className="subheading">Enter the 8-digit code we sent you.</p>
      <p className="body-copy">
        Check your inbox, then continue to log in as a Sales Representative.
      </p>

      {notice ? <p className="form-banner form-banner-muted">{notice}</p> : null}

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
        />
        <Field
          label="Verification code"
          name="otp"
          value={values.otp}
          onChange={handleChange}
          error={errors.otp}
          autoComplete="one-time-code"
          placeholder="12345678"
        />

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !canSubmit}>
          {submitting ? 'Verifying…' : 'Verify email'}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={handleResend} disabled={resending}>
          {resending ? 'Sending…' : 'Resend code'}
        </button>
      </form>

      <p className="auth-footer">
        Ready to sign in? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
