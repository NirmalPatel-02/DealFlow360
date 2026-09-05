import React from 'react';
import { Link } from 'react-router-dom';
import PaymentStatus from './PaymentStatus';

export default function InvoiceSummary({
  invoice,
  onRecordPayment,
  onCancelInvoice,
  compact = false,
}) {
  if (!invoice) return null;

  const fmt = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: invoice.currency || 'INR',
      maximumFractionDigits: 2,
    }).format(Number(val) || 0);

  const isOverdue =
    invoice.status !== 'PAID' &&
    invoice.status !== 'CANCELLED' &&
    invoice.due_date &&
    new Date(invoice.due_date) < new Date();

  return (
    <div className={`invoice-summary-card ${compact ? 'compact' : ''}`}>
      <div className="invoice-summary-header">
        <div className="invoice-id-group">
          <div className="invoice-type-tag">
            {invoice.invoice_type === 'RECURRING' ? '🔄 Recurring Cycle' : '⚡ One-Time Order'}
          </div>
          <h4 className="invoice-number">
            <Link to={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
          </h4>
          <span className="invoice-date">
            Issued: {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : 'N/A'}
          </span>
        </div>

        <div className="invoice-header-right">
          <PaymentStatus
            status={isOverdue ? 'OVERDUE' : invoice.status}
            amountPaid={invoice.amount_paid}
            totalAmount={invoice.total_amount}
            currency={invoice.currency}
          />
        </div>
      </div>

      <div className="invoice-summary-details">
        <div className="detail-item">
          <span className="detail-label">Order Ref</span>
          <span className="detail-val mono" title={invoice.order_id}>
            {invoice.order_id ? `${invoice.order_id.slice(0, 8)}...` : 'N/A'}
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Due Date</span>
          <span className={`detail-val ${isOverdue ? 'text-due' : ''}`}>
            {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
            {isOverdue && <span className="overdue-warning-tag">OVERDUE</span>}
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Total Amount</span>
          <span className="detail-val strong">{fmt(invoice.total_amount)}</span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Balance Due</span>
          <span className={`detail-val strong ${Number(invoice.amount_due) > 0 ? 'text-due' : 'text-settled'}`}>
            {fmt(invoice.amount_due)}
          </span>
        </div>
      </div>

      <div className="invoice-summary-actions">
        <Link to={`/invoices/${invoice.id}`} className="btn btn-secondary btn-sm">
          🔍 View Full Invoice
        </Link>
        {Number(invoice.amount_due) > 0 && invoice.status !== 'CANCELLED' && onRecordPayment && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onRecordPayment(invoice)}
          >
            💳 Record Payment
          </button>
        )}
        {['DRAFT', 'ISSUED'].includes(invoice.status) && onCancelInvoice && (
          <button
            type="button"
            className="btn btn-danger-ghost btn-sm"
            onClick={() => onCancelInvoice(invoice.id)}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
