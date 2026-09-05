import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { createCustomer, listCustomers } from '../../customers/customers.api';
import { listCategories, listProducts } from '../../products/products.api';
import {
  useCreateQuotation,
  useQuotationDetail,
} from '../quotations.hooks';
import {
  addQuoteLine,
  updateQuoteLine,
  deleteQuoteLine,
  updateQuotation,
} from '../quotations.api';
import { getErrorMessage } from '../../../services/api/apiError';
import '../quotation-pages.css';

const EMPTY_LINE = {
  product_id: '',
  quantity: '1',
  discount_percent: '0',
  line_type: 'one_time',
  notes: '',
};

export default function QuotationFormPage() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(quoteId);

  const { quotation, loading: quoteLoading } = useQuotationDetail(quoteId);
  const { create: createQuote, loading: creatingQuote } = useCreateQuotation();

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState('');

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({
    name: '',
    code: '',
    tier: 'bronze',
    currency: 'INR',
    email: '',
    phone: '',
  });

  const [values, setValues] = useState({
    customer_id: '',
    notes: '',
    valid_until: '',
  });

  const [lines, setLines] = useState([EMPTY_LINE]);
  const [deletedLineIds, setDeletedLineIds] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load initial active customers, products, and categories
  useEffect(() => {
    let active = true;
    Promise.all([
      listCustomers({ is_active: true }),
      listProducts({ is_active: true, limit: 100 }),
      listCategories(),
    ])
      .then(([customerData, productData, categoryData]) => {
        if (!active) return;
        setCustomers(customerData || []);
        setProducts(productData || []);
        setCategories(categoryData || []);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Filtered product listing when search/category/type changes
  useEffect(() => {
    if (loadingOptions) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      listProducts({
        search: productSearch || undefined,
        category_id: categoryId || undefined,
        product_type: productType || undefined,
        is_active: true,
        limit: 100,
      })
        .then((data) => {
          if (active) setProducts(data || []);
        })
        .catch(() => {
          // Keep existing products if search fails
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [categoryId, loadingOptions, productSearch, productType]);

  // Populate data when editing existing quotation
  useEffect(() => {
    if (!quotation) return;
    setValues({
      customer_id: quotation.customer_id || '',
      notes: quotation.notes || '',
      valid_until: quotation.valid_until ? quotation.valid_until.slice(0, 10) : '',
    });
    if (quotation.lines?.length) {
      setLines(
        quotation.lines.map((line) => ({
          id: line.id,
          product_id: line.product_id,
          quantity: String(line.quantity),
          discount_percent: String(line.discount_percent || 0),
          line_type: line.line_type || 'one_time',
          notes: line.notes || '',
        }))
      );
    }
  }, [quotation]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === values.customer_id) || null;
  }, [customers, values.customer_id]);

  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Live commercial calculations per line and total
  const lineCalculations = useMemo(() => {
    return lines.map((line) => {
      const product = productMap.get(line.product_id);
      const basePrice = Number(product?.base_price || 0);
      const costPrice = Number(product?.cost_price || 0);
      const qty = Math.max(0, Number(line.quantity || 0));
      const disc = Math.min(100, Math.max(0, Number(line.discount_percent || 0)));

      const discountedUnitPrice = basePrice * (1 - disc / 100);
      const subtotal = basePrice * qty;
      const discountAmount = subtotal * (disc / 100);
      const lineTotal = subtotal - discountAmount;
      const totalCost = costPrice * qty;
      const marginAmount = lineTotal - totalCost;
      const marginPercent = lineTotal > 0 ? (marginAmount / lineTotal) * 100 : 0;

      return {
        product,
        basePrice,
        costPrice,
        discountedUnitPrice,
        subtotal,
        discountAmount,
        lineTotal,
        totalCost,
        marginAmount,
        marginPercent,
      };
    });
  }, [lines, productMap]);

  const overallTotals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let netTotal = 0;
    let totalCost = 0;
    let totalItems = 0;

    lineCalculations.forEach((calc, index) => {
      if (lines[index].product_id && Number(lines[index].quantity) > 0) {
        subtotal += calc.subtotal;
        totalDiscount += calc.discountAmount;
        netTotal += calc.lineTotal;
        totalCost += calc.totalCost;
        totalItems += Number(lines[index].quantity);
      }
    });

    const grossMarginPercent = netTotal > 0 ? ((netTotal - totalCost) / netTotal) * 100 : 0;
    const blendedDiscountPercent = subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0;

    return {
      subtotal,
      totalDiscount,
      netTotal,
      totalCost,
      totalItems,
      grossMarginPercent,
      blendedDiscountPercent,
    };
  }, [lineCalculations, lines]);

  function updateValue(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateLineValue(index, event) {
    const { name, value } = event.target;
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, [name]: value } : line))
    );
  }

  function addBlankLine() {
    setLines((current) => [...current, { ...EMPTY_LINE }]);
  }

  function removeLine(index) {
    const targetLine = lines[index];
    if (targetLine?.id) {
      setDeletedLineIds((current) => [...current, targetLine.id]);
    }
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  }

  async function handleCreateCustomer(e) {
    e.preventDefault();
    setCustomerSaving(true);
    setError('');

    const formattedCode = customerDraft.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');

    try {
      const payload = {
        name: customerDraft.name.trim(),
        code: formattedCode,
        tier: customerDraft.tier,
        currency: customerDraft.currency.trim().toUpperCase() || 'INR',
        email: customerDraft.email.trim() || undefined,
        phone: customerDraft.phone.trim() || undefined,
      };

      const customer = await createCustomer(payload);
      setCustomers((current) => [customer, ...current]);
      setValues((current) => ({ ...current, customer_id: customer.id }));
      setShowCustomerForm(false);
      setCustomerDraft({
        name: '',
        code: '',
        tier: 'bronze',
        currency: 'INR',
        email: '',
        phone: '',
      });
    } catch (requestError) {
      setError(`Failed to create customer: ${getErrorMessage(requestError)}`);
    } finally {
      setCustomerSaving(false);
    }
  }

  const visibleCustomers = customers.filter(
    (customer) =>
      !customerSearch ||
      `${customer.name} ${customer.code} ${customer.tier}`.toLowerCase().includes(customerSearch.toLowerCase())
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!values.customer_id) {
      setError('Please select a customer for this quotation.');
      return;
    }

    const validLines = lines.filter((line) => line.product_id && Number(line.quantity) > 0);
    if (!validLines.length) {
      setError('Please add at least one product line with a valid quantity.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        // 1. Update quote header
        await updateQuotation(quoteId, {
          notes: values.notes || null,
          valid_until: values.valid_until ? new Date(`${values.valid_until}T23:59:59Z`).toISOString() : null,
        });

        // 2. Delete removed lines
        for (const lineId of deletedLineIds) {
          try {
            await deleteQuoteLine(quoteId, lineId);
          } catch {
            // Ignore if already gone
          }
        }

        // 3. Update existing lines or add new lines
        for (const line of validLines) {
          if (line.id) {
            await updateQuoteLine(quoteId, line.id, {
              quantity: Number(line.quantity),
              discount_percent: Number(line.discount_percent || 0),
              notes: line.notes || null,
            });
          } else {
            await addQuoteLine(quoteId, {
              product_id: line.product_id,
              quantity: Number(line.quantity),
              discount_percent: Number(line.discount_percent || 0),
              line_type: line.line_type || 'one_time',
              notes: line.notes || null,
            });
          }
        }

        navigate(`/quotations/${quoteId}`, { replace: true });
      } else {
        // 1. Create quote
        const savedQuote = await createQuote({
          customer_id: values.customer_id,
          notes: values.notes || null,
          valid_until: values.valid_until ? new Date(`${values.valid_until}T23:59:59Z`).toISOString() : null,
        });

        // 2. Add each product line
        for (const line of validLines) {
          await addQuoteLine(savedQuote.id, {
            product_id: line.product_id,
            quantity: Number(line.quantity),
            discount_percent: Number(line.discount_percent || 0),
            line_type: line.line_type || 'one_time',
            notes: line.notes || null,
          });
        }

        navigate(`/quotations/${savedQuote.id}`, { replace: true });
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  const busy = loadingOptions || quoteLoading || saving || creatingQuote;
  const currencyCode = selectedCustomer?.currency || quotation?.currency || 'INR';

  return (
    <section className="quotation-page">
      <div className="quotation-page-header">
        <div>
          <p className="eyebrow">DealFlow360 / Quotations</p>
          <h1 className="page-title">{editing ? `Edit ${quotation?.quote_number || 'Quotation'}` : 'New Quotation'}</h1>
          <p className="subheading">Configure customer terms, catalog products, and live margin governance.</p>
        </div>
        <Link to="/dashboard" className="btn btn-outline">
          Back to dashboard
        </Link>
      </div>

      {error ? <p className="form-banner error-banner">{error}</p> : null}

      <form className="quotation-form" onSubmit={handleSubmit}>
        {/* Customer & Quotation Details */}
        <div className="quotation-form-section">
          <div className="section-heading-row">
            <h2>Customer & Commercial Terms</h2>
            {!editing && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowCustomerForm((cur) => !cur)}
              >
                {showCustomerForm ? 'Cancel Customer' : '+ New Customer'}
              </button>
            )}
          </div>

          {/* Inline Customer Creator */}
          {showCustomerForm && !editing && (
            <div className="inline-customer-form">
              <h3>Create & Select New Customer</h3>
              <div className="quotation-form-grid">
                <label className="field">
                  <span className="field-label">Customer Name *</span>
                  <input
                    className="input"
                    value={customerDraft.name}
                    onChange={(e) => setCustomerDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Acme Corp"
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Account Code *</span>
                  <input
                    className="input"
                    value={customerDraft.code}
                    onChange={(e) => setCustomerDraft((d) => ({ ...d, code: e.target.value }))}
                    placeholder="e.g. ACME-01"
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Pricing Tier</span>
                  <select
                    className="input"
                    value={customerDraft.tier}
                    onChange={(e) => setCustomerDraft((d) => ({ ...d, tier: e.target.value }))}
                  >
                    <option value="bronze">Bronze Tier</option>
                    <option value="silver">Silver Tier</option>
                    <option value="gold">Gold Tier</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Currency</span>
                  <select
                    className="input"
                    value={customerDraft.currency}
                    onChange={(e) => setCustomerDraft((d) => ({ ...d, currency: e.target.value }))}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Email (Optional)</span>
                  <input
                    className="input"
                    type="email"
                    value={customerDraft.email}
                    onChange={(e) => setCustomerDraft((d) => ({ ...d, email: e.target.value }))}
                    placeholder="billing@acme.com"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Phone (Optional)</span>
                  <input
                    className="input"
                    value={customerDraft.phone}
                    onChange={(e) => setCustomerDraft((d) => ({ ...d, phone: e.target.value }))}
                    placeholder="+91 9876543210"
                  />
                </label>
              </div>
              <div className="action-row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateCustomer}
                  disabled={customerSaving || !customerDraft.name || !customerDraft.code}
                >
                  {customerSaving ? 'Saving Customer…' : 'Save and Select'}
                </button>
              </div>
            </div>
          )}

          <div className="quotation-form-grid">
            <label className="field">
              <span className="field-label">Select Customer *</span>
              {!editing && (
                <input
                  className="input"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Type to filter customers…"
                  style={{ marginBottom: '0.4rem' }}
                  disabled={busy}
                />
              )}
              <select
                className="input"
                name="customer_id"
                value={values.customer_id}
                onChange={updateValue}
                disabled={editing || busy}
                required
              >
                <option value="">-- Choose customer account --</option>
                {visibleCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.code}) · {customer.tier?.toUpperCase()} · {customer.currency}
                  </option>
                ))}
              </select>
              {selectedCustomer && (
                <div className="customer-badge-info">
                  <span className="tier-tag">{selectedCustomer.tier?.toUpperCase()} TIER</span>
                  <span className="currency-tag">Currency: {selectedCustomer.currency}</span>
                  <span className="code-tag">Code: {selectedCustomer.code}</span>
                </div>
              )}
            </label>

            <Field
              label="Valid Until"
              name="valid_until"
              type="date"
              value={values.valid_until}
              onChange={updateValue}
              disabled={busy}
            />
          </div>

          <label className="field" style={{ marginTop: '1rem' }}>
            <span className="field-label">Deal Notes & Commercial Terms</span>
            <textarea
              className="input quotation-notes"
              name="notes"
              value={values.notes}
              onChange={updateValue}
              rows="3"
              placeholder="Commercial scope, SLA commitments, payment schedule, or discount justifications…"
              disabled={busy}
            />
          </label>
        </div>

        {/* Product Lines Section */}
        <div className="quotation-form-section">
          <div className="section-heading-row">
            <div>
              <h2>Quotation Lines</h2>
              <p className="section-subtext">Add products and monitor real-time gross margin and discount impact.</p>
            </div>
            <button type="button" className="btn btn-outline" onClick={addBlankLine} disabled={busy}>
              + Add Product Line
            </button>
          </div>

          {/* Catalog Filters */}
          <div className="quotation-form-grid product-filters" style={{ marginBottom: '1.25rem' }}>
            <Field
              label="Search Catalog"
              name="product_search"
              placeholder="Filter products by name or SKU…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <label className="field">
              <span className="field-label">Category Filter</span>
              <select
                className="input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
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
              <span className="field-label">Product Type</span>
              <select
                className="input"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="hardware">Hardware</option>
                <option value="service">Service</option>
                <option value="subscription">Subscription</option>
              </select>
            </label>
          </div>

          {/* Lines List */}
          <div className="lines-container">
            {lines.map((line, index) => {
              const calc = lineCalculations[index];
              const isHealthyMargin = calc.marginPercent >= 25;
              const isWarningMargin = calc.marginPercent >= 10 && calc.marginPercent < 25;

              return (
                <div className="quotation-line-card" key={line.id || `line-${index}`}>
                  <div className="line-card-header">
                    <span className="line-number-badge">Line #{index + 1}</span>
                    <div className="line-card-meta">
                      {calc.product && (
                        <span className="product-type-badge">
                          {calc.product.product_type?.toUpperCase()}
                        </span>
                      )}
                      <button
                        type="button"
                        className="line-remove"
                        onClick={() => removeLine(index)}
                        disabled={busy || lines.length === 1}
                        title="Remove Line"
                        aria-label="Remove product line"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="line-inputs-grid">
                    <label className="field line-product-select">
                      <span className="field-label">Product *</span>
                      <select
                        className="input"
                        name="product_id"
                        value={line.product_id}
                        onChange={(e) => updateLineValue(index, e)}
                        disabled={busy || Boolean(line.id && editing)}
                        required
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code}) · Base: {currencyCode} {Number(p.base_price).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span className="field-label">Contract Type</span>
                      <select
                        className="input"
                        name="line_type"
                        value={line.line_type}
                        onChange={(e) => updateLineValue(index, e)}
                        disabled={busy}
                      >
                        <option value="one_time">One-time</option>
                        <option value="recurring">Recurring</option>
                        <option value="subscription">Subscription</option>
                      </select>
                    </label>

                    <Field
                      label="Quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLineValue(index, e)}
                      disabled={busy}
                      required
                    />

                    <Field
                      label="Discount %"
                      name="discount_percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={line.discount_percent}
                      onChange={(e) => updateLineValue(index, e)}
                      disabled={busy}
                    />
                  </div>

                  {/* Real-time Line Calculation Ribbon */}
                  {calc.product && (
                    <div className="line-calc-ribbon">
                      <div className="calc-stat">
                        <small>Unit Price:</small>
                        <span>
                          {currencyCode} {calc.basePrice.toFixed(2)}
                          {Number(line.discount_percent) > 0 && (
                            <span className="discounted-unit">
                              {' '}→ {currencyCode} {calc.discountedUnitPrice.toFixed(2)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="calc-stat">
                        <small>Line Total:</small>
                        <strong className="calc-total">
                          {currencyCode} {calc.lineTotal.toFixed(2)}
                        </strong>
                      </div>
                      <div className="calc-stat">
                        <small>Line Margin:</small>
                        <span
                          className={`margin-pill ${
                            isHealthyMargin
                              ? 'margin-pill-healthy'
                              : isWarningMargin
                              ? 'margin-pill-warning'
                              : 'margin-pill-danger'
                          }`}
                        >
                          {calc.marginPercent.toFixed(1)}% ({currencyCode} {calc.marginAmount.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="line-notes-row">
                    <input
                      className="input input-sm"
                      name="notes"
                      value={line.notes}
                      onChange={(e) => updateLineValue(index, e)}
                      placeholder="Optional notes or custom configuration for this line item…"
                      disabled={busy}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Overall Quotation Summary */}
          <div className="deal-summary-banner">
            <div className="summary-col">
              <span className="summary-label">Total Items</span>
              <strong className="summary-val">{overallTotals.totalItems} units</strong>
            </div>
            <div className="summary-col">
              <span className="summary-label">Gross Subtotal</span>
              <strong className="summary-val">
                {currencyCode} {overallTotals.subtotal.toFixed(2)}
              </strong>
            </div>
            <div className="summary-col">
              <span className="summary-label">Total Discount</span>
              <strong className="summary-val discount-val">
                -{currencyCode} {overallTotals.totalDiscount.toFixed(2)} ({overallTotals.blendedDiscountPercent.toFixed(1)}%)
              </strong>
            </div>
            <div className="summary-col">
              <span className="summary-label">Estimated Net Total</span>
              <strong className="summary-val grand-val">
                {currencyCode} {overallTotals.netTotal.toFixed(2)}
              </strong>
            </div>
            <div className="summary-col">
              <span className="summary-label">Blended Margin</span>
              <strong
                className={`summary-val ${
                  overallTotals.grossMarginPercent >= 25
                    ? 'text-healthy'
                    : overallTotals.grossMarginPercent >= 10
                    ? 'text-warning'
                    : 'text-danger'
                }`}
              >
                {overallTotals.grossMarginPercent.toFixed(1)}%
              </strong>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="quotation-form-actions">
          <Link to="/dashboard" className="btn btn-outline" disabled={busy}>
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Saving Quotation…' : editing ? 'Save Changes' : 'Create Quotation'}
          </button>
        </div>
      </form>
    </section>
  );
}
