import { formatCurrency } from '../../../utils/currency';
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getPortalQuote,
  getPortalNegotiations,
  createPortalNegotiation,
  confirmPortalQuote,
} from '../portal.api';
import PortalLineItem from '../components/PortalLineItem';
import NegotiationThread from '../components/NegotiationThread';
import NegotiationRequestModal from '../components/NegotiationRequestModal';
import QuoteAcceptanceModal from '../components/QuoteAcceptanceModal';
import Icon from '../../../components/ui/Icon';
import '../PortalStyles.css';

export default function CustomerPortalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlToken = searchParams.get('token');

  const [portalToken, setPortalToken] = useState(() => {
    return urlToken || sessionStorage.getItem('dealflow_portal_token') || '';
  });

  const [manualTokenInput, setManualTokenInput] = useState('');
  const [quote, setQuote] = useState(null);
  const [negotiations, setNegotiations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Modals
  const [negotiateModalOpen, setNegotiateModalOpen] = useState(false);
  const [negotiateLineId, setNegotiateLineId] = useState(null);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Sync token from URL to state & sessionStorage
  useEffect(() => {
    if (urlToken && urlToken !== portalToken) {
      setPortalToken(urlToken);
      sessionStorage.setItem('dealflow_portal_token', urlToken);
    }
  }, [urlToken]);

  const loadPortalData = useCallback(async (tokenToUse) => {
    const token = tokenToUse || portalToken;
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const [quoteRes, negRes] = await Promise.all([
        getPortalQuote(token),
        getPortalNegotiations(token).catch(() => []),
      ]);

      setQuote(quoteRes);
      setNegotiations(negRes || []);
      sessionStorage.setItem('dealflow_portal_token', token);
    } catch (err) {
      console.error('Portal load failed:', err);
      setError(
        err.message ||
          'Your portal access token is invalid or has expired. Please request a new link.'
      );
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [portalToken]);

  useEffect(() => {
    if (portalToken) {
      loadPortalData(portalToken);
    }
  }, [portalToken, loadPortalData]);

  const handleManualTokenSubmit = (e) => {
    e.preventDefault();
    if (!manualTokenInput.trim()) return;
    const cleanToken = manualTokenInput.trim();
    setPortalToken(cleanToken);
    setSearchParams({ token: cleanToken });
  };

  const handleOpenNegotiate = (line = null) => {
    setNegotiateLineId(line ? line.id : null);
    setNegotiateModalOpen(true);
  };

  const handleSendNegotiation = async (payload) => {
    await createPortalNegotiation(portalToken, payload);
    showToast('Counter-offer proposal submitted to your sales account executive.');
    loadPortalData();
  };

  const handleExecuteConfirmation = async () => {
    const res = await confirmPortalQuote(portalToken);
    showToast(res.message || 'Quotation accepted and confirmed successfully!');
    loadPortalData();
  };

  const fmt = (val) => formatCurrency(val, quote?.currency);

  // If no token or invalid session
  if (!portalToken && !quote) {
    return (
      <div className="portal-container">
        <header className="portal-topbar">
          <div className="portal-brand-group">
            <span className="portal-brand">DealFlow360</span>
            <span className="portal-tag">Customer Access</span>
          </div>
          <div className="secure-badge">
            <Icon name="shield" size={14} style={{ marginRight: '4px' }} />
            256-Bit SSL Encrypted
          </div>
        </header>

        <main className="portal-main">
          <div
            className="portal-section-card"
            style={{ maxWidth: '520px', margin: '4rem auto', textAlign: 'center' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem', color: '#a44a3f' }}>
              <Icon name="lock" size={48} />
            </div>
            <h2 style={{ color: '#3f2525', marginBottom: '0.5rem' }}>Customer Portal Authentication</h2>
            <p style={{ color: '#6c757d', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
              Please enter your secure access token from your quotation invitation email to view
              commercial terms, submit negotiations, or confirm your order.
            </p>

            <form onSubmit={handleManualTokenSubmit}>
              <div className="portal-form-group" style={{ marginBottom: '1.25rem' }}>
                <input
                  type="text"
                  className="portal-input"
                  placeholder="Paste your 64-character token here..."
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  style={{ textAlign: 'center', fontFamily: 'monospace' }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-portal-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Access Quotation Agreement
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const isConfirmed = quote?.status === 'confirmed' || quote?.status === 'CONFIRMED';
  const isUnderNegotiation =
    quote?.status === 'under_negotiation' || quote?.status === 'UNDER_NEGOTIATION';
  const canNegotiateOrConfirm = !isConfirmed;

  return (
    <div className="portal-container">
      {/* Top Header */}
      <header className="portal-topbar">
        <div className="portal-brand-group">
          <span className="portal-brand">DealFlow360</span>
          <span className="portal-tag">Client Collaboration Portal</span>
        </div>

        <div className="portal-topbar-meta">
          <div className="secure-badge">
            <Icon name="shield" size={14} style={{ marginRight: '4px' }} />
            Secure Customer Session
          </div>
          <button
            type="button"
            className="btn btn-portal-secondary btn-sm"
            onClick={() => {
              sessionStorage.removeItem('dealflow_portal_token');
              setPortalToken('');
              setQuote(null);
            }}
          >
            Exit Portal
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="portal-main">
        {loading && !quote ? (
          <div className="portal-section-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: '#a44a3f' }}>
              <Icon name="clock" size={36} />
            </div>
            <h3>Loading Your Commercial Agreement...</h3>
            <p style={{ color: '#6c757d' }}>Verifying authenticated session credentials</p>
          </div>
        ) : error ? (
          <div className="portal-section-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: '#f87171' }}>
              <Icon name="alert-triangle" size={36} />
            </div>
            <h3 style={{ color: '#a33f3f' }}>Access Restricted</h3>
            <p style={{ color: '#6c757d', maxWidth: '480px', margin: '0.5rem auto 1.5rem auto' }}>
              {error}
            </p>
            <button
              type="button"
              className="btn btn-portal-primary"
              onClick={() => {
                sessionStorage.removeItem('dealflow_portal_token');
                setPortalToken('');
                setQuote(null);
              }}
            >
              Enter New Access Token
            </button>
          </div>
        ) : quote ? (
          <>
            {/* Success Banner if Confirmed */}
            {isConfirmed && (
              <div className="portal-success-banner">
                <div className="success-banner-icon" style={{ color: '#287a55' }}>
                  <Icon name="check-circle" size={32} />
                </div>
                <div className="success-banner-content">
                  <h3>Commercial Agreement Confirmed</h3>
                  <p>
                    Quotation <strong>{quote.quote_number}</strong> has been officially confirmed by your
                    organization. Our operations team is currently preparing order fulfillment and billing.
                  </p>
                </div>
              </div>
            )}

            {/* Quotation Hero Banner */}
            <div className="portal-quote-hero">
              <div className="hero-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span
                    className={`portal-badge ${
                      isConfirmed
                        ? 'badge-confirmed'
                        : isUnderNegotiation
                        ? 'badge-negotiation'
                        : 'badge-sent'
                    }`}
                  >
                    {isConfirmed ? (
                      <>
                        <Icon name="check-circle" size={13} style={{ marginRight: '4px' }} />
                        CONFIRMED & BINDING
                      </>
                    ) : isUnderNegotiation ? (
                      <>
                        <Icon name="message" size={13} style={{ marginRight: '4px' }} />
                        UNDER NEGOTIATION
                      </>
                    ) : (
                      <>
                        <Icon name="document" size={13} style={{ marginRight: '4px' }} />
                        READY FOR REVIEW
                      </>
                    )}
                  </span>
                  {quote.valid_until && (
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Valid Until: {new Date(quote.valid_until).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <h1>{quote.quote_number}</h1>

                <div className="hero-meta-row">
                  <span>
                    Scope: <strong>{quote.lines?.length || 0} Line Items</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Currency: <strong>{quote.currency || 'INR'}</strong>
                  </span>
                </div>
              </div>

              <div className="hero-right">
                  <span style={{ fontSize: '0.8rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Net Agreement Total
                </span>
                <div className="hero-grand-total">{fmt(quote.grand_total)}</div>

                <div className="hero-actions-row">
                  <button
                    type="button"
                    className="btn btn-portal-secondary"
                    onClick={() => window.print()}
                  >
                    <Icon name="printer" size={15} style={{ marginRight: '6px' }} />
                    Print Agreement
                  </button>

                  {canNegotiateOrConfirm && (
                    <>
                      <button
                        type="button"
                        className="btn btn-portal-secondary"
                        onClick={() => handleOpenNegotiate(null)}
                      >
                        <Icon name="message" size={15} style={{ marginRight: '6px' }} />
                        Propose Terms
                      </button>

                      <button
                        type="button"
                        className="btn btn-portal-success"
                        onClick={() => setAcceptModalOpen(true)}
                      >
                        <Icon name="check" size={16} style={{ marginRight: '6px' }} />
                        Accept & Confirm
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Commercial Line Items */}
            <div className="portal-section-card">
              <h2 className="section-title">
                <Icon name="package" size={20} style={{ marginRight: '8px' }} />
                Commercial Scope & Itemized Deliverables
              </h2>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th className="line-num-cell">#</th>
                      <th>Product & Service Specification</th>
                      <th className="num-cell">Qty</th>
                      <th className="num-cell">Unit Price</th>
                      <th className="num-cell">Discount</th>
                      <th className="num-cell">Line Total</th>
                      {canNegotiateOrConfirm && <th className="actions-cell">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(quote.lines || []).map((line) => (
                      <PortalLineItem
                        key={line.id}
                        line={line}
                        currency={quote.currency}
                        onNegotiateLine={handleOpenNegotiate}
                        canNegotiate={canNegotiateOrConfirm}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Grid: Breakdown + Negotiation History */}
            <div className="portal-bottom-grid">
              {/* Financial Ledger Breakdown */}
              <div className="portal-breakdown-card">
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center' }}>
                  <Icon name="chart" size={18} style={{ marginRight: '8px' }} />
                  Financial Ledger & Tax Summary
                </h3>

                <div className="breakdown-line">
                  <span>Gross Subtotal:</span>
                  <span>{fmt(quote.subtotal)}</span>
                </div>

                {Number(quote.discount_total) > 0 && (
                  <div className="breakdown-line savings">
                    <span>Applied Commercial Savings:</span>
                    <span>- {fmt(quote.discount_total)}</span>
                  </div>
                )}

                <div className="breakdown-line taxes">
                  <span>Applicable GST / Taxes:</span>
                  <span>+ {fmt(quote.tax_total)}</span>
                </div>

                <div className="breakdown-separator" />

                <div className="breakdown-line total-line">
                  <span>Total Payable:</span>
                  <span className="grand-total-val">{fmt(quote.grand_total)}</span>
                </div>

                  <p style={{ margin: '1.25rem 0 0 0', fontSize: '0.8rem', color: '#6c757d', lineHeight: 1.5 }}>
                  * All pricing is subject to the agreed delivery schedule and milestone terms. Applicable
                  taxes are calculated based on registered tax jurisdictions.
                </p>
              </div>

              {/* Negotiation Dialogue Thread */}
              <div className="portal-section-card" style={{ margin: 0 }}>
                <NegotiationThread
                  negotiations={negotiations}
                  quoteLines={quote.lines || []}
                />
              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* MODAL 1: Counter-Offer / Negotiation Modal */}
      <NegotiationRequestModal
        isOpen={negotiateModalOpen}
        onClose={() => setNegotiateModalOpen(false)}
        onSubmit={handleSendNegotiation}
        quoteLines={quote?.lines || []}
        initialLineId={negotiateLineId}
        currency={quote?.currency || 'INR'}
      />

      {/* MODAL 2: Confirmation Modal */}
      <QuoteAcceptanceModal
        isOpen={acceptModalOpen}
        onClose={() => setAcceptModalOpen(false)}
        onConfirm={handleExecuteConfirmation}
        quote={quote}
      />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: '#ffffff',
            border: '1px solid #d8dce0',
            borderLeft: `4px solid ${toast.type === 'error' ? '#a33f3f' : '#287a55'}`,
            borderRadius: '10px',
            padding: '1rem 1.5rem',
            color: '#3f2525',
            boxShadow: '0 10px 25px rgba(63, 37, 37, 0.16)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon name={toast.type === 'error' ? 'alert-triangle' : 'check-circle'} size={18} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
