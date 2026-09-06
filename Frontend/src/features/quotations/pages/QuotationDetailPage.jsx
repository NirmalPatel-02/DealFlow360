import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import {
  useQuotationDetail,
  useQuoteApprovals,
  useQuoteSubmission,
  useApprovalAction,
} from '../quotations.hooks';
import { shareQuote } from '../quotations.api';
import { getCustomer, listContacts, createContact } from '../../customers/customers.api';
import {
  listQuoteRecommendations,
  acceptQuoteRecommendation,
} from '../../recommendations/recommendations.api';
import { getQuoteHealth } from '../../deal-health/dealHealth.api';
import { getErrorMessage } from '../../../services/api/apiError';
import Icon from '../../../components/ui/Icon';
import '../quotation-pages.css';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', className: 'badge-draft' },
  PENDING_APPROVAL: { label: 'Pending Approval', className: 'badge-pending' },
  APPROVED: { label: 'Approved', className: 'badge-approved' },
  SENT: { label: 'Sent to Customer', className: 'badge-sent' },
  UNDER_NEGOTIATION: { label: 'Under Negotiation', className: 'badge-negotiating' },
  CONFIRMED: { label: 'Confirmed Order', className: 'badge-confirmed' },
  REVISION_REQUIRED: { label: 'Revision Required', className: 'badge-revision' },
  REJECTED: { label: 'Rejected', className: 'badge-rejected' },
  CANCELLED: { label: 'Cancelled', className: 'badge-cancelled' },
};

