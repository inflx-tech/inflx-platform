'use client';
import { useEffect, useState, useMemo } from 'react';
import { walletApi, brandApi, fmtMoney } from '../../../lib/api';

// ─── Transaction type config (locked palette) ───────────────────────────────
// Each tx type gets an icon glyph + an icon tone (credit / debit / escrow).
// The icon tone drives the background of the round icon tile.
const TX_TYPE = {
  topup:           { label: 'Top-up',           icon: '↑',   tone: 'credit' },
  escrow_lock:     { label: 'Escrow lock',      icon: '🔒', tone: 'escrow' },
  escrow_release:  { label: 'Escrow release',   icon: '🔓', tone: 'credit' },
  payout:          { label: 'Payout',           icon: '→',   tone: 'debit' },
  refund:          { label: 'Refund',           icon: '↩',   tone: 'credit' },
  platform_fee:    { label: 'Platform fee',     icon: '%',         tone: 'debit' },
};

// Credit-direction tx types — show '+' prefix in success-green.
const CREDIT_TYPES = new Set(['topup', 'escrow_release', 'refund']);

// Filter chips for transaction list (client-side filter on already-loaded array).
const FILTERS = [
  { key: 'all',        label: 'All',       types: null },
  { key: 'topup',      label: 'Top-ups',   types: new Set(['topup']) },
  { key: 'escrow',     label: 'Escrow',    types: new Set(['escrow_lock']) },
  { key: 'release',    label: 'Releases',  types: new Set(['escrow_release']) },
  { key: 'refund',     label: 'Refunds',   types: new Set(['refund']) },
  { key: 'fee',        label: 'Fees',      types: new Set(['platform_fee']) },
  { key: 'payout',     label: 'Payouts',   types: new Set(['payout']) },
];

const EMPTY_BANK = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  upi_id: '',
};

// Quick-pick amount chips (rupees). Same 4 amounts as OLD wizard.
const QUICK_PICKS = [5000, 10000, 25000, 50000];

