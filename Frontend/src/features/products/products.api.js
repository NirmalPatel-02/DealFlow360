import { apiRequest } from '../../services/api/apiClient';

const CATALOG_BASE = '/api/catalog';

/**
 * List products with optional filtering
 * GET /api/catalog/products?search=...&category_id=...&product_type=...
 */
export function listProducts(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.category_id) {
    params.append('category_id', filters.category_id);
  }
  if (filters.product_type) {
    params.append('product_type', filters.product_type);
  }
  if (filters.is_active !== undefined) {
    params.append('is_active', filters.is_active);
  }
  if (filters.skip !== undefined) {
    params.append('skip', filters.skip);
  }
  if (filters.limit !== undefined) {
    params.append('limit', filters.limit);
  }
  
  const query = params.toString() ? `?${params.toString()}` : '';
  
  return apiRequest(`${CATALOG_BASE}/products${query}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Get single product by ID
 * GET /api/catalog/products/{product_id}
 */
export function getProduct(productId) {
  return apiRequest(`${CATALOG_BASE}/products/${productId}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * List product categories
 * GET /api/catalog/categories
 */
export function listCategories() {
  return apiRequest(`${CATALOG_BASE}/categories`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * List price lists
 * GET /api/catalog/price-lists
 */
export function listPriceLists(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.customer_tier) {
    params.append('customer_tier', filters.customer_tier);
  }
  if (filters.currency) {
    params.append('currency', filters.currency);
  }
  
  const query = params.toString() ? `?${params.toString()}` : '';
  
  return apiRequest(`${CATALOG_BASE}/price-lists${query}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * Create a new product category
 * POST /api/catalog/categories
 */
export function createCategory(data) {
  return apiRequest(`${CATALOG_BASE}/categories`, {
    method: 'POST',
    body: data,
    auth: true,
  });
}

/**
 * Update an existing category
 * PATCH /api/catalog/categories/{categoryId}
 */
export function updateCategory(categoryId, data) {
  return apiRequest(`${CATALOG_BASE}/categories/${categoryId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
}

/**
 * Create a new product
 * POST /api/catalog/products
 */
export function createProduct(data) {
  return apiRequest(`${CATALOG_BASE}/products`, {
    method: 'POST',
    body: data,
    auth: true,
  });
}

/**
 * Update an existing product
 * PATCH /api/catalog/products/{productId}
 */
export function updateProduct(productId, data) {
  return apiRequest(`${CATALOG_BASE}/products/${productId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
}

/**
 * Create a price list
 * POST /api/catalog/price-lists
 */
export function createPriceList(data) {
  return apiRequest(`${CATALOG_BASE}/price-lists`, {
    method: 'POST',
    body: data,
    auth: true,
  });
}

export default {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  listCategories,
  createCategory,
  updateCategory,
  listPriceLists,
  createPriceList,
};

