'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { brandApi, fmtMoney } from '../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'orders',    label: 'Orders & Payments' },
  { key: 'enquiries', label: 'Enquiries' },
];

const TYPE_FILTERS = [
  { key: 'pay_at_store', icon: '🏪', label: 'Walk-in Payments', short: 'Walk-in',  badgeCls: 'walk' },
  { key: 'prebook',      icon: '📅', label: 'Pre-bookings',     short: 'Pre-book', badgeCls: 'pre'  },
  { key: 'online_order', icon: '📦', label: 'Online Orders',    short: 'Order',    badgeCls: 'ord'  },
];

// Tx status enum: completed / initiated / returned / refunded
const TX_STATUS_FILTERS = [
  { key: '',          label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'returned',  label: 'Returned' },
  { key: 'refunded',  label: 'Refunded' },
];

// Enquiry status enum: submitted / responded / converted / closed
// (Adjacent-fix: OLD UI's `new` / `contacted` colors were phantoms — backend
//  writes 'submitted' on INSERT and only ever PATCHes to canonical values.)
const ENQ_STATUS_FILTERS = [
  { key: '',          label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'responded', label: 'Responded' },
  { key: 'converted', label: 'Converted' },
  { key: 'closed',    label: 'Closed' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60)      return `${sec}s ago`;
  if (sec < 3600)    return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400)  return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604_800) return `${Math.floor(sec / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Rental detection — a transaction is rental-shaped when fb.pickup_date is set.
function isRental(tx) {
  return Boolean(tx && tx.pickup_date);
}

// Resolve the per-row badge variant from transaction_type (+ rental override).
function badgeFor(tx) {
  if (isRental(tx)) return { cls: 'pre', icon: '📅', label: 'Rental' };
  const f = TYPE_FILTERS.find(t => t.key === tx?.transaction_type);
  if (f) return { cls: f.badgeCls, icon: f.icon, label: f.short };
  return { cls: 'walk', icon: '🏪', label: tx?.transaction_type || '—' };
}

// ─── Locked palette CSS (scoped under .cnv — day-1 discipline) ──────────────
const CSS = `
.cnv *{box-sizing:border-box}
.cnv{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --conv:#7E22CE; --conv-pale:#F3E8FF;
  --eng:#0E7490; --eng-pale:#CFFAFE;
  --info:#1D4ED8; --info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;
  color:var(--ink); font-size:13px; line-height:1.45;
}
.cnv .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}
.cnv .display{font-family:'Outfit',sans-serif}

.cnv .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.cnv .hdr-l h1{font-family:'Outfit';font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.cnv .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.cnv .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.cnv .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}

.cnv .hero{background:var(--ink);color:var(--white);border-radius:16px;padding:22px 26px;margin-bottom:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;position:relative;overflow:hidden}
.cnv .hero::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:var(--yellow);border-radius:50%;opacity:.06}
.cnv .hero-cell{position:relative;z-index:2;border-left:1px solid rgba(255,255,255,.08);padding-left:18px}
.cnv .hero-cell:first-child{border-left:0;padding-left:0}
.cnv .hero-v{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:800;letter-spacing:-.6px;color:var(--white);line-height:1.1}
.cnv .hero-v.yel{color:var(--yellow)}
.cnv .hero-l{font-family:'Outfit',sans-serif;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-top:6px}
.cnv .hero-s{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:rgba(255,255,255,.4);margin-top:3px}

