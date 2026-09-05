import { apiRequest } from '../../services/api/apiClient';

const GOVERNANCE_BASE = '/api/governance';

/**
 * List discount rules
 * GET /api/governance/discount-rules
 */
export function listDiscountRules(filters = {}) {
  const params = new URLSearchParams();
  if (filters.customer_tier) {
    params.append('customer_tier', filters.customer_tier);
  }
  if (filters.category_id) {
    params.append('category_id', filters.category_id);
  }
  if (filters.is_active !== undefined) {
    params.append('is_active', filters.is_active);
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`${GOVERNANCE_BASE}/discount-rules${query}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Create a discount rule
 * POST /api/governance/discount-rules
 * Body: { customer_tier, category_id?, max_discount_percent, approval_chain_id }
 */
export function createDiscountRule(data) {
  return apiRequest(`${GOVERNANCE_BASE}/discount-rules`, {
    method: 'POST',
    body: data,
    auth: true,
  });
}

/**
 * Update a discount rule
 * PATCH /api/governance/discount-rules/{ruleId}
 */
export function updateDiscountRule(ruleId, data) {
  return apiRequest(`${GOVERNANCE_BASE}/discount-rules/${ruleId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
}

/**
 * Delete a discount rule
 * DELETE /api/governance/discount-rules/{ruleId}
 */
export function deleteDiscountRule(ruleId) {
  return apiRequest(`${GOVERNANCE_BASE}/discount-rules/${ruleId}`, {
    method: 'DELETE',
    auth: true,
  });
}

/**
 * List approval chains
 * GET /api/governance/approval-chains
 */
export function listApprovalChains(isActive = true) {
  const query = isActive !== undefined ? `?is_active=${isActive}` : '';
  return apiRequest(`${GOVERNANCE_BASE}/approval-chains${query}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Create approval chain
 * POST /api/governance/approval-chains
 * Body: { name, description }
 */
export function createApprovalChain(data) {
  return apiRequest(`${GOVERNANCE_BASE}/approval-chains`, {
    method: 'POST',
    body: data,
    auth: true,
  });
}

/**
 * List bands for an approval chain
 * GET /api/governance/approval-chains/{chainId}/bands
 */
export function listApprovalBands(chainId) {
  return apiRequest(`${GOVERNANCE_BASE}/approval-chains/${chainId}/bands`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Create an approval band in a chain
 * POST /api/governance/approval-chains/{chainId}/bands
 * Body: { min_excess_percent, max_excess_percent, approval_level }
 */
export function createApprovalBand(chainId, data) {
  return apiRequest(`${GOVERNANCE_BASE}/approval-chains/${chainId}/bands`, {
    method: 'POST',
    body: data,
    auth: true,
  });
}

/**
 * Delete an approval band
 * DELETE /api/governance/approval-bands/{bandId}
 */
export function deleteApprovalBand(bandId) {
  return apiRequest(`${GOVERNANCE_BASE}/approval-bands/${bandId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export default {
  listDiscountRules,
  createDiscountRule,
  updateDiscountRule,
  deleteDiscountRule,
  listApprovalChains,
  createApprovalChain,
  listApprovalBands,
  createApprovalBand,
  deleteApprovalBand,
};
