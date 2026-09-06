import React from 'react';
import Icon from '../../../components/ui/Icon';
import { formatCurrency } from '../../../utils/currency';

export default function PortalLineItem({
  line,
  currency = 'INR',
  onNegotiateLine,
  canNegotiate = true,
}) {
  const fmt = (val) =>
    formatCurrency(val, currency);

  return (
    <tr className="portal-line-row">
      <td className="line-num-cell">{line.line_number}</td>
      <td className="line-desc-cell">
        <div className="line-product-title">{line.product_name}</div>
        {line.description && line.description !== line.product_name && (
          <div className="line-product-desc">{line.description}</div>
        )}
      </td>
      <td className="num-cell">{Number(line.quantity)}</td>
      <td className="num-cell">{fmt(line.unit_price)}</td>
      <td className="num-cell">
        {Number(line.discount_percent) > 0 ? (
          <span className="line-discount-tag">
            {Number(line.discount_percent).toFixed(1)}% OFF
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="num-cell line-total-cell">{fmt(line.line_total)}</td>
      {canNegotiate && (
        <td className="actions-cell">
          <button
            type="button"
            className="btn btn-portal-ghost btn-sm"
            onClick={() => onNegotiateLine(line)}
            title="Request revised terms or volume pricing for this item"
          >
            <Icon name="message" size={14} style={{ marginRight: '4px' }} />
            Counter Terms
          </button>
        </td>
      )}
    </tr>
  );
}
