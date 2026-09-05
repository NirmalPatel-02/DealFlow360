import { apiRequest } from '../../services/api/apiClient';

const BASE = '/api';

// ==========================================
// Invoices
// ==========================================

export function listInvoices(params = {}) {
  const query = new URLSearchParams();
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.orderId) query.set('orderId', params.orderId);
  if (params.status) query.set('status', params.status);
  if (params.invoiceType) query.set('invoiceType', params.invoiceType);
  if (params.fromDate) query.set('fromDate', params.fromDate);
  if (params.toDate) query.set('toDate', params.toDate);
  const qs = query.toString();
  return apiRequest(`${BASE}/invoices${qs ? `?${qs}` : ''}`, { auth: true });
}

export function getInvoice(invoiceId) {
  return apiRequest(`${BASE}/invoices/${invoiceId}`, { auth: true });
}

export function createInvoice(orderId) {
  return apiRequest(`${BASE}/invoices`, {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
    auth: true,
  });
}

export function cancelInvoice(invoiceId) {
  return apiRequest(`${BASE}/invoices/${invoiceId}/cancel`, {
    method: 'POST',
    auth: true,
  });
}

export function recordPayment(invoiceId, payload) {
  return apiRequest(`${BASE}/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: true,
  });
}

export function getInvoicePayments(invoiceId) {
  return apiRequest(`${BASE}/invoices/${invoiceId}/payments`, { auth: true });
}

export function refundPayment(paymentId, payload = {}) {
  return apiRequest(`${BASE}/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: true,
  });
}

// ==========================================
// Orders
// ==========================================

export function listOrders(params = {}) {
  const query = new URLSearchParams();
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.quotationId) query.set('quotationId', params.quotationId);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiRequest(`${BASE}/orders${qs ? `?${qs}` : ''}`, { auth: true });
}

export function getOrder(orderId) {
  return apiRequest(`${BASE}/orders/${orderId}`, { auth: true });
}

export function createOrder(payload) {
  return apiRequest(`${BASE}/orders`, {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: true,
  });
}

export function createOrderFromQuote(quoteId) {
  return apiRequest(`${BASE}/orders/from-quote/${quoteId}`, {
    method: 'POST',
    auth: true,
  });
}

export function getOrderByQuote(quoteId) {
  return apiRequest(`${BASE}/orders/by-quote/${quoteId}`, { auth: true });
}

export function getOrderBillingSummary(orderId) {
  return apiRequest(`${BASE}/orders/${orderId}/billing`, { auth: true });
}

// ==========================================
// Subscriptions & Plans
// ==========================================

export function listSubscriptionPlans() {
  return apiRequest(`${BASE}/subscription-plans`, { auth: true });
}

export function createSubscriptionPlan(payload) {
  return apiRequest(`${BASE}/subscription-plans`, {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: true,
  });
}

export function listSubscriptions(params = {}) {
  const query = new URLSearchParams();
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.orderId) query.set('orderId', params.orderId);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiRequest(`${BASE}/subscriptions${qs ? `?${qs}` : ''}`, { auth: true });
}

export function getSubscription(subscriptionId) {
  return apiRequest(`${BASE}/subscriptions/${subscriptionId}`, { auth: true });
}

export function createSubscription(orderItemId) {
  return apiRequest(`${BASE}/subscriptions`, {
    method: 'POST',
    body: JSON.stringify({ order_item_id: orderItemId }),
    auth: true,
  });
}

export function modifySubscription(subscriptionId, payload) {
  return apiRequest(`${BASE}/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    auth: true,
  });
}

export function cancelSubscription(subscriptionId, reason = 'Customer requested cancellation') {
  return apiRequest(`${BASE}/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    auth: true,
  });
}

export function getBillingSchedule(subscriptionId) {
  return apiRequest(`${BASE}/subscriptions/${subscriptionId}/billing-schedule`, { auth: true });
}

export function generateRecurringInvoice(subscriptionId) {
  return apiRequest(`${BASE}/subscriptions/${subscriptionId}/generate-invoice`, {
    method: 'POST',
    auth: true,
  });
}
