import { useEffect, useMemo, useState } from 'react';
import {
  getAdminSummary,
  listUsers,
  updateUserRole,
  updateUserStatus,
  createSubscriptionPlan,
} from '../admin.api';
import {
  listCategories,
  createCategory,
  updateCategory,
  listProducts,
  createProduct,
  updateProduct,
} from '../../products/products.api';
import {
  listApprovalChains,
  createApprovalChain,
  listApprovalBands,
  createApprovalBand,
  deleteApprovalBand,
  listDiscountRules,
  createDiscountRule,
  deleteDiscountRule,
} from '../../discounts/discounts.api';
import { getErrorMessage } from '../../../services/api/apiError';
import { formatCurrency } from '../../../utils/currency';
import './admin.css';

const TABS = [
  { id: 'catalogs', label: 'Catalogs & Categories' },
  { id: 'products', label: 'Products' },
  { id: 'users', label: 'Users & Roles' },
  { id: 'chains', label: 'Approval Chains' },
  { id: 'discounts', label: 'Discount Rules' },
  { id: 'subscriptions', label: 'Subscription Plans' },
];

const USER_ROLES = [
  { value: 'sales_rep', label: 'Sales Representative' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'finance_ops', label: 'Finance / Operations' },
  { value: 'admin', label: 'Platform Admin' },
  { value: 'customer', label: 'Customer' },
];

const CUSTOMER_TIERS = [
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
];

