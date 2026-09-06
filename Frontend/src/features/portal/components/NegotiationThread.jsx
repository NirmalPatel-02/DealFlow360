import React from 'react';
import Icon from '../../../components/ui/Icon';

export default function NegotiationThread({ negotiations = [], quoteLines = [] }) {
  if (!negotiations || negotiations.length === 0) {
    return (
      <div className="empty-thread-card">
        <div className="empty-thread-icon">
          <Icon name="handshake" size={32} />
        </div>
        <h4>No Active Negotiation Proposals</h4>
        <p>
          You haven't submitted any counter-offers or discount requests yet. If you need revised
          pricing or volume adjustments, click <strong>"Counter Terms"</strong> above.
        </p>
      </div>
    );
  }

  const getLineLabel = (lineId) => {
    if (!lineId) return 'Overall Quotation Terms';
    const match = quoteLines.find((l) => l.id === lineId);
    return match ? `Line ${match.line_number}: ${match.product_name}` : 'Specific Line Item';
  };

  const getStatusBadge = (st) => {
    switch ((st || '').toUpperCase()) {
      case 'OPEN':
        return (
          <span className="portal-badge badge-warning">
            <Icon name="clock" size={13} style={{ marginRight: '4px' }} />
            Under Review by Sales
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="portal-badge badge-success">
            <Icon name="check-circle" size={13} style={{ marginRight: '4px' }} />
            Counter Accepted
          </span>
        );
      case 'REJECTED':
        return (
          <span className="portal-badge badge-danger">
            <Icon name="x-circle" size={13} style={{ marginRight: '4px' }} />
            Counter Declined
          </span>
        );
      default:
        return <span className="portal-badge badge-neutral">{st}</span>;
    }
  };

  return (
    <div className="negotiation-thread-container">
      <div className="thread-header">
        <h3>
          <Icon name="message" size={18} style={{ marginRight: '6px' }} />
          Negotiation History & Proposals ({negotiations.length})
        </h3>
        <span className="thread-subtext">Direct dialogue with your account executive</span>
      </div>

      <div className="thread-list">
        {negotiations.map((item) => (
          <div key={item.id} className={`thread-card ${item.status?.toLowerCase()}`}>
            <div className="thread-card-header">
              <div className="thread-target-tag">
                <Icon name="target" size={14} style={{ marginRight: '4px' }} />
                {getLineLabel(item.quote_line_id)}
              </div>
              <div className="thread-meta-right">
                {getStatusBadge(item.status)}
                <span className="thread-date">
                  {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recent'}
                </span>
              </div>
            </div>

            <div className="thread-card-body">
              <div className="thread-message-bubble">
                <span className="bubble-sender">Your Proposal:</span>
                <p className="bubble-text">{item.message}</p>
              </div>

              {(item.requested_discount_percent !== null || item.requested_quantity !== null) && (
                <div className="thread-terms-pill-row">
                  {item.requested_discount_percent !== null && (
                    <span className="term-pill">
                      <Icon name="tag" size={13} style={{ marginRight: '4px' }} />
                      Requested Discount: <strong>{Number(item.requested_discount_percent)}%</strong>
                    </span>
                  )}
                  {item.requested_quantity !== null && (
                    <span className="term-pill">
                      <Icon name="package" size={13} style={{ marginRight: '4px' }} />
                      Requested Qty: <strong>{Number(item.requested_quantity)}</strong>
                    </span>
                  )}
                </div>
              )}

              {item.resolution_note && (
                <div className="thread-resolution-box">
                  <div className="resolution-title">
                    <Icon name="building" size={13} style={{ marginRight: '4px' }} />
                    Sales Team Response:
                  </div>
                  <p className="resolution-text">{item.resolution_note}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
