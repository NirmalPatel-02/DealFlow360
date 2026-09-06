import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getInvoice, cancelInvoice, getOrderBillingSummary } from '../billing.api';
import PaymentStatus from '../components/PaymentStatus';
import BillingBreakdown from '../components/BillingBreakdown';
import Icon from '../../../components/ui/Icon';
import { formatCurrency } from '../../../utils/currency';
import '../BillingStyles.css';

export default function InvoiceDetailsPage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [orderBilling, setOrderBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getInvoice(invoiceId);
      const data = res.data;
      setInvoice(data);

      if (data && data.order_id) {
        getOrderBillingSummary(data.order_id)
          .then((sumRes) => setOrderBilling(sumRes.data))
          .catch(() => null);
      }
    } catch (err) {
      console.error('Failed to load invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoiceData();
  }, [invoiceId]);

  const handleCancelInvoice = async () => {
    if (!window.confirm('Are you sure you want to cancel and void this invoice?')) return;
    try {
      await cancelInvoice(invoice.id);
      showToast('Invoice voided successfully');
      loadInvoiceData();
    } catch (err) {
      alert(err.message || 'Failed to cancel invoice');
    }
  };

  const fmt = (val) => formatCurrency(val, invoice?.currency);

  if (loading) {
    return (
      <div className="invoice-detail-workspace">
        <div className="empty-state-box">
          <div className="empty-state-icon">⏳</div>
          <p>Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="invoice-detail-workspace">
        <div className="empty-state-box">
          <div className="empty-state-icon"><Icon name="alert-triangle" size={32} color="#f59e0b" /></div>
          <h3>Invoice Not Found</h3>
          <p>{error || 'The requested invoice could not be located.'}</p>
          <Link to="/billing" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const isOverdue =
    invoice.status !== 'PAID' &&
    invoice.status !== 'CANCELLED' &&
    invoice.due_date &&
    new Date(invoice.due_date) < new Date();

  return (
    <div className="invoice-detail-workspace">
      {/* Navigation & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <Link to="/billing" className="btn btn-secondary btn-sm">
          <Icon name="arrow-left" size={14} style={{ marginRight: '6px' }} /> Back to Billing Hub
        </Link>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
          >
            <Icon name="printer" size={15} style={{ marginRight: '6px' }} /> Print / Export PDF
          </button>

          {['DRAFT', 'ISSUED'].includes(invoice.status) && (
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={handleCancelInvoice}
            >
              Void Invoice
            </button>
          )}
        </div>
      </div>

      {/* Printable Invoice Paper Container */}
      <div className="invoice-paper">
        {/* Top Header */}
        <div className="invoice-paper-top">
          <div>
            <span className="brand-badge">DealFlow360</span>
            <div className="company-meta">
              DealFlow360 Enterprise ERP & CPQ Solutions<br />
              Tax & Invoicing Directorate<br />
              Bengaluru, Karnataka, India
            </div>
          </div>

          <div className="invoice-paper-meta">
            <h2>{invoice.invoice_number}</h2>
            <div style={{ marginBottom: '0.5rem' }}>
              <PaymentStatus
                status={isOverdue ? 'OVERDUE' : invoice.status}
                amountPaid={invoice.amount_paid}
                totalAmount={invoice.total_amount}
                currency={invoice.currency}
              />
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              <strong>Type:</strong>{' '}
              {invoice.invoice_type === 'RECURRING' ? (
                <><Icon name="refresh" size={13} style={{ marginRight: '4px' }} /> Recurring Cycle</>
              ) : (
                <><Icon name="zap" size={13} style={{ marginRight: '4px' }} /> One-Time Capex</>
              )}
            </div>
          </div>
        </div>

        {/* Bill To & Invoice Info */}
        <div className="invoice-bill-to-grid">
          <div className="bill-box">
            <div className="bill-box-title">Billed To (Client)</div>
            <div className="bill-detail-line">
              <strong>Account / Customer ID:</strong>
            </div>
            <div
              className="bill-detail-line"
              style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#818cf8' }}
            >
              {invoice.customer_id}
            </div>
            <div className="bill-detail-line" style={{ marginTop: '0.5rem' }}>
              Currency: <strong>{invoice.currency}</strong>
            </div>
          </div>

          <div className="bill-box">
            <div className="bill-box-title">Order References</div>
            <div className="bill-detail-line">
              Order ID:{' '}
              <span style={{ fontFamily: 'monospace' }}>
                {invoice.order_id || 'N/A'}
              </span>
            </div>
            <div className="bill-detail-line">
              Issue Date:{' '}
              <strong>
                {invoice.issued_at
                  ? new Date(invoice.issued_at).toLocaleDateString()
                  : 'N/A'}
              </strong>
            </div>
            <div className="bill-detail-line">
              Payment Due Date:{' '}
              <strong style={{ color: isOverdue ? '#f87171' : 'inherit' }}>
                {invoice.due_date
                  ? new Date(invoice.due_date).toLocaleDateString()
                  : 'N/A'}
                {isOverdue && ' (OVERDUE)'}
              </strong>
            </div>
            {invoice.paid_at && (
              <div className="bill-detail-line" style={{ color: '#34d399' }}>
                Settled Date: {new Date(invoice.paid_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <table className="invoice-items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description & Service Line</th>
              <th>Period</th>
              <th className="num-col">Qty</th>
              <th className="num-col">Unit Price</th>
              <th className="num-col">Discount</th>
              <th className="num-col">Tax</th>
              <th className="num-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, idx) => (
              <tr key={item.id || idx}>
                <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                <td style={{ fontWeight: 500 }}>
                  {item.description}
                  {item.subscription_id && (
                    <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>
                      Linked Subscription ID: {item.subscription_id.slice(0, 8)}...
                    </div>
                  )}
                </td>
                <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {item.billing_period_start && item.billing_period_end
                    ? `${item.billing_period_start} to ${item.billing_period_end}`
                    : '—'}
                </td>
                <td className="num-col">{Number(item.quantity)}</td>
                <td className="num-col">{fmt(item.unit_price)}</td>
                <td className="num-col" style={{ color: '#34d399' }}>
                  {Number(item.discount_amount) > 0 ? `- ${fmt(item.discount_amount)}` : '—'}
                </td>
                <td className="num-col" style={{ color: '#a5b4fc' }}>
                  {Number(item.tax_amount) > 0 ? `+ ${fmt(item.tax_amount)}` : '—'}
                </td>
                <td className="num-col" style={{ fontWeight: 600 }}>
                  {fmt(item.total_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial Summary & Breakdown */}
        <div className="invoice-summary-split">
          <BillingBreakdown
            subtotal={invoice.subtotal}
            discountAmount={invoice.discount_amount}
            taxAmount={invoice.tax_amount}
            totalAmount={invoice.total_amount}
            amountPaid={invoice.amount_paid}
            amountDue={invoice.amount_due}
            currency={invoice.currency}
            oneTime={orderBilling?.oneTime}
            recurring={orderBilling?.recurring}
          />
        </div>

        {/* Payment History / Audit Trail */}
        <div className="invoice-payments-audit-section">
          <div className="audit-section-header">
            <h3><Icon name="credit-card" size={18} style={{ marginRight: '8px' }} /> Payment & Settlement Ledger ({invoice.payments?.length || 0})</h3>
          </div>

          {!invoice.payments || invoice.payments.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              No payments recorded yet for this invoice. Balance outstanding is{' '}
              <strong style={{ color: '#f87171' }}>{fmt(invoice.amount_due)}</strong>.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="billing-data-table">
                <thead>
                  <tr>
                    <th>Reference / UTR</th>
                    <th>Payment Method</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((pmt) => (
                    <tr key={pmt.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {pmt.payment_reference}
                      </td>
                      <td>
                        <span className="payment-method-chip">
                          {pmt.payment_method.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#34d399' }}>
                        {fmt(pmt.amount)}
                      </td>
                      <td>
                        <span
                          className={`billing-status-pill ${
                            pmt.status === 'SUCCESS' ? 'badge-paid' : 'badge-draft'
                          }`}
                        >
                          {pmt.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {pmt.paid_at
                          ? new Date(pmt.paid_at).toLocaleString()
                          : pmt.created_at
                          ? new Date(pmt.created_at).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`billing-toast ${toast.type}`}>
          <span>
            {toast.type === 'success' ? (
              <Icon name="check-circle" size={18} color="#10b981" />
            ) : (
              <Icon name="alert-triangle" size={18} color="#f59e0b" />
            )}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
