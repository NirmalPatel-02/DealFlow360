import { apiRequest } from '../../services/api/apiClient';

const CUSTOMERS_BASE = '/api/customers';

/**
 * List customers with optional filtering
 * GET /api/customers?search=...&tier=...&is_active=true
 */
export function listCustomers(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.tier) {
    params.append('tier', filters.tier);
  }
  if (filters.is_active !== undefined) {
    params.append('is_active', filters.is_active);
  }
  
  const query = params.toString() ? `?${params.toString()}` : '';
  
  return apiRequest(`${CUSTOMERS_BASE}${query}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Get single customer by ID
 * GET /api/customers/{customer_id}
 */
export function getCustomer(customerId) {
  return apiRequest(`${CUSTOMERS_BASE}/${customerId}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Create new customer
 * POST /api/customers
 */
export function createCustomer(payload) {
  return apiRequest(CUSTOMERS_BASE, {
    method: 'POST',
    body: payload,
    auth: true,
  });
}

/**
 * Update customer details
 * PATCH /api/customers/{customer_id}
 */
export function updateCustomer(customerId, payload) {
  return apiRequest(`${CUSTOMERS_BASE}/${customerId}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
}

export default {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
};
