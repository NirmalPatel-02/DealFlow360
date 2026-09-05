import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApprovalAction, useQuotations } from '../../quotations/quotations.hooks';
import { listCustomers } from '../../customers/customers.api';
import { getDealHealthDashboard } from '../../deal-health/dealHealth.api';
import { getQuotation, listQuoteApprovals } from '../../quotations/quotations.api';
import { getErrorMessage } from '../../../services/api/apiError';
import './FinanceDashboard.css';

const TABS = [
  { id: 'pending', label: 'Finance Pending Approvals' },
  { id: 'fulfillment', label: 'Ready for Fulfillment' },
  { id: 'negotiation', label: 'Revisions & Negotiations' },
  { id: 'all', label: 'All Quotations' },
];

export default function FinanceDashboard() {
  const [selectedTab, setSelectedTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('total_desc');
  const [marginFilter, setMarginFilter] = useState('all');

  const [customerMap, setCustomerMap] = useState({});
  const [dealHealthSummary, setDealHealthSummary] = useState(null);
  const [approvalsMap, setApprovalsMap] = useState({});

  // Quick Action Modal
  const [modalQuote, setModalQuote] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalApprovals, setModalApprovals] = useState([]);
  const [actionReason, setActionReason] = useState('');
  const [modalError, setModalError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const { quotations, loading, error, refetch: refetchQuotes } = useQuotations();
  const { approve, reject, returnForRevision, acting } = useApprovalAction();

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

  // Load deal health dashboard
  const loadHealthDashboard = useCallback(() => {
    getDealHealthDashboard()
      .then((data) => setDealHealthSummary(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadHealthDashboard();
  }, [loadHealthDashboard]);

  // For pending quotes, fetch approval steps
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
        setApprovalsMap(appMap);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [quotations]);

  // Group quotes by tab
  const groups = useMemo(() => {
    return {
      pending: quotations.filter((q) => String(q.status).toUpperCase() === 'PENDING_APPROVAL'),
      fulfillment: quotations.filter((q) => {
        const s = String(q.status).toUpperCase();
        return s === 'APPROVED' || s === 'SENT' || s === 'CONFIRMED';
      }),
      negotiation: quotations.filter((q) => {
        const s = String(q.status).toUpperCase();
        return s === 'UNDER_NEGOTIATION' || s === 'REVISION_REQUIRED';
      }),
      all: quotations,
    };
  }, [quotations]);

  // Filter & sort
  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sourceList = groups[selectedTab] || [];

    return sourceList
      .filter((q) => {
        const customer = customerMap[q.customer_id];
        const custName = customer ? customer.name.toLowerCase() : '';
        const quoteNum = String(q.quote_number || '').toLowerCase();
        const matchesQuery = !query || quoteNum.includes(query) || custName.includes(query);

        const margin = Number(q.gross_margin_percent || 0);
        let matchesMargin = true;
        if (marginFilter === 'low') matchesMargin = margin < 15;
        if (marginFilter === 'healthy') matchesMargin = margin >= 25;

        return matchesQuery && matchesMargin;
      })
      .sort((a, b) => {
        if (sort === 'total_desc') return Number(b.grand_total || 0) - Number(a.grand_total || 0);
        if (sort === 'total_asc') return Number(a.grand_total || 0) - Number(b.grand_total || 0);
        if (sort === 'margin_desc') return Number(b.gross_margin_percent || 0) - Number(a.gross_margin_percent || 0);
        if (sort === 'margin_asc') return Number(a.gross_margin_percent || 0) - Number(b.gross_margin_percent || 0);
        if (sort === 'risk_desc') return Number(b.risk_score || 0) - Number(a.risk_score || 0);
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [groups, selectedTab, search, marginFilter, sort, customerMap]);

  // Financial KPIs
  const kpis = useMemo(() => {
    const totalVolume = quotations.reduce((sum, q) => sum + Number(q.grand_total || 0), 0);
    const pendingList = groups.pending;
    const pendingValue = pendingList.reduce((sum, q) => sum + Number(q.grand_total || 0), 0);

    const approvedList = groups.fulfillment;
    const approvedValue = approvedList.reduce((sum, q) => sum + Number(q.grand_total || 0), 0);

    const totalMargin = quotations.reduce((sum, q) => sum + Number(q.gross_margin_percent || 0), 0);
    const blendedMargin = quotations.length ? totalMargin / quotations.length : 0;

    return {
      pendingCount: pendingList.length,
      pendingValue,
      approvedCount: approvedList.length,
      approvedValue,
      totalVolume,
      blendedMargin,
      totalCount: quotations.length,
    };
  }, [groups, quotations]);

  // Open Review Modal
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

  // Act on approval
  async function handleAction(action) {
    if (!modalQuote) return;
    setModalError('');
    setActionSuccess('');

    if ((action === 'reject' || action === 'return') && !actionReason.trim()) {
      setModalError('Finance notes are mandatory when rejecting or requesting revisions.');
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
    <div className="dashboard-container finance-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">DealFlow360 / Finance & Commercial Governance</p>
          <h1 className="page-title">Finance & Operations Dashboard</h1>
          <p className="subheading">
            Second-level approvals, gross margin validation, fulfillment readiness, and billing reconciliation.
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn btn-outline" onClick={() => { refetchQuotes(); loadHealthDashboard(); }}>
            ↻ Refresh Financials
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
          <button onClick={refetchQuotes} className="btn btn-sm btn-secondary">
            Retry
          </button>
        </div>
      )}

      {/* Financial Executive KPIs */}
      <div className="stats-grid">
        <div className="stat-card highlight">
          <div className="stat-value">{kpis.pendingCount}</div>
          <div className="stat-label">Pending Finance Approvals</div>
          <div className="stat-subtext">
            Exposure: ₹{kpis.pendingValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{kpis.approvedCount}</div>
          <div className="stat-label">Ready for Fulfillment</div>
          <div className="stat-subtext">
            Confirmed Value: ₹{kpis.approvedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{kpis.blendedMargin.toFixed(1)}%</div>
          <div className="stat-label">Blended Portfolio Margin</div>
          <div className="stat-subtext">Across all quotes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            ₹{kpis.totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-label">Total Commercial Pipeline</div>
          <div className="stat-subtext">{kpis.totalCount} quotations</div>
        </div>
      </div>

      {/* Toolbar: Search, Margin Filter & Sort */}
      <div className="manager-toolbar">
        <label className="field manager-search">
          <span className="field-label">Search Transactions</span>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quote number or client account…"
          />
        </label>
        <label className="field">
          <span className="field-label">Margin Filter</span>
          <select
            className="input"
            value={marginFilter}
            onChange={(e) => setMarginFilter(e.target.value)}
          >
            <option value="all">All Margins</option>
            <option value="low">Low Margin (&lt; 15%)</option>
            <option value="healthy">Healthy Margin (≥ 25%)</option>
          </select>
        </label>
        <label className="field manager-sort">
          <span className="field-label">Sort Financials By</span>
          <select
            className="input"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="total_desc">Revenue: Highest First</option>
            <option value="total_asc">Revenue: Lowest First</option>
            <option value="margin_desc">Margin: Highest First</option>
            <option value="margin_asc">Margin: Lowest First</option>
            <option value="risk_desc">Risk Score: Highest First</option>
          </select>
        </label>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${selectedTab === tab.id ? 'active' : ''}`}
              onClick={() => setSelectedTab(tab.id)}
            >
              {tab.label} ({groups[tab.id]?.length || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Financial Quotations Table */}
      {loading ? (
        <div className="page-status">
          <p>Loading financial queue…</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3>No quotations in this view</h3>
          <p>{search ? 'Try adjusting your search criteria.' : 'All transactions in this category have been processed.'}</p>
        </div>
      ) : (
        <div className="quotations-table-wrapper">
          <table className="data-table finance-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Revenue (Grand Total)</th>
                <th>Gross Margin</th>
                <th>Risk Score</th>
                <th>Approval Status</th>
                <th>Next Workflow Step</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => {
                const customer = customerMap[quote.customer_id];
                const margin = Number(quote.gross_margin_percent || 0);
                const risk = Number(quote.risk_score || 0);
                const statusKey = String(quote.status).toUpperCase();

                const pendingInfo = approvalsMap[quote.id];
                const currentStep = pendingInfo?.currentStep;

                return (
                  <tr key={quote.id}>
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
                            : margin >= 15
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
                          risk > 40
                            ? 'risk-high'
                            : risk > 20
                            ? 'risk-moderate'
                            : 'risk-low'
                        }`}
                      >
                        {risk.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-${statusKey.toLowerCase()}`}>
                        {statusKey.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {statusKey === 'PENDING_APPROVAL' && currentStep ? (
                        <span className="escalation-step-tag">
                          Step #{currentStep.step_order}: {String(currentStep.approval_level).replace('_', ' ')}
                        </span>
                      ) : statusKey === 'APPROVED' || statusKey === 'SENT' || statusKey === 'CONFIRMED' ? (
                        <span className="workflow-ready-tag">✓ Ready for Fulfillment</span>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        {statusKey === 'PENDING_APPROVAL' ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleOpenReview(quote)}
                          >
                            Audit & Action
                          </button>
                        ) : (statusKey === 'APPROVED' || statusKey === 'SENT' || statusKey === 'CONFIRMED') ? (
                          <Link to={`/fulfillment?quoteId=${quote.id}`} className="btn btn-sm btn-primary">
                            Fulfill Order
                          </Link>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleOpenReview(quote)}
                          >
                            Audit
                          </button>
                        )}
                        <Link to={`/quotations/${quote.id}`} className="btn btn-sm btn-outline">
                          View
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

      {/* Quick Action / Audit Modal */}
      {modalQuote && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Finance & Operations Audit</p>
                <h2>Quotation {modalQuote.quote_number} Financial Review</h2>
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
                <p>Loading financial audit breakdown…</p>
              </div>
            ) : (
              <div className="modal-body">
                {modalError && <div className="form-banner error-banner">{modalError}</div>}
                {actionSuccess && <div className="form-banner success-banner">{actionSuccess}</div>}

                {/* Financial Summary */}
                <div className="modal-metrics-grid">
                  <div className="modal-metric-card">
                    <small>Grand Total (Revenue)</small>
                    <strong>
                      {modalQuote.currency} {Number(modalQuote.grand_total || 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="modal-metric-card">
                    <small>Total Cost (COGS)</small>
                    <strong className="text-muted">
                      {modalQuote.currency} {Number(modalQuote.total_cost || 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="modal-metric-card">
                    <small>Gross Margin</small>
                    <strong
                      className={
                        Number(modalQuote.gross_margin_percent || 0) >= 25
                          ? 'text-healthy'
                          : Number(modalQuote.gross_margin_percent || 0) >= 15
                          ? 'text-warning'
                          : 'text-danger'
                      }
                    >
                      {Number(modalQuote.gross_margin_percent || 0).toFixed(1)}% ({modalQuote.currency} {Number(modalQuote.gross_margin || 0).toFixed(2)})
                    </strong>
                  </div>
                  <div className="modal-metric-card">
                    <small>Discount Risk</small>
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
                </div>

                {/* Line Items Table */}
                <div className="modal-lines-table-wrap">
                  <h4>Product Lines & Unit Costing</h4>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product Snapshot</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Unit Cost</th>
                        <th>Discount</th>
                        <th>Line Total</th>
                        <th>Gross Profit</th>
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
                          <td className="text-muted">
                            {modalQuote.currency} {Number(l.unit_cost || 0).toFixed(2)}
                          </td>
                          <td>{Number(l.discount_percent || 0).toFixed(1)}%</td>
                          <td>
                            <strong>
                              {modalQuote.currency} {Number(l.line_total || 0).toFixed(2)}
                            </strong>
                          </td>
                          <td className="text-healthy">
                            +{modalQuote.currency} {Number(l.margin_amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Approvals Chain */}
                {modalApprovals.length > 0 && (
                  <div className="modal-approvals-box">
                    <h4>Multi-Tier Approval Audit</h4>
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

                {/* Finance Decision Form */}
                <div className="modal-decision-form">
                  <label className="field">
                    <span className="field-label">Finance & Ops Notes (Required for Reject & Return)</span>
                    <textarea
                      className="input"
                      rows="3"
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Specify margin conditions, fulfillment caveats, or revision instructions…"
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
                      {acting ? 'Processing…' : '✓ Approve & Authorize Fulfillment'}
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