.cnv .ch-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.cnv .ch-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:14px 16px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:12px;text-align:left;width:100%;color:var(--ink)}
.cnv .ch-card:hover:not(:disabled){border-color:var(--muted-3);color:var(--ink);background:var(--white)}
.cnv .ch-card.act{background:var(--ink);border-color:var(--ink);color:var(--white)}
.cnv .ch-card.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--white)}
.cnv .ch-card.act .ch-ic{background:var(--yellow);color:var(--ink)}
.cnv .ch-card.act .ch-v{color:var(--yellow)}
.cnv .ch-card.act .ch-l{color:rgba(255,255,255,.65)}
.cnv .ch-card:disabled{opacity:.55;cursor:not-allowed;background:var(--white);color:var(--ink)}
.cnv .ch-ic{width:36px;height:36px;border-radius:10px;background:var(--yellow-pale);color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.cnv .ch-v{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:800;color:var(--ink);line-height:1.1}
.cnv .ch-l{font-family:'Outfit',sans-serif;font-size:10.5px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:2px}

.cnv .subtabs{display:inline-flex;gap:2px;background:var(--bg2);border-radius:12px;padding:4px;margin-bottom:14px}
.cnv .subtab{padding:8px 18px;border-radius:9px;font-size:12.5px;font-weight:700;color:var(--muted);background:transparent;display:inline-flex;align-items:center;gap:7px;border:0;cursor:pointer;font-family:inherit}
.cnv .subtab:hover:not(.act):not(:disabled){color:var(--ink);background:transparent}
.cnv .subtab.act{background:var(--ink);color:var(--yellow)}
.cnv .subtab.act:hover:not(:disabled){background:var(--ink);color:var(--yellow)}
.cnv .subtab .ct{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;background:rgba(255,255,255,.12);color:inherit;padding:2px 7px;border-radius:99px}
.cnv .subtab:not(.act) .ct{background:var(--white);color:var(--muted-2)}

.cnv .status-bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.cnv .chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit}
.cnv .chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.cnv .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow);font-weight:700}
.cnv .chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.cnv .chip:disabled{opacity:.4;cursor:not-allowed;background:var(--white);color:var(--muted)}
.cnv .chip .ct{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;margin-left:5px;opacity:.7}

.cnv .tc{background:var(--white);border:1px solid var(--border);border-radius:14px;margin-bottom:8px;overflow:hidden;transition:all .15s}
.cnv .tc:hover{border-color:var(--muted-3)}
.cnv .tc.open{border-color:var(--ink)}
.cnv .tc-row{padding:14px 16px;display:grid;grid-template-columns:auto 1fr auto auto auto;gap:14px;align-items:center;cursor:pointer;width:100%;text-align:left;background:transparent;border:0;color:var(--ink);font-family:inherit}
.cnv .tc-row:hover:not(:disabled){background:transparent;color:var(--ink)}
.cnv .tc-badge{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;padding:5px 10px;border-radius:8px;background:var(--yellow-pale);color:var(--ink);text-transform:uppercase;letter-spacing:.3px;flex-shrink:0;width:max-content}
.cnv .tc-badge.walk{background:var(--yellow-pale);color:var(--yellow-text)}
.cnv .tc-badge.pre{background:var(--info-pale);color:var(--info)}
.cnv .tc-badge.ord{background:var(--conv-pale);color:var(--conv)}
.cnv .tc-badge.enq{background:var(--bg2);color:var(--muted)}
.cnv .tc-mid{min-width:0;text-align:left}
.cnv .tc-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cnv .tc-name .dot{color:var(--muted-3);margin:0 6px}
.cnv .tc-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cnv .tc-amt{text-align:right;flex-shrink:0;min-width:110px}
.cnv .tc-amt-v{font-family:'JetBrains Mono',monospace;font-size:14.5px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
.cnv .tc-amt-v.dim{font-size:11.5px;color:var(--muted-2);font-weight:600}
.cnv .tc-amt-s{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted-2);margin-top:2px}
.cnv .tc-amt-s b{color:var(--success-text);font-weight:700}
.cnv .status-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0;display:inline-block}
.cnv .status-pill.completed{background:var(--success-pale);color:var(--success-text)}
.cnv .status-pill.initiated{background:var(--yellow-pale);color:var(--yellow-text)}
.cnv .status-pill.returned{background:var(--danger-pale);color:var(--danger-text)}
.cnv .status-pill.refunded{background:var(--bg2);color:var(--muted-2)}
.cnv .status-pill.submitted{background:var(--yellow-pale);color:var(--yellow-text)}
.cnv .status-pill.responded{background:var(--info-pale);color:var(--info)}
.cnv .status-pill.converted{background:var(--success-pale);color:var(--success-text)}
.cnv .status-pill.closed{background:var(--bg2);color:var(--muted-2)}
.cnv .status-pill.unknown{background:var(--bg2);color:var(--muted)}
.cnv .tc-dt{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);text-align:right;min-width:78px}