// Low-balance threshold (rupees-era — adjacent-fix from stale 1000000 paise-era constant).
// ₹10K covers a small handpick campaign (3-4 micro-influencers + 8% platform fee).
const LOW_BAL_THRESHOLD = 10000;

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
`;

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilter, setTxFilter] = useState('all');

  // Bank details state (preserved verbatim)
  const [bankDetails, setBankDetails] = useState({ ...EMPTY_BANK });
  const [savingBank, setSavingBank] = useState(false);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);

  async function load() {
    const res = await walletApi.getBalance();
    setLoading(false);
    if (res.success) setWallet(res.data?.wallet || res.data);
  }

  async function loadBrandData() {
    const res = await brandApi.getMe();
    if (res.success) {
      const b = res.data?.brand || res.data;
      const ld = b.listing_data || {};
      if (ld.bank_details) {
        setBankDetails({
          account_holder_name: ld.bank_details.account_holder_name || '',
          bank_name:           ld.bank_details.bank_name || '',
          account_number:      ld.bank_details.account_number || '',
          ifsc_code:           ld.bank_details.ifsc_code || '',
          upi_id:              ld.bank_details.upi_id || '',
        });
        setShowBankForm(true);
      }
      setBankLoaded(true);
      return b;
    }
    setBankLoaded(true);
    return null;
  }

  useEffect(() => {
    load();
    loadTransactions();
    loadBrandData();
  }, []);

  async function loadTransactions() {
    setTxLoading(true);
    const res = await walletApi.getTransactions({ limit: 20 });
    setTxLoading(false);
    if (res.success) setTransactions(res.data?.transactions || []);
  }

  async function handleTopup(e) {
    if (e) e.preventDefault();
    const amountRupees = parseFloat(topupAmount);
    if (!amountRupees || amountRupees < 1) { showToast('Minimum top-up is ₹1', 'error'); return; }
    setToppingUp(true);

    // Backend accepts rupees and converts to paise only at the Razorpay API call.
    const orderRes = await walletApi.createTopup(amountRupees);
    if (!orderRes.success) {
      showToast(orderRes.error?.message || 'Failed to create order', 'error');
      setToppingUp(false);
      return;
    }

    const { order_id, amount, key_id } = orderRes.data;

    if (typeof window !== 'undefined' && window.Razorpay) {
      const options = {
        key: key_id || 'rzp_test_placeholder',
        amount,
        currency: 'INR',
        name: 'INFLX',
        description: 'Wallet Top-up',
        order_id: order_id,
        handler: async function(response) {
          const verifyRes = await walletApi.verifyTopup({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
          });
          setToppingUp(false);
          if (verifyRes.success) {
            showToast('Top-up successful!');
            setTopupAmount('');
            load();
            loadTransactions();
          } else {
            showToast('Payment verification failed', 'error');
          }
        },
        prefill: { contact: '' },
        // Locked palette: Razorpay checkout theme = wave2 yellow.
        theme: { color: '#FFC107' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      showToast('Razorpay not loaded — in dev use API directly', 'error');
      setToppingUp(false);
    }
  }

  function showToast(msg, type = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  }

  function handleBankChange(field, value) {
    setBankDetails(prev => ({ ...prev, [field]: value }));
  }

  function maskAccountNumber(num) {
    if (!num || num.length <= 4) return num;
    return '•'.repeat(num.length - 4) + num.slice(-4);
  }

  async function handleSaveBank(e) {
    e.preventDefault();
    if (!bankDetails.account_holder_name.trim() || !bankDetails.account_number.trim() || !bankDetails.ifsc_code.trim()) {
      showToast('Account holder name, account number, and IFSC are required', 'error');
      return;
    }

    setSavingBank(true);

    // Fetch current listing_data to merge (don't clobber other fields)
    const brandRes = await brandApi.getMe();
    const currentBrand = brandRes.success ? (brandRes.data?.brand || brandRes.data) : null;
    const existingLd = currentBrand?.listing_data || {};

    const payload = {
      listing_data: {
        ...existingLd,
        bank_details: {
          account_holder_name: bankDetails.account_holder_name.trim(),
          bank_name:           bankDetails.bank_name.trim(),
          account_number:      bankDetails.account_number.trim(),
          ifsc_code:           bankDetails.ifsc_code.trim().toUpperCase(),
          upi_id:              bankDetails.upi_id.trim(),
        },
      },
    };

    const res = await brandApi.updateMe(payload);
    setSavingBank(false);

    if (res.success) {
      showToast('Bank details saved');
      setShowBankForm(true);
    } else {
      showToast(res.error?.message || 'Failed to save bank details', 'error');
    }
  }

  // Derived
  const balance        = wallet?.wallet_balance  || 0;
  const escrowLocked   = wallet?.escrow_locked   || 0;
  const totalDeposited = wallet?.total_deposited || 0;
  // Adjacent-fix: was `balance < 1000000` with a stale paise-era comment.
  // brands.wallet_balance has been rupees since migration 021. ₹10K is the
  // practical floor to publish a small handpick campaign (3-4 micro-
  // influencers + 8% platform fee headroom).
  const isLowBalance = balance < LOW_BAL_THRESHOLD;

  // Derived: last top-up date for the hero sub-line.
  const lastTopup = useMemo(() => {
    const t = transactions.find(tx => tx.type === 'topup');
    if (!t) return null;
    return { date: t.created_at, amount: t.amount };
  }, [transactions]);

  // Per-filter counts (mono digits in chip)
  const filterCounts = useMemo(() => {
    const counts = { all: transactions.length };
    for (const f of FILTERS) {
      if (f.key === 'all') continue;
      counts[f.key] = transactions.filter(tx => f.types && f.types.has(tx.type)).length;
    }
    return counts;
  }, [transactions]);

  const filtered = useMemo(() => {
    const f = FILTERS.find(x => x.key === txFilter);
    if (!f || !f.types) return transactions;
    return transactions.filter(tx => f.types.has(tx.type));
  }, [transactions, txFilter]);

  function fmtTxDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }

  function fmtShortDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function scrollToTopup() {
    const el = document.getElementById('topup-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="w">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="crumb">/dashboard <span className="sep">/</span> <b>wallet</b></div>
      <h1 className="title">Wallet</h1>
      <div className="rule" />

      <div className="wcols">
        {/* ── Main column ── */}
        <div className="wmain">

          {/* Hero card */}
          <div className="hero">
            <div className="hero-eb">Available balance</div>
            <div className="hero-bal"><span className="cur">₹</span>{fmtN(balance)}</div>
            {isLowBalance ? (
              <div className="hero-sub warn">Below the ₹{fmtN(LOW_BAL_THRESHOLD)} floor to publish a new campaign.</div>
            ) : lastTopup ? (
              <div className="hero-sub">
                Last topped up <span className="last">{fmtShortDate(lastTopup.date)} · ₹{fmtN(lastTopup.amount)}</span>
              </div>
            ) : (
              <div className="hero-sub">Top up to fund your campaigns.</div>
            )}
            <button className="hero-cta" onClick={scrollToTopup}>+ Top up wallet</button>
          </div>

          {/* Low-balance warning card */}
          {isLowBalance && (
            <div className="warn-card">
              <div className="ic">!</div>
              <div className="t"><b>Below ₹{fmtN(LOW_BAL_THRESHOLD)}</b> — you can&apos;t publish a new campaign at this level. Existing campaigns continue normally.</div>
              <button className="cta" onClick={scrollToTopup}>Top up now →</button>
            </div>
          )}

          {/* KPI strip */}
          <div className="kpis">
            <div className="kpi">
              <div className="kpi-lbl">Available</div>
              <div className={`kpi-v ${isLowBalance ? 'warn' : ''}`}>₹{fmtN(balance)}</div>
              <div className="kpi-sub">{isLowBalance ? 'below publish floor' : 'spendable now'}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Locked in escrow</div>
              <div className="kpi-v warn">₹{fmtN(escrowLocked)}</div>
              <div className="kpi-sub">across active campaigns</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Total deposited</div>
              <div className="kpi-v">₹{fmtN(totalDeposited)}</div>
              <div className="kpi-sub">all-time top-ups</div>
            </div>
          </div>

          {/* Top-up section */}
          <div className="card" id="topup-section">
            <div className="card-head">
              <h3>Top up wallet</h3>
              <span className="count">via Razorpay</span>
            </div>
            <form className="tu" onSubmit={handleTopup}>
              <div className="tu-row">
                <label className="tu-input">
                  <span className="cur">₹</span>
                  <input
                    type="number"
                    placeholder="Amount in rupees"
                    value={topupAmount}
                    onChange={e => setTopupAmount(e.target.value)}
                    min="1"
                  />
                </label>
                <button type="submit" className="tu-cta" disabled={toppingUp || !topupAmount}>
                  {toppingUp ? 'Processing…' : 'Top up'}
                </button>
              </div>
            </form>
            <div className="tu-picks">
              {QUICK_PICKS.map(amt => (
                <button
                  key={amt}
                  className={`tu-pick ${String(amt) === topupAmount ? 'act' : ''}`}
                  onClick={() => setTopupAmount(String(amt))}
                >
                  ₹{(amt).toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            <div className="tu-hint">
              Funds appear <b>instantly</b> after payment. Razorpay handles UPI · cards · netbanking. Minimum <b>₹1</b>.
            </div>
          </div>

          {/* Transaction history */}
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Transaction history</h3>
                <div className="sh">Most recent 20 entries</div>
              </div>
              <span className="count">{filtered.length} of {transactions.length} shown</span>
            </div>

            <div className="fchips">
              {FILTERS.map(f => {
                const ct = filterCounts[f.key] ?? 0;
                return (
                  <button
                    key={f.key}
                    className={`fchip ${txFilter === f.key ? 'act' : ''}`}
                    onClick={() => setTxFilter(f.key)}
                  >
                    {f.label}<span className="ct">{ct}</span>
                  </button>
                );
              })}
            </div>

            {txLoading ? (
              <div className="tx-empty">Loading transactions…</div>
            ) : transactions.length === 0 ? (
              <div className="tx-empty">No transactions yet. Top up to get started.</div>
            ) : filtered.length === 0 ? (
              <div className="tx-empty">No transactions match this filter.</div>
            ) : (
              filtered.map((tx, i) => {
                const cfg = TX_TYPE[tx.type] || { label: tx.type, icon: '•', tone: 'debit' };
                const isCredit = CREDIT_TYPES.has(tx.type);
                return (
                  <div key={tx.id || i} className="tx">
                    <div className={`tx-ic ${cfg.tone}`}>{cfg.icon}</div>
                    <div className="tx-meta">
                      <div className="tx-t">{cfg.label}</div>
                      {tx.description && <div className="tx-d">{tx.description}</div>}
                      {tx.created_at && <div className="tx-dt">{fmtTxDate(tx.created_at)}</div>}
                    </div>
                    <div className={`tx-amt ${isCredit ? 'credit' : 'debit'}`}>
                      {isCredit ? '+' : '−'} ₹{fmtN(Math.abs(tx.amount || 0))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* ── Right rail ── */}
        <aside className="wrail">

          {/* Bank account form / empty state */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: 6 }}>
              <h3>Bank account</h3>
            </div>
            <div className="sh" style={{ marginBottom: 14 }}>For follower-payment settlements after our commission deduction.</div>

            {!bankLoaded ? (
              <div className="tx-empty" style={{ padding: 18 }}>Loading…</div>
            ) : !showBankForm && !bankDetails.account_holder_name ? (
              <div className="bank-empty">
                <div className="bank-empty-ic">🏦</div>
                <div className="bank-empty-t">No bank account on file yet.<br />Add one to receive settlements.</div>
                <button className="bank-cta" style={{ float: 'none', marginTop: 0 }} onClick={() => setShowBankForm(true)}>+ Add bank account</button>
              </div>
            ) : (
              <form onSubmit={handleSaveBank}>
                <div className="f">
                  <label className="flbl">Account holder name <span className="req">*</span></label>
                  <input
                    className="inp"
                    value={bankDetails.account_holder_name}
                    onChange={e => handleBankChange('account_holder_name', e.target.value)}
                    placeholder="Name as on bank account"
                  />
                </div>
                <div className="f">
                  <label className="flbl">Bank name</label>
                  <input
                    className="inp"
                    value={bankDetails.bank_name}
                    onChange={e => handleBankChange('bank_name', e.target.value)}
                    placeholder="e.g. State Bank of India"
                  />
                </div>
                <div className="f">
                  <label className="flbl">Account number <span className="req">*</span></label>
                  <input
                    className="inp mono"
                    value={bankDetails.account_number}
                    onChange={e => handleBankChange('account_number', e.target.value.replace(/\D/g, ''))}
                    placeholder="1234567890"
                  />
                  {bankDetails.account_number.length > 4 && (
                    <div className="fhint">Displayed as {maskAccountNumber(bankDetails.account_number)}</div>
                  )}
                </div>
                <div className="f">
                  <label className="flbl">IFSC <span className="req">*</span></label>
                  <input
                    className="inp mono"
                    value={bankDetails.ifsc_code}
                    onChange={e => handleBankChange('ifsc_code', e.target.value.toUpperCase())}
                    maxLength={11}
                    placeholder="SBIN0001234"
                  />
                </div>
                <div className="f">
                  <label className="flbl">UPI ID <span className="opt">optional · faster settlements</span></label>
                  <input
                    className="inp"
                    value={bankDetails.upi_id}
                    onChange={e => handleBankChange('upi_id', e.target.value)}
                    placeholder="yourname@upi"
                  />
                </div>
                <button type="submit" className="bank-cta" disabled={savingBank}>
                  {savingBank ? 'Saving…' : 'Save bank details'}
                </button>
                <div style={{ clear: 'both' }} />
              </form>
            )}
          </div>

          {/* How wallet works card */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: 10 }}>
              <h3>How wallet works</h3>
            </div>
            <ul className="howr">
              <li><b>Top-ups</b> · instant via Razorpay (UPI · card · netbanking). Min ₹1.</li>
              <li><b>Escrow lock</b> · happens automatically at publish. T1 = 25% of each influencer&apos;s agreed fee.</li>
              <li><b>Escrow release</b> · T2 fires when you confirm a live URL. T3 auto-releases 30 days after content goes live.</li>
              <li><b>Bank account</b> · used only for follower-payment settlements (separate from campaign escrow).</li>
            </ul>
          </div>

        </aside>
      </div>

      {toast && <div className={`toast ${toastType}`}>{toast}</div>}
    </div>
  );
}

// Compact rupee formatter — preserves fmtMoney semantics but tighter for inline use
function fmtN(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
