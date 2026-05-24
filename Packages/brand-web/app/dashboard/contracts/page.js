'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { contractApi, walletApi, fmtRupees } from '../../../lib/api';

// ─── Helpers (preserved verbatim from OLD page) ─────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function platformFee(c) {
  return parseFloat(c.platform_fee_pct || 8);
}
function lockAmount(c) {
  const base  = parseFloat(c.influencer_fee || 0);
  const bonus = parseFloat(c.bonus_amount || 0);
  const fee   = platformFee(c);
  return parseFloat(((base + bonus) * (1 + fee / 100)).toFixed(2));
}

// ─── NEW use of already-loaded backend fields ───────────────────────────────
function tierFromFollowers(n) {
  const x = Number(n) || 0;
  if (x >= 1_000_000) return { key: 'mega',  label: 'Mega'  };
  if (x >=   100_000) return { key: 'macro', label: 'Macro' };
  if (x >=    10_000) return { key: 'micro', label: 'Micro' };
  if (x > 0)          return { key: 'nano',  label: 'Nano'  };
  return null;
}
function fmtFollowers(n) {
  const x = Number(n) || 0;
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (x >= 1_000)     return (x / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(x);
}
function fmtFormats(formats) {
  if (!Array.isArray(formats)) return [];
  return formats.map(f => {
    const name = (f.name || '').replace(/^Instagram\s+/i, '').replace(/^YouTube\s+/i, 'YT ');
    const count = Number(f.count) || 1;
    return `${count} ${name}${count !== 1 && !name.endsWith('s') ? 's' : ''}`;
  });
}

// ─── Locked palette CSS (scoped under .cts to avoid cascade collisions) ─────
const CSS = `
.cts *{box-sizing:border-box}
.cts{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --conv:#7E22CE; --conv-pale:#F3E8FF;
  --eng:#0E7490; --eng-pale:#CFFAFE;
  --hyb:#6B5A00; --hyb-pale:#FFF7CC;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; color:var(--ink); font-size:13px; line-height:1.45;
}
.cts .mono{font-family:'JetBrains Mono',monospace}
.cts .display{font-family:'Outfit',sans-serif}

.cts .crumb{font-family:'JetBrains Mono';font-size:11px;color:var(--muted-2);letter-spacing:.3px;text-transform:uppercase;margin-bottom:14px}
.cts .crumb b{color:var(--ink);font-weight:800}
.cts .crumb .sep{color:var(--muted-3);margin:0 6px}

/* header */
.cts .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.cts .hdr h1{font-family:'Outfit';font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.cts .hdr .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0 6px}
.cts .hdr .sub{font-size:12px;color:var(--muted-2);max-width:520px;line-height:1.5}
.cts .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono';font-size:11px;font-weight:800;margin-bottom:6px}
.cts .btn-ghost{padding:7px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.cts .btn-ghost:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.cts .btn-ghost:disabled{opacity:.4;cursor:not-allowed}

/* wallet strip — always-visible ink card */
.cts .ws{background:var(--ink);color:var(--white);border-radius:14px;padding:16px 20px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr auto;gap:20px;align-items:center}
@media (max-width:720px){.cts .ws{grid-template-columns:1fr;gap:14px}}
.cts .ws-cell{}
.cts .ws-lbl{font-family:'JetBrains Mono';font-size:10px;font-weight:800;color:rgba(255,255,255,.55);letter-spacing:.4px;text-transform:uppercase;margin-bottom:4px}
.cts .ws-v{font-family:'JetBrains Mono';font-size:18px;font-weight:800;color:var(--white)}
.cts .ws-v.yellow{color:var(--yellow)}
.cts .ws-v.warn{color:var(--danger)}
.cts .ws-bar-wrap{margin-top:8px}
.cts .ws-bar{height:4px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden}
.cts .ws-bar-fill{height:100%;background:var(--yellow);border-radius:99px;transition:width .25s}
.cts .ws-bar-fill.warn{background:var(--danger)}
.cts .ws-bar-note{font-size:10px;color:rgba(255,255,255,.5);margin-top:4px;font-family:'JetBrains Mono'}
.cts .ws-cell.action{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.cts .ws-short-chip{display:inline-flex;align-items:center;padding:4px 10px;background:rgba(232,64,26,.22);color:var(--danger);border-radius:99px;font-family:'JetBrains Mono';font-size:11px;font-weight:800;white-space:nowrap}
.cts .ws-topup-link{font-size:11px;font-weight:700;color:var(--yellow);border:1px solid rgba(255,193,7,.35);padding:6px 12px;border-radius:9px;background:transparent;text-decoration:none;display:inline-block}
.cts .ws-topup-link:hover{background:rgba(255,193,7,.12);color:var(--yellow)}

/* bulk action bar (sticky) */
.cts .bb{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:11px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;position:sticky;top:0;z-index:5;transition:all .15s}
.cts .bb.has-sel{border-color:var(--ink);box-shadow:0 4px 12px -6px rgba(0,0,0,.1)}
.cts .bb-left{display:flex;align-items:center;gap:10px}
.cts .cb{width:18px;height:18px;border:1.5px solid var(--border);border-radius:5px;background:var(--white);accent-color:var(--yellow);cursor:pointer;flex-shrink:0}
.cts .bb-lbl{font-size:12px;font-weight:600;color:var(--muted);cursor:pointer}
.cts .bb-lbl.has-sel{color:var(--ink);font-weight:700}
.cts .bb-lbl b{font-family:'JetBrains Mono';color:var(--ink)}
.cts .bb-right{display:flex;align-items:center;gap:10px}
.cts .btn-sign{padding:9px 18px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit;transition:all .15s}
.cts .btn-sign:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.cts .btn-sign:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.cts .topup-nudge{font-family:'JetBrains Mono';font-size:11px;font-weight:700;color:var(--danger-text)}

/* contract row card */
.cts .cr{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:auto 1fr auto auto;gap:14px;align-items:center;transition:all .15s;margin-bottom:8px}
.cts .cr:hover{border-color:var(--muted-3)}
.cts .cr.sel{border-color:var(--ink);background:var(--yellow-50);box-shadow:0 0 0 3px var(--yellow-pale)}
.cts .cr-mid{min-width:0}
.cts .cr-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.cts .cr-handle{font-family:'JetBrains Mono';font-size:13.5px;font-weight:800;color:var(--ink)}
.cts .tier-pill{font-family:'JetBrains Mono';font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:99px;background:var(--bg2);color:var(--muted);text-transform:uppercase;letter-spacing:.3px}
.cts .tier-pill.nano{background:var(--bg2);color:var(--muted)}
.cts .tier-pill.micro{background:var(--eng-pale);color:var(--eng)}
.cts .tier-pill.macro{background:var(--yellow-pale);color:var(--yellow-text)}
.cts .tier-pill.mega{background:var(--conv-pale);color:var(--conv)}
.cts .goal-pill{font-family:'JetBrains Mono';font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.cts .goal-pill.engagement{background:var(--eng-pale);color:var(--eng)}
.cts .goal-pill.conversion{background:var(--conv-pale);color:var(--conv)}
.cts .goal-pill.hybrid{background:var(--hyb-pale);color:var(--hyb)}
.cts .cr-meta{font-size:11px;color:var(--muted-2);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cts .cr-meta .mono{color:var(--ink);font-weight:700}
.cts .cr-meta .dot{color:var(--muted-3);margin:0 2px}
.cts .mode-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:var(--bg2);color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
.cts .cr-extras{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.cts .fmt-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;background:var(--white);border:1px solid var(--border);border-radius:99px;font-family:'JetBrains Mono';font-size:10.5px;font-weight:700;color:var(--ink)}
.cts .followers-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;background:var(--white);border:1px solid var(--border);border-radius:99px;font-size:10.5px;font-weight:700;color:var(--ink)}
.cts .followers-chip .mono{font-family:'JetBrains Mono'}
.cts .cr-amt{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.cts .cr-amt-lbl{font-family:'JetBrains Mono';font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.cts .cr-amt-v{font-family:'JetBrains Mono';font-size:16px;font-weight:800;color:var(--ink);letter-spacing:-.3px}
.cts .cr-amt-sub{font-family:'JetBrains Mono';font-size:10px;color:var(--muted-2);margin-top:2px}
.cts .cr-review{display:inline-flex;align-items:center;padding:7px 13px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:11.5px;font-weight:700;color:var(--ink);text-decoration:none;font-family:inherit}
.cts .cr-review:hover{border-color:var(--ink);background:var(--yellow-50);color:var(--ink)}

/* status banners */
.cts .err-banner{padding:11px 14px;background:var(--danger-pale);border:1px solid #FBCBC4;border-radius:10px;font-size:12px;color:var(--danger-text);font-weight:600;margin-bottom:10px}
.cts .ok-banner{padding:11px 14px;background:var(--success-pale);border:1px solid rgba(16,185,129,.3);border-radius:10px;font-size:12px;color:var(--success-text);font-weight:600;margin-bottom:10px}

/* empty state */
.cts .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:40px;text-align:center;margin-top:14px;position:relative;overflow:hidden}
.cts .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.cts .empty > *{position:relative;z-index:2}
.cts .empty .ic{width:60px;height:60px;background:var(--ink);color:var(--yellow);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:26px;margin:0 auto 14px}
.cts .empty .h{font-family:'Outfit';font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.cts .empty .t{font-size:12px;color:var(--muted);line-height:1.55;max-width:440px;margin:0 auto 16px}
.cts .empty .cta{display:inline-flex;align-items:center;padding:9px 16px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;text-decoration:none;font-family:inherit}
.cts .empty .cta:hover{background:var(--ink-2);color:var(--yellow)}

/* loading */
.cts .loading{padding:40px;text-align:center;color:var(--muted-2);font-size:13px}
`;

export default function ContractsInboxPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(() => new Set());
  const [signing, setSigning]     = useState(false);
  const [error, setError]         = useState('');
  const [okMsg, setOkMsg]         = useState('');
  const [wallet, setWallet]       = useState(null);

  // ── Load (preserved verbatim) ────────────────────────────────────────────
  async function load() {
    setLoading(true);
    setError('');
    const [cRes, wRes] = await Promise.all([
      contractApi.listPending(),
      walletApi.getBalance().catch(() => null),
    ]);
    setLoading(false);
    if (!cRes.success) {
      setError(cRes.error?.message || 'Failed to load contracts');
      return;
    }
    setContracts(cRes.data?.contracts || []);
    if (wRes?.success) setWallet(wRes.data?.wallet || wRes.data);
  }

  useEffect(() => { load(); }, []);

  // ── Derived (preserved + extended for wallet strip) ──────────────────────
  const totalLock = useMemo(
    () => contracts
      .filter(c => selected.has(c.id))
      .reduce((sum, c) => sum + lockAmount(c), 0),
    [contracts, selected]
  );

  const walletBalance = parseFloat(wallet?.wallet_balance ?? 0);
  const walletShort   = totalLock > walletBalance;
  const walletPct     = walletBalance > 0 ? Math.min(100, (totalLock / walletBalance) * 100) : 0;
  const shortBy       = walletShort ? totalLock - walletBalance : 0;
  const headroom      = walletShort ? 0 : walletBalance - totalLock;

  // ── Selection helpers (preserved verbatim) ───────────────────────────────
  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === contracts.length) setSelected(new Set());
    else setSelected(new Set(contracts.map(c => c.id)));
  }

  // ── Bulk sign (preserved verbatim) ───────────────────────────────────────
  async function signSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Counter-sign ${ids.length} contract${ids.length !== 1 ? 's' : ''} for a total wallet lock of ${fmtRupees(totalLock)}?`)) return;
    setSigning(true);
    setError(''); setOkMsg('');
    const res = await contractApi.bulkSign(ids);
    setSigning(false);
    if (!res.success) {
      setError(res.error?.message || 'Bulk sign failed');
      return;
    }
    setOkMsg(`Signed ${res.data?.signed_count || ids.length} contract${(res.data?.signed_count || ids.length) !== 1 ? 's' : ''}.`);
    setSelected(new Set());
    load();
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cts">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="crumb">/dashboard <span className="sep">/</span> <b>contracts</b></div>

      <div className="hdr">
        <div>
          <span className="cnt-chip">{loading ? '…' : `${contracts.length} pending`}</span>
          <h1>Contracts</h1>
          <div className="rule" />
          <div className="sub">Influencers have signed. Counter-sign to lock funds and start the campaign.</div>
        </div>
        <div>
          <button className="btn-ghost" onClick={load} disabled={loading}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="err-banner">{error}</div>}
      {okMsg && <div className="ok-banner">{okMsg}</div>}

      {/* Wallet status strip — always visible */}
      <div className="ws">
        <div className="ws-cell">
          <div className="ws-lbl">Wallet</div>
          <div className="ws-v">{wallet ? fmtRupees(walletBalance) : '—'}</div>
          <div className="ws-bar-note" style={{ marginTop: 6 }}>{wallet ? 'available to lock' : 'loading…'}</div>
        </div>
        <div className="ws-cell">
          <div className="ws-lbl">Selected lock</div>
          <div className={`ws-v ${walletShort ? 'warn' : 'yellow'}`}>{fmtRupees(totalLock)}</div>
          <div className="ws-bar-wrap">
            <div className="ws-bar"><div className={`ws-bar-fill ${walletShort ? 'warn' : ''}`} style={{ width: `${walletPct}%` }} /></div>
          </div>
          <div className="ws-bar-note">
            {wallet
              ? walletShort
                ? <span style={{ color: 'rgba(255,99,71,.85)' }}>{Math.round((totalLock / walletBalance) * 100)}% of wallet · over by {fmtRupees(shortBy)}</span>
                : `${Math.round(walletPct)}% of wallet · headroom ${fmtRupees(headroom)}`
              : '—'}
          </div>
        </div>
        <div className="ws-cell action">
          {walletShort && <span className="ws-short-chip">Short {fmtRupees(shortBy)}</span>}
          <Link className="ws-topup-link" href="/dashboard/wallet">+ Top up</Link>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading contracts…</div>
      ) : contracts.length === 0 ? (
        <div className="empty">
          <div className="ic">✓</div>
          <div className="h">All caught up</div>
          <div className="t">No contracts waiting on your signature right now. When an influencer signs, it&apos;ll show up here for your countersignature.</div>
          <Link className="cta" href="/dashboard/campaigns">See all your campaigns →</Link>
        </div>
      ) : (
        <>
          {/* Sticky bulk action bar */}
          <div className={`bb ${selected.size > 0 ? 'has-sel' : ''}`}>
            <label className="bb-left">
              <input
                type="checkbox"
                className="cb"
                checked={selected.size === contracts.length && contracts.length > 0}
                onChange={toggleAll}
              />
              <span className={`bb-lbl ${selected.size > 0 ? 'has-sel' : ''}`}>
                {selected.size === 0
                  ? `Select all (${contracts.length})`
                  : (<><b>{selected.size}</b> selected · lock total <b>{fmtRupees(totalLock)}</b></>)}
              </span>
            </label>
            <div className="bb-right">
              {selected.size > 0 && walletShort && (
                <span className="topup-nudge">Top up to enable</span>
              )}
              <button
                className="btn-sign"
                onClick={signSelected}
                disabled={selected.size === 0 || signing || walletShort}
              >
                {signing ? 'Signing…' : `Sign selected${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </div>
          </div>

          {/* Contract rows */}
          {contracts.map(c => {
            const isSel    = selected.has(c.id);
            const lock     = lockAmount(c);
            const base     = parseFloat(c.influencer_fee || 0);
            const bonus    = parseFloat(c.bonus_amount || 0);
            const goal     = (c.goal || 'engagement').toLowerCase();
            const tier     = tierFromFollowers(c.followers_count);
            const formats  = fmtFormats(c.formats_json);

            return (
              <div key={c.id} className={`cr ${isSel ? 'sel' : ''}`}>
                <input
                  type="checkbox"
                  className="cb"
                  checked={isSel}
                  onChange={() => toggle(c.id)}
                />
                <div className="cr-mid">
                  <div className="cr-top">
                    <span className="cr-handle">@{c.instagram_handle || '—'}</span>
                    {tier && <span className={`tier-pill ${tier.key}`}>{tier.label}</span>}
                    <span className={`goal-pill ${goal}`}>{goal}</span>
                  </div>
                  <div className="cr-meta">
                    <span>{c.campaign_name}</span>
                    <span className="dot">·</span>
                    <span>signed <span className="mono">{fmtDate(c.influencer_signed_at)}</span></span>
                    {c.production_mode && (
                      <>
                        <span className="dot">·</span>
                        <span className="mode-pill">{c.production_mode}</span>
                      </>
                    )}
                  </div>
                  {(formats.length > 0 || c.followers_count) && (
                    <div className="cr-extras">
                      {formats.map((f, i) => (
                        <span key={i} className="fmt-chip">{f}</span>
                      ))}
                      {c.followers_count > 0 && (
                        <span className="followers-chip">
                          <span className="mono">{fmtFollowers(c.followers_count)}</span> followers
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="cr-amt">
                  <div className="cr-amt-lbl">Lock</div>
                  <div className="cr-amt-v">{fmtRupees(lock)}</div>
                  {bonus > 0 && (
                    <div className="cr-amt-sub">{fmtRupees(base)} + {fmtRupees(bonus)} bonus</div>
                  )}
                </div>
                <Link
                  href={`/dashboard/campaigns/${c.campaign_id}`}
                  className="cr-review"
                >
                  Review →
                </Link>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
