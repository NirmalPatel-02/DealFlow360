import {
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  OTP_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../config/constants';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value) {
  const email = String(value || '').trim();
  if (!email) return 'Email is required.';
  if (email.length > 254) return 'Email is too long.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
  return '';
}

export function validateFullName(value) {
  const name = String(value || '').trim();
  if (!name) return 'Full name is required.';
  if (name.length < FULL_NAME_MIN_LENGTH) {
    return `Full name must be at least ${FULL_NAME_MIN_LENGTH} characters.`;
  }
  if (name.length > FULL_NAME_MAX_LENGTH) {
    return `Full name must be at most ${FULL_NAME_MAX_LENGTH} characters.`;
  }
  return '';
}

export function validatePassword(value, { required = true } = {}) {
  const password = String(value || '');
  if (!password) return required ? 'Password is required.' : '';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return '';
}

export function validatePasswordConfirmation(password, confirmation) {
  if (!confirmation) return 'Please confirm your password.';
  if (password !== confirmation) return 'Passwords do not match.';
  return '';
}

export function validateOtp(value) {
  const otp = String(value || '').trim();
  if (!otp) return 'Verification code is required.';
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) {
    return `Enter the ${OTP_LENGTH}-digit code from your email.`;
  }
  return '';
}
