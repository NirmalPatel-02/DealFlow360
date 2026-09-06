import React from 'react';
import Icon from '../../../components/ui/Icon';
import { formatCurrency as formatRupees } from '../../../utils/currency';

export default function PaymentStatus({
  status,
  amountPaid = 0,
  totalAmount = 0,
  currency = 'INR',
  paymentMethod,
  paymentReference,
  paidAt,
}) {
  const numPaid = parseFloat(amountPaid) || 0;
  const numTotal = parseFloat(totalAmount) || 0;
  const pct = numTotal > 0 ? Math.min(100, Math.round((numPaid / numTotal) * 100)) : 0;

  const getStatusBadgeClass = (st) => {
    switch ((st || '').toUpperCase()) {
      case 'PAID':
      case 'SUCCESS':
        return 'badge-paid';
      case 'PARTIALLY_PAID':
        return 'badge-partially-paid';
      case 'ISSUED':
      case 'PENDING':
        return 'badge-issued';
      case 'OVERDUE':
        return 'badge-overdue';
      case 'CANCELLED':
      case 'VOID':
      case 'FAILED':
        return 'badge-cancelled';
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        return 'badge-refunded';
      default:
        return 'badge-draft';
    }
  };

  const formatCurrency = (val) => {
    return formatRupees(val, currency);
  };

  return (
    <div className="payment-status-container">
      <div className="payment-status-header">
        <span className={`billing-status-pill ${getStatusBadgeClass(status)}`}>
          {status ? status.replace('_', ' ') : 'DRAFT'}
        </span>
        {numTotal > 0 && (
          <span className="payment-progress-label">
            {pct}% Paid ({formatCurrency(numPaid)} of {formatCurrency(numTotal)})
          </span>
        )}
      </div>

      {numTotal > 0 && (
        <div className="payment-progress-bar-track">
          <div
            className={`payment-progress-bar-fill ${pct === 100 ? 'complete' : pct > 0 ? 'partial' : 'zero'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {(paymentMethod || paymentReference || paidAt) && (
        <div className="payment-meta-row">
          {paymentMethod && (
            <span className="payment-method-chip" title="Payment Method">
              <Icon name="credit-card" size={13} style={{ marginRight: '4px' }} />
              {paymentMethod.replace('_', ' ')}
            </span>
          )}
          {paymentReference && (
            <span className="payment-ref-chip" title="Transaction Reference">
              Ref: {paymentReference}
            </span>
          )}
          {paidAt && (
            <span className="payment-date-chip" title="Recorded Date">
              <Icon name="calendar" size={13} style={{ marginRight: '4px' }} />
              {new Date(paidAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
