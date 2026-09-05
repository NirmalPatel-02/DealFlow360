import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listInvoices,
  cancelInvoice,
  recordPayment,
  listOrders,
  createOrderFromQuote,
  createInvoice,
  listSubscriptions,
  generateRecurringInvoice,
  cancelSubscription,
  listSubscriptionPlans,
  createSubscriptionPlan,
} from '../billing.api';
import PaymentStatus from '../components/PaymentStatus';
import '../BillingStyles.css';

export default function InvoiceListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'invoices';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'BANK_TRANSFER',
    payment_reference: '',
  });

  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [quoteIdInput, setQuoteIdInput] = useState('');

  const [createInvoiceModalOpen, setCreateInvoiceModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    interval: 'MONTHLY',
    price: '',
    currency: 'INR',
    proration_enabled: true,
    cancellation_policy: 'IMMEDIATE',
    refund_policy: 'NONE',
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [invRes, ordRes, subRes, planRes] = await Promise.all([
        listInvoices().catch(() => ({ data: [] })),
        listOrders().catch(() => ({ data: [] })),
        listSubscriptions().catch(() => ({ data: [] })),
        listSubscriptionPlans().catch(() => ({ data: [] })),
      ]);

      setInvoices(invRes.data || []);
      setOrders(ordRes.data || []);
      setSubscriptions(subRes.data || []);
      setPlans(planRes.data || []);
    } catch (err) {
      console.error('Failed to load billing data:', err);
      setError(err.message || 'Failed to load billing records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  // KPIs
  const kpiData = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let overdueCount = 0;

    const now = new Date();
    invoices.forEach((inv) => {
      const invTotal = parseFloat(inv.total_amount) || 0;
      const invPaid = parseFloat(inv.amount_paid) || 0;
      const invDue = parseFloat(inv.amount_due) || 0;

      if (inv.status !== 'CANCELLED' && inv.status !== 'VOID') {
        totalInvoiced += invTotal;
        totalPaid += invPaid;
        totalDue += invDue;

        if (inv.status !== 'PAID' && inv.due_date && new Date(inv.due_date) < now) {
          overdueCount += 1;
        }
      }
    });

    const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE').length;

    return {
      totalInvoiced,
      totalPaid,
      totalDue,
      overdueCount,
      activeSubs,
    };
  }, [invoices, subscriptions]);

  const fmt = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(val) || 0);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.order_id && inv.order_id.toLowerCase().includes(q)) ||
        (inv.customer_id && inv.customer_id.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'OVERDUE'
          ? inv.status !== 'PAID' && inv.due_date && new Date(inv.due_date) < new Date()
          : inv.status === statusFilter);

      const matchType = typeFilter === 'ALL' || inv.invoice_type === typeFilter;

      return matchQuery && matchStatus && matchType;
    });
  }, [invoices, searchQuery, statusFilter, typeFilter]);

  // Payment Modal Handlers
  const handleOpenPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    const due = Number(invoice.amount_due) || 0;
    setPaymentForm({
      amount: due > 0 ? due.toFixed(2) : '',
      payment_method: 'BANK_TRANSFER',
      payment_reference: `PAY-${Date.now().toString().slice(-6)}`,
    });
    setPaymentModalOpen(true);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      const payload = {
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        payment_reference: paymentForm.payment_reference.trim(),
      };
      await recordPayment(selectedInvoice.id, payload);
      showToast(`Payment recorded for Invoice ${selectedInvoice.invoice_number}`);
      setPaymentModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Payment processing error');
    }
  };

  // Cancel Invoice
  const handleCancelInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to cancel and void this invoice?')) return;
    try {
      await cancelInvoice(invoiceId);
      showToast('Invoice cancelled successfully');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to cancel invoice');
    }
  };

  // Convert Quote to Order
  const handleConvertQuote = async (e) => {
    e.preventDefault();
    if (!quoteIdInput.trim()) return;
    try {
      const res = await createOrderFromQuote(quoteIdInput.trim());
      showToast(`Order created successfully: ${res.data?.orderNumber || ''}`);
      setConvertModalOpen(false);
      setQuoteIdInput('');
      loadData();
      setActiveTab('orders');
    } catch (err) {
      alert(err.message || 'Failed to convert quotation to order');
    }
  };

  // Create One-Time Invoice for Order
  const handleCreateOrderInvoice = async (orderId) => {
    try {
      const res = await createInvoice(orderId);
      showToast(`Invoice ${res.data?.invoice_number || ''} generated successfully`);
      setCreateInvoiceModalOpen(false);
      loadData();
      setActiveTab('invoices');
    } catch (err) {
      alert(err.message || 'Failed to generate invoice for order');
    }
  };

  // Generate Recurring Invoice for Subscription
  const handleGenerateSubscriptionInvoice = async (subId) => {
    try {
      const res = await generateRecurringInvoice(subId);
      showToast(`Cycle invoice ${res.data?.invoice_number || ''} generated`);
      loadData();
      setActiveTab('invoices');
    } catch (err) {
      alert(err.message || 'Failed to generate recurring invoice');
    }
  };

  // Cancel Subscription
  const handleCancelSubscription = async (subId) => {
    const reason = window.prompt('Enter reason for cancellation:', 'Customer requested');
    if (reason === null) return;
    try {
      await cancelSubscription(subId, reason);
      showToast('Subscription cancelled');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to cancel subscription');
    }
  };

  // Create Subscription Plan
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    try {
      await createSubscriptionPlan({
        name: planForm.name,
        interval: planForm.interval,
        price: parseFloat(planForm.price),
        currency: planForm.currency,
        proration_enabled: planForm.proration_enabled,
        cancellation_policy: planForm.cancellation_policy,
        refund_policy: planForm.refund_policy,
      });
      showToast(`Plan ${planForm.name} created`);
      setPlanModalOpen(false);
      setPlanForm({
        name: '',
        interval: 'MONTHLY',
        price: '',
        currency: 'INR',
        proration_enabled: true,
        cancellation_policy: 'IMMEDIATE',
        refund_policy: 'NONE',
      });
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to create subscription plan');
    }
  };

  return (
    <div className="billing-workspace">
      {/* Page Header */}
      <div className="workspace-header">
        <div>
          <h1>Billing, Invoicing & Receivables</h1>
          <p>Commercial order conversion, invoice generation, payment reconciliation & subscription lifecycle</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setConvertModalOpen(true)}
          >
            📋 Convert Approved Quote
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateInvoiceModalOpen(true)}
          >
            ⚡ Generate Invoice
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPlanModalOpen(true)}
          >
            ➕ New Subscription Plan
          </button>
        </div>
      </div>

      {/* KPI Banner */}
      <div className="billing-kpi-grid">
        <div className="billing-kpi-card">
          <div className="kpi-icon-box indigo">📄</div>
          <div className="kpi-content">
            <span className="kpi-label">Total Invoiced</span>
            <span className="kpi-value">{fmt(kpiData.totalInvoiced)}</span>
          </div>
        </div>

        <div className="billing-kpi-card">
          <div className="kpi-icon-box emerald">💰</div>
          <div className="kpi-content">
            <span className="kpi-label">Collected / Settled</span>
            <span className="kpi-value">{fmt(kpiData.totalPaid)}</span>
          </div>
        </div>

        <div className="billing-kpi-card">
          <div className="kpi-icon-box amber">⏳</div>
          <div className="kpi-content">
            <span className="kpi-label">Receivables Outstanding</span>
            <span className="kpi-value">{fmt(kpiData.totalDue)}</span>
          </div>
        </div>

        <div className="billing-kpi-card">
          <div className="kpi-icon-box rose">🚨</div>
          <div className="kpi-content">
            <span className="kpi-label">Overdue Invoices</span>
            <span className="kpi-value">{kpiData.overdueCount}</span>
          </div>
        </div>

        <div className="billing-kpi-card">
          <div className="kpi-icon-box cyan">🔄</div>
          <div className="kpi-content">
            <span className="kpi-label">Active Subscriptions</span>
            <span className="kpi-value">{kpiData.activeSubs}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="billing-tabs-nav">
        <button
          type="button"
          className={`billing-tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          📄 Invoices & Receivables
          <span className="tab-badge-count">{invoices.length}</span>
        </button>

        <button
          type="button"
          className={`billing-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => handleTabChange('orders')}
        >
          📦 Commercial Orders
          <span className="tab-badge-count">{orders.length}</span>
        </button>

        <button
          type="button"
          className={`billing-tab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => handleTabChange('subscriptions')}
        >
          🔄 Subscriptions & Recurring
          <span className="tab-badge-count">{subscriptions.length}</span>
        </button>

        <button
          type="button"
          className={`billing-tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => handleTabChange('plans')}
        >
          📑 Subscription Plans
          <span className="tab-badge-count">{plans.length}</span>
        </button>
      </div>

      {/* TAB 1: Invoices & Receivables */}
      {activeTab === 'invoices' && (
        <div className="billing-table-card">
          <div className="table-toolbar">
            <div className="toolbar-filters">
              <input
                type="text"
                placeholder="Search by invoice #, order ID, customer..."
                className="table-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '280px' }}
              />

              <select
                className="table-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ISSUED">Issued</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid / Settled</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                className="table-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="ONE_TIME">One-Time Capex</option>
                <option value="RECURRING">Recurring Cycle</option>
              </select>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </div>
          </div>

          {loading ? (
            <div className="empty-state-box">
              <div className="empty-state-icon">⏳</div>
              <p>Loading invoice records...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon">📄</div>
              <h3>No Invoices Found</h3>
              <p>Generate an invoice from a confirmed order or recurring subscription</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="billing-data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Type</th>
                    <th>Issued Date</th>
                    <th>Due Date</th>
                    <th>Total Amount</th>
                    <th>Amount Paid</th>
                    <th>Outstanding Due</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const isOverdue =
                      inv.status !== 'PAID' &&
                      inv.status !== 'CANCELLED' &&
                      inv.due_date &&
                      new Date(inv.due_date) < new Date();

                    return (
                      <tr key={inv.id}>
                        <td>
                          <Link
                            to={`/invoices/${inv.id}`}
                            style={{
                              color: '#818cf8',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                              textDecoration: 'none',
                            }}
                          >
                            {inv.invoice_number}
                          </Link>
                          {inv.order_id && (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              Ord: {inv.order_id.slice(0, 8)}...
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: inv.invoice_type === 'RECURRING' ? '#38bdf8' : '#cbd5e1',
                            }}
                          >
                            {inv.invoice_type === 'RECURRING' ? '🔄 Recurring' : '⚡ One-Time'}
                          </span>
                        </td>
                        <td>
                          {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {inv.due_date ? (
                            <span style={{ color: isOverdue ? '#f87171' : 'inherit' }}>
                              {new Date(inv.due_date).toLocaleDateString()}
                              {isOverdue && (
                                <span className="overdue-warning-tag">OVERDUE</span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmt(inv.total_amount)}</td>
                        <td style={{ color: '#34d399' }}>{fmt(inv.amount_paid)}</td>
                        <td
                          style={{
                            fontWeight: 600,
                            color: Number(inv.amount_due) > 0 ? '#f87171' : '#34d399',
                          }}
                        >
                          {fmt(inv.amount_due)}
                        </td>
                        <td>
                          <PaymentStatus
                            status={isOverdue ? 'OVERDUE' : inv.status}
                            amountPaid={inv.amount_paid}
                            totalAmount={inv.total_amount}
                            currency={inv.currency}
                          />
                        </td>
                        <td>
                          <div className="action-buttons-cell">
                            <Link
                              to={`/invoices/${inv.id}`}
                              className="btn btn-secondary btn-sm"
                            >
                              View
                            </Link>

                            {Number(inv.amount_due) > 0 &&
                              inv.status !== 'CANCELLED' &&
                              inv.status !== 'VOID' && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleOpenPaymentModal(inv)}
                                >
                                  💳 Pay
                                </button>
                              )}

                            {['DRAFT', 'ISSUED'].includes(inv.status) && (
                              <button
                                type="button"
                                className="btn btn-danger-ghost btn-sm"
                                onClick={() => handleCancelInvoice(inv.id)}
                              >
                                Void
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
        </div>
      )}

      {/* TAB 2: Commercial Orders */}
      {activeTab === 'orders' && (
        <div className="billing-table-card">
          <div className="table-toolbar">
            <div style={{ fontWeight: 600, color: '#f8fafc' }}>
              All Commercial Orders ({orders.length})
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setConvertModalOpen(true)}
            >
              📋 Convert Quote to Order
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon">📦</div>
              <h3>No Commercial Orders</h3>
              <p>Convert an approved quotation to create an order</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="billing-data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Quotation Ref</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Total Value</th>
                    <th>Confirmed At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => (
                    <tr key={ord.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#818cf8' }}>
                        {ord.order_number}
                      </td>
                      <td>
                        {ord.quotation_id ? (
                          <Link
                            to={`/quotations/${ord.quotation_id}`}
                            style={{ color: '#cbd5e1', fontSize: '0.85rem' }}
                          >
                            Quote: {ord.quotation_id.slice(0, 8)}...
                          </Link>
                        ) : (
                          'Manual Order'
                        )}
                      </td>
                      <td>
                        <span className="billing-status-pill badge-paid">{ord.status}</span>
                      </td>
                      <td>{ord.items ? ord.items.length : '—'} line items</td>
                      <td style={{ fontWeight: 600 }}>{fmt(ord.total_amount)}</td>
                      <td>
                        {ord.confirmed_at
                          ? new Date(ord.confirmed_at).toLocaleDateString()
                          : ord.created_at
                          ? new Date(ord.created_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <div className="action-buttons-cell">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleCreateOrderInvoice(ord.id)}
                          >
                            ⚡ Generate Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Subscriptions & Recurring Billing */}
      {activeTab === 'subscriptions' && (
        <div className="billing-table-card">
          <div className="table-toolbar">
            <div style={{ fontWeight: 600, color: '#f8fafc' }}>
              Recurring Subscriptions ({subscriptions.length})
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleTabChange('plans')}
            >
              Manage Plans
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon">🔄</div>
              <h3>No Active Subscriptions</h3>
              <p>Subscriptions are automatically spun up from recurring order lines</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="billing-data-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Rate</th>
                    <th>Current Period</th>
                    <th>Next Billing Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                        {sub.plan ? sub.plan.name : 'Custom Subscription'}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Cycle: {sub.plan?.interval || 'MONTHLY'}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {sub.customer_id ? `${sub.customer_id.slice(0, 8)}...` : '—'}
                      </td>
                      <td>
                        <span
                          className={`billing-status-pill ${
                            sub.status === 'ACTIVE' ? 'badge-paid' : 'badge-cancelled'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(sub.unit_price)}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {sub.current_period_start} → {sub.current_period_end}
                      </td>
                      <td style={{ fontWeight: 600, color: '#818cf8' }}>
                        {sub.next_billing_date || '—'}
                      </td>
                      <td>
                        <div className="action-buttons-cell">
                          {sub.status === 'ACTIVE' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleGenerateSubscriptionInvoice(sub.id)}
                                title="Generate invoice for next billing cycle"
                              >
                                ⚡ Bill Cycle
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger-ghost btn-sm"
                                onClick={() => handleCancelSubscription(sub.id)}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Subscription Plans */}
      {activeTab === 'plans' && (
        <div className="billing-table-card">
          <div className="table-toolbar">
            <div style={{ fontWeight: 600, color: '#f8fafc' }}>
              Subscription Plans Catalog ({plans.length})
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setPlanModalOpen(true)}
            >
              ➕ Create Plan
            </button>
          </div>

          {plans.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon">📑</div>
              <h3>No Plans Configured</h3>
              <p>Create subscription plans for recurring SaaS, maintenance, or SLAs</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="billing-data-table">
                <thead>
                  <tr>
                    <th>Plan Name</th>
                    <th>Interval</th>
                    <th>Price</th>
                    <th>Proration</th>
                    <th>Cancellation Policy</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: '#f8fafc' }}>{p.name}</td>
                      <td>
                        <span className="schedule-pill schedule-invoiced">{p.interval}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#34d399' }}>{fmt(p.price)}</td>
                      <td>{p.proration_enabled ? '✅ Prorated' : '❌ No Proration'}</td>
                      <td>{p.cancellation_policy}</td>
                      <td>
                        <span className="billing-status-pill badge-paid">
                          {p.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Record Payment */}
      {paymentModalOpen && selectedInvoice && (
        <div className="billing-modal-backdrop">
          <div className="billing-modal-box">
            <div className="modal-header">
              <h2>💳 Record Payment</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPaymentModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitPayment}>
              <div className="modal-body">
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <strong>Invoice:</strong> {selectedInvoice.invoice_number}
                  </div>
                  <div>
                    <strong>Total Amount:</strong> {fmt(selectedInvoice.total_amount)}
                  </div>
                  <div>
                    <strong>Already Paid:</strong> {fmt(selectedInvoice.amount_paid)}
                  </div>
                  <div style={{ color: '#f87171', fontWeight: 600 }}>
                    <strong>Balance Due:</strong> {fmt(selectedInvoice.amount_due)}
                  </div>
                </div>

                <div className="billing-form-group">
                  <label>Amount to Collect ({selectedInvoice.currency || 'INR'}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedInvoice.amount_due}
                    className="billing-input"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="billing-form-group">
                  <label>Payment Method *</label>
                  <select
                    className="billing-select"
                    value={paymentForm.payment_method}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, payment_method: e.target.value })
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
                  <label>Payment Reference / UTR Number *</label>
                  <input
                    type="text"
                    className="billing-input"
                    placeholder="e.g. UTR-9823419082 or TXN-4928"
                    value={paymentForm.payment_reference}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_reference: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Convert Quote to Order */}
      {convertModalOpen && (
        <div className="billing-modal-backdrop">
          <div className="billing-modal-box">
            <div className="modal-header">
              <h2>📋 Convert Approved Quotation to Order</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setConvertModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConvertQuote}>
              <div className="modal-body">
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                  Enter an approved quotation ID. The billing engine will automatically convert all
                  commercial items, map recurring lines to subscription tiers, and create the order.
                </p>

                <div className="billing-form-group">
                  <label>Quotation ID *</label>
                  <input
                    type="text"
                    className="billing-input"
                    placeholder="e.g. 7c234a9b-..."
                    value={quoteIdInput}
                    onChange={(e) => setQuoteIdInput(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConvertModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Convert & Confirm Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Generate One-Time Invoice for Order */}
      {createInvoiceModalOpen && (
        <div className="billing-modal-backdrop">
          <div className="billing-modal-box">
            <div className="modal-header">
              <h2>⚡ Generate One-Time Invoice</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCreateInvoiceModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                Select an existing commercial order to generate a formal invoice with tax & discount breakdowns.
              </p>

              <div className="billing-form-group">
                <label>Select Commercial Order *</label>
                <select
                  className="billing-select"
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                >
                  <option value="">-- Choose Order --</option>
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.order_number} — Total: {fmt(ord.total_amount)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCreateInvoiceModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedOrderId}
                onClick={() => handleCreateOrderInvoice(selectedOrderId)}
              >
                Generate Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Create Subscription Plan */}
      {planModalOpen && (
        <div className="billing-modal-backdrop">
          <div className="billing-modal-box">
            <div className="modal-header">
              <h2>➕ Create Subscription Plan</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPlanModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePlan}>
              <div className="modal-body">
                <div className="billing-form-group">
                  <label>Plan Name *</label>
                  <input
                    type="text"
                    className="billing-input"
                    placeholder="e.g. Enterprise Cloud Annual"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="billing-form-group">
                  <label>Billing Cycle Interval *</label>
                  <select
                    className="billing-select"
                    value={planForm.interval}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, interval: e.target.value })
                    }
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly / Annual</option>
                  </select>
                </div>

                <div className="billing-form-group">
                  <label>Price (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="billing-input"
                    placeholder="e.g. 15000"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    required
                  />
                </div>

                <div className="billing-form-group">
                  <label>Cancellation Policy</label>
                  <select
                    className="billing-select"
                    value={planForm.cancellation_policy}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        cancellation_policy: e.target.value,
                      })
                    }
                  >
                    <option value="IMMEDIATE">Immediate Cancellation</option>
                    <option value="END_OF_PERIOD">At End of Billing Period</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPlanModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`billing-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
