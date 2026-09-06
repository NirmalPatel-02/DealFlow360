import { formatCurrency } from '../../../utils/currency';
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listInvoices, recordPayment } from '../billing.api';
import '../BillingStyles.css';

export default function PaymentPage() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Quick Post Modal
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [postForm, setPostForm] = useState({
    amount: '',
    payment_method: 'BANK_TRANSFER',
    payment_reference: '',
  });

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listInvoices();
      const invList = res.data || [];
      setInvoices(invList);

      // Extract all payments from invoices
      const allPmts = [];
      invList.forEach((inv) => {
        if (inv.payments && Array.isArray(inv.payments)) {
          inv.payments.forEach((p) => {
            allPmts.push({
              ...p,
              invoice_number: inv.invoice_number,
              invoice_id: inv.id,
              customer_id: inv.customer_id,
            });
          });
        }
      });

      // Sort newest first
      allPmts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setPayments(allPmts);
    } catch (err) {
      console.error('Failed to load payments:', err);
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        Number(inv.amount_due) > 0 &&
        inv.status !== 'CANCELLED' &&
        inv.status !== 'VOID'
    );
  }, [invoices]);

  // KPIs
  const metrics = useMemo(() => {
    let totalCollected = 0;
    let bankTotal = 0;
    let cardTotal = 0;
    let upiTotal = 0;

    payments.forEach((p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.status === 'SUCCESS' || !p.status) {
        totalCollected += amt;
        if (p.payment_method === 'BANK_TRANSFER') bankTotal += amt;
        else if (p.payment_method === 'CARD') cardTotal += amt;
        else if (p.payment_method === 'UPI') upiTotal += amt;
      }
    });

    return {
      totalCollected,
      count: payments.length,
      bankTotal,
      cardTotal,
      upiTotal,
    };
  }, [payments]);

  const fmt = (val) => formatCurrency(val);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (p.payment_reference && p.payment_reference.toLowerCase().includes(q)) ||
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q));

      const matchMethod = methodFilter === 'ALL' || p.payment_method === methodFilter;

      return matchQuery && matchMethod;
    });
  }, [payments, searchQuery, methodFilter]);

  const handleInvoiceSelect = (invId) => {
    setSelectedInvoiceId(invId);
    const target = openInvoices.find((i) => i.id === invId);
    if (target) {
      const due = Number(target.amount_due) || 0;
      setPostForm((prev) => ({
        ...prev,
        amount: due > 0 ? due.toFixed(2) : '',
        payment_reference: `PAY-${Date.now().toString().slice(-6)}`,
      }));
    }
  };

  const handlePostPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceId) return;
    try {
      await recordPayment(selectedInvoiceId, {
        amount: parseFloat(postForm.amount),
        payment_method: postForm.payment_method,
        payment_reference: postForm.payment_reference.trim(),
      });
      showToast('Payment successfully posted');
      setPostModalOpen(false);
      setSelectedInvoiceId('');
      setPostForm({
        amount: '',
        payment_method: 'BANK_TRANSFER',
        payment_reference: '',
      });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || 'Payment processing failed', 'error');
    }
  };

  return (
    <div className="billing-workspace">
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h1>Payment & Cash Settlement Ledger</h1>
          <p>Real-time audit trail of all customer receivables, wire transfers, and gateway settlements</p>
        </div>
        <div className="header-actions">
          <Link to="/billing" className="btn btn-secondary">
            <Icon name="arrow-left" size={14} style={{ marginRight: '6px' }} /> Billing Hub
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setPostModalOpen(true)}
            disabled={openInvoices.length === 0}
          >
            <Icon name="credit-card" size={15} style={{ marginRight: '6px' }} /> Post Direct Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="billing-kpi-grid">
        <div className="billing-kpi-card">
          <div className="kpi-icon-box emerald"><Icon name="cash" size={22} color="#10b981" /></div>
          <div className="kpi-content">
            <span className="kpi-label">Total Collections</span>
            <span className="kpi-value">{fmt(metrics.totalCollected)}</span>
          </div>
        </div>

        <div className="billing-kpi-card">
          <div className="kpi-icon-box indigo"><Icon name="document" size={22} color="#6366f1" /></div>
          <div className="kpi-content">
            <span className="kpi-label">Transactions Settled</span>
            <span className="kpi-value">{metrics.count}</span>
          </div>
        </div>

        <div className="billing-kpi-card">
          <div className="kpi-icon-box cyan"><Icon name="bank" size={22} color="#06b6d4" /></div>
          <div className="kpi-content">
            <span className="kpi-label">Bank Wire / RTGS</span>
            <span className="kpi-value">{fmt(metrics.bankTotal)}</span>
          </div>
        </div>

        <div className="billing-kpi-card">
          <div className="kpi-icon-box amber"><Icon name="zap" size={22} color="#f59e0b" /></div>
          <div className="kpi-content">
            <span className="kpi-label">UPI / Instant</span>
            <span className="kpi-value">{fmt(metrics.upiTotal)}</span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="billing-table-card">
        <div className="table-toolbar">
          <div className="toolbar-filters">
            <input
              type="text"
              placeholder="Search reference # or invoice #..."
              className="table-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '280px' }}
            />

            <select
              className="table-select"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="ALL">All Payment Methods</option>
              <option value="BANK_TRANSFER">Bank Wire</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Showing {filteredPayments.length} of {payments.length} transactions
          </div>
        </div>

        {loading ? (
          <div className="empty-state-box">
            <div className="empty-state-icon"><Icon name="clock" size={32} color="#64748b" /></div>
            <p>Loading transaction history...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon"><Icon name="credit-card" size={32} color="#64748b" /></div>
            <h3>No Transactions Recorded</h3>
            <p>Post a payment against any open invoice to begin reconciliation</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="billing-data-table">
              <thead>
                <tr>
                  <th>Reference #</th>
                  <th>Invoice Reference</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id || p.payment_reference}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#818cf8' }}>
                      {p.payment_reference}
                    </td>
                    <td>
                      <Link
                        to={`/invoices/${p.invoice_id}`}
                        style={{ color: '#cbd5e1', textDecoration: 'none' }}
                      >
                        {p.invoice_number || 'View Invoice'}
                      </Link>
                    </td>
                    <td>
                      <span className="payment-method-chip">
                        {p.payment_method ? p.payment_method.replace('_', ' ') : '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#34d399' }}>{fmt(p.amount)}</td>
                    <td>
                      <span
                        className={`billing-status-pill ${
                          p.status === 'SUCCESS' ? 'badge-paid' : 'badge-draft'
                        }`}
                      >
                        {p.status || 'SUCCESS'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleString()
                        : p.created_at
                        ? new Date(p.created_at).toLocaleString()
                        : '—'}
                    </td>
                    <td>
                      <Link
                        to={`/invoices/${p.invoice_id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        View Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Post Direct Payment Modal */}
      {postModalOpen && (
        <div className="billing-modal-backdrop">
          <div className="billing-modal-box">
            <div className="modal-header">
              <h2><Icon name="credit-card" size={20} style={{ marginRight: '8px' }} /> Post Payment Terminal</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPostModalOpen(false)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handlePostPayment}>
              <div className="modal-body">
                <div className="billing-form-group">
                  <label>Select Outstanding Invoice *</label>
                  <select
                    className="billing-select"
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                    required
                  >
                    <option value="">-- Select Invoice --</option>
                    {openInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} (Due: {fmt(inv.amount_due)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="billing-form-group">
                  <label>Payment Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="billing-input"
                    value={postForm.amount}
                    onChange={(e) => setPostForm({ ...postForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="billing-form-group">
                  <label>Payment Method *</label>
                  <select
                    className="billing-select"
                    value={postForm.payment_method}
                    onChange={(e) =>
                      setPostForm({ ...postForm, payment_method: e.target.value })
                    }
                    required
                  >
                    <option value="BANK_TRANSFER">Bank Wire / NEFT / RTGS</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="UPI">UPI (Unified Payments Interface)</option>
                    <option value="CASH">Cash Deposit</option>
                    <option value="OTHER">Other / Cheque</option>
                  </select>
                </div>

                <div className="billing-form-group">
                  <label>Reference / UTR Number *</label>
                  <input
                    type="text"
                    className="billing-input"
                    placeholder="e.g. UTR-9823419082"
                    value={postForm.payment_reference}
                    onChange={(e) =>
                      setPostForm({ ...postForm, payment_reference: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPostModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedInvoiceId || !postForm.amount}
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`billing-toast ${toast.type}`}>
          <span>
            {toast.type === 'success' ? (
              <Icon name="check-circle" size={18} color="#10b981" />
            ) : (
              <Icon name="alert-triangle" size={18} color="#f59e0b" />
            )}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
