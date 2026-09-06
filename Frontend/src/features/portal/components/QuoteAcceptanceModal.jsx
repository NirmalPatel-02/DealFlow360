import React, { useState } from 'react';
import Icon from '../../../components/ui/Icon';
import { formatCurrency } from '../../../utils/currency';

export default function QuoteAcceptanceModal({
  isOpen,
  onClose,
  onConfirm,
  quote,
}) {
  const [agreed, setAgreed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !quote) return null;

  const fmt = (val) => formatCurrency(val, quote.currency);

  const handleExecuteConfirmation = async () => {
    if (!agreed) {
      setErrorMsg('Please confirm your formal agreement to the terms before accepting.');
      return;
    }

    try {
      setConfirming(true);
      setErrorMsg('');
      await onConfirm();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to confirm quotation.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="portal-modal-backdrop">
      <div className="portal-modal-box">
        <div className="portal-modal-header">
          <h2>
            <Icon name="check-circle" size={20} style={{ marginRight: '6px' }} />
            Formal Quotation Acceptance
          </h2>
          <button type="button" className="portal-modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="portal-modal-body">
          <p className="modal-description-text">
            By accepting this quotation, you are confirming the commercial terms, quantities, and pricing
            below to proceed directly to order fulfillment and invoicing.
          </p>

          {errorMsg && <div className="portal-alert-box error">{errorMsg}</div>}

          <div className="acceptance-summary-card">
            <div className="summary-stat-row">
              <span className="summary-stat-label">Quotation Reference:</span>
              <span className="summary-stat-val mono">{quote.quote_number}</span>
            </div>
            <div className="summary-stat-row">
              <span className="summary-stat-label">Total Commercial Lines:</span>
              <span className="summary-stat-val">{quote.lines?.length || 0} line items</span>
            </div>
            <div className="summary-stat-row">
              <span className="summary-stat-label">Gross Subtotal:</span>
              <span className="summary-stat-val">{fmt(quote.subtotal)}</span>
            </div>
            {Number(quote.discount_total) > 0 && (
              <div className="summary-stat-row text-success">
                <span className="summary-stat-label">Total Commercial Savings:</span>
                <span className="summary-stat-val">- {fmt(quote.discount_total)}</span>
              </div>
            )}
            <div className="summary-stat-row">
              <span className="summary-stat-label">Applicable Taxes:</span>
              <span className="summary-stat-val">+ {fmt(quote.tax_total)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat-row highlight">
              <span className="summary-stat-label">Final Binding Total:</span>
              <span className="summary-stat-val grand-total-text">{fmt(quote.grand_total)}</span>
            </div>
          </div>

          <div className="acceptance-checkbox-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span className="checkbox-custom" />
              <span className="checkbox-label-text">
                I hereby accept and confirm Quotation <strong>{quote.quote_number}</strong> on behalf of my
                organization. I agree to the scheduled delivery terms and payment obligations.
              </span>
            </label>
          </div>
        </div>

        <div className="portal-modal-footer">
          <button
            type="button"
            className="btn btn-portal-secondary"
            onClick={onClose}
            disabled={confirming}
          >
            Review Later
          </button>
          <button
            type="button"
            className="btn btn-portal-success"
            onClick={handleExecuteConfirmation}
            disabled={!agreed || confirming}
          >
            <Icon name="check" size={16} style={{ marginRight: '6px' }} />
            {confirming ? 'Executing Acceptance...' : 'Accept & Confirm Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
