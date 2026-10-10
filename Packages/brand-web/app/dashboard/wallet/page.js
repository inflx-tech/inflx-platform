'use client';
/**
 * Brand website · Wallet — item 17 (features/item17-wallet; master rules v1.31 §17A).
 *
 * The same wallet the phone shows (board BW1–BW10), laid out for a wide screen:
 *   Available · On hold · Locked in collaborations · Sales money coming — each figure from its own
 *   source on the server; nothing is added up or subtracted here.
 *   Add money (unchanged) · Withdraw (a REQUEST: on hold at once, paid by INFLX from its bank,
 *   then marked processed) · Locked, collaboration by collaboration · every sale and its three
 *   shares · history in plain words.
 * The bank account is saved in ONE place — the brand's own record (PATCH /brands/me) — and that is
 * where a withdrawal is sent. The old copy kept in listing_data is no longer read or written.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { walletApi, brandApi } from '../../../lib/api';

// Quick-pick amount chips (rupees).
const QUICK_PICKS = [5000, 10000, 25000, 50000];

const SALE_FILTERS = [['all', 'All'], ['coming', 'Coming'], ['added', 'Added'], ['cancelled', 'Cancelled']];
const HISTORY_FILTERS = [['all', 'All'], ['added', 'Added'], ['collaborations', 'Collaborations'], ['sales', 'Sales'], ['withdrawals', 'Withdrawals'], ['courier', 'Courier']];
const W_CHIP = { requested: ['pending', 'Waiting'], processed: ['completed', 'Processed'], could_not_process: ['failed', 'Could not process'] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Oct" — from a calendar day (YYYY-MM-DD) or a moment, read in India's day. */
function dayMon(v) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 330 * 60000);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
}
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Creator';

function nextLine(p) {
  if (!p) return null;
  if (p.dueAt) return `Next: ${inr(p.amount)} on ${dayMon(p.dueAt)}`;
  if (p.kind === 'confirm_live') return `Next: ${inr(p.amount)} when you confirm it's live`;
  return `Next: ${inr(p.amount)} after it's confirmed live`;
}
function saleLine(s) {
  // item 20: a sale through a post a linked creator made for this brand itself
  const post = `${s.ownBrand ? 'Your own' : `${firstName(s.creatorName)}'s`} post ${s.post?.code || ''}`.trim();
  if (s.state === 'cancelled') return `${post} · cancelled`;
  if (s.state === 'returned') return `${post} · returned`;
  if (s.state === 'added') return `${post} · added ${dayMon(s.at)}`;
  if (s.state === 'cod_waiting') return `${post} · cash on delivery · waiting for delivery`;
  if (s.state === 'not_shipped') return `${post} · not shipped yet`;
  if (s.state === 'waiting_delivery') return `${post} · on its way · waiting for delivery`;
  const cod = s.cashOnDelivery ? ` · cash on delivery · delivered ${dayMon(s.deliveredAt)}` : '';
  return `${post}${cod} · ${s.cashOnDelivery ? 'until' : 'return window until'} ${dayMon(s.windowUntil)}`;
}
function withdrawalLine(w) {
  if (w.status === 'processed') return `Requested ${dayMon(w.requestedAt)} · paid ${dayMon(w.paidOn || w.processedAt)} to ${w.sendTo}`;
  if (w.status === 'could_not_process') return `Requested ${dayMon(w.requestedAt)}`;
  return `Requested ${dayMon(w.requestedAt)} · to ${w.sendTo} · within ${w.processHours} hours`;
}