.cnv .tc-exp{background:var(--bg);border-top:1px solid var(--border-soft);padding:18px 20px}
.cnv .tc-exp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 18px;margin-bottom:14px}
.cnv .kv{display:flex;flex-direction:column;gap:3px;min-width:0}
.cnv .kv-l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.cnv .kv-v{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cnv .kv-v.bold{font-weight:800}
.cnv .kv-v.green{color:var(--success-text)}
.cnv .kv-v.orange{color:var(--danger-text)}
.cnv .kv-v.muted{color:var(--muted)}
.cnv .tc-exp-note{padding:10px 14px;background:var(--white);border:1px solid var(--border-soft);border-radius:10px;font-size:12px;color:var(--muted);line-height:1.5}
.cnv .tc-exp-note b{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px}

.cnv .enq-exp-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}
.cnv .enq-f{background:var(--white);border:1px solid var(--border-soft);border-radius:10px;padding:10px 12px;min-width:0}
.cnv .enq-f.wide{grid-column:1 / -1}
.cnv .enq-f-l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.cnv .enq-f-v{font-size:12.5px;color:var(--ink);font-weight:600;word-break:break-word;white-space:pre-wrap}
.cnv .enq-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap}
.cnv .btn-convert{padding:9px 16px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.cnv .btn-convert:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.cnv .btn-convert:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}

.cnv .coupon-chip{display:inline-flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;background:var(--yellow-pale);color:var(--yellow-text);border:1px dashed var(--yellow);margin-left:6px}

.cnv .pager{display:flex;justify-content:center;align-items:center;gap:14px;margin-top:18px}
.cnv .pg-btn{padding:8px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:11.5px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.cnv .pg-btn:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.cnv .pg-btn:disabled{opacity:.3;cursor:not-allowed;background:var(--white);color:var(--ink)}
.cnv .pg-info{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2)}

.cnv .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px;position:relative;overflow:hidden}
.cnv .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.cnv .empty > *{position:relative;z-index:2}
.cnv .empty .ic{width:60px;height:60px;background:var(--ink);color:var(--yellow);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:24px;margin:0 auto 14px}
.cnv .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.cnv .empty .t{font-size:12px;color:var(--muted);line-height:1.55;max-width:480px;margin:0 auto}

.cnv .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:cnv-spin .8s linear infinite;margin:80px auto}
@keyframes cnv-spin{to{transform:rotate(360deg)}}