export default function QuotationDetailPage() {
  const { quoteId } = useParams();
  const { user } = useAuth();
  const userRole = user?.role;

  const { quotation, loading, error, refetch: refetchQuote } = useQuotationDetail(quoteId);
  const {
    approvals,
    loading: approvalsLoading,
    error: approvalsError,
    refetch: refetchApprovals,
  } = useQuoteApprovals(quoteId);

  const {
    evaluate,
    submit,
    evaluation,
    evaluating,
    submitting,
    error: submissionError,
  } = useQuoteSubmission(quoteId);

  const { approve, reject, returnForRevision, acting, error: actionError } = useApprovalAction();

  const [customer, setCustomer] = useState(null);
  const [dealHealth, setDealHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);

  // Approval action inputs
  const [approvalReason, setApprovalReason] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');

  // Customer portal sharing
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [sharing, setSharing] = useState(false);
  const [portalShareResult, setPortalShareResult] = useState(null);
  const [showContactCreator, setShowContactCreator] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', is_primary: false });
  const [savingContact, setSavingContact] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  // Fetch customer details and contacts
  useEffect(() => {
    if (!quotation?.customer_id) return;
    let active = true;
    getCustomer(quotation.customer_id)
      .then((c) => active && setCustomer(c))
      .catch(() => {});

    listContacts(quotation.customer_id)
      .then((data) => {
        if (!active) return;
        setContacts(data || []);
        if (data?.length) {
          const primary = data.find((c) => c.is_primary) || data[0];
          setSelectedContactId(primary.id);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [quotation?.customer_id]);

  // Fetch deal health
  const loadDealHealth = useCallback(async () => {
    if (!quoteId) return;
    try {
      setHealthLoading(true);
      const health = await getQuoteHealth(quoteId);
      setDealHealth(health);
    } catch {
      // Ignore if deal health fails
    } finally {
      setHealthLoading(false);
    }
  }, [quoteId]);

  // Fetch recommendations
  const loadRecommendations = useCallback(async () => {
    if (!quoteId) return;
    try {
      setRecsLoading(true);
      const recs = await listQuoteRecommendations(quoteId);
      setRecommendations(recs || []);
    } catch {
      // Ignore if recommendations fail
    } finally {
      setRecsLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    loadDealHealth();
    loadRecommendations();
  }, [loadDealHealth, loadRecommendations]);

  if (loading) {
    return (
      <div className="page-status">
        <p>Loading quotation details…</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <section className="quotation-page">
        <div className="form-banner error-banner">{error || 'Quotation not found.'}</div>
        <Link to="/dashboard" className="btn btn-outline">
          Back to dashboard
        </Link>
      </section>
    );
  }

  const statusKey = String(quotation.status).toUpperCase();
  const statusInfo = STATUS_CONFIG[statusKey] || { label: statusKey, className: 'badge-draft' };

  const canEdit = statusKey === 'DRAFT' || statusKey === 'REVISION_REQUIRED';
  const canSubmit = statusKey === 'DRAFT' || statusKey === 'REVISION_REQUIRED';
  const isApprovedOrSent = statusKey === 'APPROVED' || statusKey === 'SENT';

  // Find currently pending approval step
  const currentPendingApproval = approvals.find(
    (a) => String(a.status).toUpperCase() === 'PENDING'
  );

  // Check if logged-in user can act on the pending step
  const canActOnApproval = Boolean(
    currentPendingApproval &&
      ((currentPendingApproval.approval_level === 'MANAGER' &&
        (userRole === 'sales_manager' || userRole === 'admin')) ||
        (currentPendingApproval.approval_level === 'MANAGER_FINANCE' &&
          (userRole === 'finance_ops' || userRole === 'admin')) ||
        userRole === 'admin')
  );

  // Evaluate Deal Engine
  async function handleEvaluate() {
    setActionErrorMsg('');
    try {
      await evaluate();
    } catch (err) {
      setActionErrorMsg(getErrorMessage(err));
    }
  }

  // Submit for Approval
  async function handleSubmitQuote() {
    setActionErrorMsg('');
    try {
      await submit();
      await Promise.all([refetchQuote(), refetchApprovals(), loadDealHealth()]);
    } catch (err) {
      setActionErrorMsg(getErrorMessage(err));
    }
  }

  // Act on Approval (Approve / Reject / Return)
  async function handleApprovalAction(action) {
    setActionErrorMsg('');
    if ((action === 'reject' || action === 'return') && !approvalReason.trim()) {
      setActionErrorMsg('A review note or reason is required to reject or return for revision.');
      return;
    }

    try {
      if (action === 'approve') await approve(quoteId);
      if (action === 'reject') await reject(quoteId, approvalReason.trim());
      if (action === 'return') await returnForRevision(quoteId, approvalReason.trim());

      setApprovalReason('');
      await Promise.all([refetchQuote(), refetchApprovals(), loadDealHealth()]);
    } catch (err) {
      setActionErrorMsg(getErrorMessage(err));
    }
  }

  // Accept Upsell Recommendation
  async function handleAcceptRecommendation(rec) {
    setActionErrorMsg('');
    try {
      const sourceProductId =
        rec.source_product_id || quotation.lines?.[0]?.product_id || rec.product_id;

      await acceptQuoteRecommendation(quoteId, {
        source_product_id: sourceProductId,
        suggested_product_id: rec.product_id,
        discount_percent: 0,
      });

      // Remove from list and refetch quote
      setRecommendations((cur) => cur.filter((r) => r.product_id !== rec.product_id));
      await Promise.all([refetchQuote(), loadDealHealth()]);
    } catch (err) {
      setActionErrorMsg(getErrorMessage(err));
    }
  }

  // Create new contact inline
  async function handleCreateContact(e) {
    e.preventDefault();
    setSavingContact(true);
    setActionErrorMsg('');
    try {
      const contact = await createContact(quotation.customer_id, {
        name: newContact.name.trim(),
        email: newContact.email.trim(),
        phone: newContact.phone.trim() || undefined,
        is_primary: newContact.is_primary,
      });
      setContacts((cur) => [contact, ...cur]);
      setSelectedContactId(contact.id);
      setShowContactCreator(false);
      setNewContact({ name: '', email: '', phone: '', is_primary: false });
    } catch (err) {
      setActionErrorMsg(`Failed to add contact: ${getErrorMessage(err)}`);
    } finally {
      setSavingContact(false);
    }
  }

  // Share quote with customer contact
  async function handleShareQuote() {
    if (!selectedContactId) {
      setActionErrorMsg('Please select or add a customer contact to generate the portal link.');
      return;
    }
    setActionErrorMsg('');
    setSharing(true);
    try {
      const result = await shareQuote(quoteId, selectedContactId);
      setPortalShareResult(result);
      await Promise.all([refetchQuote(), loadDealHealth()]);
    } catch (err) {
      setActionErrorMsg(getErrorMessage(err));
    } finally {
      setSharing(false);
    }
  }

  function handleCopyPortalLink() {
    if (!portalShareResult?.portal_url) return;
    const fullUrl = `${window.location.origin}${portalShareResult.portal_url}`;
    navigator.clipboard.writeText(fullUrl).then(
      () => {
        setCopyFeedback('Portal link copied to clipboard!');
        setTimeout(() => setCopyFeedback(''), 4000);
      },
      () => {
        setCopyFeedback(`Link: ${fullUrl}`);
      }
    );
  }

  const currency = quotation.currency || 'INR';

  return (
    <section className="quotation-page">
      {/* Header & Breadcrumbs */}
      <div className="quotation-page-header">
        <div>
          <p className="eyebrow">DealFlow360 / Quotations / {quotation.quote_number}</p>
          <div className="header-title-row">
            <h1 className="page-title">{quotation.quote_number}</h1>
            <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>
          </div>
          <p className="subheading">
            {/* Account: <strong>{customer?.name || 'Customer Account'}</strong> ({customer?.code || quotation.customer_id}) ·{' '} */}
            Tier: <strong>{customer?.tier?.toUpperCase() || quotation.customer_tier_snapshot?.toUpperCase() || 'STANDARD'}</strong>
          </p>
        </div>
        <div className="quotation-header-actions">
          <Link to="/dashboard" className="btn btn-outline">
            Back to Dashboard
          </Link>
          {canEdit && (
            <Link to={`/quotations/${quoteId}/edit`} className="btn btn-primary">
              Edit Quotation
            </Link>
          )}
        </div>
      </div>

      {/* Error Banners */}
      {actionErrorMsg || submissionError || actionError || approvalsError ? (
        <div className="form-banner error-banner">
          {actionErrorMsg || submissionError || actionError || approvalsError}
        </div>
      ) : null}

      {/* Under Negotiation Notice */}
      {statusKey === 'UNDER_NEGOTIATION' && (
        <div className="form-banner warning-banner">
          <strong>Customer Under Negotiation:</strong> The client has proposed revisions or requested custom pricing
          via the customer portal. Review the commercial lines below before submitting counter terms.
        </div>
      )}

      {/* Key Financial Metrics */}
      <div className="quotation-summary-grid">
        <div className="quote-summary-card">
          <span>Grand Total</span>
          <strong className="summary-highlight">
            {currency} {Number(quotation.grand_total || 0).toFixed(2)}
          </strong>
        </div>
        <div className="quote-summary-card">
          <span>Gross Margin</span>
          <strong
            className={`summary-highlight ${
              Number(quotation.gross_margin_percent || 0) >= 25
                ? 'text-healthy'
                : Number(quotation.gross_margin_percent || 0) >= 10
                ? 'text-warning'
                : 'text-danger'
            }`}
          >
            {Number(quotation.gross_margin_percent || 0).toFixed(1)}%
          </strong>
        </div>
        <div className="quote-summary-card">
          <span>Deal Risk Score</span>
          <strong
            className={`summary-highlight ${
              Number(quotation.risk_score || 0) <= 20
                ? 'text-healthy'
                : Number(quotation.risk_score || 0) <= 50
                ? 'text-warning'
                : 'text-danger'
            }`}
          >
            {Number(quotation.risk_score || 0).toFixed(1)}%
          </strong>
        </div>
        <div className="quote-summary-card">
          <span>Discount Given</span>
          <strong className="summary-highlight text-discount">
            {currency} {Number(quotation.discount_total || 0).toFixed(2)}
          </strong>
        </div>
      </div>

      {/* Deal Health & Risk Alerts */}
      {dealHealth && (
        <div className={`deal-health-banner ${dealHealth.health === 'AT_RISK' ? 'health-at-risk' : 'health-healthy'}`}>
          <div className="health-header">
            <span className="health-status-tag">
              {dealHealth.health === 'AT_RISK' ? (
                <><Icon name="alert-triangle" size={13} style={{ marginRight: '5px' }} /> DEAL AT RISK</>
              ) : (
                <><Icon name="check" size={13} style={{ marginRight: '5px' }} /> DEAL HEALTHY</>
              )}
            </span>
            <span className="health-meta">
              Risk Score: {Number(dealHealth.riskScore || 0).toFixed(1)}% · Margin:{' '}
              {Number(dealHealth.grossMarginPercent || 0).toFixed(1)}%
            </span>
          </div>
          {dealHealth.alerts?.length ? (
            <div className="health-alerts-list">
              {dealHealth.alerts.map((alert, idx) => (
                <div className={`health-alert-item alert-${alert.severity?.toLowerCase()}`} key={idx}>
                  <strong className="alert-type">{alert.type?.replace('_', ' ')}:</strong>
                  <span className="alert-msg">{alert.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="health-good-note">All discount governance and margin policies are within normal thresholds.</p>
          )}
        </div>
      )}

      {/* Commercial Line Items Table */}
      <div className="quotation-form-section">
        <div className="section-heading-row">
          <div>
            <h2>Quotation Line Items</h2>
            <p className="section-subtext">Commercial breakdown of products, contracted rates, and margins.</p>
          </div>
          {canEdit && (
            <Link to={`/quotations/${quoteId}/edit`} className="btn btn-sm btn-outline">
              + Modify Lines
            </Link>
          )}
        </div>

        <div className="detail-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product Description</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Line Total</th>
                <th>Line Margin</th>
              </tr>
            </thead>
            <tbody>
              {quotation.lines?.map((line, idx) => {
                const marginVal = Number(line.margin_amount || 0);
                const lineTotalVal = Number(line.line_total || 0);
                const marginPct = lineTotalVal > 0 ? (marginVal / lineTotalVal) * 100 : 0;

                return (
                  <tr key={line.id || idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong>{line.description_snapshot || 'Product Item'}</strong>
                      {line.notes && <p className="line-item-subnotes">{line.notes}</p>}
                    </td>
                    <td>
                      <span className="type-pill">{String(line.line_type || 'one_time').replace('_', ' ')}</span>
                    </td>
                    <td>{Number(line.quantity)}</td>
                    <td>
                      {currency} {Number(line.unit_price || 0).toFixed(2)}
                    </td>
                    <td>
                      {Number(line.discount_percent || 0) > 0 ? (
                        <span className="discount-tag">
                          {Number(line.discount_percent).toFixed(1)}% (-{currency} {Number(line.discount_amount || 0).toFixed(2)})
                        </span>
                      ) : (
                        '0%'
                      )}
                    </td>
                    <td>
                      <strong>
                        {currency} {Number(line.line_total || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`margin-pill ${
                          marginPct >= 25
                            ? 'margin-pill-healthy'
                            : marginPct >= 10
                            ? 'margin-pill-warning'
                            : 'margin-pill-danger'
                        }`}
                      >
                        {marginPct.toFixed(1)}% ({currency} {marginVal.toFixed(2)})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Financial Totals */}
        <div className="quote-totals-box">
          <div className="quote-totals">
            <span>
              Subtotal: <strong>{currency} {Number(quotation.subtotal || 0).toFixed(2)}</strong>
            </span>
            <span>
              Total Discounts: <strong className="text-discount">-{currency} {Number(quotation.discount_total || 0).toFixed(2)}</strong>
            </span>
            <span>
              Tax Total: <strong>{currency} {Number(quotation.tax_total || 0).toFixed(2)}</strong>
            </span>
            <span className="quote-total">
              Grand Total: <strong>{currency} {Number(quotation.grand_total || 0).toFixed(2)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Deal Engine: Pre-submission Evaluation & Submit Panel */}
      {canSubmit && (
        <div className="quotation-form-section deal-engine-panel">
          <div className="section-heading-row">
            <div>
              <h2>Deal Engine Pre-Submission Check</h2>
              <p className="section-subtext">
                Evaluate commercial risk, discount threshold violations, and multi-level approval requirements before
                submitting.
              </p>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleEvaluate}
                disabled={evaluating || submitting}
              >
                {evaluating ? 'Evaluating Risk…' : <><Icon name="search" size={14} style={{ marginRight: '6px' }} /> Evaluate Deal</>}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitQuote}
                disabled={submitting || evaluating}
              >
                {submitting ? 'Submitting…' : <><Icon name="send" size={14} style={{ marginRight: '6px' }} /> Submit for Approval</>}
              </button>
            </div>
          </div>

          {evaluation && (
            <div className="evaluation-result-card">
              <div className="evaluation-header">
                <strong>Evaluation Status: Risk Score {Number(evaluation.risk_score || 0).toFixed(1)}%</strong>
                <span className={`eval-pill ${evaluation.requires_approval ? 'pill-warning' : 'pill-success'}`}>
                  {evaluation.requires_approval
                    ? `Approval Required (${evaluation.highest_approval_level?.replace('_', ' ')})`
                    : 'Auto-Approval Eligible'}
                </span>
              </div>
              <div className="eval-metrics">
                <span>Blended Excess: {Number(evaluation.blended_excess_percent || 0).toFixed(1)}%</span>
                <span>Max Excess: {Number(evaluation.max_excess_percent || 0).toFixed(1)}%</span>
              </div>
              {evaluation.violations?.length ? (
                <div className="violations-box">
                  <p className="violations-title">Governance Violations Detected:</p>
                  <ul>
                    {evaluation.violations.map((violation, idx) => (
                      <li key={idx}>
                        <strong>{violation.rule || 'Discount Policy'}:</strong> {violation.message || JSON.stringify(violation)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="no-violations"><Icon name="check" size={14} color="#2e6618" style={{ marginRight: '6px' }} /> No discount governance violations detected. Eligible for expedited approval.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Approval Timeline & Approver Decision Actions */}
      <div className="quotation-detail-grid">
        {/* Approval Timeline */}
        <div className="quotation-form-section approval-panel">
          <h2>Approval Chain & Workflow</h2>
          {approvalsLoading ? (
            <p>Loading approval progress…</p>
          ) : approvals.length ? (
            <ol className="approval-timeline">
              {approvals.map((approval) => {
                const stepStatus = String(approval.status).toUpperCase();
                return (
                  <li key={approval.id} className={`approval-step approval-${stepStatus.toLowerCase()}`}>
                    <div className="approval-step-header">
                      <span className="step-level">
                        Step #{approval.step_order}: {String(approval.approval_level).replace('_', ' ')}
                      </span>
                      <span className={`step-badge badge-${stepStatus.toLowerCase()}`}>{stepStatus}</span>
                    </div>
                    {approval.acted_at && (
                      <small className="acted-meta">
                        Acted: {new Date(approval.acted_at).toLocaleString()}
                      </small>
                    )}
                    {approval.reason && <p className="approval-notes">Note: {approval.reason}</p>}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="body-copy">
              Approval steps will be instantiated once the quotation is submitted for review.
            </p>
          )}

          {/* Approver Action Panel */}
          {canActOnApproval && (
            <div className="approver-decision-box">
              <h3>Manager / Finance Decision</h3>
              <p className="section-subtext">
                Pending step requires your role ({String(currentPendingApproval.approval_level).replace('_', ' ')}).
              </p>
              <label className="field">
                <span className="field-label">Review Reason / Revision Notes (Required for Reject & Return)</span>
                <textarea
                  className="input"
                  rows="3"
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="Provide commercial rationale, discount limits, or revision guidance…"
                  disabled={acting}
                />
              </label>
              <div className="action-row" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleApprovalAction('approve')}
                  disabled={acting}
                >
                  {acting ? 'Processing…' : <><Icon name="check" size={14} style={{ marginRight: '6px' }} /> Approve Deal</>}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleApprovalAction('return')}
                  disabled={acting}
                >
                  {acting ? 'Processing…' : <><Icon name="rotate-ccw" size={14} style={{ marginRight: '6px' }} /> Request Revision</>}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleApprovalAction('reject')}
                  disabled={acting}
                >
                  {acting ? 'Processing…' : <><Icon name="x" size={14} style={{ marginRight: '6px' }} /> Reject Deal</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Customer Portal Sharing & Tracking */}
        <div className="quotation-form-section sharing-panel">
          <div className="section-heading-row">
            <h2>Customer Portal Sharing</h2>
            {isApprovedOrSent && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowContactCreator((c) => !c)}
              >
                {showContactCreator ? 'Cancel' : '+ New Contact'}
              </button>
            )}
          </div>

          {isApprovedOrSent ? (
            <div>
              <p className="body-copy">
                Generate an authenticated customer portal link to share this quotation with the client.
              </p>

              {/* Inline Contact Creator */}
              {showContactCreator && (
                <div className="inline-customer-form" style={{ margin: '1rem 0' }}>
                  <h4>Add New Customer Contact</h4>
                  <div className="quotation-form-grid">
                    <label className="field">
                      <span className="field-label">Full Name *</span>
                      <input
                        className="input"
                        value={newContact.name}
                        onChange={(e) => setNewContact((c) => ({ ...c, name: e.target.value }))}
                        placeholder="e.g. Sarah Connor"
                        required
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Email *</span>
                      <input
                        className="input"
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact((c) => ({ ...c, email: e.target.value }))}
                        placeholder="sarah@client.com"
                        required
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Phone</span>
                      <input
                        className="input"
                        value={newContact.phone}
                        onChange={(e) => setNewContact((c) => ({ ...c, phone: e.target.value }))}
                        placeholder="+91 9876543210"
                      />
                    </label>
                  </div>
                  <div className="action-row" style={{ marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleCreateContact}
                      disabled={savingContact || !newContact.name || !newContact.email}
                    >
                      {savingContact ? 'Saving…' : 'Save Contact'}
                    </button>
                  </div>
                </div>
              )}

              <div className="share-controls-grid">
                <label className="field">
                  <span className="field-label">Recipient Contact</span>
                  <select
                    className="input"
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    disabled={sharing}
                  >
                    <option value="">-- Choose recipient contact --</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} ({contact.email}) {contact.is_primary ? '(Primary)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="share-btn-wrap">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleShareQuote}
                    disabled={sharing || !selectedContactId}
                  >
                    {sharing ? 'Generating Link…' : <><Icon name="link" size={14} style={{ marginRight: '6px' }} /> Generate Portal Link</>}
                  </button>
                </div>
              </div>

              {portalShareResult && (
                <div className="portal-link-box">
                  <div className="link-title-row">
                    <strong>Customer Portal Access Ready:</strong>
                    <span className="expiry-tag">
                      Expires: {new Date(portalShareResult.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="link-copy-row">
                    <input
                      className="input input-link"
                      value={`${window.location.origin}${portalShareResult.portal_url}`}
                      readOnly
                    />
                    <button type="button" className="btn btn-outline" onClick={handleCopyPortalLink}>
                      Copy Link
                    </button>
                    <a
                      href={portalShareResult.portal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                    >
                      Open Portal
                    </a>
                  </div>
                  {copyFeedback && <p className="copy-feedback-note">{copyFeedback}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="share-locked-note">
              <p>
                Customer portal sharing will be unlocked once this quotation completes the approval chain and reaches{' '}
                <strong>Approved</strong> status.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* AI / Upsell Recommendations Section */}
      <div className="quotation-form-section recommendations-panel">
        <div className="section-heading-row">
          <div>
            <h2>Upsell & Cross-Sell Recommendations</h2>
            <p className="section-subtext">
              Recommended additions based on customer co-purchase affinity and margin optimization rules.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={loadRecommendations} disabled={recsLoading}>
            {recsLoading ? 'Refreshing…' : <><Icon name="refresh" size={13} style={{ marginRight: '6px' }} /> Refresh Recommendations</>}
          </button>
        </div>

        {recommendations.length ? (
          <div className="recommendations-cards-grid">
            {recommendations.map((rec) => (
              <div className="recommendation-card-enhanced" key={rec.product_id}>
                <div className="rec-card-header">
                  <span className="rec-type-badge">{rec.product_type?.toUpperCase()}</span>
                  {rec.promotion_name && <span className="rec-promo-badge">PROMO: {rec.promotion_name}</span>}
                </div>
                <h3 className="rec-product-name">{rec.product_name}</h3>
                <p className="rec-product-code">SKU: {rec.product_code}</p>
                <p className="rec-reason">{rec.reason}</p>
                <div className="rec-financials">
                  <div className="rec-fin-stat">
                    <small>Suggested Price:</small>
                    <span>
                      {currency} {Number(rec.recommended_unit_price || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="rec-fin-stat">
                    <small>Projected Margin:</small>
                    <strong className="text-healthy">
                      {Number(rec.new_quote_margin_percent || rec.margin_percent || 0).toFixed(1)}%
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline rec-add-btn"
                  onClick={() => handleAcceptRecommendation(rec)}
                  disabled={!canEdit}
                  title={!canEdit ? 'Quote must be in Draft or Revision Required to add lines' : 'Add to quote'}
                >
                  + Add to Quotation
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="body-copy">
            No active recommendation rules apply to the currently selected catalog items.
          </p>
        )}
      </div>
    </section>
  );
}
