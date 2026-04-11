'use client';
import { useEffect, useState, useCallback } from 'react';
import { brandApi, fmtMoney } from '../../../lib/api';

const TYPE_FILTERS = [
  { key: 'all', label: 'All Transactions' },
  { key: 'pay_at_store', label: '🏪 Pay at Store' },
  { key: 'prebook', label: '📅 Pre-bookings' },
  { key: 'online_order', label: '📦 Online Orders' },
];

const TYPE_STYLES = {
  pay_at_store:  { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Walk-in Pay' },
  prebook:       { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Pre-booking' },
  online_order:  { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Online Order' },
  redirect_click:{ bg: 'bg-gray-50', text: 'text-gray-700', label: 'Click' },
};

const STATUS_STYLES = {
  completed:  'bg-green-50 text-green-700',
  initiated:  'bg-yellow-50 text-yellow-700',
  returned:   'bg-red-50 text-red-600',
  refunded:   'bg-gray-100 text-gray-600',
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [expandedId, setExpanded] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = [`page=${page}`, 'limit=20'];
      if (typeFilter !== 'all') params.push(`type=${typeFilter}`);
      const res = await brandApi.get(`/brands/me/transactions?${params.join('&')}`);
      if (res.success || res.data) {
        setTransactions(res.data?.transactions || []);
        setSummary(res.data?.summary || null);
        setMeta(res.meta || null);
      }
    } catch (e) {
      console.error('Load transactions error:', e);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-1">Transactions</h1>
      <p className="text-sm text-gray-500 mb-6">All follower payments across your campaigns</p>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Total Revenue" value={fmtMoney(summary.total_revenue)} color="text-gray-900" />
          <SummaryCard label="Your Net" value={fmtMoney(summary.total_brand_net)} color="text-teal-600" />
          <SummaryCard label="Commission Paid" value={fmtMoney(summary.total_commission)} color="text-orange-600" />
          <SummaryCard label="Transactions" value={summary.total_transactions} color="text-blue-600" />
        </div>
      )}

      {/* Channel breakdown */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-teal-50 rounded-xl p-3 text-center border border-teal-200">
            <div className="text-lg font-extrabold text-teal-700">{summary.pay_at_store_count}</div>
            <div className="text-[10px] text-teal-500 font-semibold uppercase">Walk-in Payments</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-200">
            <div className="text-lg font-extrabold text-blue-700">{summary.prebook_count}</div>
            <div className="text-[10px] text-blue-500 font-semibold uppercase">Pre-bookings</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-200">
            <div className="text-lg font-extrabold text-purple-700">{summary.online_order_count}</div>
            <div className="text-[10px] text-purple-500 font-semibold uppercase">Online Orders</div>
          </div>
        </div>
      )}

      {/* Type filters */}
      <div className="flex gap-2 mb-4">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setType(f.key); setPage(1); }}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all
              ${typeFilter === f.key ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {loading ? (
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
            const isExpanded = expandedId === tx.id;

            return (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Main row */}
                <button
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : tx.id)}
                >
                  {/* Type badge */}
                  <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${typeInfo.bg} ${typeInfo.text} flex-shrink-0`}>
                    {typeInfo.label}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">
                      {tx.follower_name || 'Follower'} {tx.product_name ? `· ${tx.product_name}` : ''}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {tx.influencer_name ? `via ${tx.influencer_name} (@${tx.instagram_handle})` : ''}
                      {tx.campaign_name ? ` · ${tx.campaign_name}` : ''}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-extrabold text-gray-900">{fmtMoney(tx.net_amount)}</div>
                    <div className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>

                  {/* Status */}
                  <div className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase ${STATUS_STYLES[tx.status] || 'bg-gray-100 text-gray-500'}`}>
                    {tx.status}
                  </div>

                  <div className="text-gray-300">{isExpanded ? '▲' : '▼'}</div>
                </button>

                {/* Expanded detail */}
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
      {meta && meta.total > 20 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-500">Page {page} of {Math.ceil(meta.total / 20)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 20 >= meta.total}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

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