.cnv .toast{position:fixed;bottom:24px;right:24px;background:var(--ink);color:var(--white);padding:12px 16px;border-radius:12px;font-size:13px;font-weight:600;z-index:50;box-shadow:0 10px 25px rgba(0,0,0,.15)}
`;

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ConversionsPage() {
  const [activeTab, setActiveTab] = useState('orders');

  // Orders state
  const [transactions, setTransactions] = useState([]);
  const [txSummary, setTxSummary] = useState(null);
  const [txLoading, setTxLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');     // '' = all channels
  const [statusFilter, setStatusFilter] = useState(''); // '' = all statuses
  const [txPage, setTxPage] = useState(1);
  const [txMeta, setTxMeta] = useState(null);
  const [expandedTx, setExpandedTx] = useState(null);

  // Enquiries state
  const [enquiries, setEnquiries] = useState([]);
  const [enqLoading, setEnqLoading] = useState(true);
  const [enqStatusFilter, setEnqStatusFilter] = useState('');
  const [expandedEnq, setExpandedEnq] = useState(null);

  // Toast
  const [toast, setToast] = useState('');

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = [`page=${txPage}`, 'limit=20'];
      if (typeFilter)   params.push(`type=${typeFilter}`);
      if (statusFilter) params.push(`status=${statusFilter}`);
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
  }, [txPage, typeFilter, statusFilter]);

  const loadEnquiries = useCallback(async () => {
    setEnqLoading(true);
    try {
      const res = await brandApi.getEnquiries();
      if (res.success) setEnquiries(res.data?.enquiries || res.data || []);
    } catch (e) {
      console.error('Load enquiries error:', e);
    } finally {
      setEnqLoading(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadEnquiries(); }, [loadEnquiries]);

  // ── Enquiry helpers ──────────────────────────────────────────────────────

  async function markConverted(id) {
    // Mutation shape preserved verbatim from OLD page — prompt() capture is
    // intentionally kept (replacing with inline input is out of scope per 05-impact).
    const dealValue = prompt('Enter deal value (₹):');
    if (!dealValue) return;
    const res = await brandApi.updateEnquiry(id, { status: 'converted', deal_value: parseFloat(dealValue) });
    if (res.success) { showToast('Marked as converted!'); loadEnquiries(); setExpandedEnq(null); }
    else showToast(res.error?.message || 'Failed');
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  // ── Derived counts ───────────────────────────────────────────────────────

  const totalTxCount = txMeta?.total ?? 0;
  const enqCount = enquiries.length;
  const headerCount = activeTab === 'orders' ? totalTxCount : enqCount;

  // Per-status enquiry counts (client-side, since enquiries returns full array)
  const enqCounts = useMemo(() => {
    const c = { '': enquiries.length, submitted: 0, responded: 0, converted: 0, closed: 0 };
    for (const e of enquiries) {
      const s = e?.status;
      if (s && c[s] !== undefined) c[s] += 1;
    }
    return c;
  }, [enquiries]);

  // Filtered enquiries view
  const visibleEnq = useMemo(() => {
    if (!enqStatusFilter) return enquiries;
    return enquiries.filter(e => e?.status === enqStatusFilter);
  }, [enquiries, enqStatusFilter]);

  // Per-status TX counts: only fully reliable when type+status both unfiltered
  // and all rows fit on page 1. Otherwise we degrade to '—' per Flow 10 discipline.
  const txCountsReliable = !typeFilter && !statusFilter && (txMeta ? txMeta.total <= 20 : false);
  const txCounts = useMemo(() => {
    if (!txCountsReliable) return { '': totalTxCount, completed: '—', initiated: '—', returned: '—', refunded: '—' };
    const c = { '': transactions.length, completed: 0, initiated: 0, returned: 0, refunded: 0 };
    for (const t of transactions) {
      const s = t?.status;
      if (s && c[s] !== undefined) c[s] += 1;
    }
    return c;
  }, [transactions, txCountsReliable, totalTxCount]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="cnv">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{headerCount} {activeTab === 'orders' ? 'transactions' : 'enquiries'}</span>
          <h1>Conversions</h1>
          <div className="rule" />
          <div className="sub">Orders, payments, and enquiry leads attributed to your influencer campaigns.</div>
        </div>
      </div>

      {/* INK hero · 3 KPIs (all-time, relevant to both tabs) */}
      <div className="hero">
        <div className="hero-cell">
          <div className="hero-v mono">{fmtMoney(txSummary?.total_revenue ?? 0)}</div>
          <div className="hero-l">Total Revenue</div>
          <div className="hero-s">gross customer pay · {txSummary?.total_transactions ?? 0} tx</div>
        </div>
        <div className="hero-cell">
          <div className="hero-v yel mono">{fmtMoney(txSummary?.total_brand_net ?? 0)}</div>
          <div className="hero-l">Your Net</div>
          <div className="hero-s">after commission + platform fee</div>
        </div>
        <div className="hero-cell">
          <div className="hero-v mono">{fmtMoney(txSummary?.total_commission ?? 0)}</div>
          <div className="hero-l">Commission Paid</div>
          <div className="hero-s">to influencers · all-time</div>
        </div>
      </div>

      {/* Channel chip row — clickable filters (Orders tab) / display-only (Enquiries tab) */}
      <div className="ch-row">
        {TYPE_FILTERS.map(t => {
          const count = txSummary?.[`${t.key}_count`] ?? 0;
          const isAct = activeTab === 'orders' && typeFilter === t.key;
          const isDisabled = activeTab !== 'orders';
          return (
            <button
              key={t.key}
              className={`ch-card${isAct ? ' act' : ''}`}
              onClick={() => {
                if (isDisabled) return;
                setTypeFilter(typeFilter === t.key ? '' : t.key);
                setTxPage(1);
                setExpandedTx(null);
              }}
              disabled={isDisabled}
            >
              <div className="ch-ic">{t.icon}</div>
              <div>
                <div className="ch-v mono">{count}</div>
                <div className="ch-l">{t.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-tabs */}
      <div className="subtabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`subtab${activeTab === t.key ? ' act' : ''}`}
            onClick={() => { setActiveTab(t.key); setExpandedTx(null); setExpandedEnq(null); }}
          >
            {t.label}
            <span className="ct">{t.key === 'orders' ? totalTxCount : enqCount}</span>
          </button>
        ))}
      </div>

      {/* ── Orders & Payments tab ─────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div>
          {/* Status filter chips — uses existing backend ?status= */}
          <div className="status-bar">
            {TX_STATUS_FILTERS.map(s => {
              const isAct = statusFilter === s.key;
              const count = txCounts[s.key];
              return (
                <button
                  key={s.key || 'all'}
                  className={`chip${isAct ? ' act' : ''}`}
                  onClick={() => { setStatusFilter(isAct ? '' : s.key); setTxPage(1); setExpandedTx(null); }}
                >
                  {s.label}
                  <span className="ct mono">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Feed */}
          {txLoading ? (
            <div className="spinner" />
          ) : transactions.length === 0 ? (
            <div className="empty">
              <div className="ic">✓</div>
              <div className="h">No transactions in this view</div>
              <div className="t">Try a different channel or status filter, or check back later — completed transactions arrive when followers pay through your influencers' tracking links.</div>
            </div>
          ) : (
            <div>
              {transactions.map(tx => {
                const b = badgeFor(tx);
                const isOpen = expandedTx === tx.id;
                const statusKey = TX_STATUS_FILTERS.some(s => s.key === tx.status) ? tx.status : 'unknown';
                const rental = isRental(tx);
                const subBits = [];
                if (tx.instagram_handle) subBits.push(`via @${tx.instagram_handle}`);
                if (tx.campaign_name)    subBits.push(`"${tx.campaign_name}"`);
                if (rental && tx.pickup_type) subBits.push(tx.pickup_type);
                else if (tx.booking_date)     subBits.push(`booking ${tx.booking_date}${tx.booking_time ? ` · ${tx.booking_time}` : ''}`);

                return (
                  <div key={tx.id} className={`tc${isOpen ? ' open' : ''}`}>
                    <button
                      className="tc-row"
                      onClick={() => setExpandedTx(isOpen ? null : tx.id)}
                      aria-expanded={isOpen}
                    >
                      <span className={`tc-badge ${b.cls}`}>{b.icon} {b.label}</span>
                      <div className="tc-mid">
                        <div className="tc-name">
                          {tx.follower_name || 'Follower'}
                          {tx.product_name ? <><span className="dot">·</span>{tx.product_name}</> : null}
                        </div>
                        <div className="tc-meta">
                          {subBits.join(' · ') || '—'}
                          {tx.coupon_code_used ? <span className="coupon-chip">{tx.coupon_code_used}</span> : null}
                        </div>
                      </div>
                      <div className="tc-amt">
                        {tx.status === 'initiated' || tx.status === 'returned' || tx.status === 'refunded' ? (
                          <>
                            <div className="tc-amt-v">{fmtMoney(tx.net_amount ?? 0)}</div>
                            <div className="tc-amt-s">{tx.status === 'initiated' ? 'pending' : (tx.status === 'returned' ? 'refunded' : '—')}</div>
                          </>
                        ) : (
                          <>
                            <div className="tc-amt-v">{fmtMoney(tx.net_amount ?? 0)}</div>
                            <div className="tc-amt-s">net <b>{fmtMoney(tx.brand_net ?? 0)}</b></div>
                          </>
                        )}
                      </div>
                      <span className={`status-pill ${statusKey}`}>● {tx.status || '—'}</span>
                      <span className="tc-dt">{fmtRelative(tx.created_at)}</span>
                    </button>

                    {isOpen && (
                      <div className="tc-exp">
                        {/* financial waterfall */}
                        <div className="tc-exp-grid">
                          <KV l="Bill Amount"            v={fmtMoney(tx.gross_amount ?? 0)} />
                          <KV l="Discount"               v={`−${fmtMoney(tx.discount_amount ?? 0)}`} cls="green" />
                          <KV l="Customer Paid"          v={fmtMoney(tx.net_amount ?? 0)} bold />
                          <KV l="Your Net"               v={fmtMoney(tx.brand_net ?? 0)} bold />
                          <KV l="Influencer Commission"  v={fmtMoney(tx.influencer_commission ?? 0)} cls="orange" />
                          <KV l="Platform Fee"           v={fmtMoney(tx.platform_fee ?? 0)} cls="muted" />
                          <KV l="Coupon Used"            v={tx.coupon_code_used || '—'} />
                          <KV l="Payment ID"             v={tx.razorpay_payment_id ? tx.razorpay_payment_id.substring(0, 16) : '—'} cls="muted" />
                        </div>

                        {/* rental block — only on rental-shaped rows (NEW surface) */}
                        {rental && (
                          <div className="tc-exp-grid" style={{ marginTop: 4 }}>
                            <KV l="Pickup Date"   v={fmtDate(tx.pickup_date)} />
                            <KV l="Return Date"   v={fmtDate(tx.return_date)} />
                            <KV l="Duration"      v={tx.duration_days != null ? `${tx.duration_days} day${tx.duration_days === 1 ? '' : 's'}` : '—'} />
                            <KV l="Pickup Type"   v={tx.pickup_type || '—'} />
                            <KV l="Booking Ref"   v={tx.booking_ref || '—'} />
                            <KV l="Customer Phone" v={tx.follower_phone || '—'} />
                            <KV l="Campaign"      v={tx.campaign_name || '—'} cls="muted" />
                            <KV l="Channel"       v={tx.transaction_type || '—'} />
                          </div>
                        )}

                        {/* non-rental booking row — show booking date + ref if present */}
                        {!rental && (tx.booking_date || tx.booking_ref || tx.order_status || tx.follower_phone) && (
                          <div className="tc-exp-grid" style={{ marginTop: 4 }}>
                            {tx.booking_date && <KV l="Booking Date" v={`${tx.booking_date}${tx.booking_time ? ` · ${tx.booking_time}` : ''}`} />}
                            {tx.booking_ref  && <KV l="Booking Ref"  v={tx.booking_ref} />}
                            {tx.order_status && <KV l="Order Status" v={tx.order_status} />}
                            {tx.follower_phone && <KV l="Customer Phone" v={tx.follower_phone} />}
                            <KV l="Campaign" v={tx.campaign_name || '—'} cls="muted" />
                            <KV l="Channel"  v={tx.transaction_type || '—'} />
                          </div>
                        )}

                        {/* booking notes — NEW surface */}
                        {tx.booking_notes && (
                          <div className="tc-exp-note">
                            <b>Booking notes</b>
                            {tx.booking_notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {txMeta && txMeta.total > 20 && (
            <div className="pager">
              <button
                className="pg-btn"
                onClick={() => setTxPage(p => Math.max(1, p - 1))}
                disabled={txPage <= 1}
              >← Previous</button>
              <span className="pg-info">Page {txPage} of {Math.max(1, Math.ceil(txMeta.total / 20))}</span>
              <button
                className="pg-btn"
                onClick={() => setTxPage(p => p + 1)}
                disabled={txPage * 20 >= txMeta.total}
              >Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Enquiries tab ─────────────────────────────────────────────────── */}
      {activeTab === 'enquiries' && (
        <div>
          {/* Status filter chips */}
          <div className="status-bar">
            {ENQ_STATUS_FILTERS.map(s => {
              const isAct = enqStatusFilter === s.key;
              return (
                <button
                  key={s.key || 'all'}
                  className={`chip${isAct ? ' act' : ''}`}
                  onClick={() => { setEnqStatusFilter(isAct ? '' : s.key); setExpandedEnq(null); }}
                >
                  {s.label}
                  <span className="ct mono">{enqCounts[s.key] ?? 0}</span>
                </button>
              );
            })}
          </div>

          {/* Feed */}
          {enqLoading ? (
            <div className="spinner" />
          ) : visibleEnq.length === 0 ? (
            <div className="empty">
              <div className="ic">✓</div>
              <div className="h">No enquiries in this view</div>
              <div className="t">When a follower submits an enquiry through one of your influencers' service pages, it'll appear here for you to respond and convert.</div>
            </div>
          ) : (
            <div>
              {visibleEnq.map(eq => {
                const isOpen = expandedEnq === eq.id;
                const statusKey = ENQ_STATUS_FILTERS.some(s => s.key === eq.status) ? eq.status : 'unknown';
                const isConverted = eq.status === 'converted';
                const form = eq.form_data_json || eq.form_data || {};
                const serviceLabel = form.service_type || form.service || 'General enquiry';
                const subBits = [];
                if (eq.influencer_name) subBits.push(`via @${eq.influencer_name}`);
                if (isConverted && eq.commission_triggered) subBits.push('commission triggered');

                return (
                  <div key={eq.id} className={`tc${isOpen ? ' open' : ''}`}>
                    <button
                      className="tc-row"
                      onClick={() => setExpandedEnq(isOpen ? null : eq.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="tc-badge enq">💬 Enquiry</span>
                      <div className="tc-mid">
                        <div className="tc-name">
                          {eq.follower_name || 'Follower'}<span className="dot">·</span>{serviceLabel}
                        </div>
                        <div className="tc-meta">
                          {subBits.join(' · ') || '—'}
                          {eq.coupon_code ? <span className="coupon-chip">{eq.coupon_code}</span> : null}
                        </div>
                      </div>
                      <div className="tc-amt">
                        {isConverted && eq.deal_value != null ? (
                          <>
                            <div className="tc-amt-v">{fmtMoney(eq.deal_value)}</div>
                            <div className="tc-amt-s">deal value</div>
                          </>
                        ) : (
                          <div className="tc-amt-v dim">—</div>
                        )}
                      </div>
                      <span className={`status-pill ${statusKey}`}>● {eq.status || '—'}</span>
                      <span className="tc-dt">{fmtRelative(eq.created_at)}</span>
                    </button>

                    {isOpen && (
                      <div className="tc-exp">
                        <div className="enq-exp-form">
                          {Object.entries(form).length === 0 ? (
                            <div className="enq-f wide">
                              <div className="enq-f-l">Form data</div>
                              <div className="enq-f-v">—</div>
                            </div>
                          ) : (
                            Object.entries(form).map(([k, v]) => {
                              const txt = (v == null) ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
                              const wide = txt.length > 60;
                              return (
                                <div key={k} className={`enq-f${wide ? ' wide' : ''}`}>
                                  <div className="enq-f-l">{k.replace(/_/g, ' ')}</div>
                                  <div className="enq-f-v">{txt}</div>
                                </div>
                              );
                            })
                          )}
                          {eq.follower_phone && (
                            <div className="enq-f">
                              <div className="enq-f-l">Customer Phone</div>
                              <div className="enq-f-v">{eq.follower_phone}</div>
                            </div>
                          )}
                          {isConverted && eq.deal_value != null && (
                            <div className="enq-f">
                              <div className="enq-f-l">Deal Value</div>
                              <div className="enq-f-v mono">{fmtMoney(eq.deal_value)}</div>
                            </div>
                          )}
                        </div>
                        {!isConverted && (
                          <div className="enq-actions">
                            <button className="btn-convert" onClick={() => markConverted(eq.id)}>✓ Mark as Converted</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ─── Internal Components ────────────────────────────────────────────────────

function KV({ l, v, bold, cls }) {
  return (
    <div className="kv">
      <span className="kv-l">{l}</span>
      <span className={`kv-v${bold ? ' bold' : ''}${cls ? ` ${cls}` : ''}`}>{v}</span>
    </div>
  );
}
