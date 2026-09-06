import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import {
  listWarehouses,
  createWarehouse,
  listInventory,
  adjustInventory,
  listReplenishmentRules,
  createReplenishmentRule,
  getFulfillmentRecommendation,
  createFulfillmentPlan,
  getQuoteFulfillmentPlan,
  acceptFulfillmentPlan,
  cancelFulfillmentPlan,
  fulfillAllocation,
  manualOverrideAllocation,
  listBackorders,
  consolidateBackorder,
} from '../fulfillment.api';
import { listQuotations, getQuotation } from '../../quotations/quotations.api';
import { listProducts } from '../../products/products.api';
import { listCustomers } from '../../customers/customers.api';
import { getErrorMessage } from '../../../services/api/apiError';

import WarehouseAllocationTable from '../components/WarehouseAllocationTable';
import ShipmentSummary from '../components/ShipmentSummary';
import { formatCurrency } from '../../../utils/currency';
import BackorderAlert from '../components/BackorderAlert';
import ManualOverrideModal from '../components/ManualOverrideModal';
import WarehouseSplit from '../components/WarehouseSplit';
import Icon from '../../../components/ui/Icon';
import '../FulfillmentStyles.css';

export default function FulfillmentPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Role permissions
  const role = user?.role || '';
  const isFinanceOps = role === 'finance_ops' || role === 'finance';
  const isAdmin = role === 'admin';
  const canOperate = isFinanceOps || isAdmin;

  // Active Tab
  const [activeTab, setActiveTab] = useState('dispatches');
  const [searchQuery, setSearchQuery] = useState('');

  // Primary Data
  const [quotations, setQuotations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [backorders, setBackorders] = useState([]);
  const [replenishmentRules, setReplenishmentRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Active Selected Quote & Plan Inspector
  const [selectedQuoteId, setSelectedQuoteId] = useState(searchParams.get('quoteId') || '');
  const [activeQuote, setActiveQuote] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [recommendation, setRecommendation] = useState(null);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Modals
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [dispatchModalAllocation, setDispatchModalAllocation] = useState(null);
  const [dispatchQty, setDispatchQty] = useState('');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({ warehouse_id: '', product_id: '', quantity_delta: '', reason: '' });
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    shipping_fixed_cost: '10.00',
    shipping_cost_per_unit: '2.50',
    shipping_cost_weight: '1.00',
  });

  // Fast Lookup Maps
  const warehouseMap = useMemo(() => {
    const map = {};
    warehouses.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [warehouses]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  const customerMap = useMemo(() => {
    const map = {};
    customers.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [customers]);

  const quoteLineMap = useMemo(() => {
    const map = {};
    if (activeQuote?.lines) {
      activeQuote.lines.forEach((l) => {
        map[l.id] = l;
      });
    }
    return map;
  }, [activeQuote]);

  // Fetch Core Reference Data
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setErrorBanner('');
    try {
      const [whRes, invRes, boRes, replRes, prodRes, custRes, quotesRes] = await Promise.allSettled([
        listWarehouses({ is_active: true }),
        listInventory(),
        listBackorders(),
        listReplenishmentRules(),
        listProducts({ limit: 200 }),
        listCustomers({ limit: 200 }),
        listQuotations(),
      ]);

      if (whRes.status === 'fulfilled') setWarehouses(whRes.value || []);
      if (invRes.status === 'fulfilled') setInventory(invRes.value || []);
      if (boRes.status === 'fulfilled') setBackorders(boRes.value || []);
      if (replRes.status === 'fulfilled') setReplenishmentRules(replRes.value || []);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value?.items || prodRes.value || []);
      if (custRes.status === 'fulfilled') setCustomers(custRes.value || []);
      if (quotesRes.status === 'fulfilled') setQuotations(quotesRes.value || []);
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to load fulfillment data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load quote details and fulfillment plan/recommendation when selected
  const loadQuoteAndPlan = useCallback(async (quoteId) => {
    if (!quoteId) {
      setActiveQuote(null);
      setActivePlan(null);
      setRecommendation(null);
      return;
    }

    try {
      const q = await getQuotation(quoteId);
      setActiveQuote(q);

      // Attempt to load existing plan
      try {
        const plan = await getQuoteFulfillmentPlan(quoteId);
        setActivePlan(plan);
        setRecommendation(null);
      } catch {
        setActivePlan(null);
        // If no plan, fetch recommendation
        try {
          const rec = await getFulfillmentRecommendation(quoteId);
          setRecommendation(rec);
        } catch {
          setRecommendation(null);
        }
      }
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to load quotation details.'));
    }
  }, []);

  useEffect(() => {
    if (selectedQuoteId) {
      loadQuoteAndPlan(selectedQuoteId);
    }
  }, [selectedQuoteId, loadQuoteAndPlan]);

  // Filter approved/confirmed quotes ready for fulfillment
  const fulfillmentQuotes = useMemo(() => {
    return quotations.filter((q) => {
      const s = String(q.status).toLowerCase();
      return s === 'approved' || s === 'confirmed' || s === 'sent';
    });
  }, [quotations]);

  // Top KPIs
  const kpis = useMemo(() => {
    const totalWarehouses = warehouses.filter((w) => w.is_active).length;
    const totalOnHand = inventory.reduce((sum, item) => sum + Number(item.quantity_on_hand || 0), 0);
    const totalReserved = inventory.reduce((sum, item) => sum + Number(item.quantity_reserved || 0), 0);
    const totalAvailable = Math.max(0, totalOnHand - totalReserved);
    const openBO = backorders.filter((b) => String(b.status).toLowerCase() === 'open').length;
    const readyQuotesCount = fulfillmentQuotes.length;

    return { totalWarehouses, totalOnHand, totalReserved, totalAvailable, openBO, readyQuotesCount };
  }, [warehouses, inventory, backorders, fulfillmentQuotes]);

  // Action Handlers
  const handleSelectQuote = (quoteId) => {
    setSelectedQuoteId(quoteId);
    setSearchParams({ quoteId });
  };

  const handleCreatePlan = async (quoteId) => {
    setActionLoading(true);
    setErrorBanner('');
    setSuccessBanner('');
    try {
      const newPlan = await createFulfillmentPlan(quoteId);
      setActivePlan(newPlan);
      setSuccessBanner('Fulfillment plan successfully generated and proposed.');
      loadInitialData();
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to generate fulfillment plan.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptPlan = async (planId) => {
    setActionLoading(true);
    setErrorBanner('');
    setSuccessBanner('');
    try {
      const accepted = await acceptFulfillmentPlan(planId);
      setActivePlan(accepted);
      setSuccessBanner('Fulfillment plan accepted! Inventory has been officially reserved.');
      loadInitialData();
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to accept fulfillment plan.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPlan = async (planId) => {
    if (!window.confirm('Are you sure you want to cancel this proposed fulfillment plan?')) return;
    setActionLoading(true);
    setErrorBanner('');
    setSuccessBanner('');
    try {
      await cancelFulfillmentPlan(planId);
      setActivePlan(null);
      setSuccessBanner('Fulfillment plan has been cancelled.');
      if (selectedQuoteId) {
        loadQuoteAndPlan(selectedQuoteId);
      }
      loadInitialData();
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to cancel fulfillment plan.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDispatchModal = (alloc) => {
    setDispatchModalAllocation(alloc);
    const rem = Math.max(0, Number(alloc.allocated_quantity || 0) - Number(alloc.fulfilled_quantity || 0));
    setDispatchQty(String(rem));
  };

  const handleExecuteDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchModalAllocation) return;

    const qtyNum = Number(dispatchQty);
    if (!qtyNum || qtyNum <= 0) {
      setErrorBanner('Please enter a valid positive dispatch quantity.');
      return;
    }

    setActionLoading(true);
    setErrorBanner('');
    setSuccessBanner('');
    try {
      await fulfillAllocation(dispatchModalAllocation.id, qtyNum);
      setSuccessBanner(`Successfully dispatched ${qtyNum} units!`);
      setDispatchModalAllocation(null);
      if (selectedQuoteId) {
        loadQuoteAndPlan(selectedQuoteId);
      }
      loadInitialData();
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to dispatch allocation.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualOverrideSubmit = async (data) => {
    if (!activePlan) return;
    setActionLoading(true);
    setErrorBanner('');
    setSuccessBanner('');
    try {
      await manualOverrideAllocation(activePlan.id, data);
      setSuccessBanner('Manual allocation override applied successfully!');
      setIsOverrideModalOpen(false);
      if (selectedQuoteId) {
        loadQuoteAndPlan(selectedQuoteId);
      }
      loadInitialData();
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to apply manual override.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConsolidateBackorder = async (backorderId) => {
    setActionLoading(true);
    setErrorBanner('');
    setSuccessBanner('');
    try {
      await consolidateBackorder(backorderId);
      setSuccessBanner('Backorder consolidation evaluated and updated.');
      if (selectedQuoteId) {
        loadQuoteAndPlan(selectedQuoteId);
      }
      loadInitialData();
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Consolidation failed. Ensure sufficient stock exists.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustInventorySubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorBanner('');
    setSuccessBanner('');
    try {
      await adjustInventory({
        warehouse_id: adjustData.warehouse_id,
        product_id: adjustData.product_id,
        quantity_delta: Number(adjustData.quantity_delta),
        reason: adjustData.reason,
      });
      setSuccessBanner('Inventory level adjusted successfully.');
      setIsAdjustModalOpen(false);
      setAdjustData({ warehouse_id: '', product_id: '', quantity_delta: '', reason: '' });
      loadInitialData();
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to adjust inventory.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateWarehouseSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorBanner('');
    setSuccessBanner('');
    try {
      await createWarehouse({
        name: newWarehouse.name,
        code: newWarehouse.code,
        city: newWarehouse.city || undefined,
        state: newWarehouse.state || undefined,
        shipping_fixed_cost: Number(newWarehouse.shipping_fixed_cost),
        shipping_cost_per_unit: Number(newWarehouse.shipping_cost_per_unit),
        shipping_cost_weight: Number(newWarehouse.shipping_cost_weight),
      });
      setSuccessBanner(`Warehouse "${newWarehouse.name}" created successfully.`);
      setIsWarehouseModalOpen(false);
      setNewWarehouse({
        name: '',
        code: '',
        city: '',
        state: '',
        shipping_fixed_cost: '10.00',
        shipping_cost_per_unit: '2.50',
        shipping_cost_weight: '1.00',
      });
      loadInitialData();
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Failed to create warehouse.'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="page-status">
          <p>Loading operations & fulfillment data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container fulfillment-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Operations & Fulfillment <span className="heading-keyword">Hub</span></h1>
          <p className="subheading">
            Multi-facility warehouse allocations, stock reservations, freight routing, and dispatching.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-outline" onClick={loadInitialData}>
            <Icon name="refresh" size={13} style={{ marginRight: '6px' }} /> Refresh
          </button>
          {canOperate && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsAdjustModalOpen(true)}
            >
              <Icon name="edit" size={13} style={{ marginRight: '6px' }} /> Adjust Stock
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsWarehouseModalOpen(true)}
            >
              + Add Warehouse Hub
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {errorBanner && (
        <div className="form-banner form-banner-error" style={{ marginBottom: '1.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="alert-triangle" size={16} color="#ef4444" /> {errorBanner}
          </span>
          <button type="button" onClick={() => setErrorBanner('')} className="btn btn-sm btn-outline" style={{ marginLeft: '1rem' }}>
            Dismiss
          </button>
        </div>
      )}
      {successBanner && (
        <div className="form-banner form-banner-success" style={{ marginBottom: '1.5rem', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="check" size={16} color="#166534" /> {successBanner}
          </span>
          <button type="button" onClick={() => setSuccessBanner('')} className="btn btn-sm btn-outline" style={{ marginLeft: '1rem' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        <div
          className={`stat-card ${activeTab === 'inventory' ? 'highlight' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <div className="stat-value">{kpis.totalWarehouses}</div>
          <div className="stat-label">Active Facilities</div>
        </div>

        <div
          className={`stat-card success ${activeTab === 'inventory' ? 'highlight' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <div className="stat-value">{kpis.totalAvailable}</div>
          <div className="stat-label">Available Stock Units</div>
        </div>

        <div
          className={`stat-card ${activeTab === 'dispatches' ? 'highlight' : ''}`}
          onClick={() => setActiveTab('dispatches')}
        >
          <div className="stat-value">{kpis.totalReserved}</div>
          <div className="stat-label">Reserved in Plans</div>
        </div>

        <div
          className={`stat-card ${kpis.readyQuotesCount > 0 ? 'warning' : ''} ${activeTab === 'dispatches' ? 'highlight' : ''}`}
          onClick={() => setActiveTab('dispatches')}
        >
          <div className="stat-value">{kpis.readyQuotesCount}</div>
          <div className="stat-label">Ready for Dispatch</div>
        </div>

        <div
          className={`stat-card ${kpis.openBO > 0 ? 'alert' : ''} ${activeTab === 'backorders' ? 'highlight' : ''}`}
          onClick={() => setActiveTab('backorders')}
        >
          <div className="stat-value">{kpis.openBO}</div>
          <div className="stat-label">Open Backorders</div>
        </div>
      </div>

      {/* Toolbar: Tabs & Search */}
      <div className="tabs-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${activeTab === 'dispatches' ? 'active' : ''}`}
            onClick={() => setActiveTab('dispatches')}
          >
            Dispatches ({fulfillmentQuotes.length})
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Warehouses & Stock ({warehouses.length})
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'backorders' ? 'active' : ''}`}
            onClick={() => setActiveTab('backorders')}
          >
            Backorders ({kpis.openBO})
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'replenishment' ? 'active' : ''}`}
            onClick={() => setActiveTab('replenishment')}
          >
            Replenishment Rules ({replenishmentRules.length})
          </button>
        </div>

        <div style={{ minWidth: '240px' }}>
          <input
            className="input"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.9rem', width: '100%' }}
            placeholder="Search quote # or customer…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: FULFILLMENT PLANS & DISPATCHES */}
      {/* ========================================================= */}
      {activeTab === 'dispatches' && (
        <section className="dispatches-tab-content">
          <div className="panel-card">
            <div className="panel-card-header">
              <h3>Approved Quotations Awaiting Dispatch</h3>
            </div>

            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Quote #</th>
                    <th>Customer Account</th>
                    <th className="text-right">Grand Total</th>
                    <th>Status</th>
                    <th>Plan State</th>
                    <th>Fulfillment Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fulfillmentQuotes
                    .filter((q) => {
                      const cust = customerMap[q.customer_id]?.name || '';
                      const qn = q.quote_number || '';
                      const query = searchQuery.toLowerCase();
                      return qn.toLowerCase().includes(query) || cust.toLowerCase().includes(query);
                    })
                    .map((q) => {
                      const cust = customerMap[q.customer_id];
                      const isSelected = q.id === selectedQuoteId;

                      return (
                        <tr
                          key={q.id}
                          style={{
                            background: isSelected ? '#f0fdf4' : undefined,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSelectQuote(q.id)}
                        >
                          <td>
                            <Link to={`/quotations/${q.id}`} className="quote-link" style={{ fontWeight: 600 }}>
                              {q.quote_number}
                            </Link>
                          </td>
                          <td>
                            <div>
                              <strong>{cust?.name || 'Customer Account'}</strong>
                              {cust?.tier && <span className="admin-tier-badge" style={{ marginLeft: '0.5rem', fontSize: '0.68rem' }}>{cust.tier.toUpperCase()}</span>}
                            </div>
                          </td>
                          <td className="text-right">
                            <strong>{formatCurrency(q.grand_total)}</strong>
                          </td>
                          <td>
                            <span className={`status-pill status-${String(q.status).toLowerCase()}`}>
                              {String(q.status).toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {isSelected && activePlan ? (
                              <span className={`status-pill status-${String(activePlan.status).toLowerCase()}`}>
                                {String(activePlan.status).replace('_', ' ').toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-sm">Select to inspect</span>
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectQuote(q.id);
                                }}
                              >
                                {isSelected ? 'Inspecting' : 'Inspect Plan'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {fulfillmentQuotes.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center" style={{ padding: '2.5rem', color: '#6b7280' }}>
                        No approved quotations currently waiting for fulfillment dispatch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIVE QUOTE FULFILLMENT PLAN INSPECTOR */}
          {activeQuote && (
            <div className="plan-detail-view">
              <div className="plan-actions-bar">
                <div className="plan-actions-left">
                  <h3>
                    Plan Details: <strong>{activeQuote.quote_number}</strong>
                  </h3>
                  {activePlan && (
                    <span className={`status-pill status-${String(activePlan.status).toLowerCase()}`}>
                      {String(activePlan.status).replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="plan-actions-right">
                  {!activePlan && canOperate && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={actionLoading}
                      onClick={() => handleCreatePlan(activeQuote.id)}
                    >
                      {actionLoading ? 'Generating...' : <><Icon name="zap" size={14} style={{ marginRight: '6px' }} /> Generate Fulfillment Plan</>}
                    </button>
                  )}

                  {activePlan && String(activePlan.status).toLowerCase() === 'proposed' && canOperate && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => setIsOverrideModalOpen(true)}
                      >
                        <Icon name="edit" size={14} style={{ marginRight: '6px' }} /> Manual Override
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={actionLoading}
                        onClick={() => handleAcceptPlan(activePlan.id)}
                      >
                        <Icon name="check" size={14} style={{ marginRight: '6px' }} /> Accept & Reserve Stock
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={actionLoading}
                        onClick={() => handleCancelPlan(activePlan.id)}
                      >
                        Cancel Plan
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Recommendation Preview if Plan is not yet created */}
              {!activePlan && recommendation && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      background: '#f0f7ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e40af' }}>Proposed Allocation Recommendation</h4>
                    <p style={{ margin: 0, color: '#374151' }}>
                      Optimal routing: <strong>{recommendation.shipment_count} facility hub(s)</strong> with an
                      estimated freight cost of <strong>{formatCurrency(recommendation.estimated_shipping_cost)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Active Plan Metrics */}
              {activePlan && (
                <>
                  <ShipmentSummary plan={activePlan} allocations={activePlan.allocations} />

                  <WarehouseSplit
                    allocations={activePlan.allocations}
                    warehouseMap={warehouseMap}
                    productMap={productMap}
                    quoteLineMap={quoteLineMap}
                  />

                  {/* Backorder Alerts for Quote */}
                  <BackorderAlert
                    backorders={backorders.filter((b) => b.quotation_id === activeQuote.id)}
                    productMap={productMap}
                    canConsolidate={canOperate}
                    onConsolidate={handleConsolidateBackorder}
                  />

                  {/* Allocations Table */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <div className="panel-card-header">
                      <h4>Warehouse Allocations & Line Dispatches</h4>
                    </div>
                    <WarehouseAllocationTable
                      allocations={activePlan.allocations}
                      warehouseMap={warehouseMap}
                      productMap={productMap}
                      quoteLineMap={quoteLineMap}
                      canFulfill={canOperate}
                      planStatus={activePlan.status}
                      onFulfill={handleOpenDispatchModal}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ========================================================= */}
      {/* TAB 2: WAREHOUSES & INVENTORY */}
      {/* ========================================================= */}
      {activeTab === 'inventory' && (
        <section className="inventory-tab-content">
          <div className="panel-card">
            <div className="panel-card-header">
              <h3>Regional Warehouse Facilities</h3>
            </div>

            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Warehouse Facility</th>
                    <th>Location</th>
                    <th className="text-right">Fixed Freight</th>
                    <th className="text-right">Freight / Unit</th>
                    <th className="text-center">Weight Multiplier</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((wh) => (
                    <tr key={wh.id}>
                      <td>
                        <span className="wh-badge">{wh.code}</span>
                      </td>
                      <td>
                        <strong>{wh.name}</strong>
                      </td>
                      <td>
                        {wh.city || wh.state ? `${wh.city || ''}, ${wh.state || ''}` : 'Primary Hub'}
                      </td>
                      <td className="text-right">{formatCurrency(wh.shipping_fixed_cost)}</td>
                      <td className="text-right">{formatCurrency(wh.shipping_cost_per_unit)}</td>
                      <td className="text-center">{Number(wh.shipping_cost_weight || 1).toFixed(2)}x</td>
                      <td>
                        <span className={`status-pill ${wh.is_active ? 'status-fulfilled' : 'status-cancelled'}`}>
                          {wh.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {warehouses.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center" style={{ padding: '2.5rem', color: '#6b7280' }}>
                        No warehouse facilities configured yet. Click "+ Add Warehouse Hub" above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-card" style={{ marginTop: '1.5rem' }}>
            <div className="panel-card-header">
              <h3>Inventory Stock Balances</h3>
            </div>

            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Facility Hub</th>
                    <th>Product / Hardware SKU</th>
                    <th className="text-center">On-Hand Stock</th>
                    <th className="text-center">Reserved for Plans</th>
                    <th className="text-center">Available to Promise</th>
                    <th>Stock Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((inv) => {
                    const wh = warehouseMap[inv.warehouse_id];
                    const prod = productMap[inv.product_id];
                    const onHand = Number(inv.quantity_on_hand || 0);
                    const reserved = Number(inv.quantity_reserved || 0);
                    const available = Number(inv.available_quantity ?? onHand - reserved);

                    return (
                      <tr key={inv.id}>
                        <td>
                          <strong>{wh?.name || 'Warehouse'}</strong> ({wh?.code || 'WH'})
                        </td>
                        <td>
                          <strong>{prod?.name || 'Hardware SKU'}</strong>
                          {prod?.code && <span className="item-sku"> · {prod.code}</span>}
                        </td>
                        <td className="text-center">
                          <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{onHand}</span>
                        </td>
                        <td className="text-center">
                          <span style={{ fontFamily: 'monospace', color: '#d97706', fontWeight: 'bold' }}>{reserved}</span>
                        </td>
                        <td className="text-center">
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              color: available > 0 ? '#166534' : '#dc2626',
                            }}
                          >
                            {available}
                          </span>
                        </td>
                        <td>
                          {canOperate && (
                            <div className="table-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => {
                                  setAdjustData({
                                    warehouse_id: inv.warehouse_id,
                                    product_id: inv.product_id,
                                    quantity_delta: '',
                                    reason: '',
                                  });
                                  setIsAdjustModalOpen(true);
                                }}
                              >
                                Adjust Stock
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center" style={{ padding: '2.5rem', color: '#6b7280' }}>
                        No inventory stock records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* TAB 3: BACKORDERS CONSOLE */}
      {/* ========================================================= */}
      {activeTab === 'backorders' && (
        <section className="backorders-tab-content">
          <div className="panel-card">
            <div className="panel-card-header">
              <h3>Unfulfilled Backorders Queue</h3>
            </div>

            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Quotation</th>
                    <th>Hardware Item</th>
                    <th className="text-center">Units Remaining</th>
                    <th>Status</th>
                    <th>Expected ETA</th>
                    <th>Consolidation Action</th>
                  </tr>
                </thead>
                <tbody>
                  {backorders.map((bo) => {
                    const quote = quotations.find((q) => q.id === bo.quotation_id);
                    const prod = productMap[bo.product_id];

                    return (
                      <tr key={bo.id}>
                        <td>
                          <Link to={`/quotations/${bo.quotation_id}`} className="quote-link">
                            <strong>{quote?.quote_number || 'Quotation'}</strong>
                          </Link>
                        </td>
                        <td>
                          <strong>{prod?.name || 'Hardware Line Item'}</strong>
                        </td>
                        <td className="text-center">
                          <span className="bo-qty-badge">{bo.quantity_remaining} Units</span>
                        </td>
                        <td>
                          <span className={`status-pill status-${String(bo.status).toLowerCase()}`}>
                            {String(bo.status).toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {bo.expected_at ? new Date(bo.expected_at).toLocaleDateString() : 'Pending Supplier'}
                        </td>
                        <td>
                          {canOperate && String(bo.status).toLowerCase() === 'open' && (
                            <div className="table-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline consolidate-btn"
                                disabled={actionLoading}
                                onClick={() => handleConsolidateBackorder(bo.id)}
                              >
                                Consolidate Stock
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {backorders.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center" style={{ padding: '2.5rem', color: '#6b7280' }}>
                        No active backorders currently recorded. All demands are fulfilled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* TAB 4: REPLENISHMENT RULES */}
      {/* ========================================================= */}
      {activeTab === 'replenishment' && (
        <section className="replenishment-tab-content">
          <div className="panel-card">
            <div className="panel-card-header">
              <h3>Automated Inventory Replenishment Rules</h3>
            </div>

            <div className="quotations-table-wrapper">
              <table className="data-table quotations-table">
                <thead>
                  <tr>
                    <th>Warehouse Hub</th>
                    <th>Product</th>
                    <th className="text-center">Reorder Point (Threshold)</th>
                    <th className="text-center">Reorder Quantity</th>
                    <th className="text-center">Max Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {replenishmentRules.map((rule) => {
                    const wh = warehouseMap[rule.warehouse_id];
                    const prod = productMap[rule.product_id];

                    return (
                      <tr key={rule.id}>
                        <td>
                          <strong>{wh?.name || 'Warehouse'}</strong>
                        </td>
                        <td>
                          <strong>{prod?.name || 'Product'}</strong>
                        </td>
                        <td className="text-center">{rule.reorder_point} units</td>
                        <td className="text-center">{rule.reorder_quantity} units</td>
                        <td className="text-center">{rule.max_stock ? `${rule.max_stock} units` : 'Uncapped'}</td>
                      </tr>
                    );
                  })}
                  {replenishmentRules.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center" style={{ padding: '2.5rem', color: '#6b7280' }}>
                        No replenishment rules configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* MODAL: DISPATCH ALLOCATION */}
      {/* ========================================================= */}
      {dispatchModalAllocation && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Dispatch Allocation</h3>
                <p className="modal-subtitle">
                  Confirm physical dispatch from warehouse facility.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDispatchModalAllocation(null)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteDispatch} className="modal-form">
              <div className="form-group">
                <label>Warehouse Hub</label>
                <div style={{ color: 'var(--ink, #1f2937)', fontWeight: 'bold' }}>
                  {warehouseMap[dispatchModalAllocation.warehouse_id]?.name || 'Warehouse'}
                </div>
              </div>

              <div className="form-group">
                <label>Allocated vs Dispatched</label>
                <div style={{ color: 'var(--muted, #6b7280)' }}>
                  Total Allocated: <strong>{dispatchModalAllocation.allocated_quantity}</strong> | Already Dispatched: <strong>{dispatchModalAllocation.fulfilled_quantity}</strong>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="dispatch-qty">Units to Dispatch Now</label>
                <input
                  id="dispatch-qty"
                  type="number"
                  step="1"
                  min="1"
                  max={Number(dispatchModalAllocation.allocated_quantity) - Number(dispatchModalAllocation.fulfilled_quantity)}
                  className="form-input"
                  value={dispatchQty}
                  onChange={(e) => setDispatchQty(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setDispatchModalAllocation(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Dispatching...' : 'Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADJUST INVENTORY */}
      {/* ========================================================= */}
      {isAdjustModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Adjust Warehouse Stock</h3>
                <p className="modal-subtitle">Directly adjust inventory levels with mandatory audit reason.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAdjustModalOpen(false)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleAdjustInventorySubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="adjust-wh">Warehouse Hub</label>
                <select
                  id="adjust-wh"
                  className="form-input"
                  value={adjustData.warehouse_id}
                  onChange={(e) => setAdjustData({ ...adjustData, warehouse_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Warehouse --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="adjust-prod">Product Hardware</label>
                <select
                  id="adjust-prod"
                  className="form-input"
                  value={adjustData.product_id}
                  onChange={(e) => setAdjustData({ ...adjustData, product_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="adjust-delta">Stock Delta (+ to add, - to subtract)</label>
                <input
                  id="adjust-delta"
                  type="number"
                  step="1"
                  className="form-input"
                  placeholder="e.g. 50 or -5"
                  value={adjustData.quantity_delta}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity_delta: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="adjust-reason">Audit Reason</label>
                <textarea
                  id="adjust-reason"
                  rows="2"
                  className="form-input"
                  placeholder="e.g. Initial stock intake from supplier invoice #49102"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsAdjustModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Updating Stock...' : 'Apply Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE WAREHOUSE */}
      {/* ========================================================= */}
      {isWarehouseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Add Warehouse Facility</h3>
                <p className="modal-subtitle">Register a new logistics fulfillment center.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsWarehouseModalOpen(false)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWarehouseSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="wh-name">Warehouse Facility Name</label>
                <input
                  id="wh-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. East Coast Distribution Center"
                  value={newWarehouse.name}
                  onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="wh-code">Facility Code (Unique Identifier)</label>
                <input
                  id="wh-code"
                  type="text"
                  className="form-input"
                  placeholder="e.g. WH-EAST-01"
                  value={newWarehouse.code}
                  onChange={(e) => setNewWarehouse({ ...newWarehouse, code: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="wh-city">City</label>
                  <input
                    id="wh-city"
                    type="text"
                    className="form-input"
                    placeholder="e.g. New York"
                    value={newWarehouse.city}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, city: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="wh-state">State / Province</label>
                  <input
                    id="wh-state"
                    type="text"
                    className="form-input"
                    placeholder="e.g. NY"
                    value={newWarehouse.state}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, state: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="wh-fixed-cost">Fixed Shipment Freight ($)</label>
                  <input
                    id="wh-fixed-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={newWarehouse.shipping_fixed_cost}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, shipping_fixed_cost: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="wh-unit-cost">Per-Unit Freight ($)</label>
                  <input
                    id="wh-unit-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={newWarehouse.shipping_cost_per_unit}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, shipping_cost_per_unit: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsWarehouseModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating Warehouse...' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: MANUAL OVERRIDE */}
      {/* ========================================================= */}
      <ManualOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        plan={activePlan}
        quoteLines={activeQuote?.lines || []}
        warehouses={warehouses}
        productMap={productMap}
        inventory={inventory}
        onSubmit={handleManualOverrideSubmit}
        loading={actionLoading}
      />
    </div>
  );
}
