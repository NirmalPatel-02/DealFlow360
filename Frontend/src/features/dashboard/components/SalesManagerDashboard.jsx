import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApprovalAction, useQuotations } from '../../quotations/quotations.hooks';
import { getErrorMessage } from '../../../services/api/apiError';
import './SalesManagerDashboard.css';

const PAGE_SIZE = 8;
const TABS = [
  { id: 'pending', label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'atRisk', label: 'At-risk deals' },
];
const STATUS_LABELS = { PENDING_APPROVAL: 'Pending review', APPROVED: 'Approved', REJECTED: 'Rejected' };

export default function SalesManagerDashboard() {
  const [selectedTab, setSelectedTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('risk_desc');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState('');
  const { quotations, loading, error, refetch } = useQuotations();
  const { approve, acting } = useApprovalAction();

  const groups = useMemo(() => ({
    pending: quotations.filter((quote) => quote.status === 'PENDING_APPROVAL'),
    approved: quotations.filter((quote) => quote.status === 'APPROVED'),
    rejected: quotations.filter((quote) => quote.status === 'REJECTED'),
    atRisk: quotations.filter((quote) => Number(quote.risk_score || 0) > 50),
  }), [quotations]);

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (groups[selectedTab] || []).filter((quote) => !query || [quote.quote_number, quote.id, quote.customer_id, quote.created_by_user_id].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
    return [...matches].sort((left, right) => {
      if (sort === 'total_desc') return Number(right.grand_total || 0) - Number(left.grand_total || 0);
      if (sort === 'total_asc') return Number(left.grand_total || 0) - Number(right.grand_total || 0);
      if (sort === 'date_asc') return new Date(left.created_at) - new Date(right.created_at);
      return Number(right.risk_score || 0) - Number(left.risk_score || 0);
    });
  }, [groups, search, selectedTab, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const visibleQuotes = filteredQuotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stats = {
    pending: groups.pending.length,
    approved: groups.approved.length,
    rejected: groups.rejected.length,
    atRisk: groups.atRisk.length,
    totalUnderReview: quotations.filter((quote) => quote.status === 'PENDING_APPROVAL').length,
  };

  function selectTab(tab) { setSelectedTab(tab); setPage(1); }
  function updateSearch(event) { setSearch(event.target.value); setPage(1); }

  async function approveQuote(quoteId) {
    setActionError('');
    try { await approve(quoteId); await refetch(); } catch (requestError) { setActionError(getErrorMessage(requestError)); }
  }

  if (loading) return <div className="dashboard-container"><div className="page-status"><p>Loading approvals…</p></div></div>;

  return (
    <div className="dashboard-container sales-manager-dashboard">
      <div className="dashboard-header"><div><p className="eyebrow">DealFlow360 / Governance</p><h1 className="page-title">Sales Manager Dashboard</h1><p className="subheading">Review discount-driven approvals and monitor deal risk.</p></div></div>
      {error || actionError ? <div className="alert alert-error"><p>{error || actionError}</p><button onClick={refetch} className="btn btn-sm btn-secondary">Retry</button></div> : null}

      <div className="stats-grid"><div className="stat-card highlight"><div className="stat-value">{stats.pending}</div><div className="stat-label">Pending my review</div></div><div className="stat-card success"><div className="stat-value">{stats.approved}</div><div className="stat-label">Approved</div></div><div className="stat-card warning"><div className="stat-value">{stats.rejected}</div><div className="stat-label">Rejected</div></div><div className="stat-card alert"><div className="stat-value">{stats.atRisk}</div><div className="stat-label">At-risk deals</div></div><div className="stat-card"><div className="stat-value">{stats.totalUnderReview}</div><div className="stat-label">Total under review</div></div></div>

      <div className="manager-toolbar" role="search"><label className="field manager-search"><span className="field-label">Search quotations</span><input className="input" value={search} onChange={updateSearch} placeholder="Quote number or identifier" /></label><label className="field manager-sort"><span className="field-label">Sort by</span><select className="input" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="risk_desc">Risk: highest first</option><option value="total_desc">Total: highest first</option><option value="total_asc">Total: lowest first</option><option value="date_asc">Oldest first</option></select></label></div>
      <div className="tabs-container"><div className="tabs">{TABS.map((tab) => <button key={tab.id} className={`tab ${selectedTab === tab.id ? 'active' : ''}`} onClick={() => selectTab(tab.id)}>{tab.label} ({stats[tab.id]})</button>)}</div></div>

      {visibleQuotes.length === 0 ? <div className="empty-state"><div className="empty-state-icon">✓</div><h3>No quotations found</h3><p>{search ? 'Try a different search term.' : 'There are no quotations in this category.'}</p></div> : <div className="quotations-table-wrapper"><table className="data-table approvals-table"><thead><tr><th>Quote #</th><th>Customer ID</th><th>Total</th><th>Risk</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{visibleQuotes.map((quote) => { const riskScore = Number(quote.risk_score || 0); const isPending = quote.status === 'PENDING_APPROVAL'; return <tr key={quote.id} className={riskScore > 50 ? 'row-highlight-warning' : ''}><td><Link to={`/quotations/${quote.id}`} className="quote-link">{quote.quote_number}</Link></td><td>{quote.customer_id}</td><td className="text-right">{quote.currency} {Number(quote.grand_total || 0).toFixed(2)}</td><td><span className={`risk-badge ${riskScore > 50 ? 'risk-high' : 'risk-low'}`}>{riskScore.toFixed(1)}%</span></td><td><span className="status-badge status-pending">{STATUS_LABELS[quote.status] || quote.status}</span></td><td className="text-sm text-gray-500">{new Date(quote.created_at).toLocaleDateString()}</td><td><div className="table-actions"><Link to={`/quotations/${quote.id}`} className="btn btn-sm btn-outline">Review</Link>{isPending && <button className="btn btn-sm btn-success" onClick={() => approveQuote(quote.id)} disabled={acting}>Approve</button>}</div></td></tr>; })}</tbody></table></div>}

      <div className="manager-pagination"><span>Showing {filteredQuotes.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filteredQuotes.length)} of {filteredQuotes.length}</span><div className="pagination-actions"><button className="btn btn-sm btn-outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Previous</button><span>Page {page} of {pageCount}</span><button className="btn btn-sm btn-outline" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</button></div></div>
      <div className="dashboard-footer"><p className="text-sm text-gray-500"><strong>Review note:</strong> Approval eligibility and discount thresholds are enforced by backend governance and deal-engine services.</p></div>
    </div>
  );
}
