import { formatCurrency } from '../../../utils/currency';
import React from 'react';
import Icon from '../../../components/ui/Icon';

export default function WarehouseAllocationTable({
  allocations = [],
  warehouseMap = {},
  productMap = {},
  quoteLineMap = {},
  onFulfill,
  canFulfill = true,
  planStatus,
}) {
  if (!allocations || allocations.length === 0) {
    return (
      <div className="empty-allocations-state">
        <span className="empty-icon"><Icon name="package" size={32} color="#64748b" /></span>
        <p>No warehouse allocations generated yet for this plan.</p>
      </div>
    );
  }

  const isAcceptedOrProgress = ['accepted', 'partially_fulfilled', 'fulfilled', 'backordered'].includes(
    String(planStatus).toLowerCase()
  );

  return (
    <div className="allocations-table-container">
      <table className="allocations-table">
        <thead>
          <tr>
            <th>Warehouse</th>
            <th>Item Details</th>
            <th>Allocated / Req</th>
            <th>Dispatched</th>
            <th>Est. Freight</th>
            <th>Status</th>
            {canFulfill && isAcceptedOrProgress && <th>Dispatch Action</th>}
          </tr>
        </thead>
        <tbody>
          {allocations.map((alloc) => {
            const wh = warehouseMap[alloc.warehouse_id];
            const line = quoteLineMap[alloc.quote_line_id];
            const prod = line ? productMap[line.product_id] : null;

            const allocated = Number(alloc.allocated_quantity || 0);
            const requested = Number(alloc.requested_quantity || 0);
            const fulfilled = Number(alloc.fulfilled_quantity || 0);
            const remainingToDispatch = Math.max(0, allocated - fulfilled);
            const isCompleted = fulfilled >= allocated && allocated > 0;

            const progressPct = allocated > 0 ? Math.min(100, Math.round((fulfilled / allocated) * 100)) : 0;

            return (
              <tr key={alloc.id} className={isCompleted ? 'allocation-fulfilled-row' : ''}>
                <td>
                  <div className="wh-meta">
                    <span className="wh-badge">{wh?.code || 'WH'}</span>
                    <strong className="wh-name">{wh?.name || 'Warehouse'}</strong>
                    {wh?.city && <small className="wh-city">{wh.city}</small>}
                  </div>
                </td>
                <td>
                  <div className="line-meta">
                    <strong>{prod?.name || line?.description_snapshot || 'Hardware Component'}</strong>
                    {prod?.code && <span className="item-sku">SKU: {prod.code}</span>}
                    {alloc.manual_override && <span className="override-pill">Manual Override</span>}
                  </div>
                </td>
                <td>
                  <div className="quantity-badge">
                    <span className="qty-allocated">{allocated}</span>
                    <span className="qty-divider">/</span>
                    <span className="qty-req">{requested}</span>
                  </div>
                </td>
                <td>
                  <div className="dispatch-progress-cell">
                    <div className="progress-numbers">
                      <strong>{fulfilled}</strong>
                      <span className="text-muted text-xs">({progressPct}%)</span>
                    </div>
                    <div className="mini-progress-bar">
                      <div
                        className={`mini-progress-fill ${isCompleted ? 'complete' : ''}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  <span className="shipment-cost-tag">
                    {formatCurrency(alloc.shipment_cost)}
                  </span>
                </td>
                <td>
                  <span className={`status-pill status-${String(alloc.status).toLowerCase()}`}>
                    {String(alloc.status).replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                {canFulfill && isAcceptedOrProgress && (
                  <td>
                    {!isCompleted ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-primary dispatch-btn"
                        onClick={() => onFulfill && onFulfill(alloc)}
                      >
                        Dispatch ({remainingToDispatch})
                      </button>
                    ) : (
                      <span className="dispatched-check"><Icon name="check" size={14} style={{ marginRight: '4px' }} /> Completed</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
