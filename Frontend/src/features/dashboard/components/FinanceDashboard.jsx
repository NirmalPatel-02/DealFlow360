import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuotations } from '../../quotations/quotations.hooks.js';
import './FinanceDashboard.css';

export default function FinanceDashboard() {
  const [selectedTab, setSelectedTab] = useState('finance-pending');

  // Fetch quotations requiring finance approval
  const { quotations, loading, error, refetch } = useQuotations();

  // Finance-level approvals (MANAGER_FINANCE level)
  const financePending = quotations.filter(
    (q) =>
      q.approval_chain &&
      q.approval_chain.some((a) => a.status === 'PENDING' && a.approval_level === 'MANAGER_FINANCE')
  );

  const financeApproved = quotations.filter(
    (q) =>
      q.approval_chain &&
      q.approval_chain.some(
        (a) => a.status === 'APPROVED' && a.approval_level === 'MANAGER_FINANCE'
      )
  );

  const approvedReadyForFulfillment = quotations.filter(
    (q) => q.status === 'APPROVED' && !q.fulfillment_status
  );

  const stats = {
    financePending: financePending.length,
    financeApproved: financeApproved.length,
    readyForFulfillment: approvedReadyForFulfillment.length,
    total: quotations.length,
  };

  let displayQuotes = [];
  if (selectedTab === 'finance-pending') {
    displayQuotes = financePending;
  } else if (selectedTab === 'finance-approved') {
    displayQuotes = financeApproved;
  } else if (selectedTab === 'fulfillment') {
    displayQuotes = approvedReadyForFulfillment;
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="page-status">
          <p>Loading finance data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container finance-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Finance & Operations Dashboard</h1>
          <p className="subheading">Second-level approvals, fulfillment, invoicing, and billing management</p>
        </div>
      </div>


      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
          <button onClick={refetch} className="btn btn-sm btn-secondary">
            Retry
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card highlight">
          <div className="stat-value">{stats.financePending}</div>
          <div className="stat-label">Pending Finance Approval</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.financeApproved}</div>
          <div className="stat-label">Approved (Finance)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.readyForFulfillment}</div>
          <div className="stat-label">Ready for Fulfillment</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Quotations</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${selectedTab === 'finance-pending' ? 'active' : ''}`}
            onClick={() => setSelectedTab('finance-pending')}
          >
            Finance Pending ({stats.financePending})
          </button>
          <button
            className={`tab ${selectedTab === 'finance-approved' ? 'active' : ''}`}
            onClick={() => setSelectedTab('finance-approved')}
          >
            Finance Approved ({stats.financeApproved})
          </button>
          <button
            className={`tab ${selectedTab === 'fulfillment' ? 'active' : ''}`}
            onClick={() => setSelectedTab('fulfillment')}
          >
            Ready for Fulfillment ({stats.readyForFulfillment})
          </button>
        </div>
      </div>

      {/* Quotations Table */}
      {displayQuotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3>No items in this category</h3>
          <p>
            {selectedTab === 'finance-pending'
              ? 'All quotations awaiting finance approval have been processed.'
              : 'No quotations to display.'}
          </p>
        </div>
      ) : (
        <div className="quotations-table-wrapper">
          <table className="data-table finance-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Total Amount</th>
                <th>Cost</th>
                <th>Margin</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayQuotes.map((quote) => {
                const margin = parseFloat(quote.gross_margin || 0);
                const total = parseFloat(quote.grand_total || 0);
                const cost = parseFloat(quote.total_cost || 0);

                return (
                  <tr key={quote.id}>
                    <td>
                      <Link to={`/quotations/${quote.id}`} className="quote-link">
                        {quote.quote_number}
                      </Link>
                    </td>
                    <td>{quote.customer?.name || 'N/A'}</td>
                    <td className="text-right">
                      <strong>
                        {quote.currency} {total.toFixed(2)}
                      </strong>
                    </td>
                    <td className="text-right text-gray-600">
                      {quote.currency} {cost.toFixed(2)}
                    </td>
                    <td className="text-center">
                      <span className={`margin-badge ${margin >= 15 ? 'healthy' : 'warning'}`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className="status-badge status-pending">{quote.status}</span>
                    </td>
                    <td className="text-sm">{quote.created_by?.full_name || '-'}</td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/quotations/${quote.id}`} className="btn btn-sm btn-outline">
                          Review
                        </Link>
                        {selectedTab === 'finance-pending' && (
                          <button
                            className="btn btn-sm btn-success"
                            title="Approve & Create Order"
                          >
                            Approve
                          </button>
                        )}
                        {selectedTab === 'fulfillment' && (
                          <button className="btn btn-sm btn-primary" title="Create Order/Invoice">
                            Create Order
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Additional Info Section */}
      {selectedTab === 'finance-pending' && (
        <div className="info-box">
          <h4>Finance Review Process</h4>
          <ul>
            <li>Review quotation margins and total costs</li>
            <li>Verify discount compliance with governance rules</li>
            <li>Check for any risk flags or violations</li>
            <li>Approve or reject based on business criteria</li>
            <li>Approved quotes are ready for fulfillment</li>
          </ul>
        </div>
      )}

      {selectedTab === 'fulfillment' && (
        <div className="info-box">
          <h4>Fulfillment Workflow</h4>
          <ul>
            <li>Create orders from approved quotations</li>
            <li>Handle fulfillment splits (backorders, partial shipments)</li>
            <li>Generate invoices for billing</li>
            <li>Set up recurring billing for subscription items</li>
            <li>Track fulfillment status</li>
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="dashboard-footer">
        <p className="text-sm text-gray-500">
          💡 <strong>Tip:</strong> Click "Review" to see detailed quote breakdown, line items, and cost analysis.
        </p>
      </div>
    </div>
  );
}
