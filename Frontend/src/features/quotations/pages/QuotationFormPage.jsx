import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Field from '../../../components/forms/Field.jsx';
import { listCustomers } from '../../customers/customers.api';
import { listProducts } from '../../products/products.api';
import {
  useCreateQuotation,
  useQuotationDetail,
  useQuotationLines,
} from '../quotations.hooks';
import { addQuoteLine, updateQuotation } from '../quotations.api';
import { getErrorMessage } from '../../../services/api/apiError';
import '../quotation-pages.css';

const EMPTY_LINE = { product_id: '', quantity: '1', discount_percent: '0', line_type: 'one_time', notes: '' };

export default function QuotationFormPage() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(quoteId);
  const { quotation, loading: quoteLoading } = useQuotationDetail(quoteId);
  const { create, loading: creating } = useCreateQuotation();
  const { updateLine, loading: lineSaving, error: lineError } = useQuotationLines(quoteId);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [values, setValues] = useState({ customer_id: '', notes: '', valid_until: '' });
  const [lines, setLines] = useState([EMPTY_LINE]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listCustomers({ is_active: true }), listProducts({ is_active: true })])
      .then(([customerData, productData]) => {
        if (!active) return;
        setCustomers(customerData || []);
        setProducts(productData || []);
      })
      .catch((requestError) => active && setError(getErrorMessage(requestError)))
      .finally(() => active && setLoadingOptions(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!quotation) return;
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
              <select className="input" name="customer_id" value={values.customer_id} onChange={updateValue} disabled={editing || busy}>
                <option value="">Select customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} ({customer.code})</option>)}
              </select>
            </label>
            <Field label="Valid until" name="valid_until" type="date" value={values.valid_until} onChange={updateValue} disabled={busy} />
          </div>
          <label className="field">
            <span className="field-label">Notes</span>
            <textarea className="input quotation-notes" name="notes" value={values.notes} onChange={updateValue} rows="4" disabled={busy} />
          </label>
        </div>

        <div className="quotation-form-section">
          <div className="section-heading-row"><h2>Product lines</h2><button type="button" className="btn btn-outline" onClick={addBlankLine}>+ Add line</button></div>
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
