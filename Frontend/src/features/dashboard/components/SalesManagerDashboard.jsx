import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApprovalAction, useQuotations } from '../../quotations/quotations.hooks';
import { listCustomers } from '../../customers/customers.api';
import { getDealHealthDashboard } from '../../deal-health/dealHealth.api';
import { getQuotation, listQuoteApprovals } from '../../quotations/quotations.api';
import { getErrorMessage } from '../../../services/api/apiError';
import './SalesManagerDashboard.css';

const PAGE_SIZE = 10;
const TABS = [
  { id: 'pending', label: 'Pending Review' },
  { id: 'approved', label: 'Approved Deals' },
  { id: 'revision', label: 'Revision Required' },
  { id: 'rejected', label: 'Rejected Deals' },
  { id: 'atRisk', label: 'At-Risk Pipeline' },
  { id: 'all', label: 'All Quotations' },
];

export default function SalesManagerDashboard() {
  const [selectedTab, setSelectedTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('risk_desc');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [customerMap, setCustomerMap] = useState({});
  const [dealHealthSummary, setDealHealthSummary] = useState(null);
  const [pendingApprovalsMap, setPendingApprovalsMap] = useState({});

  // Quick Action Modal state
  const [modalQuote, setModalQuote] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalApprovals, setModalApprovals] = useState([]);
  const [actionReason, setActionReason] = useState('');
  const [modalError, setModalError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const { quotations, loading, error, refetch: refetchQuotes } = useQuotations();
  const { approve, reject, returnForRevision, acting, error: hookActionError } = useApprovalAction();

  // Load customer map
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

  // Load Deal Health Dashboard
  const loadHealthDashboard = useCallback(() => {
    getDealHealthDashboard()
      .then((data) => setDealHealthSummary(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadHealthDashboard();
  }, [loadHealthDashboard]);

  // For all quotes with PENDING_APPROVAL, fetch their approval steps to know the active level
  useEffect(() => {
    let active = true;
    const pendingQuotes = quotations.filter((q) => String(q.status).toUpperCase() === 'PENDING_APPROVAL');
    if (!pendingQuotes.length) return;

    Promise.allSettled(pendingQuotes.map((q) => listQuoteApprovals(q.id).then((apps) => ({ id: q.id, apps }))))
      .then((results) => {
        if (!active) return;
        const appMap = {};
        results.forEach((res) => {
          if (res.status === 'fulfilled' && res.value) {
            const currentStep = res.value.apps.find((a) => String(a.status).toUpperCase() === 'PENDING');
            appMap[res.value.id] = {
              currentStep,
              allSteps: res.value.apps,
            };
          }
        });
        setPendingApprovalsMap(appMap);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [quotations]);

  // Categorize quotes into tabs
  const groups = useMemo(() => {
    const atRiskIds = new Set((dealHealthSummary?.deals || []).map((d) => d.quotationId));

    return {
      pending: quotations.filter((q) => String(q.status).toUpperCase() === 'PENDING_APPROVAL'),
      approved: quotations.filter((q) => {
        const s = String(q.status).toUpperCase();
        return s === 'APPROVED' || s === 'SENT' || s === 'CONFIRMED';
      }),
      revision: quotations.filter((q) => String(q.status).toUpperCase() === 'REVISION_REQUIRED'),
      rejected: quotations.filter((q) => String(q.status).toUpperCase() === 'REJECTED'),
      atRisk: quotations.filter((q) => {
        const risk = Number(q.risk_score || 0);
        const margin = Number(q.gross_margin_percent || 0);
        return atRiskIds.has(q.id) || risk > 30 || margin < 15;
      }),
      all: quotations,
    };
  }, [quotations, dealHealthSummary]);

  // Filter & sort
  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sourceList = groups[selectedTab] || [];

    return sourceList
      .filter((quote) => {
        const cust = customerMap[quote.customer_id];
        const custName = cust ? cust.name.toLowerCase() : '';
        const quoteNum = String(quote.quote_number || '').toLowerCase();
        const matchesQuery = !query || quoteNum.includes(query) || custName.includes(query);

        const risk = Number(quote.risk_score || 0);
        let matchesRisk = true;
        if (riskFilter === 'low') matchesRisk = risk <= 20;
        if (riskFilter === 'moderate') matchesRisk = risk > 20 && risk <= 40;
        if (riskFilter === 'high') matchesRisk = risk > 40;

        return matchesQuery && matchesRisk;
      })
      .sort((a, b) => {
        if (sort === 'total_desc') return Number(b.grand_total || 0) - Number(a.grand_total || 0);
        if (sort === 'total_asc') return Number(a.grand_total || 0) - Number(b.grand_total || 0);
        if (sort === 'margin_desc') return Number(b.gross_margin_percent || 0) - Number(a.gross_margin_percent || 0);
        if (sort === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
        // default: risk_desc
        return Number(b.risk_score || 0) - Number(a.risk_score || 0);
      });
  }, [groups, selectedTab, search, riskFilter, sort, customerMap]);

  const pageCount = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const visibleQuotes = filteredQuotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats calculation
  const stats = useMemo(() => {
    const pendingList = groups.pending;
    const pendingValue = pendingList.reduce((sum, q) => sum + Number(q.grand_total || 0), 0);
    const approvedList = groups.approved;
    const approvedValue = approvedList.reduce((sum, q) => sum + Number(q.grand_total || 0), 0);

    const totalMargin = approvedList.reduce((sum, q) => sum + Number(q.gross_margin_percent || 0), 0);
    const avgMargin = approvedList.length ? totalMargin / approvedList.length : 0;

    return {
      pendingCount: pendingList.length,
      pendingValue,
      approvedCount: approvedList.length,
      approvedValue,
      avgMargin,
      atRiskCount: groups.atRisk.length,
      totalCount: quotations.length,
    };
  }, [groups, quotations]);

  // Open Quick Review Modal
  async function handleOpenReview(quote) {
    setModalError('');
    setActionSuccess('');
    setActionReason('');
    setModalLoading(true);
    setModalQuote(quote);

    try {
      const [fullQuote, approvals] = await Promise.all([
        getQuotation(quote.id),
        listQuoteApprovals(quote.id),
      ]);
      setModalQuote(fullQuote);
      setModalApprovals(approvals || []);
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setModalLoading(false);
    }
  }

  function handleCloseModal() {
    setModalQuote(null);
    setModalApprovals([]);
    setActionReason('');
    setModalError('');
    setActionSuccess('');
  }

  // Act on approval from Modal
  async function handleAction(action) {
    if (!modalQuote) return;
    setModalError('');
    setActionSuccess('');

    if ((action === 'reject' || action === 'return') && !actionReason.trim()) {
      setModalError('A reason or revision instruction is mandatory when rejecting or requesting revisions.');
      return;
    }

    try {
      if (action === 'approve') await approve(modalQuote.id);
      if (action === 'reject') await reject(modalQuote.id, actionReason.trim());
      if (action === 'return') await returnForRevision(modalQuote.id, actionReason.trim());

      setActionSuccess(`Quotation ${modalQuote.quote_number} ${action === 'approve' ? 'approved' : action === 'return' ? 'returned for revision' : 'rejected'} successfully.`);
      await Promise.all([refetchQuotes(), loadHealthDashboard()]);
      setTimeout(() => {
        handleCloseModal();
      }, 1200);
    } catch (err) {
      setModalError(getErrorMessage(err));
    }
  }

  return (
    <div className="dashboard-container sales-manager-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">DealFlow360 / Governance & Commercial Approvals</p>
          <h1 className="page-title">Sales Manager Oversight</h1>
          <p className="subheading">
            Review discount exceptions, enforce governance policies, and expedite approved client orders.
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn btn-outline" onClick={() => { refetchQuotes(); loadHealthDashboard(); }}>
            ↻ Refresh Queue
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
          <button onClick={refetchQuotes} className="btn btn-sm btn-secondary">
            Retry
          </button>
        </div>
      )}

      {/* Executive KPI Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card highlight">
          <div className="stat-value">{stats.pendingCount}</div>
          <div className="stat-label">Pending Reviews</div>
          <div className="stat-subtext">
            Queue Value: ₹{stats.pendingValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.approvedCount}</div>
          <div className="stat-label">Approved & Active</div>
          <div className="stat-subtext">
            Volume: ₹{stats.approvedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.avgMargin.toFixed(1)}%</div>
          <div className="stat-label">Portfolio Gross Margin</div>
          <div className="stat-subtext">Across approved deals</div>
        </div>
        <div className={`stat-card ${stats.atRiskCount > 0 ? 'alert' : ''}`}>
          <div className="stat-value">{stats.atRiskCount}</div>
          <div className="stat-label">Deals Flagged At-Risk</div>
          <div className="stat-subtext">Margin & policy anomalies</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalCount}</div>
          <div className="stat-label">Total Commercial Pipeline</div>
          <div className="stat-subtext">Active system quotations</div>
        </div>
      </div>

      {/* Toolbar: Search, Risk Filter & Sort */}
      <div className="manager-toolbar">
        <label className="field manager-search">
          <span className="field-label">Search Pipeline</span>
          <input
            className="input"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by quote number or customer account…"
          />
        </label>
        <label className="field">
          <span className="field-label">Risk Filter</span>
          <select
            className="input"
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk (≤ 20%)</option>
            <option value="moderate">Moderate Risk (21% - 40%)</option>
            <option value="high">High Risk (&gt; 40%)</option>
          </select>
        </label>
        <label className="field manager-sort">
          <span className="field-label">Sort By</span>
          <select
            className="input"
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
          >
            <option value="risk_desc">Risk: Highest First</option>
            <option value="total_desc">Value: Highest First</option>
            <option value="total_asc">Value: Lowest First</option>
            <option value="margin_desc">Margin: Highest First</option>
            <option value="date_asc">Oldest Submission First</option>
          </select>
        </label>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-container">
        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${selectedTab === tab.id ? 'active' : ''}`}
              onClick={() => { setSelectedTab(tab.id); setPage(1); }}
            >
              {tab.label} ({groups[tab.id]?.length || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Table */}
      {loading ? (
        <div className="page-status">
          <p>Loading approval queue…</p>
        </div>
      ) : visibleQuotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✓</div>
          <h3>No quotations in this view</h3>
          <p>{search ? 'Try adjusting your search criteria or risk filters.' : 'All items in this queue have been handled.'}</p>
        </div>
      ) : (
        <div className="quotations-table-wrapper">
          <table className="data-table approvals-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer Account</th>
                <th>Grand Total</th>
                <th>Gross Margin</th>
                <th>Risk Score</th>
                <th>Current Status</th>
                <th>Escalation Level</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuotes.map((quote) => {
                const customer = customerMap[quote.customer_id];
                const riskScore = Number(quote.risk_score || 0);
                const margin = Number(quote.gross_margin_percent || 0);
                const statusKey = String(quote.status).toUpperCase();
                const isPending = statusKey === 'PENDING_APPROVAL';

                const pendingInfo = pendingApprovalsMap[quote.id];
                const currentStep = pendingInfo?.currentStep;

                return (
                  <tr key={quote.id} className={riskScore > 30 ? 'row-highlight-warning' : ''}>
                    <td>
                      <Link to={`/quotations/${quote.id}`} className="quote-link">
                        <strong>{quote.quote_number}</strong>
                      </Link>
                    </td>
                    <td>
                      <div>
                        <strong>{customer?.name || 'Customer Account'}</strong>
                        {customer?.tier && (
                          <span className="customer-tier-tag"> · {customer.tier.toUpperCase()}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong>
                        {quote.currency} {Number(quote.grand_total || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`margin-pill ${
                          margin >= 25
                            ? 'margin-pill-healthy'
                            : margin >= 10
                            ? 'margin-pill-warning'
                            : 'margin-pill-danger'
                        }`}
                      >
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span
                        className={`risk-badge ${
                          riskScore > 40
                            ? 'risk-high'
                            : riskScore > 20
                            ? 'risk-moderate'
                            : 'risk-low'
                        }`}
                      >
                        {riskScore.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-${statusKey.toLowerCase()}`}>
                        {statusKey.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {isPending ? (
                        <span className="escalation-step-tag">
                          {currentStep
                            ? `Step #${currentStep.step_order}: ${String(currentStep.approval_level).replace('_', ' ')}`
                            : 'Pending Escalation'}
                        </span>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>
                    <td className="text-sm text-gray-500">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenReview(quote)}
                        >
                          Review Deal
                        </button>
                        <Link to={`/quotations/${quote.id}`} className="btn btn-sm btn-outline">
                          Full View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="manager-pagination">
        <span>
          Showing {filteredQuotes.length ? (page - 1) * PAGE_SIZE + 1 : 0}-
          {Math.min(page * PAGE_SIZE, filteredQuotes.length)} of {filteredQuotes.length} quotations
        </span>
        <div className="pagination-actions">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setPage((c) => Math.max(1, c - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setPage((c) => Math.min(pageCount, c + 1))}
            disabled={page >= pageCount}
          >
            Next
          </button>
        </div>
      </div>

      {/* Quick Action Decision Modal */}
      {modalQuote && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Deal Decision Panel</p>
                <h2>Review Quotation {modalQuote.quote_number}</h2>
                <p className="modal-subtext">
                  Customer: <strong>{customerMap[modalQuote.customer_id]?.name || modalQuote.customer_id}</strong> ·
                  Status: <strong>{String(modalQuote.status).toUpperCase()}</strong>
                </p>
              </div>
              <button className="modal-close-btn" onClick={handleCloseModal} aria-label="Close modal">
                ×
              </button>
            </div>

            {modalLoading ? (
              <div className="page-status">
                <p>Loading quotation line details…</p>
              </div>
            ) : (
              <div className="modal-body">
                {modalError && <div className="form-banner error-banner">{modalError}</div>}
                {actionSuccess && <div className="form-banner success-banner">{actionSuccess}</div>}

                {/* Metrics Summary */}
                <div className="modal-metrics-grid">
                  <div className="modal-metric-card">
                    <small>Grand Total</small>
                    <strong>
                      {modalQuote.currency} {Number(modalQuote.grand_total || 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="modal-metric-card">
                    <small>Gross Margin</small>
                    <strong
                      className={
                        Number(modalQuote.gross_margin_percent || 0) >= 25
                          ? 'text-healthy'
                          : Number(modalQuote.gross_margin_percent || 0) >= 10
                          ? 'text-warning'
                          : 'text-danger'
                      }
                    >
                      {Number(modalQuote.gross_margin_percent || 0).toFixed(1)}%
                    </strong>
                  </div>
                  <div className="modal-metric-card">
                    <small>Risk Score</small>
                    <strong
                      className={
                        Number(modalQuote.risk_score || 0) <= 20
                          ? 'text-healthy'
                          : Number(modalQuote.risk_score || 0) <= 40
                          ? 'text-warning'
                          : 'text-danger'
                      }
                    >
                      {Number(modalQuote.risk_score || 0).toFixed(1)}%
                    </strong>
                  </div>
                  <div className="modal-metric-card">
                    <small>Total Discount</small>
                    <strong className="text-discount">
                      -{modalQuote.currency} {Number(modalQuote.discount_total || 0).toFixed(2)}
                    </strong>
                  </div>
                </div>

                {/* Line Items Overview */}
                <div className="modal-lines-table-wrap">
                  <h4>Line Items & Commercials</h4>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product Snapshot</th>
                        <th>Qty</th>
                        <th>Unit Rate</th>
                        <th>Discount</th>
                        <th>Line Total</th>
                        <th>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalQuote.lines?.map((l, i) => (
                        <tr key={l.id || i}>
                          <td>{l.description_snapshot || 'Product Item'}</td>
                          <td>{Number(l.quantity)}</td>
                          <td>
                            {modalQuote.currency} {Number(l.unit_price || 0).toFixed(2)}
                          </td>
                          <td>{Number(l.discount_percent || 0).toFixed(1)}%</td>
                          <td>
                            <strong>
                              {modalQuote.currency} {Number(l.line_total || 0).toFixed(2)}
                            </strong>
                          </td>
                          <td>
                            {Number(l.line_total) > 0
                              ? ((Number(l.margin_amount) / Number(l.line_total)) * 100).toFixed(1)
                              : 0}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Approval Chain Progress */}
                {modalApprovals.length > 0 && (
                  <div className="modal-approvals-box">
                    <h4>Approval Escalation Chain</h4>
                    <ol className="approval-stepper">
                      {modalApprovals.map((app) => (
                        <li key={app.id} className={`stepper-item step-${String(app.status).toLowerCase()}`}>
                          <span>Step #{app.step_order}: {String(app.approval_level).replace('_', ' ')}</span>
                          <strong>{String(app.status).toUpperCase()}</strong>
                          {app.reason && <p className="step-note">{app.reason}</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Approver Decision Form */}
                <div className="modal-decision-form">
                  <label className="field">
                    <span className="field-label">
                      Decision Rationale / Revision Instructions (Required for Reject & Return)
                    </span>
                    <textarea
                      className="input"
                      rows="3"
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Enter commercial feedback, margin limits, or rationale for this decision…"
                      disabled={acting}
                    />
                  </label>

                  <div className="modal-actions-row">
                    <button
                      type="button"
                      className="btn btn-success btn-lg"
                      onClick={() => handleAction('approve')}
                      disabled={acting}
                    >
                      {acting ? 'Processing…' : '✓ Approve Deal'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-warning btn-lg"
                      onClick={() => handleAction('return')}
                      disabled={acting}
                    >
                      {acting ? 'Processing…' : '↩ Request Revision'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-lg"
                      onClick={() => handleAction('reject')}
                      disabled={acting}
                    >
                      {acting ? 'Processing…' : '✕ Reject Deal'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
