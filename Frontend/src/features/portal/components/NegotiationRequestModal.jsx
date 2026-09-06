import React, { useState, useEffect } from 'react';
import Icon from '../../../components/ui/Icon';

export default function NegotiationRequestModal({
  isOpen,
  onClose,
  onSubmit,
  quoteLines = [],
  initialLineId = null,
  currency = 'INR',
}) {
  const [targetLineId, setTargetLineId] = useState('');
  const [requestedDiscount, setRequestedDiscount] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTargetLineId(initialLineId || '');
      setRequestedDiscount('');
      setRequestedQuantity('');
      setMessage('');
      setErrorMsg('');
      setSubmitting(false);

      if (initialLineId) {
        const line = quoteLines.find((l) => l.id === initialLineId);
        if (line) {
          setRequestedQuantity(line.quantity ? Number(line.quantity).toString() : '');
        }
      }
    }
  }, [isOpen, initialLineId, quoteLines]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!message.trim()) {
      setErrorMsg('Please provide a message or justification for your proposal.');
      return;
    }

    if (requestedDiscount !== '' && !targetLineId) {
      setErrorMsg('A specific quote line item is required when proposing a line discount.');
      return;
    }

    if (requestedQuantity !== '' && !targetLineId) {
      setErrorMsg('A specific quote line item is required when proposing a quantity adjustment.');
      return;
    }

    const payload = {
      quote_line_id: targetLineId || null,
      message: message.trim(),
      requested_discount_percent:
        requestedDiscount !== '' ? parseFloat(requestedDiscount) : null,
      requested_quantity:
        requestedQuantity !== '' ? parseFloat(requestedQuantity) : null,
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit negotiation request.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLine = quoteLines.find((l) => l.id === targetLineId);

  return (
    <div className="portal-modal-backdrop">
      <div className="portal-modal-box">
        <div className="portal-modal-header">
          <h2>
            <Icon name="message" size={18} style={{ marginRight: '6px' }} />
            Submit Counter-Offer & Negotiation
          </h2>
          <button type="button" className="portal-modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="portal-modal-body">
            <p className="modal-description-text">
              Propose revised commercial terms, volume discounts, or custom packaging directly to your
              sales account executive.
            </p>

            {errorMsg && <div className="portal-alert-box error">{errorMsg}</div>}

            <div className="portal-form-group">
              <label>Target Scope *</label>
              <select
                className="portal-select"
                value={targetLineId}
                onChange={(e) => {
                  setTargetLineId(e.target.value);
                  const matched = quoteLines.find((l) => l.id === e.target.value);
                  if (matched && matched.quantity) {
                    setRequestedQuantity(Number(matched.quantity).toString());
                  }
                }}
              >
                <option value="">Entire Quotation Agreement</option>
                {quoteLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    Line {l.line_number}: {l.product_name} (Current Qty: {Number(l.quantity)})
                  </option>
                ))}
              </select>
            </div>

            {selectedLine && (
              <div className="portal-target-summary">
                <div>
                  <strong>Item:</strong> {selectedLine.product_name}
                </div>
                <div>
                  <strong>Current Price:</strong> {currency} {Number(selectedLine.unit_price).toFixed(2)}
                </div>
                <div>
                  <strong>Current Discount:</strong> {Number(selectedLine.discount_percent || 0).toFixed(1)}%
                </div>
              </div>
            )}

            <div className="portal-form-row">
              <div className="portal-form-group">
                <label>Proposed Quantity {targetLineId ? '' : '(Requires specific line)'}</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="1000000"
                  className="portal-input"
                  placeholder="e.g. 50"
                  disabled={!targetLineId}
                  value={requestedQuantity}
                  onChange={(e) => setRequestedQuantity(e.target.value)}
                />
              </div>

              <div className="portal-form-group">
                <label>Proposed Discount % {targetLineId ? '' : '(Requires specific line)'}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="portal-input"
                  placeholder="e.g. 15.0"
                  disabled={!targetLineId}
                  value={requestedDiscount}
                  onChange={(e) => setRequestedDiscount(e.target.value)}
                />
              </div>
            </div>

            <div className="portal-form-group">
              <label>Message & Justification *</label>
              <textarea
                className="portal-textarea"
                rows="4"
                placeholder="Explain your business justification, budget constraints, or competitor pricing..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="portal-modal-footer">
            <button
              type="button"
              className="btn btn-portal-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-portal-primary" disabled={submitting}>
              <Icon name="send" size={15} style={{ marginRight: '6px' }} />
              {submitting ? 'Transmitting Proposal...' : 'Transmit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
