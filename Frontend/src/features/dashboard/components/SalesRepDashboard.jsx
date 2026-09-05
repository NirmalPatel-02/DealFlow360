import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuotations } from '../../quotations/quotations.hooks';
import { listCustomers } from '../../customers/customers.api';
import { formatCurrency } from '../../../utils/currency';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [customerMap, setCustomerMap] = useState({});

  // Fetch quotations
  const { quotations, loading, error, refetch } = useQuotations();

  // Fetch customers to resolve names
  useEffect(() => {
    let active = true;
    listCustomers({ limit: 200 })
      .then((customers) => {
        if (!active || !customers) return;
        const map = {};
        customers.forEach((c) => {
          map[c.id] = c;
        });
        setCustomerMap(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Filter quotations
  const filteredQuotations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return quotations.filter((item) => {
      const statusUpper = String(item.status || '').toUpperCase();
      const matchesTab = selectedTab === 'all' || statusUpper === selectedTab;
      const customer = customerMap[item.customer_id];
      const customerName = customer ? customer.name.toLowerCase() : '';
      const quoteNum = String(item.quote_number || '').toLowerCase();

      const matchesSearch = !q || quoteNum.includes(q) || customerName.includes(q);
      return matchesTab && matchesSearch;
    });
  }, [quotations, selectedTab, searchQuery, customerMap]);

  const stats = useMemo(() => {
    return {
      total: quotations.length,
      draft: quotations.filter((q) => String(q.status).toUpperCase() === 'DRAFT').length,
      pending: quotations.filter((q) => String(q.status).toUpperCase() === 'PENDING_APPROVAL').length,
      approved: quotations.filter((q) => String(q.status).toUpperCase() === 'APPROVED').length,
      sent: quotations.filter((q) => String(q.status).toUpperCase() === 'SENT').length,
      negotiating: quotations.filter((q) => String(q.status).toUpperCase() === 'UNDER_NEGOTIATION').length,
      confirmed: quotations.filter((q) => String(q.status).toUpperCase() === 'CONFIRMED').length,
    };
  }, [quotations]);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="page-status">
          <p>Loading your deal pipeline…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container sales-rep-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Sales Representative Workspace</h1>
          <p className="subheading">
            Build competitive proposals, track governance approvals, and manage live customer negotiations.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-outline" onClick={refetch}>
            ↻ Refresh
          </button>
          <Link to="/quotations/new" className="btn btn-primary">
            + New Quotation
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="form-banner form-banner-error" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={refetch} className="btn btn-sm btn-outline" style={{ marginLeft: '1rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        <div
          className={`stat-card ${selectedTab === 'all' ? 'highlight' : ''}`}
          onClick={() => setSelectedTab('all')}
        >
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Deals</div>
        </div>
        <div
          className={`stat-card ${selectedTab === 'DRAFT' ? 'highlight' : ''}`}
          onClick={() => setSelectedTab('DRAFT')}
        >
          <div className="stat-value">{stats.draft}</div>
          <div className="stat-label">Drafts</div>
        </div>
        <div
          className={`stat-card ${selectedTab === 'PENDING_APPROVAL' ? 'highlight' : ''}`}
          onClick={() => setSelectedTab('PENDING_APPROVAL')}
        >
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending Approval</div>
        </div>
        <div
          className={`stat-card success ${selectedTab === 'APPROVED' ? 'highlight' : ''}`}
          onClick={() => setSelectedTab('APPROVED')}
        >
          <div className="stat-value">{stats.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div
          className={`stat-card ${selectedTab === 'SENT' ? 'highlight' : ''}`}
          onClick={() => setSelectedTab('SENT')}
        >
          <div className="stat-value">{stats.sent}</div>
          <div className="stat-label">Sent to Customer</div>
        </div>
        <div
          className={`stat-card warning ${selectedTab === 'UNDER_NEGOTIATION' ? 'highlight' : ''}`}
          onClick={() => setSelectedTab('UNDER_NEGOTIATION')}
        >
          <div className="stat-value">{stats.negotiating}</div>
          <div className="stat-label">Negotiating</div>
        </div>
        <div
          className={`stat-card success ${selectedTab === 'CONFIRMED' ? 'highlight' : ''}`}
          onClick={() => setSelectedTab('CONFIRMED')}
        >
          <div className="stat-value">{stats.confirmed}</div>
          <div className="stat-label">Confirmed</div>
        </div>
      </div>

      {/* Toolbar: Tabs & Search */}
      <div className="tabs-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${selectedTab === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedTab('all')}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            className={`tab ${selectedTab === 'DRAFT' ? 'active' : ''}`}
            onClick={() => setSelectedTab('DRAFT')}
          >
            Draft ({stats.draft})
          </button>
          <button
            type="button"
            className={`tab ${selectedTab === 'PENDING_APPROVAL' ? 'active' : ''}`}
            onClick={() => setSelectedTab('PENDING_APPROVAL')}
          >
            Pending ({stats.pending})
          </button>
          <button
            type="button"
            className={`tab ${selectedTab === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setSelectedTab('APPROVED')}
          >
            Approved ({stats.approved})
          </button>
          <button
            type="button"
            className={`tab ${selectedTab === 'SENT' ? 'active' : ''}`}
            onClick={() => setSelectedTab('SENT')}
          >
            Sent ({stats.sent})
          </button>
          <button
            type="button"
            className={`tab ${selectedTab === 'UNDER_NEGOTIATION' ? 'active' : ''}`}
            onClick={() => setSelectedTab('UNDER_NEGOTIATION')}
          >
            Negotiating ({stats.negotiating})
          </button>
          <button
            type="button"
            className={`tab ${selectedTab === 'CONFIRMED' ? 'active' : ''}`}
            onClick={() => setSelectedTab('CONFIRMED')}
          >
            Confirmed ({stats.confirmed})
          </button>
        </div>

        <div style={{ minWidth: '220px' }}>
          <input
            className="input"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.9rem' }}
            placeholder="Search quote # or customer…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Quotations Table */}
      {filteredQuotations.length === 0 ? (
        <div className="empty-state">
          <h3>No quotations found</h3>
          <p>
            {selectedTab === 'all'
              ? 'Create a new quotation to get started with your deal pipeline.'
              : `No quotations found with status "${QUOTE_STATUSES[selectedTab] || selectedTab}".`}
          </p>
          <Link to="/quotations/new" className="btn btn-primary">
            + Create New Quotation
          </Link>
        </div>
      ) : (
        <div className="quotations-table-wrapper">
          <table className="data-table quotations-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th className="text-right">Grand Total</th>
                <th className="text-center">Margin %</th>
                <th>Risk Score</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((quote) => {
                const statusKey = String(quote.status || '').toUpperCase();
                const customer = customerMap[quote.customer_id];
                const marginVal = Number(quote.gross_margin ?? quote.gross_margin_percent ?? 0);
                const riskVal = Number(quote.risk_score ?? 0);

                let marginClass = 'healthy';
                if (marginVal < 10) marginClass = 'alert';
                else if (marginVal < 20) marginClass = 'warning';

                return (
                  <tr key={quote.id}>
                    <td>
                      <Link to={`/quotations/${quote.id}`} className="quote-link" style={{ fontWeight: 600 }}>
                        {quote.quote_number}
                      </Link>
                    </td>
                    <td>
                      <strong>{customer ? customer.name : 'Customer'}</strong>
                      {customer?.tier && (
                        <span className="admin-tier-badge" style={{ marginLeft: '0.5rem', fontSize: '0.68rem' }}>
                          {customer.tier.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <strong>{formatCurrency(quote.grand_total, quote.currency)}</strong>
                    </td>
                    <td className="text-center">
                      <span className={`margin ${marginClass}`} style={{ fontWeight: 600 }}>
                        {marginVal.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: riskVal > 50 ? 'var(--error)' : 'inherit' }}>
                        {riskVal.toFixed(0)} / 100
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${STATUS_COLORS[statusKey] || 'status-draft'}`}>
                        {QUOTE_STATUSES[statusKey] || quote.status}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/quotations/${quote.id}`} className="btn btn-sm btn-outline">
                          View
                        </Link>
                        {(statusKey === 'DRAFT' || statusKey === 'REVISION_REQUIRED') && (
                          <Link to={`/quotations/${quote.id}/edit`} className="btn btn-sm btn-primary">
                            Edit
                          </Link>
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
    </div>
  );
}
