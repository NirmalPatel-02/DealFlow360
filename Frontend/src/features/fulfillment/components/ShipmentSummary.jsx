import React from 'react';

export default function ShipmentSummary({ plan, allocations = [] }) {
  if (!plan) return null;

  const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocated_quantity || 0), 0);
  const totalFulfilled = allocations.reduce((sum, a) => sum + Number(a.fulfilled_quantity || 0), 0);
  const pct = totalAllocated > 0 ? Math.min(100, Math.round((totalFulfilled / totalAllocated) * 100)) : 0;

  const status = String(plan.status || 'PROPOSED').toUpperCase();

  return (
    <div className="shipment-summary-card">
      <div className="summary-header">
        <div>
          <span className="summary-eyebrow">Fulfillment Plan Architecture</span>
          <h4 className="summary-title">Plan ID: #{plan.id?.slice(0, 8)}...</h4>
        </div>
        <span className={`status-pill status-${status.toLowerCase()}`}>
          {status.replace('_', ' ')}
        </span>
      </div>

      <div className="summary-metrics-grid">
        <div className="summary-metric">
          <span className="metric-label">Shipment Facilities</span>
          <strong className="metric-value">{plan.estimated_shipment_count || 1} Hub(s)</strong>
        </div>

        <div className="summary-metric">
          <span className="metric-label">Estimated Freight Cost</span>
          <strong className="metric-value freight-highlight">
            ${Number(plan.estimated_shipping_cost || 0).toFixed(2)}
          </strong>
        </div>

        <div className="summary-metric">
          <span className="metric-label">Fulfillment Progress</span>
          <strong className="metric-value">{pct}% Completed</strong>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="summary-metric">
          <span className="metric-label">Dispatch Status</span>
          <strong className="metric-value">
            {totalFulfilled} / {totalAllocated} Units
          </strong>
          {plan.accepted_at && (
            <small className="accepted-time">
              Accepted: {new Date(plan.accepted_at).toLocaleDateString()}
            </small>
          )}
        </div>
      </div>
    </div>
  );
}
