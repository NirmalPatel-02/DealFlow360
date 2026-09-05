import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { SALES_REP_ROLE } from '../../config/constants';
import { getErrorCode, getErrorMessage } from '../../services/api/apiError';
import { AUTH_ERROR_CODES } from '../../types/auth';
import { getAccessToken } from '../../services/api/apiClient';
import {
  forgotPassword as forgotPasswordRequest,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshAccessToken,
  registerAccount,
  resendVerification as resendVerificationRequest,
  resetPassword as resetPasswordRequest,
  setAccessToken,
  verifyEmail as verifyEmailRequest,
} from '../../features/auth/auth.api';

export const AuthContext = createContext(null);

function assertSalesRep(user) {
  if (user && user.role !== SALES_REP_ROLE) {
    const error = new Error('Only Sales Representatives can sign in here.');
    error.code = AUTH_ERROR_CODES.ROLE_NOT_ALLOWED;
    throw error;
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      await refreshAccessToken();
      const currentUser = await getCurrentUser();
      assertSalesRep(currentUser);
      setUser(currentUser);
      setStatus('authenticated');
    } catch {
      if (getAccessToken()) {
        try {
          await logoutRequest();
        } catch {
          // Ignore network failures during cleanup.
        }
      }
      clearSession();
      setStatus('anonymous');
    }
  }, [clearSession]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (credentials) => {
    const response = await loginRequest(credentials);
    setAccessToken(response.access_token);

    try {
      assertSalesRep(response.user);
    } catch (error) {
      try {
        await logoutRequest();
      } catch {
        // Ignore network failures during cleanup.
      }
      clearSession();
      throw error;
    }

    setUser(response.user);
    setStatus('authenticated');
    return response.user;
  }, [clearSession]);

  const register = useCallback(async (payload) => {
    return registerAccount(payload);
  }, []);

  const verifyEmail = useCallback(async (payload) => {
    return verifyEmailRequest(payload);
  }, []);

  const resendVerification = useCallback(async (email) => {
    return resendVerificationRequest(email);
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    return forgotPasswordRequest(email);
  }, []);

  const resetPassword = useCallback(async (payload) => {
    return resetPasswordRequest(payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Session is cleared locally even if the request fails.
    } finally {
      clearSession();
      setStatus('anonymous');
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      isReady: status !== 'loading',
      login,
      register,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      logout,
      getErrorMessage,
      getErrorCode,
    }),
    [
      user,
      status,
      login,
      register,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
