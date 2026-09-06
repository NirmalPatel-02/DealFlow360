import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listInvoices,
  cancelInvoice,
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
import Icon from '../../../components/ui/Icon';
import { formatCurrency } from '../../../utils/currency';
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

  const fmt = (val) => formatCurrency(val);

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

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="page-status">
          <p>Loading billing & invoice records…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container billing-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Billing, Invoicing & <span className="heading-keyword">Receivables</span></h1>
          <p className="subheading">
            Commercial order conversion, invoice generation, payment reconciliation & subscription lifecycle.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-outline" onClick={loadData}>
            <Icon name="refresh" size={13} style={{ marginRight: '6px' }} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setConvertModalOpen(true)}
          >
            <Icon name="document" size={14} style={{ marginRight: '6px' }} /> Convert Quote
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateInvoiceModalOpen(true)}
          >
            <Icon name="zap" size={14} style={{ marginRight: '6px' }} /> Generate Invoice
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPlanModalOpen(true)}
          >
            <Icon name="plus" size={14} style={{ marginRight: '6px' }} /> New Plan
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="form-banner form-banner-error" style={{ marginBottom: '1.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="alert-triangle" size={16} color="#ef4444" /> {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="btn btn-sm btn-outline" style={{ marginLeft: '1rem' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`form-banner form-banner-${toast.type === 'error' ? 'error' : 'success'}`}
          style={{
            marginBottom: '1.5rem',
            background: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
            border: `1px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`,
            color: toast.type === 'error' ? '#991b1b' : '#166534',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name={toast.type === 'error' ? 'alert-triangle' : 'check'} size={16} color={toast.type === 'error' ? '#991b1b' : '#166534'} /> {toast.message}
          </span>
          <button type="button" onClick={() => setToast(null)} className="btn btn-sm btn-outline" style={{ marginLeft: '1rem' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        <div
          className={`stat-card ${activeTab === 'invoices' ? 'highlight' : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          <div className="stat-value">{fmt(kpiData.totalInvoiced)}</div>
          <div className="stat-label">Total Invoiced</div>
        </div>

        <div
          className={`stat-card success ${activeTab === 'invoices' ? 'highlight' : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          <div className="stat-value">{fmt(kpiData.totalPaid)}</div>
          <div className="stat-label">Collected / Settled</div>
        </div>

        <div
          className={`stat-card warning ${activeTab === 'invoices' ? 'highlight' : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          <div className="stat-value">{fmt(kpiData.totalDue)}</div>
          <div className="stat-label">Receivables Outstanding</div>
        </div>

        <div
          className={`stat-card ${kpiData.overdueCount > 0 ? 'alert' : ''} ${activeTab === 'invoices' ? 'highlight' : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          <div className="stat-value">{kpiData.overdueCount}</div>
          <div className="stat-label">Overdue Invoices</div>
        </div>

        <div
          className={`stat-card ${activeTab === 'subscriptions' ? 'highlight' : ''}`}
          onClick={() => handleTabChange('subscriptions')}
        >
          <div className="stat-value">{kpiData.activeSubs}</div>
          <div className="stat-label">Active Subscriptions</div>
        </div>
      </div>

      {/* Toolbar: Tabs & Search */}
      <div className="tabs-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => handleTabChange('invoices')}
          >
            Invoices & Receivables ({invoices.length})
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => handleTabChange('orders')}
          >
            Commercial Orders ({orders.length})
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => handleTabChange('subscriptions')}
          >
            Subscriptions ({subscriptions.length})
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => handleTabChange('plans')}
          >
            Plans Catalog ({plans.length})
          </button>
        </div>

        {activeTab === 'invoices' && (
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search invoice #, order, customer…"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: '220px', padding: '0.5rem 0.85rem', fontSize: '0.88rem' }}
            />
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ISSUED">Issued</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid / Settled</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
            >
              <option value="ALL">All Types</option>
              <option value="ONE_TIME">One-Time Capex</option>
              <option value="RECURRING">Recurring Cycle</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: Invoices & Receivables */}
      {activeTab === 'invoices' && (
        <div className="tab-pane">
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <h3>No Invoices Found</h3>
              <p>Generate an invoice from a confirmed order or recurring subscription.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreateInvoiceModalOpen(true)}
              >
                + Generate Invoice
              </button>
            </div>
          ) : (
            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Type</th>
                    <th>Issued Date</th>
                    <th>Due Date</th>
                    <th className="text-right">Total Amount</th>
                    <th className="text-right">Amount Paid</th>
                    <th className="text-right">Outstanding Due</th>
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
                            className="quote-link"
                            style={{ fontWeight: 600, fontFamily: 'monospace' }}
                          >
                            {inv.invoice_number}
                          </Link>
                          {inv.order_id && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted, #6b7280)' }}>
                              Ord: {inv.order_id.slice(0, 8)}...
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: inv.invoice_type === 'RECURRING' ? '#1e40af' : '#4b5563',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {inv.invoice_type === 'RECURRING' ? (
                              <><Icon name="refresh" size={13} /> Recurring</>
                            ) : (
                              <><Icon name="zap" size={13} /> One-Time</>
                            )}
                          </span>
                        </td>
                        <td>
                          {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {inv.due_date ? (
                            <span style={{ color: isOverdue ? '#dc2626' : 'inherit' }}>
                              {new Date(inv.due_date).toLocaleDateString()}
                              {isOverdue && (
                                <span className="overdue-warning-tag">OVERDUE</span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-right" style={{ fontWeight: 600 }}>{fmt(inv.total_amount)}</td>
                        <td className="text-right" style={{ color: '#166534', fontWeight: 600 }}>{fmt(inv.amount_paid)}</td>
                        <td
                          className="text-right"
                          style={{
                            fontWeight: 700,
                            color: Number(inv.amount_due) > 0 ? '#dc2626' : '#166534',
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
                          <div className="table-actions">
                            <Link
                              to={`/invoices/${inv.id}`}
                              className="btn btn-sm btn-outline"
                            >
                              View
                            </Link>

                            {['DRAFT', 'ISSUED'].includes(inv.status) && (
                              <button
                                type="button"
                                className="btn btn-sm btn-danger-ghost"
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
        <div className="tab-pane">
          {orders.length === 0 ? (
            <div className="empty-state">
              <h3>No Commercial Orders</h3>
              <p>Convert an approved quotation to create a commercial order.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConvertModalOpen(true)}
              >
                + Convert Quote to Order
              </button>
            </div>
          ) : (
            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Quotation Ref</th>
                    <th>Status</th>
                    <th>Line Items</th>
                    <th className="text-right">Total Value</th>
                    <th>Created Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => (
                    <tr key={ord.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {ord.order_number}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/quotations/${ord.quotation_id}`}
                          className="quote-link"
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.82rem',
                          }}
                        >
                          {ord.quotation_id.slice(0, 8)}...
                        </Link>
                      </td>
                      <td>
                        <span className="billing-status-pill badge-paid">{ord.status}</span>
                      </td>
                      <td>{ord.lines?.length || 0} items</td>
                      <td className="text-right" style={{ fontWeight: 700 }}>
                        {fmt(ord.total_amount)}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {new Date(ord.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleCreateOrderInvoice(ord.id)}
                          >
                            <Icon name="zap" size={13} style={{ marginRight: '4px' }} /> Generate Invoice
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
        <div className="tab-pane">
          {subscriptions.length === 0 ? (
            <div className="empty-state">
              <h3>No Active Subscriptions</h3>
              <p>Subscriptions are automatically spun up from recurring order lines.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleTabChange('plans')}
              >
                Manage Plans
              </button>
            </div>
          ) : (
            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="text-right">Rate</th>
                    <th>Current Period</th>
                    <th>Next Billing Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <strong>{sub.plan ? sub.plan.name : 'Custom Subscription'}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted, #6b7280)' }}>
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
                      <td className="text-right" style={{ fontWeight: 600 }}>{fmt(sub.unit_price)}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {sub.current_period_start} → {sub.current_period_end}
                      </td>
                      <td style={{ fontWeight: 600, color: '#1e40af' }}>
                        {sub.next_billing_date || '—'}
                      </td>
                      <td>
                        <div className="table-actions">
                          {sub.status === 'ACTIVE' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => handleGenerateSubscriptionInvoice(sub.id)}
                                title="Generate invoice for next billing cycle"
                              >
                                <Icon name="zap" size={13} style={{ marginRight: '4px' }} /> Bill Cycle
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger-ghost"
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
        <div className="tab-pane">
          {plans.length === 0 ? (
            <div className="empty-state">
              <h3>No Plans Configured</h3>
              <p>Create subscription plans for recurring SaaS, maintenance, or SLAs.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPlanModalOpen(true)}
              >
                + Create Plan
              </button>
            </div>
          ) : (
            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Plan Name</th>
                    <th>Interval</th>
                    <th className="text-right">Price</th>
                    <th>Proration</th>
                    <th>Cancellation Policy</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <span className="schedule-pill schedule-invoiced">{p.interval}</span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, color: '#166534' }}>{fmt(p.price)}</td>
                      <td>
                        {p.proration_enabled ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#166534' }}>
                            <Icon name="check" size={14} color="#166534" /> Prorated
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--muted, #6b7280)' }}>
                            <Icon name="x" size={14} color="#6b7280" /> No Proration
                          </span>
                        )}
                      </td>
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

      {/* MODAL: Convert Quote to Order */}
      {convertModalOpen && (
        <div className="billing-modal-backdrop">
          <div className="billing-modal-box">
            <div className="modal-header">
              <h2><Icon name="document" size={20} style={{ marginRight: '8px' }} /> Convert Approved Quotation to Order</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setConvertModalOpen(false)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleConvertQuote}>
              <div className="modal-body">
                <p style={{ color: 'var(--muted, #6b7280)', fontSize: '0.9rem', margin: 0 }}>
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
                  className="btn btn-outline"
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
              <h2><Icon name="zap" size={20} style={{ marginRight: '8px' }} /> Generate One-Time Invoice</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCreateInvoiceModalOpen(false)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--muted, #6b7280)', fontSize: '0.9rem', margin: 0 }}>
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
                className="btn btn-outline"
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
              <h2><Icon name="plus" size={20} style={{ marginRight: '8px' }} /> Create Subscription Plan</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPlanModalOpen(false)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
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
                  className="btn btn-outline"
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
    </div>
  );
}
