import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuotations } from '../../quotations/quotations.hooks';
import './SalesManagerDashboard.css';

const APPROVAL_STATUSES = {
  PENDING: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RETURNED: 'Returned for Revision',
};

const STATUS_BADGE_COLORS = {
  PENDING: 'status-pending',
  APPROVED: 'status-approved',
  REJECTED: 'status-rejected',
  RETURNED: 'status-revision',
};

export default function SalesManagerDashboard() {
  const [selectedTab, setSelectedTab] = useState('pending');

  // Fetch all quotations for manager
  const { quotations, loading, error, refetch } = useQuotations();

  // Filter to only quotes that need manager approval or are awaiting next level
  const pendingApprovals = quotations.filter(
    (q) =>
      q.status === 'PENDING_APPROVAL' ||
      (q.approval_chain && q.approval_chain.some((a) => a.status === 'PENDING' && a.approval_level === 'MANAGER'))
  );

  const approvedByMe = quotations.filter(
    (q) =>
      q.approval_chain &&
      q.approval_chain.some(
        (a) => a.status === 'APPROVED' && a.approval_level === 'MANAGER' && a.acted_by_user_id
      )
  );

  const rejectedByMe = quotations.filter(
    (q) =>
      q.approval_chain &&
      q.approval_chain.some(
        (a) => a.status === 'REJECTED' && a.approval_level === 'MANAGER' && a.acted_by_user_id
      )
  );

  const atRiskDeals = quotations.filter(
    (q) => q.risk_score && parseFloat(q.risk_score) > 50
  );

  const stats = {
    pending: pendingApprovals.length,
    approved: approvedByMe.length,
    rejected: rejectedByMe.length,
    atRisk: atRiskDeals.length,
    totalUnderReview: quotations.filter((q) => q.status === 'PENDING_APPROVAL').length,
  };

  let displayQuotes = [];
  if (selectedTab === 'pending') {
    displayQuotes = pendingApprovals;
  } else if (selectedTab === 'approved') {
    displayQuotes = approvedByMe;
  } else if (selectedTab === 'rejected') {
    displayQuotes = rejectedByMe;
  } else if (selectedTab === 'atRisk') {
    displayQuotes = atRiskDeals;
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="page-status">
          <p>Loading approvals…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container sales-manager-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Sales Manager Dashboard</h1>
          <p className="subheading">Review quotations, approve/reject discounts, and monitor at-risk deals</p>
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
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending My Review</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.approved}</div>
          <div className="stat-label">Approved by Me</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.rejected}</div>
          <div className="stat-label">Rejected by Me</div>
        </div>
        <div className="stat-card alert">
          <div className="stat-value">{stats.atRisk}</div>
          <div className="stat-label">At-Risk Deals</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalUnderReview}</div>
          <div className="stat-label">Total Under Review</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${selectedTab === 'pending' ? 'active' : ''}`}
            onClick={() => setSelectedTab('pending')}
          >
            Pending Review ({stats.pending})
          </button>
          <button
            className={`tab ${selectedTab === 'approved' ? 'active' : ''}`}
            onClick={() => setSelectedTab('approved')}
          >
            Approved by Me ({stats.approved})
          </button>
          <button
            className={`tab ${selectedTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setSelectedTab('rejected')}
          >
            Rejected by Me ({stats.rejected})
          </button>
          <button
            className={`tab ${selectedTab === 'atRisk' ? 'active' : ''}`}
            onClick={() => setSelectedTab('atRisk')}
          >
            At-Risk Deals ({stats.atRisk})
          </button>
        </div>
      </div>

      {/* Quotations Table */}
      {displayQuotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <h3>No items to review</h3>
          <p>
            {selectedTab === 'pending'
              ? 'Great! All quotations waiting for your review have been handled.'
              : 'No quotations in this category.'}
          </p>
        </div>
      ) : (
        <div className="quotations-table-wrapper">
          <table className="data-table approvals-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Rep</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Risk Score</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayQuotes.map((quote) => {
                const currentApproval = quote.approval_chain?.find(
                  (a) => a.status === 'PENDING' && a.approval_level === 'MANAGER'
                );
                const riskScore = parseFloat(quote.risk_score || 0);
                const isHighRisk = riskScore > 50;

                return (
                  <tr key={quote.id} className={isHighRisk ? 'row-highlight-warning' : ''}>
                    <td>
                      <Link to={`/quotations/${quote.id}`} className="quote-link">
                        {quote.quote_number}
                      </Link>
                    </td>
                    <td>{quote.created_by?.full_name || 'N/A'}</td>
                    <td>{quote.customer?.name || 'N/A'}</td>
                    <td className="text-right">
                      {quote.currency} {parseFloat(quote.grand_total).toFixed(2)}
                    </td>
                    <td>
                      <span className={`risk-badge ${isHighRisk ? 'risk-high' : 'risk-low'}`}>
                        {riskScore.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {currentApproval ? (
                        <span className={`status-badge ${STATUS_BADGE_COLORS[currentApproval.status]}`}>
                          {APPROVAL_STATUSES[currentApproval.status]}
                        </span>
                      ) : (
                        <span className="status-badge">-</span>
                      )}
                    </td>
                    <td className="text-sm text-gray-500">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/quotations/${quote.id}`}
                          className="btn btn-sm btn-outline"
                        >
                          Review
                        </Link>
                        {selectedTab === 'pending' && (
                          <button className="btn btn-sm btn-success" title="Approve">
                            ✓
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

      {/* Footer Info */}
      <div className="dashboard-footer">
        <p className="text-sm text-gray-500">
          💡 <strong>Note:</strong> Click "Review" to see discount violations, risk scores, and approval chain.
          Your approval moves the quote to Finance (if needed) or directly to "Approved".
        </p>
      </div>
    </div>
  );
}