const PRODUCT_TYPES = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'service', label: 'Service' },
  { value: 'subscription', label: 'Subscription' },
];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('catalogs');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Domain data
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [approvalChains, setApprovalChains] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [selectedChainId, setSelectedChainId] = useState(null);
  const [selectedChainBands, setSelectedChainBands] = useState([]);
  const [bandsLoading, setBandsLoading] = useState(false);

  // Filters & Search
  const [query, setQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');

  // Modals
  const [modal, setModal] = useState(null);

  // Load all admin data
  const refreshData = async () => {
    setLoading(true);
    setError('');
    try {
      const [
        summaryRes,
        categoriesRes,
        productsRes,
        usersRes,
        chainsRes,
        rulesRes,
      ] = await Promise.all([
        getAdminSummary().catch(() => null),
        listCategories().catch(() => []),
        listProducts({ limit: 100 }).catch(() => []),
        listUsers().catch(() => []),
        listApprovalChains().catch(() => []),
        listDiscountRules().catch(() => []),
      ]);

      if (summaryRes) setSummary(summaryRes);
      setCategories(categoriesRes || []);
      setProducts(productsRes || []);
      setUsers(usersRes || []);
      setApprovalChains(chainsRes || []);
      setDiscountRules(rulesRes || []);

      if (chainsRes && chainsRes.length > 0 && !selectedChainId) {
        setSelectedChainId(chainsRes[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Fetch bands when selected chain changes
  useEffect(() => {
    if (!selectedChainId) {
      setSelectedChainBands([]);
      return;
    }
    setBandsLoading(true);
    listApprovalBands(selectedChainId)
      .then((bands) => setSelectedChainBands(bands || []))
      .catch(() => setSelectedChainBands([]))
      .finally(() => setBandsLoading(false));
  }, [selectedChainId]);

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // --- Handlers: Categories ---
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const payload = {
        name: form.get('name').trim(),
        code: form.get('code').trim().toUpperCase(),
        description: form.get('description')?.trim() || null,
      };
      await createCategory(payload);
      showSuccess('Category created successfully!');
      setModal(null);
      const updated = await listCategories();
      setCategories(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCategoryActive = async (category) => {
    setActionLoading(true);
    try {
      await updateCategory(category.id, { is_active: !category.is_active });
      showSuccess(`Category ${category.is_active ? 'deactivated' : 'activated'}!`);
      const updated = await listCategories();
      setCategories(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // --- Handlers: Products ---
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const payload = {
        name: form.get('name').trim(),
        code: form.get('code').trim().toUpperCase(),
        category_id: form.get('category_id'),
        product_type: form.get('product_type'),
        base_price: Number(form.get('base_price')),
        cost_price: Number(form.get('cost_price')),
        unit: form.get('unit').trim() || 'unit',
        tax_rate: Number(form.get('tax_rate') || 0),
        description: form.get('description')?.trim() || null,
      };
      await createProduct(payload);
      showSuccess('Product added successfully!');
      setModal(null);
      const updated = await listProducts({ limit: 100 });
      setProducts(updated);
      const updatedSummary = await getAdminSummary().catch(() => null);
      if (updatedSummary) setSummary(updatedSummary);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleProductActive = async (product) => {
    setActionLoading(true);
    try {
      await updateProduct(product.id, { is_active: !product.is_active });
      showSuccess(`Product ${product.is_active ? 'deactivated' : 'activated'}!`);
      const updated = await listProducts({ limit: 100 });
      setProducts(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // --- Handlers: Users & Roles ---
  const handleRoleChange = async (userId, newRole) => {
    setActionLoading(true);
    setError('');
    try {
      await updateUserRole(userId, newRole);
      showSuccess('User role updated!');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUserStatus = async (user) => {
    setActionLoading(true);
    setError('');
    try {
      await updateUserStatus(user.id, !user.is_active);
      showSuccess(`User account ${user.is_active ? 'deactivated' : 'activated'}!`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_active: !user.is_active } : u
        )
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // --- Handlers: Approval Chains & Bands ---
  const handleCreateChain = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const payload = {
        name: form.get('name').trim(),
        description: form.get('description')?.trim() || null,
      };
      const newChain = await createApprovalChain(payload);
      showSuccess('Approval chain created!');
      setModal(null);
      const updated = await listApprovalChains();
      setApprovalChains(updated);
      setSelectedChainId(newChain.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBand = async (e) => {
    e.preventDefault();
    if (!selectedChainId) return;
    setActionLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const maxVal = form.get('max_excess_percent');
      const payload = {
        min_excess_percent: Number(form.get('min_excess_percent')),
        max_excess_percent: maxVal ? Number(maxVal) : null,
        approval_level: form.get('approval_level'),
      };
      await createApprovalBand(selectedChainId, payload);
      showSuccess('Approval band added to chain!');
      setModal(null);
      const updatedBands = await listApprovalBands(selectedChainId);
      setSelectedChainBands(updatedBands || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBand = async (bandId) => {
    if (!confirm('Are you sure you want to remove this band?')) return;
    setActionLoading(true);
    try {
      await deleteApprovalBand(bandId);
      showSuccess('Band removed!');
      const updatedBands = await listApprovalBands(selectedChainId);
      setSelectedChainBands(updatedBands || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // --- Handlers: Discount Rules ---
  const handleCreateDiscountRule = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const catVal = form.get('category_id');
      const payload = {
        customer_tier: form.get('customer_tier'),
        category_id: catVal && catVal !== 'ALL' ? catVal : null,
        max_discount_percent: Number(form.get('max_discount_percent')),
        approval_chain_id: form.get('approval_chain_id'),
      };
      await createDiscountRule(payload);
      showSuccess('Discount rule established!');
      setModal(null);
      const updated = await listDiscountRules();
      setDiscountRules(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDiscountRule = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this discount rule?')) return;
    setActionLoading(true);
    try {
      await deleteDiscountRule(ruleId);
      showSuccess('Discount rule deleted!');
      const updated = await listDiscountRules();
      setDiscountRules(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // --- Handlers: Subscription Plan ---
  const handleCreateSubscriptionPlan = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const payload = {
        name: form.get('name').trim(),
        interval: form.get('interval'),
        price: Number(form.get('price')),
        currency: form.get('currency') || 'USD',
        proration_enabled: true,
        cancellation_policy: 'IMMEDIATE',
        refund_policy: 'NONE',
      };
      await createSubscriptionPlan(payload);
      showSuccess('Subscription plan created!');
      setModal(null);
      const updatedProducts = await listProducts({ limit: 100 });
      setProducts(updatedProducts);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered rows for current active tab
  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [categories, query]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q);
      const matchesCategory =
        !productCategoryFilter || p.category_id === productCategoryFilter;
      const matchesType =
        !productTypeFilter || p.product_type === productTypeFilter;
      return matchesQuery && matchesCategory && matchesType;
    });
  }, [products, query, productCategoryFilter, productTypeFilter]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, query]);

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return discountRules.filter(
      (r) =>
        !q ||
        r.customer_tier.toLowerCase().includes(q) ||
        (r.category_id && r.category_id.toLowerCase().includes(q))
    );
  }, [discountRules, query]);

  const subscriptionProducts = useMemo(() => {
    return products.filter((p) => p.product_type === 'subscription');
  }, [products]);

  return (
    <div className="admin-page">
      {/* Page Header */}
      <div className="admin-heading">
        <div>
          <p className="eyebrow">DealFlow360 / Governance & Catalog</p>
          <h1 className="page-title">Admin Control Center</h1>
          <p className="subheading">
            Manage commercial catalogs, role permissions, approval chains, and governance guardrails.
          </p>
        </div>
        <div className="admin-actions-bar">
          <button
            className="btn btn-outline btn-sm"
            onClick={refreshData}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : '↻ Refresh Data'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="form-banner admin-alert admin-alert-error">
          <span>⚠️ {error}</span>
          <button className="admin-alert-dismiss" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {successMessage && (
        <div className="form-banner form-banner-muted admin-alert admin-alert-success">
          <span>✓ {successMessage}</span>
          <button
            className="admin-alert-dismiss"
            onClick={() => setSuccessMessage('')}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="admin-stat-grid">
        <div className="admin-stat">
          <span>Total Managed Users</span>
          <strong>{summary?.users ?? users.length}</strong>
        </div>
        <div className="admin-stat">
          <span>Active Customers</span>
          <strong>{summary?.activeCustomers ?? 0}</strong>
        </div>
        <div className="admin-stat">
          <span>Active Catalog Items</span>
          <strong>{summary?.activeProducts ?? products.length}</strong>
        </div>
        <div className="admin-stat">
          <span>Total Deals / Quotes</span>
          <strong>{summary?.quotations ?? 0}</strong>
        </div>
        <div className="admin-stat">
          <span>Confirmed Revenue</span>
          <strong>{formatCurrency(summary?.confirmedRevenue ?? 0)}</strong>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs">
        {TABS.map((tab) => {
          let count = 0;
          if (tab.id === 'catalogs') count = categories.length;
          if (tab.id === 'products') count = products.length;
          if (tab.id === 'users') count = users.length;
          if (tab.id === 'chains') count = approvalChains.length;
          if (tab.id === 'discounts') count = discountRules.length;
          if (tab.id === 'subscriptions') count = subscriptionProducts.length;

          return (
            <button
              key={tab.id}
              className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setQuery('');
              }}
            >
              {tab.label}
              <span className="admin-tab-badge">{count}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: Catalogs & Categories */}
      {activeTab === 'catalogs' && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <label className="field">
              <span className="field-label">Search Categories</span>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or code…"
              />
            </label>
            <div />
            <button
              className="btn btn-primary admin-add-button"
              onClick={() => setModal({ type: 'category' })}
            >
              + Add Category
            </button>
          </div>

          <div className="admin-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <strong>{cat.name}</strong>
                    </td>
                    <td>
                      <code>{cat.code}</code>
                    </td>
                    <td>{cat.description || '—'}</td>
                    <td>
                      <span
                        className={`admin-status ${
                          cat.is_active ? 'admin-status-active' : 'admin-status-draft'
                        }`}
                      >
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleToggleCategoryActive(cat)}
                        disabled={actionLoading}
                      >
                        {cat.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      {loading ? 'Loading categories…' : 'No categories found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT: Products */}
      {activeTab === 'products' && (
        <section className="admin-section">
          <div className="admin-toolbar admin-toolbar-products">
            <label className="field">
              <span className="field-label">Search Products</span>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, code, SKU…"
              />
            </label>
            <label className="field">
              <span className="field-label">Filter Category</span>
              <select
                className="input"
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Filter Type</span>
              <select
                className="input"
                value={productTypeFilter}
                onChange={(e) => setProductTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-primary admin-add-button"
              onClick={() => setModal({ type: 'product' })}
            >
              + Add Product
            </button>
          </div>

          <div className="admin-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Base Price</th>
                  <th>Cost Price</th>
                  <th>Unit</th>
                  <th>Tax</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((prd) => {
                  const cat = categories.find((c) => c.id === prd.category_id);
                  const marginPct =
                    prd.base_price > 0
                      ? (
                          ((prd.base_price - prd.cost_price) / prd.base_price) *
                          100
                        ).toFixed(1)
                      : '0.0';

                  return (
                    <tr key={prd.id}>
                      <td>
                        <strong>{prd.name}</strong>
                      </td>
                      <td>
                        <code>{prd.code}</code>
                      </td>
                      <td>{cat ? cat.name : '—'}</td>
                      <td>
                        <span className="admin-pill-type">
                          {prd.product_type}
                        </span>
                      </td>
                      <td>{formatCurrency(prd.base_price)}</td>
                      <td>
                        {formatCurrency(prd.cost_price)}
                        <small className="admin-margin-tag"> ({marginPct}% mrg)</small>
                      </td>
                      <td>{prd.unit}</td>
                      <td>{prd.tax_rate}%</td>
                      <td>
                        <span
                          className={`admin-status ${
                            prd.is_active
                              ? 'admin-status-active'
                              : 'admin-status-draft'
                          }`}
                        >
                          {prd.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleToggleProductActive(prd)}
                          disabled={actionLoading}
                        >
                          {prd.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="admin-empty">
                      {loading ? 'Loading products…' : 'No products found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT: Users & Roles */}
      {activeTab === 'users' && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <label className="field">
              <span className="field-label">Search Users</span>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search user email or role…"
              />
            </label>
            <div />
            <div className="admin-hint-tag">
              * Assign roles carefully to configure workflow permissions
            </div>
          </div>

          <div className="admin-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Assigned Role</th>
                  <th>Email Verification</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((usr) => (
                  <tr key={usr.id}>
                    <td>
                      <strong>{usr.email}</strong>
                    </td>
                    <td>
                      <select
                        className="admin-inline-select"
                        value={usr.role}
                        onChange={(e) => handleRoleChange(usr.id, e.target.value)}
                        disabled={actionLoading}
                      >
                        {USER_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`admin-status ${
                          usr.is_verified
                            ? 'admin-status-active'
                            : 'admin-status-draft'
                        }`}
                      >
                        {usr.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-status ${
                          usr.is_active
                            ? 'admin-status-active'
                            : 'admin-status-draft'
                        }`}
                      >
                        {usr.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleToggleUserStatus(usr)}
                        disabled={actionLoading}
                      >
                        {usr.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      {loading ? 'Loading users…' : 'No users found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT: Approval Chains & Bands */}
      {activeTab === 'chains' && (
        <section className="admin-section admin-dual-grid">
          {/* Chains List */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3>Approval Chains</h3>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setModal({ type: 'chain' })}
              >
                + Create Chain
              </button>
            </div>
            <div className="admin-chain-list">
              {approvalChains.map((chain) => (
                <div
                  key={chain.id}
                  className={`admin-chain-card ${
                    selectedChainId === chain.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedChainId(chain.id)}
                >
                  <div className="admin-chain-title">
                    <strong>{chain.name}</strong>
                    <span
                      className={`admin-status ${
                        chain.is_active
                          ? 'admin-status-active'
                          : 'admin-status-draft'
                      }`}
                    >
                      {chain.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="admin-chain-desc">
                    {chain.description || 'No description provided.'}
                  </p>
                </div>
              ))}
              {approvalChains.length === 0 && (
                <div className="admin-empty">No approval chains defined yet.</div>
              )}
            </div>
          </div>

          {/* Bands for Selected Chain */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>Governance Bands</h3>
                <p className="admin-small-caption">
                  Configured threshold bands for current chain
                </p>
              </div>
              {selectedChainId && (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setModal({ type: 'band' })}
                >
                  + Add Band
                </button>
              )}
            </div>

            {bandsLoading ? (
              <div className="admin-empty">Loading bands…</div>
            ) : selectedChainBands.length === 0 ? (
              <div className="admin-empty">
                {selectedChainId
                  ? 'No bands configured for this chain. Add one to require manager approvals!'
                  : 'Select an approval chain to inspect bands.'}
              </div>
            ) : (
              <div className="admin-table-card">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Excess Range</th>
                      <th>Approval Required</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedChainBands.map((band) => (
                      <tr key={band.id}>
                        <td>
                          <strong>{band.min_excess_percent}%</strong> to{' '}
                          <strong>
                            {band.max_excess_percent
                              ? `${band.max_excess_percent}%`
                              : 'Unlimited'}
                          </strong>
                        </td>
                        <td>
                          <span className="admin-pill-level">
                            {band.approval_level === 'manager_finance'
                              ? 'Sales Manager + Finance'
                              : 'Sales Manager'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="admin-delete"
                            onClick={() => handleDeleteBand(band.id)}
                            title="Remove Band"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB CONTENT: Discount Rules */}
      {activeTab === 'discounts' && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <label className="field">
              <span className="field-label">Filter Rules</span>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tier or category…"
              />
            </label>
            <div />
            <button
              className="btn btn-primary admin-add-button"
              onClick={() => setModal({ type: 'discount_rule' })}
              disabled={approvalChains.length === 0}
              title={
                approvalChains.length === 0
                  ? 'Create an approval chain first'
                  : ''
              }
            >
              + Add Discount Rule
            </button>
          </div>

          <div className="admin-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer Tier</th>
                  <th>Category</th>
                  <th>Max Allowed Discount</th>
                  <th>Associated Approval Chain</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => {
                  const cat = categories.find((c) => c.id === rule.category_id);
                  const chain = approvalChains.find(
                    (ch) => ch.id === rule.approval_chain_id
                  );

                  return (
                    <tr key={rule.id}>
                      <td>
                        <span className="admin-tier-badge">
                          {rule.customer_tier.toUpperCase()}
                        </span>
                      </td>
                      <td>{cat ? cat.name : 'All Categories (Global)'}</td>
                      <td>
                        <strong>{rule.max_discount_percent}%</strong>
                      </td>
                      <td>{chain ? chain.name : rule.approval_chain_id}</td>
                      <td>
                        <span
                          className={`admin-status ${
                            rule.is_active
                              ? 'admin-status-active'
                              : 'admin-status-draft'
                          }`}
                        >
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="admin-delete"
                          onClick={() => handleDeleteDiscountRule(rule.id)}
                          title="Delete Rule"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredRules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="admin-empty">
                      {loading
                        ? 'Loading discount rules…'
                        : 'No discount rules defined. Click "+ Add Discount Rule" to set governance guardrails.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT: Subscription Plans */}
      {activeTab === 'subscriptions' && (
        <section className="admin-section admin-dual-grid">
          {/* Create Plan Card */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3>Create Subscription Plan</h3>
              <span className="admin-mode-badge">Recurring Billing</span>
            </div>
            <form className="auth-form" onSubmit={handleCreateSubscriptionPlan}>
              <label className="field">
                <span className="field-label">Plan Name</span>
                <input
                  className="input"
                  name="name"
                  placeholder="e.g. Enterprise Monthly Support"
                  required
                />
              </label>
              <div className="admin-form-row">
                <label className="field">
                  <span className="field-label">Billing Interval</span>
                  <select className="input" name="interval" required>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Currency</span>
                  <input
                    className="input"
                    name="currency"
                    defaultValue="USD"
                    required
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Recurring Price</span>
                <input
                  className="input"
                  name="price"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="299.00"
                  required
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving Plan…' : 'Publish Subscription Plan'}
              </button>
            </form>
          </div>

          {/* Subscription Catalog Items */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3>Active Subscription Products</h3>
              <span className="admin-small-caption">
                Catalog items with type=subscription
              </span>
            </div>
            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Code</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <code>{p.code}</code>
                      </td>
                      <td>{formatCurrency(p.base_price)}</td>
                      <td>
                        <span
                          className={`admin-status ${
                            p.is_active
                              ? 'admin-status-active'
                              : 'admin-status-draft'
                          }`}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {subscriptionProducts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="admin-empty">
                        No subscription products in catalog yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* MODALS */}
      {modal && (
        <div className="admin-modal-backdrop" role="presentation">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <div>
                <p className="eyebrow">Admin Configuration</p>
                <h2>
                  {modal.type === 'category' && 'Add Catalog Category'}
                  {modal.type === 'product' && 'Add Catalog Product'}
                  {modal.type === 'chain' && 'Create Approval Chain'}
                  {modal.type === 'band' && 'Add Approval Band'}
                  {modal.type === 'discount_rule' && 'Add Discount Governance Rule'}
                </h2>
              </div>
              <button
                className="admin-close"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Category Form */}
            {modal.type === 'category' && (
              <form className="auth-form" onSubmit={handleCreateCategory}>
                <label className="field">
                  <span className="field-label">Category Name</span>
                  <input
                    className="input"
                    name="name"
                    placeholder="e.g. Cloud Infrastructure"
                    minLength={2}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Category Code</span>
                  <input
                    className="input"
                    name="code"
                    placeholder="e.g. CLOUD-INFRA"
                    pattern="^[A-Za-z0-9_-]+$"
                    title="Alphanumeric, dashes, and underscores only"
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Description (Optional)</span>
                  <textarea
                    className="input"
                    name="description"
                    rows={3}
                    placeholder="Describe the scope of products under this category…"
                  />
                </label>
                <div className="admin-modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Creating…' : 'Save Category'}
                  </button>
                </div>
              </form>
            )}

            {/* Product Form */}
            {modal.type === 'product' && (
              <form className="auth-form" onSubmit={handleCreateProduct}>
                <label className="field">
                  <span className="field-label">Product Name</span>
                  <input
                    className="input"
                    name="name"
                    placeholder="e.g. High-Throughput Edge Node"
                    required
                  />
                </label>
                <div className="admin-form-row">
                  <label className="field">
                    <span className="field-label">Code / SKU</span>
                    <input
                      className="input"
                      name="code"
                      placeholder="e.g. EDGE-200"
                      pattern="^[A-Za-z0-9_-]+$"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Category</span>
                    <select className="input" name="category_id" required>
                      <option value="">Select category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="admin-form-row">
                  <label className="field">
                    <span className="field-label">Product Type</span>
                    <select className="input" name="product_type" required>
                      {PRODUCT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Unit of Measure</span>
                    <input
                      className="input"
                      name="unit"
                      defaultValue="unit"
                      required
                    />
                  </label>
                </div>
                <div className="admin-form-row">
                  <label className="field">
                    <span className="field-label">Base Sale Price ($)</span>
                    <input
                      className="input"
                      name="base_price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="4500.00"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Cost Price ($)</span>
                    <input
                      className="input"
                      name="cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="3000.00"
                      required
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Tax Rate (%)</span>
                  <input
                    className="input"
                    name="tax_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue="0.00"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Description (Optional)</span>
                  <textarea
                    className="input"
                    name="description"
                    rows={2}
                    placeholder="Product specs and notes…"
                  />
                </label>
                <div className="admin-modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving Product…' : 'Save Product'}
                  </button>
                </div>
              </form>
            )}

            {/* Approval Chain Form */}
            {modal.type === 'chain' && (
              <form className="auth-form" onSubmit={handleCreateChain}>
                <label className="field">
                  <span className="field-label">Chain Name</span>
                  <input
                    className="input"
                    name="name"
                    placeholder="e.g. Standard Discount Escalation"
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Description</span>
                  <textarea
                    className="input"
                    name="description"
                    rows={3}
                    placeholder="Describe escalation routing for this chain…"
                  />
                </label>
                <div className="admin-modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving Chain…' : 'Save Chain'}
                  </button>
                </div>
              </form>
            )}

            {/* Approval Band Form */}
            {modal.type === 'band' && (
              <form className="auth-form" onSubmit={handleCreateBand}>
                <div className="admin-form-row">
                  <label className="field">
                    <span className="field-label">Min Excess %</span>
                    <input
                      className="input"
                      name="min_excess_percent"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0.0"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      Max Excess % (Empty = Unlimited)
                    </span>
                    <input
                      className="input"
                      name="max_excess_percent"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      placeholder="10.0"
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Required Approval Level</span>
                  <select className="input" name="approval_level" required>
                    <option value="manager">Sales Manager</option>
                    <option value="manager_finance">Sales Manager + Finance</option>
                  </select>
                </label>
                <div className="admin-modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving Band…' : 'Add Band'}
                  </button>
                </div>
              </form>
            )}

            {/* Discount Rule Form */}
            {modal.type === 'discount_rule' && (
              <form className="auth-form" onSubmit={handleCreateDiscountRule}>
                <label className="field">
                  <span className="field-label">Customer Tier</span>
                  <select className="input" name="customer_tier" required>
                    {CUSTOMER_TIERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Product Category</span>
                  <select className="input" name="category_id">
                    <option value="ALL">All Categories (Global Tier Rule)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Max Allowed Discount (%)</span>
                  <input
                    className="input"
                    name="max_discount_percent"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="15.0"
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Associated Approval Chain</span>
                  <select className="input" name="approval_chain_id" required>
                    <option value="">Select Approval Chain…</option>
                    {approvalChains.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving Rule…' : 'Save Rule'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
