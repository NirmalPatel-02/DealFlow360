import { apiRequest } from '../../services/api/apiClient';

const BASE = '/api/fulfillment';

export function getFulfillmentRecommendation(quoteId) {
  return apiRequest(`${BASE}/quotes/${quoteId}/recommendation`, { auth: true });
}

export function createFulfillmentPlan(quoteId) {
  return apiRequest(`${BASE}/quotes/${quoteId}/plan`, { method: 'POST', auth: true });
}

export function getFulfillmentPlan(planId) {
  return apiRequest(`${BASE}/plans/${planId}`, { auth: true });
}// Boilerplate placeholder. Add implementation here.
export default {};
