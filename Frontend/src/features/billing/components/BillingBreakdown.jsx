import React from 'react';

export default function BillingBreakdown({
  subtotal = 0,
  discountAmount = 0,
  taxAmount = 0,
  totalAmount = 0,
  amountPaid = 0,
  amountDue = 0,
  currency = 'INR',
  oneTime = null,
  recurring = null,
}) {
  const fmt = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(Number(val) || 0);

  const numSubtotal = Number(subtotal) || 0;
  const numDiscount = Number(discountAmount) || 0;
  const numTax = Number(taxAmount) || 0;
  const numTotal = Number(totalAmount) || 0;
  const numPaid = Number(amountPaid) || 0;
  const numDue = Number(amountDue) !== undefined ? Number(amountDue) : Math.max(0, numTotal - numPaid);

  return (
    <div className="billing-breakdown-card">
      <h3 className="breakdown-title">
        <span className="breakdown-title-icon">📊</span> Financial Ledger & Breakdown
      </h3>

      <div className="breakdown-rows">
        <div className="breakdown-row">
          <span className="breakdown-label">Gross Subtotal</span>
          <span className="breakdown-value">{fmt(numSubtotal)}</span>
        </div>

        {numDiscount > 0 && (
          <div className="breakdown-row discount">
            <span className="breakdown-label">
              <span className="badge-tag">Savings</span> Applied Discount
            </span>
            <span className="breakdown-value text-discount">- {fmt(numDiscount)}</span>
          </div>
        )}

        {numTax > 0 && (
          <div className="breakdown-row tax">
            <span className="breakdown-label">Applicable Tax / GST</span>
            <span className="breakdown-value text-tax">+ {fmt(numTax)}</span>
          </div>
        )}

        <div className="breakdown-divider" />

        <div className="breakdown-row total-highlight">
          <span className="breakdown-label">Net Invoiced Total</span>
          <span className="breakdown-value text-total">{fmt(numTotal)}</span>
        </div>

        <div className="breakdown-row paid">
          <span className="breakdown-label">Amount Collected / Settled</span>
          <span className="breakdown-value text-paid">{fmt(numPaid)}</span>
        </div>

        <div className="breakdown-row due-highlight">
          <span className="breakdown-label">Outstanding Receivables Due</span>
          <span className={`breakdown-value ${numDue > 0 ? 'text-due' : 'text-settled'}`}>
            {fmt(numDue)}
          </span>
        </div>
      </div>

      {/* Optional One-time vs Recurring Breakdown */}
      {(oneTime || recurring) && (
        <div className="split-billing-breakdown">
          <div className="split-billing-header">Billing Classification</div>
          <div className="split-billing-grid">
            {oneTime && (
              <div className="split-box">
                <span className="split-type">⚡ One-Time Hardware / Capex</span>
                <div className="split-metric">
                  <span>Total:</span> <strong>{fmt(oneTime.invoiceTotal || oneTime.totalAmount || 0)}</strong>
                </div>
                <div className="split-metric">
                  <span>Paid:</span> <strong className="text-paid">{fmt(oneTime.paid || 0)}</strong>
                </div>
                <div className="split-metric">
                  <span>Due:</span> <strong className="text-due">{fmt(oneTime.due || 0)}</strong>
                </div>
              </div>
            )}
            {recurring && (
              <div className="split-box">
                <span className="split-type">🔄 Recurring Subscriptions</span>
                <div className="split-metric">
                  <span>Active Plans:</span> <strong>{recurring.activeSubscriptions || 0}</strong>
                </div>
                {recurring.nextBillingDate && (
                  <div className="split-metric">
                    <span>Next Cycle:</span> <strong>{recurring.nextBillingDate}</strong>
                  </div>
                )}
                {recurring.nextBillingAmount !== undefined && (
                  <div className="split-metric">
                    <span>Next Cycle Amount:</span> <strong>{fmt(recurring.nextBillingAmount)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
