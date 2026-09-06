import React, { useState, useEffect } from 'react';
import Icon from '../../../components/ui/Icon';

export default function ManualOverrideModal({
  isOpen,
  onClose,
  plan,
  quoteLines = [],
  warehouses = [],
  productMap = {},
  inventory = [],
  onSubmit,
  loading = false,
}) {
  const [selectedLineId, setSelectedLineId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const hardwareLines = quoteLines.filter((ql) => {
    const prod = productMap[ql.product_id];
    return prod?.product_type === 'hardware' || !prod?.product_type;
  });

  const activeWarehouses = warehouses.filter((w) => w.is_active);

  const selectedLine = quoteLines.find((l) => l.id === selectedLineId);
  const selectedProduct = selectedLine ? productMap[selectedLine.product_id] : null;

  // Available stock in the selected warehouse for this product
  const relevantStock = inventory.find(
    (inv) =>
      inv.warehouse_id === selectedWarehouseId &&
      inv.product_id === selectedLine?.product_id
  );

  const availableInWarehouse = relevantStock
    ? Number(relevantStock.available_quantity ?? (Number(relevantStock.quantity_on_hand) - Number(relevantStock.quantity_reserved)))
    : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedLineId) {
      setError('Please select a quote line.');
      return;
    }
    if (!selectedWarehouseId) {
      setError('Please select a destination warehouse.');
      return;
    }
    const numQty = Number(quantity);
    if (!numQty || numQty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (selectedLine && numQty > Number(selectedLine.quantity)) {
      setError(`Quantity cannot exceed the quote line quantity (${selectedLine.quantity}).`);
      return;
    }
    if (numQty > availableInWarehouse) {
      setError(
        `Requested quantity (${numQty}) exceeds available warehouse stock (${availableInWarehouse}).`
      );
      return;
    }

    onSubmit({
      quote_line_id: selectedLineId,
      warehouse_id: selectedWarehouseId,
      quantity: numQty,
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container manual-override-modal">
        <div className="modal-header">
          <div>
            <h3>Manual Allocation Override</h3>
            <p className="modal-subtitle">
              Directly assign inventory stock from a specific warehouse to a quotation line.
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        {error && <div className="modal-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="override-line">Hardware Item / Quote Line</label>
            <select
              id="override-line"
              className="form-input"
              value={selectedLineId}
              onChange={(e) => {
                setSelectedLineId(e.target.value);
                setError('');
              }}
              required
            >
              <option value="">-- Select Line Item --</option>
              {hardwareLines.map((line) => {
                const p = productMap[line.product_id];
                return (
                  <option key={line.id} value={line.id}>
                    Line #{line.line_number}: {p?.name || line.description_snapshot} (Qty: {line.quantity})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="override-warehouse">Source Warehouse Hub</label>
            <select
              id="override-warehouse"
              className="form-input"
              value={selectedWarehouseId}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                setError('');
              }}
              required
            >
              <option value="">-- Select Warehouse --</option>
              {activeWarehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code}) — {wh.city || 'Standard Hub'}
                </option>
              ))}
            </select>
            {selectedWarehouseId && selectedLineId && (
              <small className="stock-hint">
                Available in this warehouse: <strong>{availableInWarehouse}</strong> units
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="override-qty">Override Allocation Quantity</label>
            <input
              id="override-qty"
              type="number"
              step="1"
              min="1"
              max={selectedLine ? selectedLine.quantity : undefined}
              className="form-input"
              placeholder="e.g. 5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Applying Override...' : 'Apply Manual Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
