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
import QuotationFormPage from '../features/quotations/pages/QuotationFormPage';
import QuotationDetailPage from '../features/quotations/pages/QuotationDetailPage';
import ProfilePage from '../features/profile/pages/ProfilePage';
import AdminRoute from '../guards/AdminRoute';
import AdminLoginPage from '../features/auth/pages/AdminLoginPage';
import AdminLayout from '../layouts/AdminLayout';
import AdminDashboardPage from '../features/admin/pages/AdminDashboardPage';
import FulfillmentPage from '../features/fulfillment/pages/FulfillmentPage';
import InvoiceListPage from '../features/billing/pages/InvoiceListPage';
import InvoiceDetailsPage from '../features/billing/pages/InvoiceDetailsPage';
import PaymentPage from '../features/billing/pages/PaymentPage';

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
              { path: '/admin/login', element: <AdminLoginPage /> },
            ],
          },
        ],
      },
      {
        element: <AdminRoute />,
        children: [
          {
            element: <AdminLayout />,
            children: [{ path: '/admin', element: <AdminDashboardPage /> }],
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
                children: [
                  { path: '/dashboard', element: <DashboardPage /> },
                  { path: '/fulfillment', element: <FulfillmentPage /> },
                  { path: '/billing', element: <InvoiceListPage /> },
                  { path: '/invoices', element: <InvoiceListPage /> },
                  { path: '/invoices/:invoiceId', element: <InvoiceDetailsPage /> },
                  { path: '/billing/payments', element: <PaymentPage /> },
                  { path: '/quotations/new', element: <QuotationFormPage /> },
                  { path: '/quotations/:quoteId', element: <QuotationDetailPage /> },
                  { path: '/quotations/:quoteId/edit', element: <QuotationFormPage /> },
                  { path: '/profile', element: <ProfilePage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
