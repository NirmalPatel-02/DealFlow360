import React from 'react';
import { Link } from 'react-router-dom';
import PaymentStatus from './PaymentStatus';
import Icon from '../../../components/ui/Icon';
import { formatCurrency } from '../../../utils/currency';

export default function InvoiceSummary({
  invoice,
  onRecordPayment,
  onCancelInvoice,
  compact = false,
}) {
  if (!invoice) return null;

  const fmt = (val) =>
    formatCurrency(val, invoice.currency);

  const isOverdue =
    invoice.status !== 'PAID' &&
    invoice.status !== 'CANCELLED' &&
    invoice.due_date &&
    new Date(invoice.due_date) < new Date();

  return (
    <div className={`invoice-summary-card ${compact ? 'compact' : ''}`}>
      <div className="invoice-summary-header">
        <div className="invoice-id-group">
          <div className="invoice-type-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {invoice.invoice_type === 'RECURRING' ? (
              <>
                <Icon name="refresh" size={12} /> Recurring Cycle
              </>
            ) : (
              <>
                <Icon name="package" size={12} /> One-Time Order
              </>
            )}
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
          <Icon name="search" size={13} style={{ marginRight: '4px' }} />
          View Full Invoice
        </Link>
        {Number(invoice.amount_due) > 0 && invoice.status !== 'CANCELLED' && onRecordPayment && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onRecordPayment(invoice)}
          >
            <Icon name="credit-card" size={13} style={{ marginRight: '4px' }} />
            Record Payment
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
