import { apiRequest } from '../../services/api/apiClient';

const PORTAL_BASE = '/api/portal';

/**
 * Fetch quotation details for customer portal using the secure portal access token.
 * GET /api/portal/quote
 * Header: X-Portal-Token: <token>
 */
export function getPortalQuote(token) {
  return apiRequest(`${PORTAL_BASE}/quote`, {
    method: 'GET',
    headers: {
      'X-Portal-Token': token,
    },
  });
}

/**
 * List all negotiation requests for the current portal session.
 * GET /api/portal/negotiations
 * Header: X-Portal-Token: <token>
 */
export function getPortalNegotiations(token) {
  return apiRequest(`${PORTAL_BASE}/negotiations`, {
    method: 'GET',
    headers: {
      'X-Portal-Token': token,
    },
  });
}

/**
 * Submit a customer negotiation request / counter-offer on a quote or specific quote line.
 * POST /api/portal/negotiations
 * Header: X-Portal-Token: <token>
 * Body: { quote_line_id, message, requested_discount_percent, requested_quantity }
 */
export function createPortalNegotiation(token, payload) {
  return apiRequest(`${PORTAL_BASE}/negotiations`, {
    method: 'POST',
    headers: {
      'X-Portal-Token': token,
    },
    body: payload,
  });
}

/**
 * Formally accept and confirm the quotation in the customer portal.
 * POST /api/portal/confirm
 * Header: X-Portal-Token: <token>
 */
export function confirmPortalQuote(token) {
  return apiRequest(`${PORTAL_BASE}/confirm`, {
    method: 'POST',
    headers: {
      'X-Portal-Token': token,
    },
  });
}

/**
 * Generate/retrieve a shareable portal session link for a quotation and customer contact (Sales Rep internal action).
 * POST /api/portal/quotes/{quoteId}/share?contact_id={contactId}
 */
export function shareQuoteWithContact(quoteId, contactId) {
  return apiRequest(`${PORTAL_BASE}/quotes/${quoteId}/share?contact_id=${contactId}`, {
    method: 'POST',
    auth: true,
  });
}
