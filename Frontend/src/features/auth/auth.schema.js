import {
  validateEmail,
  validateFullName,
  validateOtp,
  validatePassword,
  validatePasswordConfirmation,
} from '../../utils/validation';

export function validateLogin(values) {
  return {
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  };
}

export function validateRegister(values) {
  return {
    full_name: validateFullName(values.full_name),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    confirm_password: validatePasswordConfirmation(values.password, values.confirm_password),
  };
}

export function validateVerifyEmail(values) {
  return {
    email: validateEmail(values.email),
    otp: validateOtp(values.otp),
  };
}

export function validateForgotPassword(values) {
  return {
    email: validateEmail(values.email),
  };
}

export function validateResetPassword(values) {
  return {
    email: validateEmail(values.email),
    otp: validateOtp(values.otp),
    new_password: validatePassword(values.new_password),
    confirm_password: validatePasswordConfirmation(values.new_password, values.confirm_password),
  };
}

export function hasErrors(errors) {
  return Object.values(errors).some(Boolean);
}
