import { apiRequest } from '../../services/api/apiClient';

const DEAL_HEALTH_BASE = '/api/deal-health';

/**
 * Get deal health alerts and risk for a single quotation
 * GET /api/deal-health/quotes/{quote_id}
 */
export function getQuoteHealth(quoteId) {
  return apiRequest(`${DEAL_HEALTH_BASE}/quotes/${quoteId}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Get overall deal health dashboard metrics and at-risk deals
 * GET /api/deal-health/dashboard
 */
export function getDealHealthDashboard() {
  return apiRequest(`${DEAL_HEALTH_BASE}/dashboard`, {
    method: 'GET',
    auth: true,
  });
}

export default {
  getQuoteHealth,
  getDealHealthDashboard,
};
