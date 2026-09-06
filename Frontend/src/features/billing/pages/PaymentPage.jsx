import { formatCurrency } from '../../../utils/currency';
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listInvoices } from '../billing.api';
import '../BillingStyles.css';

export default function PaymentPage() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');

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

    </div>
  );
}
