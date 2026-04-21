'use client';
import { useEffect, useState, useCallback } from 'react';
import { brandApi, fmtMoney } from '../../../lib/api';

/* ── Constants ─────────────────────────────────────────────── */

const TABS = [
  { key: 'orders', label: 'Orders & Payments' },
  { key: 'enquiries', label: 'Enquiries' },
];

const TYPE_FILTERS = [
  { key: 'all', label: 'All Transactions' },
  { key: 'pay_at_store', label: '🏪 Pay at Store' },
  { key: 'prebook', label: '📅 Pre-bookings' },
  { key: 'online_order', label: '📦 Online Orders' },
];

const TYPE_STYLES = {
  pay_at_store:   { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Walk-in Pay' },
  prebook:        { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Pre-booking' },
  online_order:   { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Online Order' },
  redirect_click: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Click' },
};

const TX_STATUS_STYLES = {
  completed: 'bg-green-50 text-green-700',
  initiated: 'bg-yellow-50 text-yellow-700',
  returned:  'bg-red-50 text-red-600',
  refunded:  'bg-gray-100 text-gray-600',
};

const ENQ_STATUS_STYLES = {
  new:       'bg-yellow-50 text-yellow-700',
  contacted: 'bg-blue-50 text-blue-700',
  converted: 'bg-green-50 text-green-700',
  closed:    'bg-gray-100 text-gray-500',
};

/* ── Main Page ─────────────────────────────────────────────── */

export default function ConversionsPage() {
  const [activeTab, setActiveTab] = useState('orders');

  // Orders state
  const [transactions, setTransactions] = useState([]);
  const [txSummary, setTxSummary] = useState(null);
  const [txLoading, setTxLoading] = useState(true);
  const [typeFilter, setType] = useState('all');
  const [txPage, setTxPage] = useState(1);
  const [txMeta, setTxMeta] = useState(null);
  const [expandedTx, setExpandedTx] = useState(null);

  // Enquiries state
  const [enquiries, setEnquiries] = useState([]);
  const [enqLoading, setEnqLoading] = useState(true);
  const [selectedEnq, setSelectedEnq] = useState(null);
  const [toast, setToast] = useState('');

  /* ── Data loading ──────────────────────────────────────── */

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = [`page=${txPage}`, 'limit=20'];
      if (typeFilter !== 'all') params.push(`type=${typeFilter}`);
      const res = await brandApi.get(`/brands/me/transactions?${params.join('&')}`);
      if (res.success || res.data) {
        setTransactions(res.data?.transactions || []);
        setTxSummary(res.data?.summary || null);
        setTxMeta(res.meta || null);
      }
    } catch (e) {
      console.error('Load transactions error:', e);
    } finally {
      setTxLoading(false);
    }
  }, [txPage, typeFilter]);

  async function loadEnquiries() {
    setEnqLoading(true);
    try {
      const res = await brandApi.getEnquiries();
      if (res.success) setEnquiries(res.data?.enquiries || res.data || []);
    } catch (e) {
      console.error('Load enquiries error:', e);
    } finally {
      setEnqLoading(false);
    }
  }

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadEnquiries(); }, []);

  /* ── Enquiry helpers ───────────────────────────────────── */

  async function markConverted(id) {
    const dealValue = prompt('Enter deal value (₹):');
    if (!dealValue) return;
    const res = await brandApi.updateEnquiry(id, { status: 'converted', deal_value: parseFloat(dealValue) });
    if (res.success) { showToast('Marked as converted!'); loadEnquiries(); setSelectedEnq(null); }
    else showToast(res.error?.message || 'Failed');
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  /* ── Derived summary counts ────────────────────────────── */

  const totalOrders = txSummary?.total_transactions ?? 0;
  const totalRevenue = txSummary?.total_revenue ?? 0;
  const totalEnquiries = enquiries.length;
  const convertedEnquiries = enquiries.filter(e => e.status === 'converted').length;

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-1">Conversions</h1>
      <p className="text-sm text-gray-500 mb-6">Orders, payments, and enquiry leads from your campaigns</p>

      {/* Combined summary header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total Orders" value={totalOrders} color="text-blue-600" />
        <SummaryCard label="Total Revenue" value={fmtMoney(totalRevenue)} color="text-gray-900" />
        <SummaryCard label="Total Enquiries" value={totalEnquiries} color="text-purple-600" />
        <SummaryCard label="Converted" value={convertedEnquiries} color="text-green-600" />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all
              ${activeTab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Orders & Payments Tab ─────────────────────────── */}
      {activeTab === 'orders' && (
        <div>
          {/* Channel breakdown */}
          {txSummary && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-teal-50 rounded-xl p-3 text-center border border-teal-200">
                <div className="text-lg font-extrabold text-teal-700">{txSummary.pay_at_store_count}</div>
                <div className="text-[10px] text-teal-500 font-semibold uppercase">Walk-in Payments</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-200">
                <div className="text-lg font-extrabold text-blue-700">{txSummary.prebook_count}</div>
                <div className="text-[10px] text-blue-500 font-semibold uppercase">Pre-bookings</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-200">
                <div className="text-lg font-extrabold text-purple-700">{txSummary.online_order_count}</div>
                <div className="text-[10px] text-purple-500 font-semibold uppercase">Online Orders</div>
              </div>
            </div>
          )}

          {/* Revenue detail cards */}
          {txSummary && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <SummaryCard label="Your Net" value={fmtMoney(txSummary.total_brand_net)} color="text-teal-600" />
              <SummaryCard label="Commission Paid" value={fmtMoney(txSummary.total_commission)} color="text-orange-600" />
              <SummaryCard label="Transactions" value={txSummary.total_transactions} color="text-blue-600" />
            </div>
          )}

          {/* Type filters */}
          <div className="flex gap-2 mb-4">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setType(f.key); setTxPage(1); }}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all
                  ${typeFilter === f.key
                    ? 'bg-orange-50 border-orange-300 text-orange-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Transaction list */}
          {txLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <div className="text-4xl mb-3">📊</div>
              <div className="text-lg font-bold text-gray-800">No transactions yet</div>
              <div className="text-sm text-gray-500 mt-1">Transactions will appear here when followers make payments</div>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => {
                const typeInfo = TYPE_STYLES[tx.transaction_type] || TYPE_STYLES.pay_at_store;
                const isExpanded = expandedTx === tx.id;

                return (
                  <div key={tx.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                    >
                      <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${typeInfo.bg} ${typeInfo.text} flex-shrink-0`}>
                        {typeInfo.label}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 truncate">
                          {tx.follower_name || 'Follower'} {tx.product_name ? `· ${tx.product_name}` : ''}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {tx.influencer_name ? `via ${tx.influencer_name} (@${tx.instagram_handle})` : ''}
                          {tx.campaign_name ? ` · ${tx.campaign_name}` : ''}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-extrabold text-gray-900">{fmtMoney(tx.net_amount)}</div>
                        <div className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>

                      <div className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase ${TX_STATUS_STYLES[tx.status] || 'bg-gray-100 text-gray-500'}`}>
                        {tx.status}
                      </div>

                      <div className="text-gray-300">{isExpanded ? '▲' : '▼'}</div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                          <DetailItem label="Bill Amount" value={fmtMoney(tx.gross_amount)} />
                          <DetailItem label="Discount" value={`-${fmtMoney(tx.discount_amount)}`} color="text-green-600" />
                          <DetailItem label="Customer Paid" value={fmtMoney(tx.net_amount)} bold />
                          <DetailItem label="Your Net" value={fmtMoney(tx.brand_net)} color="text-teal-600" bold />
                          <DetailItem label="Influencer Commission" value={fmtMoney(tx.influencer_commission)} color="text-orange-600" />
                          <DetailItem label="Platform Fee" value={fmtMoney(tx.platform_fee)} color="text-gray-500" />
                          <DetailItem label="Coupon Used" value={tx.coupon_code_used || '—'} />
                          <DetailItem label="Payment ID" value={tx.razorpay_payment_id?.substring(0, 16) || '—'} />
                          {tx.booking_date && <DetailItem label="Booking Date" value={`${tx.booking_date} ${tx.booking_time}`} />}
                          {tx.booking_ref && <DetailItem label="Booking Ref" value={tx.booking_ref} />}
                          {tx.order_status && <DetailItem label="Order Status" value={tx.order_status} />}
                          {tx.follower_phone && <DetailItem label="Customer Phone" value={tx.follower_phone} />}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {txMeta && txMeta.total > 20 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setTxPage(p => Math.max(1, p - 1))}
                disabled={txPage <= 1}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500">Page {txPage} of {Math.ceil(txMeta.total / 20)}</span>
              <button
                onClick={() => setTxPage(p => p + 1)}
                disabled={txPage * 20 >= txMeta.total}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Enquiries Tab ─────────────────────────────────── */}
      {activeTab === 'enquiries' && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_1fr_100px_120px_80px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <div>Enquiry</div><div>Influencer</div><div>Date</div><div>Status</div><div>Action</div>
            </div>

            {enqLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full" />
              </div>
            ) : enquiries.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-4xl mb-3">💬</div>
                <div className="font-bold text-gray-800 mb-1">No enquiries yet</div>
                <div className="text-xs text-gray-500">Enquiries from followers will appear here</div>
              </div>
            ) : (
              enquiries.map(eq => (
                <div
                  key={eq.id}
                  className="grid grid-cols-[1fr_1fr_100px_120px_80px] gap-3 px-4 py-3 border-b border-gray-200 last:border-0 items-center text-sm hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => setSelectedEnq(eq)}
                >
                  <div>
                    <div className="font-medium text-gray-900 text-xs truncate">{eq.form_data?.service_type || 'General enquiry'}</div>
                    <div className="text-[10px] text-gray-400 truncate">{eq.form_data?.notes?.slice(0, 40) || '—'}</div>
                  </div>
                  <div className="text-xs text-gray-600 truncate">@{eq.influencer_handle || '—'}</div>
                  <div className="text-[10px] text-gray-400">{eq.created_at ? new Date(eq.created_at).toLocaleDateString('en-IN') : '—'}</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ENQ_STATUS_STYLES[eq.status] || 'bg-gray-100 text-gray-500'}`}>
                      {eq.status}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={e => { e.stopPropagation(); markConverted(eq.id); }}
                      className="px-2 py-1 text-[10px] font-bold bg-green-50 text-green-700 rounded-lg hover:bg-green-600 hover:text-white transition-colors"
                    >
                      Convert
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Enquiry detail modal */}
      {selectedEnq && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-96 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Enquiry Detail</h3>
              <button onClick={() => setSelectedEnq(null)} className="text-gray-400 hover:text-gray-900">✕</button>
            </div>
            <div className="space-y-3">
              {Object.entries(selectedEnq.form_data || {}).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{k.replace(/_/g, ' ')}</div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-700">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => markConverted(selectedEnq.id)}
              className="w-full mt-4 py-2.5 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-700 transition-colors"
            >
              Mark as Converted
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Shared Components ─────────────────────────────────────── */

function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`text-xl font-extrabold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-400 font-semibold uppercase mt-1">{label}</div>
    </div>
  );
}

function DetailItem({ label, value, color, bold }) {
  return (
    <div>
      <div className="text-[10px] text-gray-400 font-semibold uppercase">{label}</div>
      <div className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${color || 'text-gray-800'} mt-0.5`}>{value}</div>
    </div>
  );
}
