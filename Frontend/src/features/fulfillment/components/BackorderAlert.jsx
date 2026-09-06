import React from 'react';
import Icon from '../../../components/ui/Icon';

export default function BackorderAlert({
  backorders = [],
  productMap = {},
  onConsolidate,
  consolidatingId,
  canConsolidate = true,
}) {
  if (!backorders || backorders.length === 0) return null;

  const openBackorders = backorders.filter((b) => String(b.status).toLowerCase() === 'open');

  if (openBackorders.length === 0) return null;

  return (
    <div className="backorder-alert-banner">
      <div className="backorder-alert-header">
        <div className="alert-icon-wrap">
          <span className="alert-icon"><Icon name="alert-triangle" size={18} color="#f59e0b" /></span>
        </div>
        <div className="alert-text">
          <h5>Active Backorders Detected ({openBackorders.length})</h5>
          <p>
            Some requested items exceeded currently available warehouse inventory and have been
            reserved as open backorders. Once stock is replenished, click <strong>Consolidate</strong> to
            allocate immediately.
          </p>
        </div>
      </div>

      <div className="backorder-items-list">
        {openBackorders.map((bo) => {
          const prod = productMap[bo.product_id] || { name: 'Hardware Line Item' };
          const isActing = consolidatingId === bo.id;

          return (
            <div key={bo.id} className="backorder-item-card">
              <div className="bo-info">
                <span className="bo-sku">{prod.code || 'SKU'}</span>
                <strong className="bo-name">{prod.name}</strong>
                <span className="bo-qty-badge">
                  {bo.quantity_remaining} Units Backordered
                </span>
                {bo.expected_at && (
                  <small className="bo-eta">
                    ETA: {new Date(bo.expected_at).toLocaleDateString()}
                  </small>
                )}
              </div>

              {canConsolidate && onConsolidate && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline consolidate-btn"
                  disabled={isActing}
                  onClick={() => onConsolidate(bo.id)}
                >
                  {isActing ? 'Consolidating...' : 'Consolidate Stock'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
