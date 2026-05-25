'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { brandApi, fmtMoney } from '../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { key: 'pay_at_store', icon: '🏪', label: 'Walk-in Payments', short: 'Walk-in',  badgeCls: 'walk' },
  { key: 'prebook',      icon: '📅', label: 'Pre-bookings',     short: 'Pre-book', badgeCls: 'pre'  },
  { key: 'online_order', icon: '📦', label: 'Online Orders',    short: 'Order',    badgeCls: 'ord'  },
];

const TX_STATUS_FILTERS = [
  { key: '',          label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'returned',  label: 'Returned' },
  { key: 'refunded',  label: 'Refunded' },
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

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isRental(tx) {
  return Boolean(tx && tx.pickup_date);
}

function badgeFor(tx) {
  if (isRental(tx)) return { cls: 'pre', icon: '📅', label: 'Rental' };
  const f = TYPE_FILTERS.find(t => t.key === tx?.transaction_type);
  if (f) return { cls: f.badgeCls, icon: f.icon, label: f.short };
  return { cls: 'walk', icon: '🏪', label: tx?.transaction_type || '—' };
}

// ─── Locked palette CSS scoped under .ord ───────────────────────────────────
const CSS = `
.ord *{box-sizing:border-box}
.ord{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --conv:#7E22CE; --conv-pale:#F3E8FF;
  --info:#1D4ED8; --info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;
  color:var(--ink); font-size:13px; line-height:1.45;
  max-width:1080px; margin:0 auto;
}
.ord .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.ord .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.ord .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.ord .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.ord .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.ord .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}

.ord .hero{background:var(--ink);color:var(--white);border-radius:16px;padding:22px 26px;margin-bottom:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;position:relative;overflow:hidden}
.ord .hero::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:var(--yellow);border-radius:50%;opacity:.06}
.ord .hero-cell{position:relative;z-index:2;border-left:1px solid rgba(255,255,255,.08);padding-left:18px}
.ord .hero-cell:first-child{border-left:0;padding-left:0}
.ord .hero-v{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:800;color:var(--white);line-height:1.1;letter-spacing:-.6px}
.ord .hero-v.yel{color:var(--yellow)}
.ord .hero-l{font-family:'Outfit',sans-serif;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-top:6px}
.ord .hero-s{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:rgba(255,255,255,.4);margin-top:3px}

.ord .ch-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.ord .ch-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:12px 14px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:11px;text-align:left;width:100%;color:var(--ink);font-family:inherit}
.ord .ch-card:hover:not(:disabled){border-color:var(--muted-3);color:var(--ink);background:var(--white)}
.ord .ch-card.act{background:var(--ink);border-color:var(--ink);color:var(--white)}
.ord .ch-card.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--white)}
.ord .ch-card.act .ch-ic{background:var(--yellow);color:var(--ink)}
.ord .ch-card.act .ch-v{color:var(--yellow)}
.ord .ch-card.act .ch-l{color:rgba(255,255,255,.65)}
.ord .ch-ic{width:34px;height:34px;border-radius:10px;background:var(--yellow-pale);color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
.ord .ch-v{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:800;color:var(--ink);line-height:1.1}
.ord .ch-l{font-family:'Outfit',sans-serif;font-size:10px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:2px}

.ord .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.ord .chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit}
.ord .chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.ord .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow);font-weight:700}
.ord .chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.ord .chip .ct{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;margin-left:5px;opacity:.7}

.ord .tc{background:var(--white);border:1px solid var(--border);border-radius:12px;margin-bottom:6px;overflow:hidden;transition:all .15s}
.ord .tc:hover{border-color:var(--muted-3)}
.ord .tc.open{border-color:var(--ink)}
.ord .tc-row{padding:12px 14px;display:grid;grid-template-columns:auto 1fr auto auto auto;gap:12px;align-items:center;cursor:pointer;width:100%;text-align:left;background:transparent;border:0;color:var(--ink);font-family:inherit}
.ord .tc-badge{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;padding:5px 10px;border-radius:8px;background:var(--yellow-pale);color:var(--ink);text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.ord .tc-badge.walk{background:var(--yellow-pale);color:var(--yellow-text)}
.ord .tc-badge.pre{background:var(--info-pale);color:var(--info)}
.ord .tc-badge.ord{background:var(--conv-pale);color:var(--conv)}
.ord .tc-mid{min-width:0;text-align:left}
.ord .tc-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ord .tc-name .dot{color:var(--muted-3);margin:0 6px}
.ord .tc-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
.ord .tc-amt{text-align:right;flex-shrink:0;min-width:100px}
.ord .tc-amt-v{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
.ord .tc-amt-s{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);margin-top:1px}
.ord .tc-amt-s b{color:var(--success-text);font-weight:700}
.ord .status-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.ord .status-pill.completed{background:var(--success-pale);color:var(--success-text)}
.ord .status-pill.initiated{background:var(--yellow-pale);color:var(--yellow-text)}
.ord .status-pill.returned{background:var(--danger-pale);color:var(--danger-text)}
.ord .status-pill.refunded{background:var(--bg2);color:var(--muted-2)}
.ord .status-pill.unknown{background:var(--bg2);color:var(--muted)}
.ord .tc-dt{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);text-align:right;min-width:74px}

.ord .tc-exp{background:var(--bg);border-top:1px solid var(--border-soft);padding:14px}
.ord .tc-exp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.ord .kv{display:flex;flex-direction:column;gap:3px}
.ord .kv-l{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.ord .kv-v{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--ink)}
.ord .kv-v.green{color:var(--success-text)}
.ord .kv-v.bold{font-weight:800}
.ord .kv-v.muted{color:var(--muted)}
.ord .pager{display:flex;justify-content:center;align-items:center;gap:14px;margin-top:18px}
.ord .pg-btn{padding:8px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:11.5px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.ord .pg-btn:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.ord .pg-btn:disabled{opacity:.3;cursor:not-allowed}
.ord .pg-info{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2)}
.ord .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px}
.ord .empty .em{font-size:48px;margin-bottom:10px}
.ord .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.ord .empty .t{font-size:12px;color:var(--muted);max-width:480px;margin:0 auto}
.ord .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:ord-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes ord-spin{to{transform:rotate(360deg)}}
`;

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [typeFilter, setType]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]         = useState(1);
  const [meta, setMeta]         = useState(null);
  const [expandedId, setExpanded] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = [`page=${page}`, 'limit=20'];
      if (typeFilter)   params.push(`type=${typeFilter}`);
      if (statusFilter) params.push(`status=${statusFilter}`);
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
  }, [page, typeFilter, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="ord">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{meta?.total ?? 0} transactions</span>
          <h1>Transactions</h1>
          <div className="rule" />
          <div className="sub">All follower payments across your campaigns. See also <strong>/conversions</strong> for a combined view with enquiries.</div>
        </div>
      </div>

      <div className="hero">
        <div className="hero-cell">
          <div className="hero-v mono">{fmtMoney(summary?.total_revenue ?? 0)}</div>
          <div className="hero-l">Total Revenue</div>
          <div className="hero-s">gross customer pay · {summary?.total_transactions ?? 0} tx</div>
        </div>
        <div className="hero-cell">
          <div className="hero-v yel mono">{fmtMoney(summary?.total_brand_net ?? 0)}</div>
          <div className="hero-l">Your Net</div>
          <div className="hero-s">after commission + platform fee</div>
        </div>
        <div className="hero-cell">
          <div className="hero-v mono">{fmtMoney(summary?.total_commission ?? 0)}</div>
          <div className="hero-l">Commission Paid</div>
        </div>
      </div>

      <div className="ch-row">
        {TYPE_FILTERS.map(t => {
          const count = summary?.[`${t.key}_count`] ?? 0;
          const isAct = typeFilter === t.key;
          return (
            <button key={t.key} className={`ch-card${isAct ? ' act' : ''}`} onClick={() => { setType(typeFilter === t.key ? '' : t.key); setPage(1); setExpanded(null); }}>
              <div className="ch-ic">{t.icon}</div>
              <div>
                <div className="ch-v mono">{count}</div>
                <div className="ch-l">{t.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="chip-row">
        {TX_STATUS_FILTERS.map(s => {
          const isAct = statusFilter === s.key;
          return (
            <button key={s.key || 'all'} className={`chip${isAct ? ' act' : ''}`} onClick={() => { setStatusFilter(isAct ? '' : s.key); setPage(1); setExpanded(null); }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="spinner" />
      ) : transactions.length === 0 ? (
        <div className="empty">
          <div className="em">✓</div>
          <div className="h">No transactions in this view</div>
          <div className="t">Try a different channel or status filter, or check back later — transactions arrive when followers pay through your influencers' tracking links.</div>
        </div>
      ) : (
        <div>
          {transactions.map(tx => {
            const b = badgeFor(tx);
            const isOpen = expandedId === tx.id;
            const statusKey = TX_STATUS_FILTERS.some(s => s.key === tx.status) ? tx.status : 'unknown';
            const rental = isRental(tx);
            const subBits = [];
            if (tx.instagram_handle) subBits.push(`via @${tx.instagram_handle}`);
            if (tx.campaign_name)    subBits.push(`"${tx.campaign_name}"`);
            if (rental && tx.pickup_type) subBits.push(tx.pickup_type);
            else if (tx.booking_date)     subBits.push(`booking ${tx.booking_date}${tx.booking_time ? ` · ${tx.booking_time}` : ''}`);

            return (
              <div key={tx.id} className={`tc${isOpen ? ' open' : ''}`}>
                <button className="tc-row" onClick={() => setExpanded(isOpen ? null : tx.id)} aria-expanded={isOpen}>
                  <span className={`tc-badge ${b.cls}`}>{b.icon} {b.label}</span>
                  <div className="tc-mid">
                    <div className="tc-name">
                      {tx.follower_name || 'Follower'}{tx.product_name ? <><span className="dot">·</span>{tx.product_name}</> : null}
                    </div>
                    <div className="tc-meta">{subBits.join(' · ') || '—'}</div>
                  </div>
                  <div className="tc-amt">
                    <div className="tc-amt-v">{fmtMoney(tx.net_amount ?? 0)}</div>
                    <div className="tc-amt-s">{tx.status === 'initiated' ? 'pending' : tx.status === 'returned' ? 'refunded' : (<>net <b>{fmtMoney(tx.brand_net ?? 0)}</b></>)}</div>
                  </div>
                  <span className={`status-pill ${statusKey}`}>● {tx.status || '—'}</span>
                  <span className="tc-dt">{fmtRelative(tx.created_at)}</span>
                </button>

                {isOpen && (
                  <div className="tc-exp">
                    <div className="tc-exp-grid">
                      <div className="kv"><span className="kv-l">Bill Amount</span><span className="kv-v">{fmtMoney(tx.gross_amount ?? 0)}</span></div>
                      <div className="kv"><span className="kv-l">Discount</span><span className="kv-v green">−{fmtMoney(tx.discount_amount ?? 0)}</span></div>
                      <div className="kv"><span className="kv-l">Customer Paid</span><span className="kv-v bold">{fmtMoney(tx.net_amount ?? 0)}</span></div>
                      <div className="kv"><span className="kv-l">Your Net</span><span className="kv-v bold">{fmtMoney(tx.brand_net ?? 0)}</span></div>
                      <div className="kv"><span className="kv-l">Influencer Commission</span><span className="kv-v">{fmtMoney(tx.influencer_commission ?? 0)}</span></div>
                      <div className="kv"><span className="kv-l">Platform Fee</span><span className="kv-v muted">{fmtMoney(tx.platform_fee ?? 0)}</span></div>
                      <div className="kv"><span className="kv-l">Coupon Used</span><span className="kv-v">{tx.coupon_code_used || '—'}</span></div>
                      <div className="kv"><span className="kv-l">Payment ID</span><span className="kv-v muted">{tx.razorpay_payment_id ? tx.razorpay_payment_id.substring(0, 16) : '—'}</span></div>
                    </div>
                    {rental && (
                      <div className="tc-exp-grid" style={{ marginTop: 8 }}>
                        <div className="kv"><span className="kv-l">Pickup Date</span><span className="kv-v">{fmtDate(tx.pickup_date)}</span></div>
                        <div className="kv"><span className="kv-l">Return Date</span><span className="kv-v">{fmtDate(tx.return_date)}</span></div>
                        <div className="kv"><span className="kv-l">Duration</span><span className="kv-v">{tx.duration_days != null ? `${tx.duration_days}d` : '—'}</span></div>
                        <div className="kv"><span className="kv-l">Pickup Type</span><span className="kv-v">{tx.pickup_type || '—'}</span></div>
                      </div>
                    )}
                    {!rental && (tx.booking_date || tx.booking_ref || tx.order_status || tx.follower_phone) && (
                      <div className="tc-exp-grid" style={{ marginTop: 8 }}>
                        {tx.booking_date && <div className="kv"><span className="kv-l">Booking Date</span><span className="kv-v">{`${tx.booking_date}${tx.booking_time ? ` · ${tx.booking_time}` : ''}`}</span></div>}
                        {tx.booking_ref  && <div className="kv"><span className="kv-l">Booking Ref</span><span className="kv-v">{tx.booking_ref}</span></div>}
                        {tx.order_status && <div className="kv"><span className="kv-l">Order Status</span><span className="kv-v">{tx.order_status}</span></div>}
                        {tx.follower_phone && <div className="kv"><span className="kv-l">Customer Phone</span><span className="kv-v">{tx.follower_phone}</span></div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.total > 20 && (
        <div className="pager">
          <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>← Previous</button>
          <span className="pg-info">Page {page} of {Math.max(1, Math.ceil(meta.total / 20))}</span>
          <button className="pg-btn" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= meta.total}>Next →</button>
        </div>
      )}
    </div>
  );
}
