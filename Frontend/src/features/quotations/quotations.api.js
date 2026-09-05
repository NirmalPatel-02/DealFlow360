import { apiRequest } from '../../services/api/apiClient';

const QUOTATIONS_BASE = '/api/quotations';
const APPROVALS_BASE = '/api/approvals';

// ============================================
// QUOTATIONS CRUD
// ============================================

/**
 * Create a new quotation
 * POST /api/quotations
 * Required: customer_id, notes (optional)
 */
export function createQuotation(payload) {
  return apiRequest(QUOTATIONS_BASE, {
    method: 'POST',
    body: payload,
    auth: true,
  });
}

/**
 * List quotations for current user
 * GET /api/quotations?status=DRAFT&customer_id=...
 */
export function listQuotations(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.status) {
    params.append('status', filters.status);
  }
  if (filters.customer_id) {
    params.append('customer_id', filters.customer_id);
  }
  
  const query = params.toString() ? `?${params.toString()}` : '';
  
  return apiRequest(`${QUOTATIONS_BASE}${query}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Get single quotation with all details
 * GET /api/quotations/{quote_id}
 */
export function getQuotation(quoteId) {
  return apiRequest(`${QUOTATIONS_BASE}/${quoteId}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Update quotation (status, notes, etc.)
 * PATCH /api/quotations/{quote_id}
 */
export function updateQuotation(quoteId, payload) {
  return apiRequest(`${QUOTATIONS_BASE}/${quoteId}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
}

// ============================================
// QUOTE LINES
// ============================================

/**
 * Add product line to quotation
 * POST /api/quotations/{quote_id}/lines
 * Required: product_id, quantity, discount_percent (optional)
 */
export function addQuoteLine(quoteId, lineData) {
  return apiRequest(`${QUOTATIONS_BASE}/${quoteId}/lines`, {
    method: 'POST',
    body: lineData,
    auth: true,
  });
}

/**
 * Update quote line (quantity, discount, etc.)
 * PATCH /api/quotations/{quote_id}/lines/{line_id}
 */
export function updateQuoteLine(quoteId, lineId, lineData) {
  return apiRequest(`${QUOTATIONS_BASE}/${quoteId}/lines/${lineId}`, {
    method: 'PATCH',
    body: lineData,
    auth: true,
  });
}

/**
 * Remove quote line
 * DELETE /api/quotations/{quote_id}/lines/{line_id}
 */
export function deleteQuoteLine(quoteId, lineId) {
  return apiRequest(`${QUOTATIONS_BASE}/${quoteId}/lines/${lineId}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ============================================
// APPROVALS
// ============================================

/**
 * Evaluate quote for approval requirements
 * POST /api/approvals/quotes/{quote_id}/evaluate
 * Returns: risk_score, violations, highest_approval_level
 */
export function evaluateQuote(quoteId) {
  return apiRequest(`${APPROVALS_BASE}/quotes/${quoteId}/evaluate`, {
    method: 'POST',
    auth: true,
  });
}

/**
 * Submit quotation for approval (changes status to PENDING_APPROVAL)
 * POST /api/approvals/quotes/{quote_id}/submit
 * Returns: quote_id, status, approval_version, risk_score, approval_level_required
 */
export function submitQuoteForApproval(quoteId) {
  return apiRequest(`${APPROVALS_BASE}/quotes/${quoteId}/submit`, {
    method: 'POST',
    auth: true,
  });
}

/**
 * Act on an approval (approve, reject, return)
 * POST /api/approvals/quotes/{quote_id}/action
 * Body: { action: 'approve|reject|return', reason?: string }
 */
export function actOnApproval(quoteId, action, reason = null) {
  return apiRequest(`${APPROVALS_BASE}/quotes/${quoteId}/action`, {
    method: 'POST',
    body: {
      action,
      reason,
    },
    auth: true,
  });
}

export function listQuoteApprovals(quoteId) {
  return apiRequest(`${APPROVALS_BASE}/quotes/${quoteId}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Share approved quotation with customer contact
 * POST /api/portal/quotes/{quote_id}/share?contact_id=...
 */
export function shareQuote(quoteId, contactId) {
  return apiRequest(`/api/portal/quotes/${quoteId}/share?contact_id=${contactId}`, {
    method: 'POST',
    auth: true,
  });
}

export default {
  // Quotations
  createQuotation,
  listQuotations,
  getQuotation,
  updateQuotation,
  
  // Quote Lines
  addQuoteLine,
  updateQuoteLine,
  deleteQuoteLine,
  
  // Approvals
  evaluateQuote,
  submitQuoteForApproval,
  actOnApproval,
  listQuoteApprovals,

  // Portal Share
  shareQuote,
};