// ─── Locked palette CSS (wave2) ────────────────────────────────────────────
const CSS = `
.w *{box-sizing:border-box}
.w{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; color:var(--ink); font-size:13px; line-height:1.45;
}
.w .mono{font-family:'JetBrains Mono',monospace}
.w .display{font-family:'Outfit',sans-serif}
.w h1.title{font-family:'Outfit';font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.w .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0 18px}
.w .crumb{font-family:'JetBrains Mono';font-size:11px;color:var(--muted-2);letter-spacing:.3px;text-transform:uppercase;margin-bottom:14px}
.w .crumb b{color:var(--ink);font-weight:800}
.w .crumb .sep{color:var(--muted-3);margin:0 6px}

.w .wcols{display:grid;grid-template-columns:1fr 340px;gap:22px;align-items:start}
@media (max-width:980px){.w .wcols{grid-template-columns:1fr}}
.w .wmain{display:flex;flex-direction:column;gap:14px}
.w .wrail{display:flex;flex-direction:column;gap:14px;position:sticky;top:24px}
@media (max-width:980px){.w .wrail{position:static}}

/* hero */
.w .hero{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:20px;padding:26px 28px;position:relative;overflow:hidden}
.w .hero::before{content:'';position:absolute;top:-50px;right:-50px;width:200px;height:200px;background:var(--yellow);border-radius:50%;opacity:.22}
.w .hero::after{content:'';position:absolute;top:-20px;right:60px;width:90px;height:90px;background:var(--yellow);border-radius:50%;opacity:.14}
.w .hero > *{position:relative;z-index:2}
.w .hero-eb{font-family:'JetBrains Mono';font-size:11px;font-weight:800;color:var(--yellow-text);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.w .hero-bal{font-family:'JetBrains Mono';font-size:48px;font-weight:800;color:var(--ink);letter-spacing:-1.2px;line-height:1;margin-bottom:6px}
.w .hero-bal .cur{font-size:32px;color:var(--muted)}
.w .hero-sub{font-size:12.5px;color:var(--muted);font-weight:600;margin-bottom:18px}
.w .hero-sub .last{font-family:'JetBrains Mono';color:var(--ink);font-weight:700}
.w .hero-sub.warn{color:var(--danger-text)}
.w .hero-cta{display:inline-flex;align-items:center;gap:8px;background:var(--ink);color:var(--yellow);padding:10px 18px;border-radius:11px;font-size:12.5px;font-weight:700;cursor:pointer;border:0}
.w .hero-cta:hover{background:var(--ink-2);color:var(--yellow)}

/* warning card */
.w .warn-card{background:var(--yellow-pale);border:1px solid var(--yellow);border-radius:12px;padding:13px 16px;display:flex;align-items:center;gap:12px}
.w .warn-card .ic{width:30px;height:30px;background:var(--yellow);color:var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:14px;flex-shrink:0}
.w .warn-card .t{flex:1;font-size:12px;color:var(--ink);line-height:1.5}
.w .warn-card .t b{font-weight:700}
.w .warn-card .cta{font-size:11.5px;font-weight:700;color:var(--yellow-text);text-decoration:underline;cursor:pointer;background:transparent;border:0}

/* KPI strip */
.w .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media (max-width:680px){.w .kpis{grid-template-columns:1fr}}
.w .kpi{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.w .kpi-lbl{font-family:'JetBrains Mono';font-size:10px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
.w .kpi-v{font-family:'JetBrains Mono';font-size:20px;font-weight:800;color:var(--ink);letter-spacing:-.3px;line-height:1.1}
.w .kpi-v.warn{color:var(--yellow-text)}
.w .kpi-sub{font-size:10.5px;color:var(--muted-2);margin-top:4px}

/* card */
.w .card{background:var(--white);border:1px solid var(--border);border-radius:16px;padding:20px 22px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.w .card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:10px}
.w .card-head h3{font-family:'Outfit';font-size:14px;font-weight:700;color:var(--ink)}
.w .card .sh{font-size:11.5px;color:var(--muted-2);margin-top:2px}
.w .card .count{font-family:'JetBrains Mono';font-size:11px;font-weight:700;color:var(--muted-2)}

/* top-up form */
.w form.tu{margin:0}
.w .tu-row{display:flex;gap:10px;margin-bottom:12px}
@media (max-width:520px){.w .tu-row{flex-direction:column}}
.w .tu-input{flex:1;display:flex;align-items:center;border:1px solid var(--border);border-radius:11px;overflow:hidden;background:var(--white);transition:all .15s}
.w .tu-input:focus-within{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.w .tu-input .cur{padding:11px 14px;background:var(--bg);color:var(--muted);font-family:'JetBrains Mono';font-weight:700;border-right:1px solid var(--border)}
.w .tu-input input{flex:1;padding:11px 14px;font:inherit;font-size:14px;font-family:'JetBrains Mono';font-weight:700;outline:none;border:0;color:var(--ink);background:transparent;width:100%}
.w .tu-input input::placeholder{color:var(--muted-3);font-weight:500}
.w .tu-cta{padding:11px 22px;background:var(--ink);color:var(--yellow);border-radius:11px;font-size:12.5px;font-weight:700;white-space:nowrap;cursor:pointer;border:0}
.w .tu-cta:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.w .tu-cta:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.w .tu-picks{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.w .tu-pick{padding:8px;background:var(--white);border:1px solid var(--border);border-radius:9px;font-family:'JetBrains Mono';font-size:11.5px;font-weight:700;color:var(--ink);text-align:center;transition:all .15s;cursor:pointer}
.w .tu-pick:hover{border-color:var(--ink);background:var(--yellow-50)}
.w .tu-pick.act{background:var(--yellow);border-color:var(--yellow)}
.w .tu-hint{font-size:10.5px;color:var(--muted-2);margin-top:10px;line-height:1.5}
.w .tu-hint b{color:var(--ink);font-weight:700}

/* filter chips */
.w .fchips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.w .fchip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .15s}
.w .fchip:hover{border-color:var(--ink);color:var(--ink)}
.w .fchip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow);font-weight:700}
.w .fchip .ct{font-family:'JetBrains Mono';margin-left:5px;opacity:.65;font-size:10px}
.w .fchip.act .ct{color:var(--yellow);opacity:.85}

/* tx list */
.w .tx{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--border-soft)}
.w .tx:first-of-type{border-top:0;padding-top:4px}
.w .tx-ic{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:14px;flex-shrink:0}
.w .tx-ic.credit{background:var(--success-pale);color:var(--success-text)}
.w .tx-ic.debit{background:var(--bg2);color:var(--ink)}
.w .tx-ic.escrow{background:var(--yellow-pale);color:var(--yellow-text)}
.w .tx-meta{flex:1;min-width:0}
.w .tx-t{font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:2px}
.w .tx-d{font-size:11px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:380px}
.w .tx-dt{font-family:'JetBrains Mono';font-size:10px;color:var(--muted-2);margin-top:2px}
.w .tx-amt{font-family:'JetBrains Mono';font-size:13.5px;font-weight:800;text-align:right;white-space:nowrap}
.w .tx-amt.credit{color:var(--success-text)}
.w .tx-amt.debit{color:var(--ink)}
.w .tx-empty{padding:30px;text-align:center;color:var(--muted-2);font-size:12px}

/* form fields */
.w .f{display:flex;flex-direction:column;margin-bottom:14px}
.w .f:last-child{margin-bottom:0}
.w .flbl{font-size:11px;font-weight:700;color:var(--ink);margin-bottom:6px;letter-spacing:.1px}
.w .flbl .req{color:var(--danger);margin-left:2px}
.w .flbl .opt{color:var(--muted-2);font-weight:500;font-size:10.5px;margin-left:5px}
.w .inp{width:100%;padding:10px 13px;border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;background:var(--white);color:var(--ink);outline:none;transition:all .15s}
.w .inp:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.w .inp::placeholder{color:var(--muted-3)}
.w .inp.mono{font-family:'JetBrains Mono';font-weight:700;font-size:13.5px}
.w .fhint{font-size:10.5px;color:var(--muted-2);margin-top:5px;font-family:'JetBrains Mono'}

/* bank rail */
.w .bank-cta{padding:9px 16px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:11.5px;font-weight:700;border:0;cursor:pointer;margin-top:6px;float:right}
.w .bank-cta:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.w .bank-cta:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.w .bank-empty{padding:18px;text-align:center;background:var(--bg);border-radius:10px;border:1px dashed var(--border)}
.w .bank-empty-ic{font-size:30px;color:var(--muted-3);margin-bottom:6px}
.w .bank-empty-t{font-size:11.5px;color:var(--muted);margin-bottom:12px;line-height:1.5}

/* how-it-works */
.w .howr{padding-left:16px;font-size:11.5px;color:var(--muted);line-height:1.65;margin:0}
.w .howr li{list-style:none;position:relative;padding-left:0;margin-bottom:10px}
.w .howr li:last-child{margin-bottom:0}
.w .howr li b{color:var(--ink);font-weight:700;font-family:'Outfit'}
.w .howr li::before{content:'';position:absolute;left:-14px;top:8px;width:6px;height:6px;background:var(--yellow);border-radius:50%}

/* toast */
.w .toast{position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:12px;font-size:12px;font-weight:700;box-shadow:0 8px 24px -12px rgba(0,0,0,.2);z-index:60}
.w .toast.success{background:var(--ink);color:var(--white)}
.w .toast.error{background:var(--danger);color:var(--white)}

/* load-more */
.w .load-more{display:block;margin:14px auto 0;padding:7px 16px;font-size:11.5px;font-weight:700;color:var(--ink);background:var(--white);border:1px solid var(--border);border-radius:99px;cursor:pointer}
.w .load-more:hover{border-color:var(--ink)}

/* withdraw */
.w .wd-methods{display:flex;gap:6px;margin-bottom:12px}
.w .wd-method{flex:1;padding:8px;background:var(--white);border:1px solid var(--border);border-radius:9px;font-size:11.5px;font-weight:700;color:var(--ink);text-align:center;cursor:pointer;transition:all .15s}
.w .wd-method:hover{border-color:var(--ink)}
.w .wd-method.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.w .wd-method:disabled{opacity:.35;cursor:not-allowed}
.w .wd-dest{font-size:10.5px;color:var(--muted-2);margin-top:10px;font-family:'JetBrains Mono'}
.w .wd-dest b{color:var(--ink);font-weight:700}
.w .wd-list{margin-top:4px}
.w .wd-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--border-soft)}
.w .wd-row:first-of-type{border-top:0}
.w .wd-meta{flex:1;min-width:0}
.w .wd-amt{font-family:'JetBrains Mono';font-size:13px;font-weight:800;color:var(--ink)}
.w .wd-dt{font-family:'JetBrains Mono';font-size:10px;color:var(--muted-2);margin-top:2px}
.w .wd-pill{padding:3px 9px;border-radius:99px;font-size:10px;font-weight:800;text-transform:capitalize;white-space:nowrap}
.w .wd-pill.pending{background:var(--yellow-pale);color:var(--yellow-text)}
.w .wd-pill.queued,.w .wd-pill.processing{background:var(--bg2);color:var(--muted)}
.w .wd-pill.completed{background:var(--success-pale);color:var(--success-text)}
.w .wd-pill.failed,.w .wd-pill.cancelled{background:var(--danger-pale);color:var(--danger-text)}

/* item 17 — the four figures, the hold, locked, shares */
.w .kpis.four{grid-template-columns:repeat(4,1fr)}
@media (max-width:900px){.w .kpis.four{grid-template-columns:repeat(2,1fr)}}
.w .hero-cta.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--ink);margin-left:8px}
.w .hero-cta.ghost:hover{background:var(--white);color:var(--ink)}
.w .hero-cta:disabled{opacity:.4;cursor:not-allowed}
.w .hold-card{background:#E6EFFC;border-radius:12px;padding:13px 16px;display:flex;align-items:flex-start;gap:12px;color:#1D5FBF}
.w .hold-card .ic{font-size:16px;line-height:1.3}
.w .hold-card .t{flex:1;font-size:12.5px;line-height:1.5}
.w .hold-card .t b{font-weight:800}
.w .hold-card.plain{margin-bottom:4px}
.w .ferr{font-size:11.5px;color:var(--danger-text);font-weight:600;margin:-4px 0 8px}
.w .sec-lbl{font-family:'JetBrains Mono';font-size:10px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px}
.w .wd-note{font-size:11.5px;color:var(--muted);background:var(--bg);border-radius:8px;padding:8px 10px;margin-top:6px;line-height:1.5}
.w .wd-dt b{color:var(--ink)}
.w .lk{padding:13px 0;border-top:1px solid var(--border-soft)}
.w .lk:first-of-type{border-top:0}
.w .lk-top{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start}
.w .lk-top b{font-size:13px}
.w .lk-nums{display:flex;gap:16px;font-size:11.5px;color:var(--muted)}
.w .lk-nums b{font-family:'JetBrains Mono';color:var(--ink);margin-left:4px}
.w .lk-pays{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.w .lk-pay{font-size:11px;padding:4px 9px;border-radius:99px;border:1px solid var(--border);color:var(--muted)}
.w .lk-pay.on{background:var(--ink);border-color:var(--ink);color:var(--white)}
.w .lk-next{font-size:12px;font-weight:700;color:var(--ink);margin-top:8px}
.w .tx.click{cursor:pointer}
.w .shares{display:flex;flex-wrap:wrap;gap:6px 18px;background:var(--bg);border-radius:10px;padding:10px 12px;margin:0 0 10px;font-size:11.5px;color:var(--muted)}
.w .shares b{font-family:'JetBrains Mono';color:var(--ink);margin-left:5px}
.w .shares .tot{color:var(--ink);font-weight:700}
.w .wd-pill{text-transform:none}
.w .bank-on{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;background:var(--bg);border-radius:10px;padding:12px 14px}
.w .bank-on b{font-size:13px}
.w .link{background:transparent;border:0;font-size:11.5px;font-weight:700;color:var(--ink);text-decoration:underline;cursor:pointer}
`;

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fig, setFig] = useState(null);
  const [waiting, setWaiting] = useState(null);
  const [opts, setOpts] = useState(null);
  const [locked, setLocked] = useState(null);
  const [sales, setSales] = useState(null);
  const [saleFilter, setSaleFilter] = useState('all');
  const [salesMore, setSalesMore] = useState(false);
  const [openSale, setOpenSale] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historyMore, setHistoryMore] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);

  const [topupAmount, setTopupAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const [gst, setGst] = useState(null);
  const [bankForm, setBankForm] = useState(false);
  const [bank, setBank] = useState({ bank_account_no: '', bank_ifsc: '' });
  const [bankError, setBankError] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');
  function showToast(msg, type = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3500);
  }

  const loadMoney = useCallback(async () => {
    const [w, o, l, wd] = await Promise.all([walletApi.getBalance(), walletApi.getWithdrawOptions(), walletApi.getLocked(), walletApi.getWithdrawals()]);
    setLoading(false);
    if (!w.success || !w.data?.figures) { setLoadError(true); return; }
    setLoadError(false);
    setFig(w.data.figures);
    setWaiting(w.data.withdrawal_waiting || null);
    if (o.success) setOpts(o.data);
    if (l.success) setLocked(l.data);
    if (wd.success) setWithdrawals(wd.data?.withdrawals || []);
  }, []);
  // One page at a time: "Show more" is ignored while a load is on its way, and a first-page load
  // (a filter change, a refresh) supersedes anything older — so rows are never doubled or skipped.
  const salesSeq = useRef(0); const salesBusy = useRef(false);
  const historySeq = useRef(0); const historyBusy = useRef(false);
  const loadSales = useCallback(async (f, offset) => {
    if (offset && salesBusy.current) return;
    const mine = ++salesSeq.current; salesBusy.current = true;
    const r = await walletApi.getSales(f, offset);
    if (mine !== salesSeq.current) return;
    salesBusy.current = false;
    if (!r.success) return;
    const got = r.data?.sales || [];
    setSales((old) => (offset && old ? { totals: r.data.totals, sales: [...old.sales, ...got] } : r.data));
    setSalesMore(got.length === 100);
  }, []);
  const loadHistory = useCallback(async (f, offset) => {
    if (offset && historyBusy.current) return;
    const mine = ++historySeq.current; historyBusy.current = true;
    const r = await walletApi.getHistory(f, offset);
    if (mine !== historySeq.current) return;
    historyBusy.current = false;
    if (!r.success) return;
    const got = r.data?.rows || [];
    setHistory((old) => (offset ? [...old, ...got] : got));
    setHistoryMore(got.length === 50);
  }, []);
  const refresh = useCallback(() => { loadMoney(); loadSales(saleFilter); loadHistory(historyFilter, 0); }, [loadMoney, loadSales, loadHistory, saleFilter, historyFilter]);

  useEffect(() => { loadMoney(); }, [loadMoney]);
  useEffect(() => { loadSales(saleFilter); }, [saleFilter, loadSales]);
  useEffect(() => { loadHistory(historyFilter, 0); }, [historyFilter, loadHistory]);
  useEffect(() => {
    brandApi.getMe().then((res) => { if (res.success) setGst(!!(res.data?.brand || res.data)?.gstin); });
  }, []);

  /* ── Add money (unchanged: Razorpay; the wallet is credited once, however often it is verified) ── */
  async function handleTopup(e) {
    if (e) e.preventDefault();
    const amountRupees = parseFloat(topupAmount);
    if (!amountRupees || amountRupees < 1) { showToast('Enter at least ₹1.', 'error'); return; }
    setToppingUp(true);
    const orderRes = await walletApi.createTopup(amountRupees);
    if (!orderRes.success) {
      showToast(orderRes.error?.message || 'We could not start the payment. Try again.', 'error');
      setToppingUp(false);
      return;
    }
    const { order_id, amount, key_id } = orderRes.data;
    if (typeof window !== 'undefined' && window.Razorpay) {
      const rzp = new window.Razorpay({
        key: key_id || 'rzp_test_placeholder',
        amount,
        currency: 'INR',
        name: 'INFLX',
        description: 'Add money to your wallet',
        order_id,
        handler: async (response) => {
          const verifyRes = await walletApi.verifyTopup({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setToppingUp(false);
          if (verifyRes.success) {
            showToast(`${inr(amountRupees)} added.`);
            setTopupAmount('');
            refresh();
          } else {
            // Paid, but not confirmed: never claim either outcome.
            showToast("We couldn't confirm the payment. If money left your account it will be credited — check your wallet before trying again.", 'error');
          }
        },
        modal: { ondismiss: () => setToppingUp(false) },
        prefill: { contact: '' },
        theme: { color: '#FFC107' },
      });
      rzp.open();
    } else {
      showToast('The payment window could not open. Reload the page and try again.', 'error');
      setToppingUp(false);
    }
  }

  /* ── Withdraw: a request (BW7, BW9) ── */
  async function handleWithdraw(e) {
    if (e) e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < opts.minimum) { setWithdrawError(`The minimum is ${inr(opts.minimum)}.`); return; }
    if (amt > opts.available) { setWithdrawError(`That's more than your ${inr(opts.available)} available.`); return; }
    setWithdrawError('');
    setWithdrawing(true);
    const res = await walletApi.requestWithdrawal(amt);
    setWithdrawing(false);
    if (res.success) {
      showToast(`${inr(amt)} requested. It is on hold until INFLX pays it.`);
      setWithdrawAmount('');
      refresh();
    } else {
      setWithdrawError(res.error?.message || 'Something went wrong. Try again.');
      loadMoney();
    }
  }

  /* ── The bank account: one place (PATCH /brands/me) ── */
  async function handleSaveBank(e) {
    e.preventDefault();
    const acct = bank.bank_account_no.replace(/\s+/g, '');
    const ifsc = bank.bank_ifsc.trim().toUpperCase();
    if (!acct || !ifsc) { setBankError('Enter the account number and the IFSC together.'); return; }
    setBankError('');
    setSavingBank(true);
    const res = await brandApi.updateMe({ bank_account_no: acct, bank_ifsc: ifsc });
    setSavingBank(false);
    if (res.success) {
      showToast('Bank account saved.');
      setBankForm(false);
      setBank({ bank_account_no: '', bank_ifsc: '' });
      loadMoney();
    } else {
      setBankError(res.error?.message || 'We could not save that. Check the details and try again.');
    }
  }

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (loading) return <div className="w"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="tx-empty">Loading your wallet…</div></div>;
  if (loadError) {
    return (
      <div className="w"><style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="tx-empty">We couldn&apos;t load your wallet. <button className="load-more" onClick={() => { setLoading(true); loadMoney(); }}>Try again</button></div>
      </div>
    );
  }

  const sendTo = opts?.sendTo?.[0] || null;
  const blocked = opts?.blocked || null;
  const collabs = locked?.collaborations || [];
  const paidInFull = locked?.paidInFull || [];

  return (
    <div className="w">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="crumb">/dashboard <span className="sep">/</span> <b>wallet</b></div>
      <h1 className="title">Wallet</h1>
      <div className="rule" />

      <div className="wcols">
        <div className="wmain">

          {/* Available (BW1) */}
          <div className="hero">
            <div className="hero-eb">Available</div>
            <div className="hero-bal" data-testid="wallet-available"><span className="cur">₹</span>{fmtN(fig.available)}</div>
            <div className="hero-sub">Money you can use now: for an agreement, a parcel, or a withdrawal.</div>
            <button className="hero-cta" onClick={() => scrollTo('topup-section')}>+ Add money</button>
            <button className="hero-cta ghost" onClick={() => scrollTo('withdraw-section')} disabled={!!waiting}>Withdraw</button>
          </div>

          {/* On hold (BW2) */}
          {waiting && (
            <div className="hold-card" data-testid="hold-box">
              <div className="ic">⏳</div>
              <div className="t"><b>You requested {inr(waiting.amount)} on {dayMon(waiting.requestedAt)}.</b> It will be processed within {waiting.processHours} hours. This amount is on hold until then.</div>
            </div>
          )}

          {/* The four figures, each from its own source */}
          <div className="kpis four">
            <div className="kpi">
              <div className="kpi-lbl">Available</div>
              <div className="kpi-v">{inr(fig.available)}</div>
              <div className="kpi-sub">to use or withdraw</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">On hold</div>
              <div className="kpi-v">{inr(fig.onHold)}</div>
              <div className="kpi-sub">{waiting ? `your withdrawal · to ${waiting.sendTo}` : 'no withdrawal waiting'}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Locked in collaborations</div>
              <div className="kpi-v">{inr(fig.locked)}</div>
              <div className="kpi-sub">{fig.lockedCount ? `${fig.lockedCount} collaboration${fig.lockedCount === 1 ? '' : 's'}` : 'nothing locked'}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Sales money coming</div>
              <div className="kpi-v">{inr(fig.salesComing)}</div>
              <div className="kpi-sub">{fig.salesComingCount ? `${fig.salesComingCount} sale${fig.salesComingCount === 1 ? '' : 's'} not added yet` : 'no sales waiting'}</div>
            </div>
          </div>

          {/* Add money */}
          <div className="card" id="topup-section">
            <div className="card-head">
              <h3>Add money</h3>
              <span className="count">UPI · card · net banking</span>
            </div>
            <form className="tu" onSubmit={handleTopup}>
              <div className="tu-row">
                <label className="tu-input">
                  <span className="cur">₹</span>
                  <input type="number" placeholder="Amount in rupees" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} min="1" />
                </label>
                <button type="submit" className="tu-cta" disabled={toppingUp || !topupAmount}>{toppingUp ? 'Processing…' : 'Add money'}</button>
              </div>
            </form>
            <div className="tu-picks">
              {QUICK_PICKS.map((amt) => (
                <button key={amt} className={`tu-pick ${String(amt) === topupAmount ? 'act' : ''}`} onClick={() => setTopupAmount(String(amt))}>₹{amt.toLocaleString('en-IN')}</button>
              ))}
            </div>
            <div className="tu-hint">This money sits in your wallet until you sign an agreement. <b>Nothing is committed to anyone until then.</b></div>
          </div>

          {/* Withdraw (BW7–BW9) */}
          <div className="card" id="withdraw-section">
            <div className="card-head">
              <h3>Withdraw</h3>
              <span className="count">a request · paid by INFLX within {opts?.processHours || 24} hours</span>
            </div>

            {!opts ? (
              <div className="tx-empty">Loading…</div>
            ) : blocked && blocked.code === 'NO_DETAILS' ? (
              <div className="bank-empty">
                <div className="bank-empty-t"><b>Add your bank account first.</b><br />We need it to send your money.</div>
                <button className="bank-cta" style={{ float: 'none', marginTop: 0 }} onClick={() => { setBankForm(true); scrollTo('bank-section'); }}>Add bank account</button>
              </div>
            ) : blocked ? (
              <div className="hold-card plain" data-testid={`withdraw-blocked-${blocked.code}`}><div className="t">{blocked.message}</div></div>
            ) : (
              <>
                <form className="tu" onSubmit={handleWithdraw}>
                  <div className="tu-row">
                    <label className="tu-input">
                      <span className="cur">₹</span>
                      <input type="number" placeholder="How much?" value={withdrawAmount} onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawError(''); }} min={opts.minimum} max={opts.available} />
                    </label>
                    <button type="button" className="tu-pick" style={{ padding: '0 14px' }} onClick={() => { setWithdrawAmount(String(Math.floor(opts.available))); setWithdrawError(''); }}>All · {inr(Math.floor(opts.available))}</button>
                    <button type="submit" className="tu-cta" disabled={withdrawing || !withdrawAmount}>{withdrawing ? 'Requesting…' : `Request${withdrawAmount ? ` ${inr(withdrawAmount)}` : ''}`}</button>
                  </div>
                </form>
                {withdrawError && <div className="ferr">{withdrawError}</div>}
                <div className="wd-dest">Available <b>{inr(opts.available)}</b> · minimum <b>{inr(opts.minimum)}</b> · sent to <b>{sendTo?.label}</b> ({sendTo?.masked})</div>
                <div className="tu-hint">INFLX pays this from its bank within <b>{opts.processHours} hours</b>. Until then the amount is on hold: it can&apos;t be used for an agreement or requested again.</div>
              </>
            )}

            {withdrawals.length > 0 && (
              <div className="wd-list" style={{ marginTop: 16 }}>
                <div className="sec-lbl">Your withdrawals</div>
                {withdrawals.slice(0, 8).map((w) => {
                  const [cls, word] = W_CHIP[w.status] || W_CHIP.requested;
                  return (
                    <div key={w.id} className="wd-row">
                      <div className="wd-meta">
                        <div className="wd-amt">{inr(w.amount)}</div>
                        <div className="wd-dt">{withdrawalLine(w)}</div>
                        {w.status === 'processed' && w.reference && <div className="wd-dt">Reference <b>{w.reference}</b></div>}
                        {w.status === 'could_not_process' && <div className="wd-note">{w.reason} Your {inr(w.amount)} is back in Available.</div>}
                      </div>
                      <span className={`wd-pill ${cls}`}>{word}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Locked in collaborations (BW3, BW4) */}
          <div className="card" id="locked-section">
            <div className="card-head">
              <div>
                <h3>Locked in collaborations</h3>
                <div className="sh">Money locks when you sign a Pay for Content or Hybrid agreement, and is paid to the creator in three parts.</div>
              </div>
              <span className="count">{inr(locked?.stillLocked)} locked · {inr(locked?.paidSoFar)} paid so far</span>
            </div>
            {!collabs.length && !paidInFull.length ? (
              <div className="tx-empty">Nothing is locked.</div>
            ) : (
              [...collabs, ...paidInFull].map((c) => (
                <div key={c.ciId} className="lk">
                  <div className="lk-top">
                    <div><b>{c.creatorName}</b> <span className="wd-pill queued">{c.aimLabel}</span><div className="wd-dt">{[c.campaignName, c.setName].filter(Boolean).join(' · ')}</div></div>
                    <div className="lk-nums">
                      <span>{c.aim === 'hybrid' ? 'Fixed amount' : 'Fee'} <b>{inr(c.amount)}</b></span>
                      <span>Paid <b>{inr(c.paid)}</b></span>
                      <span>Still locked <b>{inr(c.locked)}</b></span>
                    </div>
                  </div>
                  <div className="lk-pays">
                    {c.payments.map((p) => (
                      <span key={p.n} className={`lk-pay ${p.paid ? 'on' : ''}`}>
                        {p.label} · {inr(p.amount)} · {p.status === 'refunded' ? 'returned to you by INFLX' : p.paid ? `paid ${dayMon(p.paidAt)}` : p.dueAt ? `on ${dayMon(p.dueAt)}` : p.n === 2 ? "when you confirm it's live" : "after it's confirmed live"}
                      </span>
                    ))}
                  </div>
                  {c.next && <div className="lk-next">{nextLine(c.next)}</div>}
                  {c.campaignFee > 0 && <div className="wd-dt">INFLX campaign fee {inr(c.campaignFee)} · charged to you at signing, never to her.</div>}
                </div>
              ))
            )}
          </div>

          {/* Sales money (BW5, BW6) */}
          <div className="card" id="sales-section">
            <div className="card-head">
              <div>
                <h3>Sales money</h3>
                <div className="sh">Each item sold through a creator&apos;s post, split three ways. Your share is added to Available after the item is delivered and its return window closes.</div>
              </div>
              <span className="count">{inr(sales?.totals?.coming)} coming · {inr(sales?.totals?.addedThisMonth)} added this month · {sales?.totals?.sales || 0} sales</span>
            </div>
            <div className="fchips">
              {SALE_FILTERS.map(([k, l]) => (
                <button key={k} className={`fchip ${saleFilter === k ? 'act' : ''}`} onClick={() => setSaleFilter(k)}>{l}</button>
              ))}
            </div>
            {!sales ? (
              <div className="tx-empty">Loading…</div>
            ) : sales.sales.length === 0 ? (
              <div className="tx-empty">{saleFilter === 'all' ? 'No sales yet.' : 'No sales match this filter.'}</div>
            ) : (
              sales.sales.map((s) => (
                <div key={s.id}>
                  <div className="tx click" onClick={() => setOpenSale(openSale === s.id ? null : s.id)}>
                    <div className="tx-meta">
                      <div className="tx-t">{s.item}</div>
                      <div className="tx-d">{saleLine(s)}</div>
                    </div>
                    <div className={`tx-amt ${s.state === 'added' ? 'credit' : 'debit'}`}>{s.state === 'added' ? '+ ' : ''}{inr(s.brandShare)}</div>
                  </div>
                  {openSale === s.id && (
                    <div className="shares">
                      <span>Shopper paid <b>{inr(s.paid)}</b></span>
                      {s.ownBrand ? null : <span>Creator&apos;s share · {s.commissionPct}% <b>{inr(s.creatorShare)}</b></span>}
                      <span>INFLX&apos;s share · {s.feePct}% <b>{inr(s.inflxShare)}</b></span>
                      <span className="tot">Your share <b>{inr(s.brandShare)}</b></span>
                      <span>{s.cashOnDelivery ? 'Cash on delivery' : 'Paid online'}{s.offerName ? ` · ${s.offerName}` : ''}</span>
                    </div>
                  )}
                </div>
              ))
            )}
            {sales && salesMore ? <button className="load-more" onClick={() => loadSales(saleFilter, sales.sales.length)}>Show more</button> : null}
          </div>

          {/* History (BW10) */}
          <div className="card">
            <div className="card-head">
              <div>
                <h3>History</h3>
                <div className="sh">Everything in and out, newest first.</div>
              </div>
            </div>
            <div className="fchips">
              {HISTORY_FILTERS.map(([k, l]) => (
                <button key={k} className={`fchip ${historyFilter === k ? 'act' : ''}`} onClick={() => setHistoryFilter(k)}>{l}</button>
              ))}
            </div>
            {history.length === 0 ? (
              <div className="tx-empty">Nothing yet. Every rupee that moves appears here.</div>
            ) : (
              history.map((r) => (
                <div key={r.id} className="tx">
                  <div className="tx-meta">
                    <div className="tx-t">{r.label}</div>
                    <div className="tx-d">{[r.sub, dayMon(r.at)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className={`tx-amt ${r.moneyIn ? 'credit' : 'debit'}`}>{r.sign ? `${r.sign} ` : ''}{inr(r.amount)}</div>
                </div>
              ))
            )}
            {historyMore && <button className="load-more" onClick={() => loadHistory(historyFilter, history.length)}>Show more</button>}
          </div>

        </div>

        {/* ── Right rail ── */}
        <aside className="wrail">

          <div className="card" id="bank-section">
            <div className="card-head" style={{ marginBottom: 6 }}>
              <h3>Bank and business details</h3>
            </div>
            <div className="sh" style={{ marginBottom: 14 }}>Your withdrawals are sent to this bank account.</div>

            {sendTo && !bankForm ? (
              <div className="bank-on">
                <div><b>{sendTo.label}</b><div className="wd-dt">{sendTo.masked}</div></div>
                <button className="link" onClick={() => setBankForm(true)}>Change</button>
              </div>
            ) : !bankForm ? (
              <div className="bank-empty">
                <div className="bank-empty-t">No bank account yet.<br />Add one before you withdraw.</div>
                <button className="bank-cta" style={{ float: 'none', marginTop: 0 }} onClick={() => setBankForm(true)}>Add bank account</button>
              </div>
            ) : (
              <form onSubmit={handleSaveBank}>
                <div className="f">
                  <label className="flbl">Account number <span className="req">*</span></label>
                  <input className="inp mono" value={bank.bank_account_no} onChange={(e) => setBank((b) => ({ ...b, bank_account_no: e.target.value.replace(/\D/g, '') }))} placeholder="1234567890" />
                </div>
                <div className="f">
                  <label className="flbl">IFSC <span className="req">*</span></label>
                  <input className="inp mono" value={bank.bank_ifsc} onChange={(e) => setBank((b) => ({ ...b, bank_ifsc: e.target.value.toUpperCase() }))} maxLength={11} placeholder="SBIN0001234" />
                </div>
                {bankError && <div className="ferr">{bankError}</div>}
                <button type="submit" className="bank-cta" disabled={savingBank}>{savingBank ? 'Saving…' : 'Save bank account'}</button>
                <button type="button" className="link" style={{ marginTop: 14 }} onClick={() => { setBankForm(false); setBankError(''); }}>Cancel</button>
                <div style={{ clear: 'both' }} />
              </form>
            )}
            <div className="wd-dt" style={{ marginTop: 12 }}>GST number: <b>{gst == null ? '—' : gst ? 'Added' : 'Not added'}</b> · set in Settings. Our team checks these by hand.</div>
          </div>

          <div className="card">
            <div className="card-head" style={{ marginBottom: 10 }}>
              <h3>How your wallet works</h3>
            </div>
            <ul className="howr">
              <li><b>Add money</b> · it stays in Available until you sign an agreement.</li>
              <li><b>Locked</b> · signing a Pay for Content or Hybrid agreement locks the amount. It is paid to the creator in three parts: at signing, when you confirm it&apos;s live, and the final 50% on its date.</li>
              <li><b>Sales money</b> · a shopper&apos;s payment comes to INFLX. Your share is added to Available after the order is delivered and its return window closes — the same for online and cash-on-delivery orders. A returned item adds nothing.</li>
              <li><b>Withdraw</b> · a request. The amount is on hold until INFLX pays it from its bank, within {opts?.processHours || 24} hours. One request at a time.</li>
            </ul>
          </div>

        </aside>
      </div>

      {toast && <div className={`toast ${toastType}`}>{toast}</div>}
    </div>
  );
}

// Compact rupee number for the large Available figure.
function fmtN(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
