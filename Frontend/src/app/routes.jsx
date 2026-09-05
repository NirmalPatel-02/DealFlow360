import { createBrowserRouter, Outlet } from 'react-router-dom';
import AuthProvider from './providers/AuthProvider';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import GuestRoute from '../guards/GuestRoute';
import ProtectedRoute from '../guards/ProtectedRoute';
import RoleRoute from '../guards/RoleRoute';
import LandingPage from '../features/auth/pages/LandingPage';
import LoginPage from '../features/auth/pages/LoginPage';
import SignupPage from '../features/auth/pages/SignupPage';
import VerifyEmailPage from '../features/auth/pages/VerifyEmailPage';
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage';
import DashboardPage from '../features/dashboard/pages/DashboardPage';

function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/', element: <LandingPage /> },
              { path: '/login', element: <LoginPage /> },
              { path: '/register', element: <SignupPage /> },
              { path: '/verify-email', element: <VerifyEmailPage /> },
              { path: '/forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <RoleRoute />,
            children: [
              {
                element: <DashboardLayout />,
                children: [{ path: '/dashboard', element: <DashboardPage /> }],
              },
            ],
          },
        ],
      },
    ],
  },
]);
