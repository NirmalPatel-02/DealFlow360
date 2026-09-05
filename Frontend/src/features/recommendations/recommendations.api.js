import { apiRequest } from '../../services/api/apiClient';

const BASE = '/api/recommendations';

export function listQuoteRecommendations(quoteId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.source_product_id) params.set('source_product_id', filters.source_product_id);
  if (filters.limit) params.set('limit', filters.limit);
  const query = params.toString() ? `?${params}` : '';
  return apiRequest(`${BASE}/quotes/${quoteId}${query}`, { auth: true });
}

export function acceptQuoteRecommendation(quoteId, payload) {
  return apiRequest(`${BASE}/quotes/${quoteId}/accept`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
}// Boilerplate placeholder. Add implementation here.
export default {};
