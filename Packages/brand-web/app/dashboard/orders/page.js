'use client';
import { useEffect, useState, useCallback } from 'react';
import { orderApi, fmtMoney } from '../../../lib/api';

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'dispatched', 'delivered'];

const STATUS_STYLES = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered:  'bg-teal-100 text-teal-700',
  cancelled:  'bg-red-100 text-red-600',
};

const NEXT_STATUS = {
  pending:    'confirmed',
  confirmed:  'dispatched',
  dispatched: 'delivered',
};

export default function OrdersPage() {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setFilter] = useState('all');
  const [page, setPage]           = useState(1);
  const [meta, setMeta]           = useState(null);
  const [updating, setUpdating]   = useState('');
  const [toast, setToast]         = useState('');
  const [expandedId, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (statusFilter !== 'all') params.status = statusFilter;
    const res = await orderApi.list(params);
    setLoading(false);
    if (res.success) {
      setOrders(res.data?.orders || []);
      setMeta(res.meta);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function advance(order) {
    const next = NEXT_STATUS[order.order_status];
    if (!next) return;
    setUpdating(order.id);
    const res = await orderApi.updateStatus(order.id, { order_status: next });
    setUpdating('');
    if (res.success) {
      showToast(`Order marked as ${next}`);
      load();
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

  function parseItems(items_json) {
    if (!items_json) return [];
    try { return typeof items_json === 'string' ? JSON.parse(items_json) : items_json; }
    catch { return []; }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Orders</h1>
        <span className="text-xs text-t3">{meta?.total ?? '–'} total</span>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
              ${statusFilter === s ? 'bg-navy text-white' : 'bg-surface2 text-t2 hover:bg-navy-pale hover:text-navy'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-t3 text-sm">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-4xl mb-3">📦</div>
          <div className="font-bold text-t1 mb-1">No orders yet</div>
          <div className="text-xs text-t3">Orders from your followers will appear here</div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const items = parseItems(order.items_json);
            const isExpanded = expandedId === order.id;
            const nextStatus = NEXT_STATUS[order.order_status];
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Order header */}
                <div
                  className="flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-surface2 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs flex-shrink-0">
                      {(order.follower_name || '??').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-t1">{order.follower_name || 'Follower'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_STYLES[order.order_status] || 'bg-gray-100 text-t3'}`}>
                          {order.order_status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-t3 flex-wrap">
                        <span>📱 {order.follower_phone || '—'}</span>
                        <span>🕐 {order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : '—'}</span>
                        {order.tracking_number && <span className="font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">🚚 {order.tracking_number}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-bold text-sm text-t1">{fmtMoney(order.net_amount || 0)}</div>
                      <div className="text-[10px] text-t3">{items.length} item{items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded: items + address + actions */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {/* Items */}
                    {items.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-t3 uppercase mb-2">Items</div>
                        <div className="space-y-1.5">
                          {items.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-t1 font-medium">{item.name || item.product_name || `Item ${i + 1}`}</span>
                              <span className="text-t2">{item.qty || item.quantity || 1}× {fmtMoney((item.price || 0) * 100)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delivery address */}
                    {order.delivery_address && (
                      <div>
                        <div className="text-[10px] font-bold text-t3 uppercase mb-1">Delivery Address</div>
                        <div className="text-xs text-t2 bg-surface2 rounded-lg px-3 py-2">
                          {typeof order.delivery_address === 'string'
                            ? order.delivery_address
                            : (() => {
                                const a = typeof order.delivery_address === 'object' ? order.delivery_address : {};
                                return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
                              })()
                          }
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex gap-4 text-[10px] text-t3">
                      {order.dispatched_at && <span>📦 Dispatched: {new Date(order.dispatched_at).toLocaleString('en-IN')}</span>}
                      {order.delivered_at  && <span>✅ Delivered: {new Date(order.delivered_at).toLocaleString('en-IN')}</span>}
                    </div>

                    {/* Advance status button */}
                    {nextStatus && (
                      <button
                        onClick={() => advance(order)}
                        disabled={updating === order.id}
                        className="w-full py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {updating === order.id ? 'Updating…' : `Mark as ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > 20 && (
        <div className="flex items-center justify-between mt-6 text-xs text-t3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-4 py-2 bg-surface2 rounded-xl font-semibold disabled:opacity-40 hover:bg-navy-pale hover:text-navy transition-colors">
            ← Previous
          </button>
          <span>Page {page} of {Math.ceil(meta.total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={orders.length < 20}
            className="px-4 py-2 bg-surface2 rounded-xl font-semibold disabled:opacity-40 hover:bg-navy-pale hover:text-navy transition-colors">
            Next →
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
