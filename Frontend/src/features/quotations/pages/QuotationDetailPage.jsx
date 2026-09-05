import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useApprovalAction,
  useQuoteApprovals,
  useQuotationDetail,
  useQuoteSubmission,
} from '../quotations.hooks';
import { getErrorMessage } from '../../../services/api/apiError';
import { acceptQuoteRecommendation, listQuoteRecommendations } from '../../recommendations/recommendations.api';
import { createFulfillmentPlan, getFulfillmentRecommendation } from '../../fulfillment/fulfillment.api';
import '../quotation-pages.css';

const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVISION_REQUIRED: 'Revision required',
  SENT: 'Sent to customer',
  UNDER_NEGOTIATION: 'Under negotiation',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

export default function QuotationDetailPage() {
  const { quoteId } = useParams();
  const { quotation, loading, error, refetch } = useQuotationDetail(quoteId);
  const { approvals, loading: approvalsLoading, error: approvalsError, refetch: refetchApprovals } = useQuoteApprovals(quoteId);
  const { evaluate, submit, evaluation, evaluating, submitting, error: submissionError } = useQuoteSubmission(quoteId);
  const { approve, reject, returnForRevision, acting, error: actionError } = useApprovalAction();
  const [reason, setReason] = useState('');
  const [actionErrorMessage, setActionErrorMessage] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [fulfillment, setFulfillment] = useState(null);
  const [shareNotice, setShareNotice] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [negotiationNotice, setNegotiationNotice] = useState('');

  useEffect(() => {
    if (!quoteId) return undefined;
    let active = true;
    Promise.allSettled([listQuoteRecommendations(quoteId), getFulfillmentRecommendation(quoteId)]).then(([recommendationResult, fulfillmentResult]) => {
      if (!active) return;
      if (recommendationResult.status === 'fulfilled') setRecommendations(recommendationResult.value || []);
      if (fulfillmentResult.status === 'fulfilled') setFulfillment(fulfillmentResult.value);
    });
    return () => { active = false; };
  }, [quoteId]);

  if (loading) return <div className="page-status"><p>Loading quotation…</p></div>;
  if (error || !quotation) return <section className="quotation-page"><p className="form-banner">{error || 'Quotation not found.'}</p><Link to="/dashboard" className="btn btn-outline">Back to dashboard</Link></section>;

  const currentApproval = approvals.find((approval) => String(approval.status).toUpperCase() === 'PENDING');
  const canSubmit = quotation.status === 'DRAFT' || quotation.status === 'REVISION_REQUIRED';
  const canEdit = quotation.status === 'DRAFT' || quotation.status === 'REVISION_REQUIRED';

  async function runAction(action) {
    setActionErrorMessage('');
    if (action !== 'approve' && !reason.trim()) {
      setActionErrorMessage('Add a reason for rejecting or returning this quotation.');
      return;
    }
    try {
      if (action === 'approve') await approve(quoteId);
      if (action === 'reject') await reject(quoteId, reason.trim());
      if (action === 'return') await returnForRevision(quoteId, reason.trim());
      setReason('');
      await Promise.all([refetch(), refetchApprovals()]);
    } catch (requestError) {
      setActionErrorMessage(getErrorMessage(requestError));
    }
  }

  async function evaluateAndShow() {
    try {
      await evaluate();
    } catch (requestError) {
      setActionErrorMessage(getErrorMessage(requestError));
    }
  }

  async function submitQuote() {
    try {
      await submit();
      await Promise.all([refetch(), refetchApprovals()]);
    } catch (requestError) {
      setActionErrorMessage(getErrorMessage(requestError));
    }
  }

  async function acceptRecommendation(recommendation) {
    try {
      await acceptQuoteRecommendation(quoteId, {
        source_product_id: recommendation.source_product_id || quotation.lines?.[0]?.product_id,
        suggested_product_id: recommendation.suggested_product_id || recommendation.product_id,
        discount_percent: 0,
      });
      setRecommendations((current) => current.filter((item) => item.product_id !== recommendation.product_id));
      await refetch();
    } catch (requestError) {
      setActionErrorMessage(getErrorMessage(requestError));
    }
  }

  async function prepareFulfillment() {
    try {
      const plan = await createFulfillmentPlan(quoteId);
      setFulfillment(plan);
    } catch (requestError) {
      setActionErrorMessage(getErrorMessage(requestError));
    }
  }

  async function shareDeal() {
    const link = `${window.location.origin}/quotations/${quoteId}`;
    try { await navigator.clipboard.writeText(link); } catch { /* Clipboard can be unavailable in local HTTP. */ }
    setShareNotice(`Customer link ready: ${link}`);
  }

  function submitNegotiation() {
    if (!negotiationMessage.trim()) return;
    setNegotiationNotice('Request saved locally for this demo. Customer negotiation APIs are not available yet.');
    setNegotiationMessage('');
  }

  return (
    <section className="quotation-page">
      <div className="quotation-page-header">
        <div><p className="eyebrow">DealFlow360 / Quotation</p><h1 className="page-title">{quotation.quote_number}</h1><p className="subheading">Review commercial terms, line items, and approval progress in one place.</p></div>
        <div className="quotation-header-actions"><Link to="/dashboard" className="btn btn-outline">Dashboard</Link>{canEdit && <Link to={`/quotations/${quoteId}/edit`} className="btn btn-primary">Edit</Link>}</div>
      </div>

      {submissionError || actionError || actionErrorMessage ? <p className="form-banner">{submissionError || actionError || actionErrorMessage}</p> : null}
      <div className="quotation-summary-grid">
        <div className="quote-summary-card"><span>Status</span><strong className="quote-status">{STATUS_LABELS[quotation.status] || quotation.status}</strong></div>
        <div className="quote-summary-card"><span>Grand total</span><strong>{quotation.currency} {Number(quotation.grand_total || 0).toFixed(2)}</strong></div>
        <div className="quote-summary-card"><span>Gross margin</span><strong>{Number(quotation.gross_margin || 0).toFixed(1)}%</strong></div>
        <div className="quote-summary-card"><span>Risk score</span><strong>{Number(quotation.risk_score || 0).toFixed(1)}%</strong></div>
      </div>

      <div className="quotation-detail-grid">
        <div className="quotation-form-section">
          <h2>Line items</h2>
          <div className="detail-table-wrap"><table className="data-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Total</th></tr></thead><tbody>{quotation.lines?.map((line) => <tr key={line.id}><td>{line.description_snapshot}</td><td>{line.quantity}</td><td>{quotation.currency} {Number(line.unit_price || 0).toFixed(2)}</td><td>{Number(line.discount_percent || 0).toFixed(1)}%</td><td>{quotation.currency} {Number(line.line_total || 0).toFixed(2)}</td></tr>)}</tbody></table></div>
          <div className="quote-totals"><span>Subtotal <strong>{quotation.currency} {Number(quotation.subtotal || 0).toFixed(2)}</strong></span><span>Discount <strong>{quotation.currency} {Number(quotation.discount_total || 0).toFixed(2)}</strong></span><span>Tax <strong>{quotation.currency} {Number(quotation.tax_total || 0).toFixed(2)}</strong></span><span className="quote-total">Grand total <strong>{quotation.currency} {Number(quotation.grand_total || 0).toFixed(2)}</strong></span></div>
        </div>

        <aside className="quotation-form-section approval-panel"><h2>Approval progress</h2>{approvalsLoading ? <p>Loading approval steps…</p> : approvalsError ? <p className="form-banner">{approvalsError}</p> : approvals.length ? <ol className="approval-timeline">{approvals.map((approval) => <li key={approval.id} className={`approval-step approval-${String(approval.status).toLowerCase()}`}><span>{String(approval.approval_level).replace('_', ' ')}</span><strong>{String(approval.status).toLowerCase()}</strong>{approval.reason && <small>{approval.reason}</small>}</li>)}</ol> : <p className="body-copy">Approval steps appear after this quotation is submitted.</p>}</aside>
      </div>

      <div className="quotation-detail-grid sales-rep-tools">
        <section className="quotation-form-section"><div className="section-heading-row"><h2>Deal sharing</h2><button type="button" className="btn btn-primary" onClick={shareDeal}>Generate customer link</button></div>{shareNotice ? <p className="form-banner form-banner-muted">{shareNotice}</p> : <p className="body-copy">Create a customer-facing tracking link when the quotation is ready to share.</p>}</section>
        <section className="quotation-form-section"><h2>Deal tracking</h2>{fulfillment ? <div className="tracking-summary"><strong>{fulfillment.status || fulfillment.plan_status || 'Fulfillment plan available'}</strong><span>{fulfillment.allocations?.length || 0} allocation steps</span></div> : <><p className="body-copy">Fulfillment recommendation is unavailable until the quote is approved.</p>{quotation.status === 'APPROVED' && <button type="button" className="btn btn-outline" onClick={prepareFulfillment}>Prepare fulfillment plan</button>}</>}</section>
      </div>

      <section className="quotation-form-section"><div className="section-heading-row"><h2>Recommended upsell items</h2><span className="text-sm text-gray-500">Backend recommendations</span></div>{recommendations.length ? <div className="recommendation-grid">{recommendations.map((recommendation) => <article className="recommendation-card" key={recommendation.product_id}><strong>{recommendation.product_name}</strong><span>{recommendation.reason}</span><small>Margin {Number(recommendation.new_quote_margin_percent || recommendation.margin_percent || 0).toFixed(1)}%</small><button type="button" className="btn btn-sm btn-outline" onClick={() => acceptRecommendation(recommendation)}>Add to quote</button></article>)}</div> : <p className="body-copy">No upsell recommendations are available for this quotation.</p>}</section>

      <section className="quotation-form-section negotiation-panel"><h2>Customer negotiation</h2><p className="body-copy">Negotiation endpoints are still under development. Capture the next customer request here for the handoff.</p><textarea className="input" rows="3" value={negotiationMessage} onChange={(event) => setNegotiationMessage(event.target.value)} placeholder="Customer requested change" /><button type="button" className="btn btn-outline" onClick={submitNegotiation}>Record change request</button>{negotiationNotice ? <p className="form-banner form-banner-muted">{negotiationNotice}</p> : null}</section>

      {(canSubmit || currentApproval) && <section className="quotation-form-section quotation-actions-panel"><h2>Next action</h2>{canSubmit && <div className="action-row"><button type="button" className="btn btn-outline" onClick={evaluateAndShow} disabled={evaluating}>{evaluating ? 'Evaluating…' : 'Evaluate quote'}</button><button type="button" className="btn btn-primary" onClick={submitQuote} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for approval'}</button></div>}{evaluation && <div className="evaluation-result"><strong>Evaluation: {Number(evaluation.risk_score || 0).toFixed(1)}% risk</strong><span>{evaluation.requires_approval ? `Approval required: ${evaluation.highest_approval_level}` : 'No approval required'}</span>{evaluation.violations?.length ? <ul>{evaluation.violations.map((violation, index) => <li key={index}>{violation.message || violation.rule || JSON.stringify(violation)}</li>)}</ul> : null}</div>}{currentApproval && <div className="approval-actions"><label className="field"><span className="field-label">Reason for rejection or revision</span><textarea className="input" rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for reject and return" /></label><div className="action-row"><button type="button" className="btn btn-primary" onClick={() => runAction('approve')} disabled={acting}>Approve</button><button type="button" className="btn btn-outline" onClick={() => runAction('return')} disabled={acting}>Return for revision</button><button type="button" className="btn btn-danger" onClick={() => runAction('reject')} disabled={acting}>Reject</button></div></div>}</section>}
    </section>
  );
}
