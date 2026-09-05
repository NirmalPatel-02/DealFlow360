import { apiRequest } from '../../services/api/apiClient';

const BASE = '/api';

// ==========================================
// Warehouses
// ==========================================

export function listWarehouses(params = {}) {
  const query = new URLSearchParams();
  if (params.is_active !== undefined) query.set('is_active', params.is_active);
  const qs = query.toString();
  return apiRequest(`${BASE}/warehouses${qs ? `?${qs}` : ''}`, { auth: true });
}

export function createWarehouse(data) {
  return apiRequest(`${BASE}/warehouses`, {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true,
  });
}

export function getWarehouse(id) {
  return apiRequest(`${BASE}/warehouses/${id}`, { auth: true });
}

export function updateWarehouse(id, data) {
  return apiRequest(`${BASE}/warehouses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    auth: true,
  });
}

// ==========================================
// Inventory
// ==========================================

export function listInventory(params = {}) {
  const query = new URLSearchParams();
  if (params.warehouse_id) query.set('warehouse_id', params.warehouse_id);
  if (params.product_id) query.set('product_id', params.product_id);
  const qs = query.toString();
  return apiRequest(`${BASE}/inventory${qs ? `?${qs}` : ''}`, { auth: true });
}

export function createInventoryStock(data) {
  return apiRequest(`${BASE}/inventory`, {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true,
  });
}

export function adjustInventory(data) {
  return apiRequest(`${BASE}/inventory/adjust`, {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true,
  });
}

// ==========================================
// Replenishment Rules
// ==========================================

export function listReplenishmentRules(params = {}) {
  const query = new URLSearchParams();
  if (params.warehouse_id) query.set('warehouse_id', params.warehouse_id);
  if (params.product_id) query.set('product_id', params.product_id);
  const qs = query.toString();
  return apiRequest(`${BASE}/replenishment-rules${qs ? `?${qs}` : ''}`, { auth: true });
}

export function createReplenishmentRule(data) {
  return apiRequest(`${BASE}/replenishment-rules`, {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true,
  });
}

export function updateReplenishmentRule(ruleId, data) {
  return apiRequest(`${BASE}/replenishment-rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    auth: true,
  });
}

// ==========================================
// Fulfillment Planning & Dispatch
// ==========================================

export function getFulfillmentRecommendation(quoteId) {
  return apiRequest(`${BASE}/fulfillment/quotes/${quoteId}/recommendation`, { auth: true });
}

export function createFulfillmentPlan(quoteId) {
  return apiRequest(`${BASE}/fulfillment/quotes/${quoteId}/plan`, {
    method: 'POST',
    auth: true,
  });
}

export function getQuoteFulfillmentPlan(quoteId) {
  return apiRequest(`${BASE}/fulfillment/quotes/${quoteId}/plan`, { auth: true });
}

export function listFulfillmentPlans(params = {}) {
  const query = new URLSearchParams();
  if (params.quotation_id) query.set('quotation_id', params.quotation_id);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiRequest(`${BASE}/fulfillment/plans${qs ? `?${qs}` : ''}`, { auth: true });
}

export function getFulfillmentPlan(planId) {
  return apiRequest(`${BASE}/fulfillment/plans/${planId}`, { auth: true });
}

export function acceptFulfillmentPlan(planId) {
  return apiRequest(`${BASE}/fulfillment/plans/${planId}/accept`, {
    method: 'POST',
    auth: true,
  });
}

export function cancelFulfillmentPlan(planId) {
  return apiRequest(`${BASE}/fulfillment/plans/${planId}/cancel`, {
    method: 'POST',
    auth: true,
  });
}

export function fulfillAllocation(allocationId, quantity) {
  return apiRequest(`${BASE}/fulfillment/allocations/${allocationId}/fulfill?quantity=${encodeURIComponent(quantity)}`, {
    method: 'POST',
    auth: true,
  });
}

export function manualOverrideAllocation(planId, data) {
  return apiRequest(`${BASE}/fulfillment/plans/${planId}/override`, {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true,
  });
}

// ==========================================
// Backorders
// ==========================================

export function listBackorders(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiRequest(`${BASE}/fulfillment/backorders${qs ? `?${qs}` : ''}`, { auth: true });
}

export function consolidateBackorder(backorderId) {
  return apiRequest(`${BASE}/fulfillment/backorders/${backorderId}/consolidate`, {
    method: 'POST',
    auth: true,
  });
}
