import React from 'react';
import Icon from '../../../components/ui/Icon';

export default function WarehouseSplit({
  allocations = [],
  warehouseMap = {},
  productMap = {},
  quoteLineMap = {},
}) {
  if (!allocations || allocations.length === 0) return null;

  // Group allocations by warehouse_id
  const byWarehouse = {};
  allocations.forEach((alloc) => {
    if (!byWarehouse[alloc.warehouse_id]) {
      byWarehouse[alloc.warehouse_id] = {
        warehouse: warehouseMap[alloc.warehouse_id],
        allocations: [],
        totalCost: 0,
        totalUnits: 0,
      };
    }
    byWarehouse[alloc.warehouse_id].allocations.push(alloc);
    byWarehouse[alloc.warehouse_id].totalCost += Number(alloc.shipment_cost || 0);
    byWarehouse[alloc.warehouse_id].totalUnits += Number(alloc.allocated_quantity || 0);
  });

  const hubs = Object.values(byWarehouse);
  const isMultiWarehouse = hubs.length > 1;

  return (
    <div className="warehouse-split-widget">
      <div className="split-widget-header">
        <div className="split-badge-wrap">
          <span className={`split-status-badge ${isMultiWarehouse ? 'multi' : 'single'}`}>
            {isMultiWarehouse ? `Multi-Hub Split (${hubs.length} Facilities)` : 'Single Facility Dispatch'}
          </span>
        </div>
        <p className="split-explanation">
          {isMultiWarehouse
            ? 'Order lines are distributed across multiple regional fulfillment centers for cost and inventory optimization.'
            : 'All items are fulfilled directly from a single primary logistics center.'}
        </p>
      </div>

      <div className="warehouse-hubs-grid">
        {hubs.map(({ warehouse, allocations: hubAllocs, totalCost, totalUnits }, idx) => (
          <div key={warehouse?.id || idx} className="hub-card">
            <div className="hub-card-header">
              <div className="hub-icon-wrap"><Icon name="warehouse" size={20} color="#6366f1" /></div>
              <div>
                <strong className="hub-title">{warehouse?.name || 'Regional Hub'}</strong>
                <small className="hub-sub">
                  Code: {warehouse?.code || 'N/A'} {warehouse?.city ? `· ${warehouse.city}` : ''}
                </small>
              </div>
            </div>

            <div className="hub-card-body">
              <div className="hub-stat-row">
                <span className="stat-label">Units Allocated:</span>
                <strong className="stat-val">{totalUnits} units</strong>
              </div>
              <div className="hub-stat-row">
                <span className="stat-label">Freight Assessment:</span>
                <strong className="stat-val cost-accent">${totalCost.toFixed(2)}</strong>
              </div>

              <div className="hub-items-preview">
                <span className="preview-label">Dispatched SKUs:</span>
                <ul className="preview-list">
                  {hubAllocs.map((a) => {
                    const line = quoteLineMap[a.quote_line_id];
                    const prod = line ? productMap[line.product_id] : null;
                    return (
                      <li key={a.id} className="preview-item">
                        <span>{prod?.name || line?.description_snapshot || 'Item'}</span>
                        <span className="item-qty-tag">× {a.allocated_quantity}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
