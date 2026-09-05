import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { createCustomer, listCustomers } from '../../customers/customers.api';
import { listCategories, listProducts } from '../../products/products.api';
import {
  useCreateQuotation,
  useQuotationDetail,
  useQuotationLines,
} from '../quotations.hooks';
import { addQuoteLine, updateQuotation } from '../quotations.api';
import { getErrorMessage } from '../../../services/api/apiError';
import '../quotation-pages.css';

const EMPTY_LINE = { product_id: '', quantity: '1', discount_percent: '0', line_type: 'one_time', notes: '' };
const TEMP_CUSTOMERS = [{ id: 'temp-customer-1', name: 'Northstar Labs', code: 'NORTHSTAR', tier: 'gold', currency: 'USD' }];
const TEMP_PRODUCTS = [{ id: 'temp-product-1', name: 'Edge Compute Node', code: 'EDGE-100', product_type: 'hardware', base_price: 4800, cost_price: 3200 }];

export default function QuotationFormPage() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(quoteId);
  const { quotation, loading: quoteLoading } = useQuotationDetail(quoteId);
  const { create, loading: creating } = useCreateQuotation();
  const { updateLine, loading: lineSaving, error: lineError } = useQuotationLines(quoteId);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({ name: '', code: '', tier: 'bronze', currency: 'USD' });
  const [values, setValues] = useState({ customer_id: '', notes: '', valid_until: '' });
  const [lines, setLines] = useState([EMPTY_LINE]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listCustomers({ is_active: true }), listProducts({ is_active: true, limit: 100 }), listCategories()])
      .then(([customerData, productData, categoryData]) => {
        if (!active) return;
        setCustomers(customerData?.length ? customerData : TEMP_CUSTOMERS);
        setProducts(productData?.length ? productData : TEMP_PRODUCTS);
        setCategories(categoryData || []);
      })
      .catch((requestError) => {
        if (!active) return;
        setCustomers(TEMP_CUSTOMERS);
        setProducts(TEMP_PRODUCTS);
        setError(`${getErrorMessage(requestError)} Showing temporary catalog data.`);
      })
      .finally(() => active && setLoadingOptions(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loadingOptions) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      listProducts({ search: productSearch, category_id: categoryId, product_type: productType, is_active: true, limit: 100 })
        .then((data) => active && setProducts(data?.length ? data : TEMP_PRODUCTS))
        .catch(() => active && setProducts(TEMP_PRODUCTS));
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [categoryId, loadingOptions, productSearch, productType]);

  useEffect(() => {
    if (!quotation) return;
    let active = true;
    const hydration = setTimeout(() => {
      if (!active) return;
      setValues({
        customer_id: quotation.customer_id || '',
        notes: quotation.notes || '',
        valid_until: quotation.valid_until ? quotation.valid_until.slice(0, 10) : '',
      });
      setLines(quotation.lines?.length ? quotation.lines.map((line) => ({
        id: line.id,
        product_id: line.product_id,
        quantity: String(line.quantity),
        discount_percent: String(line.discount_percent),
        line_type: line.line_type || 'one_time',
        notes: line.notes || '',
      })) : [EMPTY_LINE]);
    }, 0);
    return () => { active = false; clearTimeout(hydration); };
  }, [quotation]);

  function updateValue(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateLineValue(index, event) {
    const { name, value } = event.target;
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index ? { ...line, [name]: value } : line
    )));
  }

  function addBlankLine() {
    setLines((current) => [...current, { ...EMPTY_LINE }]);
  }

  function removeLine(index) {
    setLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function handleCreateCustomer() {
    setCustomerSaving(true);
    setError('');
    try {
      const customer = await createCustomer(customerDraft);
      setCustomers((current) => [customer, ...current]);
      setValues((current) => ({ ...current, customer_id: customer.id }));
      setShowCustomerForm(false);
      setCustomerDraft({ name: '', code: '', tier: 'bronze', currency: 'USD' });
    } catch (requestError) {
      setError(`${getErrorMessage(requestError)} Temporary customer creation is unavailable until the API is ready.`);
    } finally {
      setCustomerSaving(false);
    }
  }

  const visibleCustomers = customers.filter((customer) => !customerSearch || `${customer.name} ${customer.code}`.toLowerCase().includes(customerSearch.toLowerCase()));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!values.customer_id) {
      setError('Select a customer before saving the quotation.');
      return;
    }
    const validLines = lines.filter((line) => line.product_id && Number(line.quantity) > 0);
    if (!validLines.length) {
      setError('Add at least one product line.');
      return;
    }

    setSaving(true);
    try {
      let savedQuote;
      if (editing) {
        savedQuote = await updateQuotation(quoteId, {
          notes: values.notes || null,
          valid_until: values.valid_until ? new Date(`${values.valid_until}T00:00:00`).toISOString() : null,
        });
        for (const line of validLines.filter((line) => line.id)) {
          await updateLine(line.id, {
            quantity: Number(line.quantity),
            discount_percent: Number(line.discount_percent || 0),
            notes: line.notes || null,
          });
        }
      } else {
        savedQuote = await create({
          customer_id: values.customer_id,
          notes: values.notes || null,
          valid_until: values.valid_until ? new Date(`${values.valid_until}T00:00:00`).toISOString() : null,
        });
        for (const line of validLines) {
          await addQuoteLine(savedQuote.id, {
            product_id: line.product_id,
            quantity: Number(line.quantity),
            discount_percent: Number(line.discount_percent || 0),
            line_type: line.line_type,
            notes: line.notes || null,
          });
        }
      }
      navigate(`/quotations/${savedQuote.id}`, { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  const busy = loadingOptions || quoteLoading || saving || creating || lineSaving;

  return (
    <section className="quotation-page">
      <div className="quotation-page-header">
        <div>
          <p className="eyebrow">DealFlow360 / Quotations</p>
          <h1 className="page-title">{editing ? 'Edit quotation' : 'New quotation'}</h1>
          <p className="subheading">Build a clear offer with the customer, products, and commercial terms.</p>
        </div>
        <Link to="/dashboard" className="btn btn-outline">Back to dashboard</Link>
      </div>

      {error || lineError ? <p className="form-banner">{error || lineError}</p> : null}
      <form className="quotation-form" onSubmit={handleSubmit}>
        <div className="quotation-form-section">
          <h2>Quotation details</h2>
          <div className="quotation-form-grid">
            <label className="field">
              <span className="field-label">Customer</span>
              <input className="input" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customers" disabled={busy} />
              <select className="input" name="customer_id" value={values.customer_id} onChange={updateValue} disabled={editing || busy}>
                <option value="">Select customer</option>
                {visibleCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.tier || 'tier pending'}</option>)}
              </select>
              {!editing && <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowCustomerForm((current) => !current)}>+ Create customer</button>}
            </label>
            <Field label="Valid until" name="valid_until" type="date" value={values.valid_until} onChange={updateValue} disabled={busy} />
          </div>
          <label className="field">
            <span className="field-label">Notes</span>
            <textarea className="input quotation-notes" name="notes" value={values.notes} onChange={updateValue} rows="4" disabled={busy} />
          </label>
        </div>

        {showCustomerForm && <div className="quotation-form-section inline-customer-form"><div className="section-heading-row"><h2>Create customer</h2><button type="button" className="line-remove" onClick={() => setShowCustomerForm(false)} aria-label="Close customer form">×</button></div><div className="quotation-form-grid"><label className="field"><span className="field-label">Customer name</span><input className="input" value={customerDraft.name} onChange={(event) => setCustomerDraft((current) => ({ ...current, name: event.target.value }))} required /></label><label className="field"><span className="field-label">Customer code</span><input className="input" value={customerDraft.code} onChange={(event) => setCustomerDraft((current) => ({ ...current, code: event.target.value }))} required /></label><label className="field"><span className="field-label">Subscription tier</span><select className="input" value={customerDraft.tier} onChange={(event) => setCustomerDraft((current) => ({ ...current, tier: event.target.value }))}><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option></select></label><label className="field"><span className="field-label">Currency</span><input className="input" value={customerDraft.currency} onChange={(event) => setCustomerDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} maxLength="3" required /></label><button className="btn btn-primary" type="button" onClick={handleCreateCustomer} disabled={customerSaving}>{customerSaving ? 'Creating…' : 'Create and select'}</button></div></div>}

        <div className="quotation-form-section">
          <div className="section-heading-row"><h2>Product lines</h2><button type="button" className="btn btn-outline" onClick={addBlankLine}>+ Add line</button></div>
          <div className="quotation-form-grid product-filters"><Field label="Search catalog" name="product_search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /><label className="field"><span className="field-label">Catalog category</span><select className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="field"><span className="field-label">Product type</span><select className="input" value={productType} onChange={(event) => setProductType(event.target.value)}><option value="">All types</option><option value="hardware">Hardware</option><option value="service">Service</option><option value="subscription">Subscription</option></select></label></div>
          {lines.map((line, index) => (
            <div className="quotation-line" key={line.id || `new-${index}`}>
              <label className="field line-product"><span className="field-label">Product</span><select className="input" name="product_id" value={line.product_id} onChange={(event) => updateLineValue(index, event)} disabled={busy || Boolean(line.id && editing)}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code}</option>)}</select></label>
              <Field label="Quantity" name="quantity" type="number" value={line.quantity} onChange={(event) => updateLineValue(index, event)} disabled={busy} />
              <Field label="Discount %" name="discount_percent" type="number" value={line.discount_percent} onChange={(event) => updateLineValue(index, event)} disabled={busy} />
              <button type="button" className="line-remove" onClick={() => removeLine(index)} disabled={busy || lines.length === 1} aria-label="Remove product line">×</button>
            </div>
          ))}
        </div>
        <div className="quotation-form-actions"><Link to="/dashboard" className="btn btn-outline">Cancel</Link><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create quotation'}</button></div>
      </form>
    </section>
  );
}
