import { apiRequest } from '../../services/api/apiClient';

const ADMIN_BASE = '/api/admin';

/**
 * Fetch platform KPI summary metrics
 * GET /api/admin/dashboard/summary
 */
export function getAdminSummary() {
  return apiRequest(`${ADMIN_BASE}/dashboard/summary`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * List all users
 * GET /api/admin/users
 */
export function listUsers() {
  return apiRequest(`${ADMIN_BASE}/users`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Update a user's role
 * PATCH /api/admin/users/{userId}/role
 * Body: { role: 'sales_rep' | 'sales_manager' | 'finance_ops' | 'admin' | 'customer' }
 */
export function updateUserRole(userId, role) {
  return apiRequest(`${ADMIN_BASE}/users/${userId}/role`, {
    method: 'PATCH',
    body: { role },
    auth: true,
  });
}

/**
 * Update a user's active status
 * PATCH /api/admin/users/{userId}/status
 * Body: { is_active: boolean }
 */
export function updateUserStatus(userId, isActive) {
  return apiRequest(`${ADMIN_BASE}/users/${userId}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
    auth: true,
  });
}

/**
 * Create a new subscription plan
 * POST /api/subscription-plans
 */
export function createSubscriptionPlan(data) {
  return apiRequest('/api/subscription-plans', {
    method: 'POST',
    body: data,
    auth: true,
  });
}

export default {
  getAdminSummary,
  listUsers,
  updateUserRole,
  updateUserStatus,
  createSubscriptionPlan,
};
