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
  
  const query = params.toString() ? `?${params.toString()}` : '';
  
  return apiRequest(`${CATALOG_BASE}/price-lists${query}`, {
    method: 'GET',
    auth: true,
  });
}

export default {
  listProducts,
  getProduct,
  listCategories,
  listPriceLists,
};
