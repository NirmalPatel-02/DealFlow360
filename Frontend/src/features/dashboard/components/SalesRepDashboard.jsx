import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuotations } from '../../quotations/quotations.hooks';
import './SalesRepDashboard.css';

const QUOTE_STATUSES = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVISION_REQUIRED: 'Revision Required',
  SENT: 'Sent to Customer',
  UNDER_NEGOTIATION: 'Under Negotiation',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS = {
  DRAFT: 'status-draft',
  PENDING_APPROVAL: 'status-pending',
  APPROVED: 'status-approved',
  REJECTED: 'status-rejected',
  REVISION_REQUIRED: 'status-revision',
  SENT: 'status-sent',
  UNDER_NEGOTIATION: 'status-negotiating',
  CONFIRMED: 'status-confirmed',
  CANCELLED: 'status-cancelled',
};

export default function SalesRepDashboard() {
  const [selectedTab, setSelectedTab] = useState('all');

  // Fetch all quotations
  const { quotations, loading, error, refetch } = useQuotations();

  // Filter quotations by tab
  const filteredQuotations = quotations.filter((q) => {
    if (selectedTab === 'all') return true;
    return q.status === selectedTab;
  });

  const stats = {
    total: quotations.length,
    draft: quotations.filter((q) => q.status === 'DRAFT').length,
    pending: quotations.filter((q) => q.status === 'PENDING_APPROVAL').length,
    approved: quotations.filter((q) => q.status === 'APPROVED').length,
    sent: quotations.filter((q) => q.status === 'SENT').length,
    negotiating: quotations.filter((q) => q.status === 'UNDER_NEGOTIATION').length,
    confirmed: quotations.filter((q) => q.status === 'CONFIRMED').length,
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="page-status">
          <p>Loading quotations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container sales-rep-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Sales Representative Dashboard</h1>
          <p className="subheading">Manage quotations, apply discounts, and submit for approval</p>
        </div>
        <div className="header-actions">
          <Link to="/quotations/new" className="btn btn-primary">
            + New Quotation
          </Link>
        </div>
      </div>


      {/* Error Message */}
      {/* {error && (
        <div className="alert alert-error">
          <p>{error}</p>
          <button onClick={refetch} className="btn btn-sm btn-secondary">
            Retry
          </button>
        </div>
      )} */}

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Quotations</div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-value">{stats.draft}</div>
          <div className="stat-label">In Draft</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending Approval</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.sent}</div>
          <div className="stat-label">Sent to Customer</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.negotiating}</div>
          <div className="stat-label">Under Negotiation</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${selectedTab === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedTab('all')}
          >
            All ({stats.total})
          </button>
          <button
            className={`tab ${selectedTab === 'DRAFT' ? 'active' : ''}`}
            onClick={() => setSelectedTab('DRAFT')}
          >
            Draft ({stats.draft})
          </button>
          <button
            className={`tab ${selectedTab === 'PENDING_APPROVAL' ? 'active' : ''}`}
            onClick={() => setSelectedTab('PENDING_APPROVAL')}
          >
            Pending Approval ({stats.pending})
          </button>
          <button
            className={`tab ${selectedTab === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setSelectedTab('APPROVED')}
          >
            Approved ({stats.approved})
          </button>
          <button
            className={`tab ${selectedTab === 'SENT' ? 'active' : ''}`}
            onClick={() => setSelectedTab('SENT')}
          >
            Sent ({stats.sent})
          </button>
          <button
            className={`tab ${selectedTab === 'UNDER_NEGOTIATION' ? 'active' : ''}`}
            onClick={() => setSelectedTab('UNDER_NEGOTIATION')}
          >
            Negotiating ({stats.negotiating})
          </button>
        </div>
      </div>

      {/* Quotations Table */}
      {filteredQuotations.length === 0 ? (
        <div className="empty-state">
          {/* <div className="empty-state-icon">📋</div> */}
          <h3>No quotations found</h3>
          <p>
            {selectedTab === 'all'
              ? 'Create a new quotation to get started.'
              : `No quotations with status "${QUOTE_STATUSES[selectedTab]}"`}
          </p>
          <Link to="/quotations/new" className="btn btn-primary">
            Create New Quotation
          </Link>
        </div>
      ) : (
        <div className="quotations-table-wrapper">
          <table className="data-table quotations-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Grand Total</th>
                <th>Margin %</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <Link to={`/quotations/${quote.id}`} className="quote-link">
                      {quote.quote_number}
                    </Link>
                  </td>
                  <td>{quote.customer?.name || 'N/A'}</td>
                  <td className="text-right">
                    {quote.currency} {parseFloat(quote.grand_total).toFixed(2)}
                  </td>
                  <td className="text-center">
                    <span className={`margin ${parseFloat(quote.gross_margin) >= 15 ? 'healthy' : 'warning'}`}>
                      {parseFloat(quote.gross_margin).toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${STATUS_COLORS[quote.status] || ''}`}>
                      {QUOTE_STATUSES[quote.status] || quote.status}
                    </span>
                  </td>
                  <td className="text-sm text-gray-500">
                    {new Date(quote.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link to={`/quotations/${quote.id}`} className="btn btn-sm btn-outline">
                        View
                      </Link>
                      {quote.status === 'DRAFT' && (
                        <Link to={`/quotations/${quote.id}/edit`} className="btn btn-sm btn-outline">
                          Edit
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Info */}
      <div className="dashboard-footer">
        <p className="text-sm text-gray-500">
          💡 <strong>Tip:</strong> Use the "New Quotation" button to create a draft, add products, apply discounts,
          then submit for manager approval.
        </p>
      </div>
    </div>
  );
}
