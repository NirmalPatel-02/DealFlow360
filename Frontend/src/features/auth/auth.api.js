import { apiRequest, refreshAccessToken, setAccessToken } from '../../services/api/apiClient';

export function registerAccount(payload) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: payload.email,
      full_name: payload.full_name,
      password: payload.password,
    },
  });
}

export function verifyEmail(payload) {
  return apiRequest('/auth/verify-email', {
    method: 'POST',
    body: {
      email: payload.email,
      otp: payload.otp,
    },
  });
}

export function resendVerification(email) {
  return apiRequest('/auth/resend-verification', {
    method: 'POST',
    body: { email },
  });
}

export function login(payload) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: payload.email,
      password: payload.password,
    },
  });
}

export function logout() {
  return apiRequest('/auth/logout', { method: 'POST' });
}

export function getCurrentUser() {
  return apiRequest('/auth/me', { method: 'GET', auth: true });
}

export function changePassword(payload) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: {
      current_password: payload.current_password,
      new_password: payload.new_password,
      confirm_password: payload.confirm_password,
    },
    auth: true,
  });
}

export function forgotPassword(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export function resetPassword(payload) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: {
      email: payload.email,
      otp: payload.otp,
      new_password: payload.new_password,
      confirm_password: payload.confirm_password,
    },
  });
}

export { refreshAccessToken, setAccessToken };
