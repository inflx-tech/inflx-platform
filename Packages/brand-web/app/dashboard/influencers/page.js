'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { influencerApi, brandApi, creatorInvitationApi, proposalApi, influencerGroupApi, fmtNum, fmtRupees } from '../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_CFG = {
  nano:      { label: 'Nano',      dot: 'var(--muted)' },
  micro:     { label: 'Micro',     dot: 'var(--info)' },
  mid:       { label: 'Mid',       dot: 'var(--eng)' },
  macro:     { label: 'Macro',     dot: 'var(--conv)' },
  mega:      { label: 'Mega',      dot: 'var(--yellow)' },
  celebrity: { label: 'Celebrity', dot: 'var(--danger)' },
};

const SORTS = [
  { key: 'rank',         label: 'Best fit (rank)' },
  { key: 'view_er',      label: 'Best engagement' },
  { key: 'followers',    label: 'Most followers' },
  { key: 'active',       label: 'Most active' },
  { key: 'growth',       label: 'Highest growth potential' },
  { key: 'cheapest',     label: 'Lowest est. rate' },
  { key: 'most_collabs', label: 'Most brand collabs' },
];

const STALE_DAYS = 7;

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(handle, name) {
  const src = (name || handle || '??').replace(/^@/, '').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function isStale(iso) {
  if (!iso) return false;
  const ms = Date.now() - new Date(iso).getTime();
  return ms > STALE_DAYS * 86_400_000;
}

function staleDays(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function erClass(er) {
  const v = Number(er || 0);
  if (v >= 5) return 'er-high';
  if (v >= 2) return 'er-mid';
  return '';
}

function median(arr) {
  const vs = arr.filter(v => v != null && !Number.isNaN(Number(v))).map(Number).sort((a, b) => a - b);
  if (!vs.length) return 0;
  const mid = Math.floor(vs.length / 2);
  return vs.length % 2 ? vs[mid] : Math.round((vs[mid - 1] + vs[mid]) / 2);
}

// ─── Locked palette CSS scoped under .inf — day-1 discipline ────────────────
const CSS = `
.inf *{box-sizing:border-box}
.inf{
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
.inf .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

/* Sub-tabs (Discover / Proposals) — E-2 */
.inf .subtabs{display:flex;gap:4px;background:var(--bg2);padding:4px;border-radius:11px;margin-bottom:16px;width:fit-content}
.inf .subtab{border:0;background:transparent;padding:8px 18px;border-radius:8px;font-weight:700;font-size:12.5px;cursor:pointer;color:var(--muted);font-family:inherit;display:inline-flex;align-items:center;gap:7px}
.inf .subtab.act{background:var(--white);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.inf .subtab-ct{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;background:var(--ink);color:var(--yellow);padding:2px 7px;border-radius:99px}

.inf .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.inf .hdr-l h1{font-family:'Outfit';font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.inf .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.inf .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:600px;line-height:1.5}
.inf .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.inf .btn-ghost{padding:8px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.inf .btn-ghost:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.inf .btn-ink{padding:8px 14px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.inf .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.inf .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}

.inf .hero{background:var(--ink);color:var(--white);border-radius:16px;padding:22px 26px;margin-bottom:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;position:relative;overflow:hidden}
.inf .hero::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:var(--yellow);border-radius:50%;opacity:.06}
.inf .hero-cell{position:relative;z-index:2;border-left:1px solid rgba(255,255,255,.08);padding-left:18px}
.inf .hero-cell:first-child{border-left:0;padding-left:0}
.inf .hero-v{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:800;letter-spacing:-.6px;color:var(--white);line-height:1.1}
.inf .hero-v.yel{color:var(--yellow)}
.inf .hero-l{font-family:'Outfit',sans-serif;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-top:6px}
.inf .hero-s{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:rgba(255,255,255,.4);margin-top:3px}

.inf .sbar{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px}
.inf .sbar-top{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.inf .sbar-top .qin{flex:1;min-width:240px;padding:10px 14px;border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;color:var(--ink);background:var(--white)}
.inf .sbar-top .qin:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.inf .sbar-top select{padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:12px;font-family:inherit;outline:none;background:var(--white);color:var(--ink);min-width:180px;font-weight:600}
.inf .sbar-row{display:flex;flex-wrap:wrap;gap:8px;align-items:end}
.inf .sbar-f{display:flex;flex-direction:column;gap:4px;min-width:120px}
.inf .sbar-f-l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.inf .sbar-f-i{padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:inherit;outline:none;color:var(--ink);background:var(--white)}
.inf .sbar-f-i:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.inf .sbar-more{padding:7px 12px;background:transparent;border:1px dashed var(--muted-3);border-radius:8px;font-size:11.5px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.inf .sbar-more:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--bg)}
.inf .sbar-more.open{border-style:solid;border-color:var(--ink);background:var(--bg);color:var(--ink)}
.inf .sbar-clear{padding:7px 10px;background:transparent;border:0;font-size:11px;font-weight:700;color:var(--muted-2);text-decoration:underline;cursor:pointer;font-family:inherit}
.inf .sbar-clear:hover{color:var(--danger-text);background:transparent}
.inf .sbar-advanced{margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)}
.inf .sbar-checks{display:flex;flex-wrap:wrap;gap:18px;margin-top:10px}
.inf .sbar-check{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink);font-weight:600;cursor:pointer}
.inf .sbar-check input{accent-color:var(--yellow);width:14px;height:14px}

.inf .tier-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.inf .tier-chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.inf .tier-chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.inf .tier-chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.inf .tier-chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.inf .tier-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--muted-3)}
.inf .tier-chip .ct{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;opacity:.7;margin-left:2px}

.inf .tier-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;display:inline-flex;align-items:center;gap:4px;background:var(--bg2);color:var(--muted)}
.inf .tier-pill.nano{background:var(--bg2);color:var(--muted)}
.inf .tier-pill.micro{background:var(--info-pale);color:var(--info)}
.inf .tier-pill.mid{background:var(--eng-pale);color:var(--eng)}
.inf .tier-pill.macro{background:var(--conv-pale);color:var(--conv)}
.inf .tier-pill.mega{background:var(--yellow-pale);color:var(--yellow-text)}
.inf .tier-pill.celebrity{background:var(--danger-pale);color:var(--danger-text)}
.inf .tier-pill .d{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.6}

/* Compact single-line row card */
.inf .ic{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:10px 14px;display:grid;grid-template-columns:44px 1fr auto auto auto;gap:14px;align-items:center;margin-bottom:6px;transition:all .15s;cursor:pointer;min-height:64px;text-align:left;color:var(--ink);font-family:inherit;width:100%;border-width:1px}
.inf .ic:hover{border-color:var(--ink)}
.inf .av{width:40px;height:40px;border-radius:10px;background:var(--yellow-pale);color:var(--yellow-text);display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:13px;flex-shrink:0;overflow:hidden}
.inf .av img{width:100%;height:100%;object-fit:cover}
.inf .ic-mid{min-width:0;display:flex;flex-direction:column;gap:3px}
.inf .ic-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.inf .ic-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink)}
.inf .ic-handle{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--muted-2)}
.inf .ic-verify{display:inline-flex;align-items:center;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;padding:1px 5px;border-radius:5px;background:var(--info-pale);color:var(--info);text-transform:uppercase;letter-spacing:.3px}
.inf .ic-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inf .ic-meta b{color:var(--ink);font-weight:600}
.inf .ic-meta .sep{color:var(--muted-3)}
.inf .ic-tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;color:var(--muted-2);padding:1px 5px;border-radius:4px;background:var(--bg2);font-style:italic}
.inf .ic-tag.stale{color:var(--danger-text);background:var(--danger-pale);font-style:normal}
.inf .rank-mini{display:inline-flex;align-items:center;gap:3px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;padding:2px 6px;border-radius:5px;background:var(--yellow-pale);color:var(--yellow-text)}

.inf .ic-stats{display:flex;gap:14px;align-items:center;flex-shrink:0}
.inf .ic-st{text-align:center;min-width:50px}
.inf .ic-st-v{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:800;color:var(--ink);letter-spacing:-.2px;line-height:1.1}
.inf .ic-st-v.er-high{color:var(--success-text)}
.inf .ic-st-v.er-mid{color:var(--info)}
.inf .ic-st-l{font-family:'Outfit',sans-serif;font-size:8.5px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:1px}

.inf .ic-rate-mini{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;color:var(--ink);text-align:right;flex-shrink:0;min-width:90px;line-height:1.15}
.inf .ic-rate-mini .l{font-family:'Outfit',sans-serif;font-size:8.5px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:1px;display:block}
.inf .ic-action-btn{padding:7px 12px;font-size:11px;font-weight:700;border-radius:8px;cursor:pointer;font-family:inherit;border:0;flex-shrink:0;white-space:nowrap}
.inf .ic-action-btn.add{background:var(--ink);color:var(--yellow)}
.inf .ic-action-btn.add:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.inf .ic-action-btn.add:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.inf .ic-action-btn.invite{background:var(--yellow);color:var(--ink)}
.inf .ic-action-btn.invite:hover:not(:disabled){background:var(--yellow-hover);color:var(--ink)}
.inf .ic-action-btn.invite:disabled{opacity:.4;cursor:not-allowed;background:var(--yellow);color:var(--ink)}

.inf .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px;position:relative;overflow:hidden}
.inf .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.inf .empty > *{position:relative;z-index:2}
.inf .empty .ic-ic{width:60px;height:60px;background:var(--ink);color:var(--yellow);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:24px;margin:0 auto 14px}
.inf .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.inf .empty .t{font-size:12px;color:var(--muted);line-height:1.55;max-width:480px;margin:0 auto 16px}

.inf .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:inf-spin .8s linear infinite;margin:80px auto}
@keyframes inf-spin{to{transform:rotate(360deg)}}

.inf .gated{max-width:520px;margin:80px auto;text-align:center;padding:32px}
.inf .gated .icx{font-size:48px;margin-bottom:14px}
.inf .gated h2{font-family:'Outfit',sans-serif;font-size:20px;font-weight:700;color:var(--ink);margin-bottom:8px}
.inf .gated p{font-size:13px;color:var(--muted-2);line-height:1.55;margin-bottom:18px}

/* Invite Modal */
.inf .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
.inf .modal{background:var(--white);border-radius:16px;max-width:440px;width:100%;padding:22px;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
.inf .modal-h{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:14px}
.inf .modal-h h3{font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;color:var(--ink)}
.inf .modal-h p{font-size:11.5px;color:var(--muted-2);margin-top:3px;line-height:1.5}
.inf .modal-x{width:30px;height:30px;border-radius:50%;color:var(--muted-2);font-size:20px;background:transparent;border:0;cursor:pointer;font-family:inherit}
.inf .modal-x:hover{background:var(--bg);color:var(--ink)}
.inf .modal-f{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.inf .modal-f-l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px}
.inf .modal-f textarea,.inf .modal-f input{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;color:var(--ink);background:var(--white);resize:vertical}
.inf .modal-f textarea:focus,.inf .modal-f input:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.inf .modal-err{padding:10px 12px;background:var(--danger-pale);border:1px solid #FBCBC4;border-radius:8px;font-size:11.5px;color:var(--danger-text);margin-bottom:10px}
.inf .modal-actions{display:flex;gap:8px}
.inf .modal-actions button{flex:1;padding:10px 14px;font-size:12px;font-weight:700;border-radius:10px;cursor:pointer;font-family:inherit;border:0}
.inf .modal-actions .cancel{background:var(--white);border:1px solid var(--border);color:var(--ink)}
.inf .modal-actions .cancel:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.inf .modal-actions .submit{background:var(--ink);color:var(--yellow)}
.inf .modal-actions .submit:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.inf .modal-actions .submit:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}

.inf .toast{position:fixed;bottom:24px;right:24px;background:var(--ink);color:var(--white);padding:12px 16px;border-radius:12px;font-size:13px;font-weight:600;z-index:50;box-shadow:0 10px 25px rgba(0,0,0,.15)}
.inf .toast.err{background:var(--danger);color:var(--white)}

/* Groups sub-tab (F-5) */
.inf .grp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:14px}
.inf .grp-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:16px 18px;cursor:pointer;transition:all .15s;text-align:left;font-family:inherit;width:100%;display:flex;flex-direction:column;gap:8px}
.inf .grp-card:hover{border-color:var(--ink)}
.inf .grp-card-name{font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;color:var(--ink)}
.inf .grp-card-ct{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:var(--muted-2)}
.inf .grp-card-ct b{color:var(--ink)}
.inf .grp-mems{display:flex;flex-wrap:wrap;gap:4px}
.inf .grp-mem-pill{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;background:var(--bg2);color:var(--muted)}
.inf .grp-detail-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.inf .grp-name-edit{display:flex;align-items:center;gap:8px}
.inf .grp-name-edit input{padding:8px 12px;border:1px solid var(--border);border-radius:10px;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;outline:none;color:var(--ink);background:var(--white)}
.inf .grp-name-edit input:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.inf .grp-mem-row{background:var(--white);border:1px solid var(--border);border-radius:10px;padding:9px 12px;display:flex;align-items:center;gap:10px;margin-bottom:6px}
.inf .grp-mem-row .av{width:32px;height:32px;font-size:11px;border-radius:8px}
.inf .grp-mem-row .nm{flex:1;min-width:0}
.inf .grp-mem-row .nm .n{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:var(--ink)}
.inf .grp-mem-row .nm .h{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2)}
.inf .grp-mem-row .rm{padding:5px 10px;font-size:11px;font-weight:700;border-radius:8px;cursor:pointer;font-family:inherit;border:1px solid var(--border);background:var(--white);color:var(--danger-text)}
.inf .grp-mem-row .rm:hover{border-color:var(--danger);background:var(--danger-pale)}
.inf .grp-pick-row{background:var(--white);border:1px solid var(--border);border-radius:10px;padding:9px 12px;display:flex;align-items:center;gap:10px;margin-bottom:6px;cursor:pointer}
.inf .grp-pick-row.sel{border-color:var(--ink);background:var(--yellow-50)}
.inf .grp-pick-row .chk{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--muted-3);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink);flex-shrink:0}
.inf .grp-pick-row.sel .chk{background:var(--yellow);border-color:var(--yellow)}
`;

// ─── Row Card (compact single-line) ─────────────────────────────────────────

function CreatorRow({ c, onInvite, router }) {
  const tier = TIER_CFG[c.tier];
  const tierClass = TIER_CFG[c.tier] ? c.tier : 'nano';
  const isUnclaimed = c.source === 'scraped' && !c.is_inflx_verified;
  const stale = isStale(c.last_calculated_at);
  const inits = initials(c.ig_handle, c.full_name);

  const onClickRow = () => {
    router.push(`/dashboard/influencers/${c.linked_influencer_id || c.row_id}?source=${c.source}&handle=${c.ig_handle}`);
  };
  const onClickAction = (e) => {
    e.stopPropagation();
    if (isUnclaimed) onInvite(c);
    else router.push('/dashboard/campaigns');
  };

  const collabBit = c.total_brand_collaborations > 0 ? `${c.total_brand_collaborations} brand collab${c.total_brand_collaborations === 1 ? '' : 's'}` : null;

  const metaBits = [c.city, c.niche, collabBit].filter(Boolean);
  const erGood = Number(c.view_based_er || 0) >= 3;

  return (
    <div
      onClick={onClickRow}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClickRow(); }}
      className="text-left bg-white border border-[#E4E4E7] rounded-[14px] p-3.5 mb-2.5 cursor-pointer hover:border-[#A1A1AA] transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-[#EDEDED] flex items-center justify-center font-extrabold text-[13px] text-[#555] overflow-hidden flex-shrink-0">
          {c.profile_pic_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.profile_pic_url} alt={c.ig_handle} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : inits}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[15px] font-bold text-[#0A0A0A]">{c.full_name || `@${c.ig_handle}`}</span>
            {c.is_inflx_verified && <span className="text-[#3B6FE0] text-[13px]">✓</span>}
            <span className="text-[10px] font-extrabold bg-[#F2ECFB] text-[#6D3FC4] px-2 py-0.5 rounded-full uppercase tracking-[0.3px]">{tier?.label || c.tier || 'Unknown'}</span>
            {isUnclaimed && <span className="text-[9.5px] font-bold bg-[#F4F4F5] text-[#71717A] px-2 py-0.5 rounded-full uppercase">scraped</span>}
            {stale && <span className="text-[9.5px] font-bold bg-[#FDEEE9] text-[#B91C1C] px-2 py-0.5 rounded-full">data {staleDays(c.last_calculated_at)}d old</span>}
          </div>
          <div className="text-[12.5px] text-[#8E8E8E] mt-0.5 truncate">
            {c.full_name ? `@${c.ig_handle}` : ''}{c.full_name && metaBits.length ? ' · ' : ''}{metaBits.join(' · ')}
          </div>
        </div>
        <button
          onClick={onClickAction}
          className={`flex-shrink-0 text-[12px] font-bold rounded-[8px] px-3 py-1.5 whitespace-nowrap ${isUnclaimed ? 'bg-[#FFC107] text-[#0A0A0A] hover:bg-[#E0A800]' : 'bg-[#0A0A0A] text-white hover:opacity-90'}`}
        >
          {isUnclaimed ? 'Invite' : 'Add'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-[#FAFAFA] rounded-[9px] px-2.5 py-2">
          <div className="text-[17px] font-black text-[#0A0A0A] font-mono">{fmtNum(c.followers_count)}</div>
          <div className="text-[11px] text-[#8E8E8E]">Followers</div>
        </div>
        <div className="bg-[#FAFAFA] rounded-[9px] px-2.5 py-2">
          <div className={`text-[17px] font-black font-mono ${erGood ? 'text-[#047857]' : 'text-[#0A0A0A]'}`}>{Number(c.view_based_er || 0).toFixed(1)}%</div>
          <div className="text-[11px] text-[#8E8E8E]">Eng. rate</div>
        </div>
        <div className="bg-[#FAFAFA] rounded-[9px] px-2.5 py-2">
          <div className="text-[15px] font-black text-[#0A0A0A] font-mono">{c.estimated_min_rate ? `${fmtRupees(c.estimated_min_rate)}–${fmtRupees(c.estimated_max_rate)}` : '—'}</div>
          <div className="text-[11px] text-[#8E8E8E]">Est. / post</div>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Modal ───────────────────────────────────────────────────────────

function InviteModal({ creator, onClose, onSubmitted }) {
  const [message, setMessage]   = useState('');
  const [proposedFee, setFee]   = useState('');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState(null);

  if (!creator) return null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const body = {
      ig_handle: creator.ig_handle,
      brand_message: message || undefined,
      proposed_fee: proposedFee ? Number(proposedFee) : undefined,
    };
    const res = await creatorInvitationApi.create(body);
    setBusy(false);
    if (res.success) onSubmitted();
    else setErr(res?.error?.message || 'Failed to create invitation');
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h3>Invite @{creator.ig_handle}</h3>
            <p>Inflx admin will run outreach. The creator gets your offer when they sign up.</p>
          </div>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-f">
            <div>
              <div className="modal-f-l">Message to creator (optional)</div>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000}
                placeholder="Hey! We loved your content and would like to collaborate on…" />
            </div>
            <div>
              <div className="modal-f-l">Proposed fee per post (optional, ₹)</div>
              <input type="number" value={proposedFee} onChange={(e) => setFee(e.target.value)} min="0" step="500" placeholder="e.g. 5000" />
            </div>
          </div>
          {err && <div className="modal-err">{err}</div>}
          <div className="modal-actions">
            <button type="button" className="cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit" disabled={busy}>{busy ? 'Sending…' : 'Send Invite'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function InfluencersPage() {
  const router = useRouter();
  const [brandStatus, setBrandStatus] = useState(null);
  const [results,     setResults]     = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [searched,    setSearched]    = useState(false);

  // Filters
  const [query,        setQuery]        = useState('');
  const [city,         setCity]         = useState('');
  const [niche,        setNiche]        = useState('');
  const [tier,         setTier]         = useState('');
  const [language,     setLanguage]     = useState('');
  const [useCase,      setUseCase]      = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [maxFollowers, setMaxFollowers] = useState('');
  const [minViewEr,    setMinViewEr]    = useState('');
  const [minRate,      setMinRate]      = useState('');
  const [maxRate,      setMaxRate]      = useState('');
  const [hasCollabs,   setHasCollabs]   = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [bizOnly,      setBizOnly]      = useState(false);
  const [brandHandle,  setBrandHandle]  = useState('');
  const [sort,         setSort]         = useState('rank');
  const [advanced,     setAdvanced]     = useState(false);

  const [inviteTarget, setInviteTarget] = useState(null);
  const [toast,        setToast]        = useState(null);

  // Sub-tabs: Discover (creator search) + Proposals (folded inbox, E-2) +
  // Groups (F-5 server-persisted influencer groups).
  const [subTab, setSubTab] = useState('discover'); // 'discover' | 'proposals' | 'groups'
  const [proposalCount, setProposalCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);

  // Honor ?tab=proposals|groups deep-link (from the old /dashboard/proposals redirect).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'proposals') setSubTab('proposals');
    else if (t === 'groups') setSubTab('groups');
  }, []);

  // Group count for the sub-tab badge.
  useEffect(() => {
    influencerGroupApi.list().then(res => {
      if (res.success || res.ok) setGroupCount((res.data?.groups || []).length);
    }).catch(() => {});
  }, []);

  // Pending-proposal count for the sub-tab badge (independent of approval gate).
  useEffect(() => {
    proposalApi.list(null).then(res => {
      if (res.success) {
        const list = res.data?.proposals || [];
        setProposalCount(list.filter(p => ['sent', 'viewed', 'countered'].includes(p.status)).length);
      }
    }).catch(() => {});
  }, []);

  // Approval gate
  useEffect(() => {
    brandApi.getMe().then(res => {
      if (res.success) {
        const b = res.data?.brand || res.data;
        setBrandStatus(b?.user_status || b?.status || 'pending');
      } else setBrandStatus('pending');
    });
  }, []);

  useEffect(() => { if (brandStatus === 'approved') doSearch(); /* eslint-disable-next-line */ }, [brandStatus]);

  async function doSearch(e) {
    e?.preventDefault();
    setLoading(true); setSearched(true);
    const params = { sort };
    if (query)        params.q                 = query;
    if (city)         params.city              = city;
    if (niche)        params.niche             = niche;
    if (tier)         params.tier              = tier;
    if (language)     params.languages         = language;
    if (useCase)      params.use_case          = useCase;
    if (minFollowers) params.min_followers     = minFollowers;
    if (maxFollowers) params.max_followers     = maxFollowers;
    if (minViewEr)    params.min_view_er       = minViewEr;
    if (minRate)      params.min_rate          = minRate;
    if (maxRate)      params.max_rate          = maxRate;
    if (hasCollabs)   params.has_brand_collabs = 'true';
    if (verifiedOnly) params.is_inflx_verified = 'true';
    if (bizOnly)      params.is_business       = 'true';
    if (brandHandle)  params.brand_handle      = brandHandle.replace(/^@/, '');
    params.limit = 50;

    const res = await influencerApi.search(params);
    setLoading(false);
    if (res.success) {
      setResults(res.data?.creators || []);
      setTotal(res.meta?.total || 0);
    } else {
      setResults([]); setTotal(0);
      setToast({ kind: 'err', text: res?.error?.message || 'Search failed' });
      setTimeout(() => setToast(null), 4000);
    }
  }

  const clearFilters = () => {
    setQuery(''); setCity(''); setNiche(''); setTier(''); setLanguage('');
    setUseCase(''); setMinFollowers(''); setMaxFollowers(''); setMinViewEr('');
    setMinRate(''); setMaxRate(''); setHasCollabs(false); setVerifiedOnly(false);
    setBizOnly(false); setBrandHandle(''); setSort('rank');
  };

  const activeFilterCount = [
    query, city, niche, tier, language, useCase, minFollowers, maxFollowers,
    minViewEr, minRate, maxRate, brandHandle,
  ].filter(Boolean).length + (hasCollabs ? 1 : 0) + (verifiedOnly ? 1 : 0) + (bizOnly ? 1 : 0);

  // Hero KPIs (client-derived from visible page — labeled as such on the sub line)
  const heroVerified = useMemo(() => results.filter(c => c.is_inflx_verified).length, [results]);
  const heroMedianRate = useMemo(() => median(results.map(c => c.estimated_min_rate)), [results]);
  const heroPctVerified = total ? Math.round((heroVerified / Math.min(results.length, total)) * 100) : 0;

  // Tier chip counts
  const tierCounts = useMemo(() => {
    const c = { '': results.length };
    for (const k of Object.keys(TIER_CFG)) c[k] = 0;
    for (const r of results) if (r.tier && c[r.tier] !== undefined) c[r.tier] += 1;
    return c;
  }, [results]);

  if (brandStatus === null) {
    return (
      <div className="inf">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="spinner" />
      </div>
    );
  }

  // Shared sub-tab bar (Discover / Proposals) — visible in every state so a
  // pending brand can still reach their proposal inbox.
  const subTabBar = (
    <div className="subtabs">
      <button className={`subtab${subTab === 'discover' ? ' act' : ''}`} onClick={() => setSubTab('discover')}>Discover</button>
      <button className={`subtab${subTab === 'proposals' ? ' act' : ''}`} onClick={() => setSubTab('proposals')}>
        Proposals{proposalCount > 0 && <span className="subtab-ct">{proposalCount}</span>}
      </button>
      <button className={`subtab${subTab === 'groups' ? ' act' : ''}`} onClick={() => setSubTab('groups')}>
        Groups{groupCount > 0 && <span className="subtab-ct">{groupCount}</span>}
      </button>
    </div>
  );

  // Groups sub-tab — server-persisted influencer groups (not behind approval gate).
  if (subTab === 'groups') {
    return (
      <div className="inf">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {subTabBar}
        <GroupsManager onCountChange={setGroupCount} />
      </div>
    );
  }

  // Proposals sub-tab — folded inbox (not behind the approval gate).
  if (subTab === 'proposals') {
    return (
      <div className="inf">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {subTabBar}
        <ProposalsInbox />
      </div>
    );
  }

  // Discover sub-tab, but account still under review → gated notice.
  if (brandStatus !== 'approved') {
    return (
      <div className="inf">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {subTabBar}
        <div className="gated">
          <div className="icx">⏳</div>
          <h2>Account Under Review</h2>
          <p>Your account is pending admin approval. Influencer browsing will be available once approved — usually within 24 hours.</p>
          <button className="btn-ink" onClick={() => router.push('/dashboard')}>← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="inf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {subTabBar}

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{searched ? `${total} searchable` : 'Find creators'}</span>
          <h1>Find Creators</h1>
          <div className="rule" />
          <div className="sub">Search across onboarded + scraped creators. Invite unclaimed ones and Inflx admin will run outreach.</div>
        </div>
        <button className="btn-ghost" onClick={() => router.push('/dashboard/influencers/analytics')}>📊 Market Analytics</button>
      </div>

      {/* INK hero KPIs */}
      <div className="hero">
        <div className="hero-cell">
          <div className="hero-v mono">{searched ? fmtNum(total) : '—'}</div>
          <div className="hero-l">Total Searchable</div>
          <div className="hero-s">{searched ? 'across cities + niches' : 'run a search to see counts'}</div>
        </div>
        <div className="hero-cell">
          <div className="hero-v yel mono">{searched ? fmtNum(heroVerified) : '—'}</div>
          <div className="hero-l">Verified (this page)</div>
          <div className="hero-s">{searched ? `${heroPctVerified}% of loaded results` : '—'}</div>
        </div>
        <div className="hero-cell">
          <div className="hero-v mono">{heroMedianRate > 0 ? fmtRupees(heroMedianRate) : '—'}</div>
          <div className="hero-l">Median min rate (this page)</div>
          <div className="hero-s">per post · est.</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="sbar">
        <form onSubmit={doSearch}>
          <div className="sbar-top">
            <input className="qin" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or @handle…" />
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="submit" className="btn-ink" disabled={loading}>{loading ? '…' : 'Search'}</button>
          </div>
          <div className="sbar-row">
            <div className="sbar-f"><div className="sbar-f-l">City</div><input className="sbar-f-i" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Vijayawada, Mumbai…" /></div>
            <div className="sbar-f"><div className="sbar-f-l">Niche</div><input className="sbar-f-i" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="food_blogger, fashion…" /></div>
            <div className="sbar-f"><div className="sbar-f-l">Tier</div>
              <select className="sbar-f-i" value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">All</option>
                {Object.keys(TIER_CFG).map(t => <option key={t} value={t}>{TIER_CFG[t].label}</option>)}
              </select>
            </div>
            <div className="sbar-f"><div className="sbar-f-l">Min ER %</div><input className="sbar-f-i" type="number" step="0.1" value={minViewEr} onChange={(e) => setMinViewEr(e.target.value)} placeholder="2.0" /></div>
            <button type="button" className={`sbar-more${advanced ? ' open' : ''}`} onClick={() => setAdvanced(!advanced)}>{advanced ? 'More filters ▴' : 'More filters ▾'}</button>
            {activeFilterCount > 0 && <button type="button" className="sbar-clear" onClick={clearFilters}>Clear ({activeFilterCount}) ✕</button>}
          </div>
          {advanced && (
            <div className="sbar-advanced">
              <div className="sbar-row">
                <div className="sbar-f"><div className="sbar-f-l">Language</div><input className="sbar-f-i" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="english,telugu" /></div>
                <div className="sbar-f"><div className="sbar-f-l">Use case</div>
                  <select className="sbar-f-i" value={useCase} onChange={(e) => setUseCase(e.target.value)}>
                    <option value="">Any</option>
                    <option value="awareness">Awareness</option>
                    <option value="reach">Reach</option>
                    <option value="conversion">Conversion</option>
                    <option value="engagement">Engagement</option>
                  </select>
                </div>
                <div className="sbar-f"><div className="sbar-f-l">Min followers</div><input className="sbar-f-i" type="number" value={minFollowers} onChange={(e) => setMinFollowers(e.target.value)} placeholder="10000" /></div>
                <div className="sbar-f"><div className="sbar-f-l">Max followers</div><input className="sbar-f-i" type="number" value={maxFollowers} onChange={(e) => setMaxFollowers(e.target.value)} placeholder="500000" /></div>
                <div className="sbar-f"><div className="sbar-f-l">Min rate ₹</div><input className="sbar-f-i" type="number" value={minRate} onChange={(e) => setMinRate(e.target.value)} placeholder="2000" /></div>
                <div className="sbar-f"><div className="sbar-f-l">Max rate ₹</div><input className="sbar-f-i" type="number" value={maxRate} onChange={(e) => setMaxRate(e.target.value)} placeholder="50000" /></div>
                <div className="sbar-f"><div className="sbar-f-l">Worked with brand</div><input className="sbar-f-i" value={brandHandle} onChange={(e) => setBrandHandle(e.target.value)} placeholder="@swiggy" /></div>
              </div>
              <div className="sbar-checks">
                <label className="sbar-check"><input type="checkbox" checked={hasCollabs} onChange={(e) => setHasCollabs(e.target.checked)} />Has worked with brands</label>
                <label className="sbar-check"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />Verified by Inflx only</label>
                <label className="sbar-check"><input type="checkbox" checked={bizOnly} onChange={(e) => setBizOnly(e.target.checked)} />Instagram business account only</label>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Tier chip row */}
      {results.length > 0 && (
        <div className="tier-row">
          <button className={`tier-chip${!tier ? ' act' : ''}`} onClick={() => { setTier(''); doSearch(); }}><span className="dot" style={{ background: 'var(--muted-3)' }}></span>All <span className="ct">{tierCounts[''] || 0}</span></button>
          {Object.entries(TIER_CFG).map(([key, cfg]) => {
            const count = tierCounts[key] || 0;
            if (!count) return null;
            return (
              <button key={key} className={`tier-chip${tier === key ? ' act' : ''}`} onClick={() => { setTier(tier === key ? '' : key); doSearch(); }}>
                <span className="dot" style={{ background: cfg.dot }}></span>{cfg.label} <span className="ct">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="spinner" />
      ) : searched && results.length === 0 ? (
        <div className="empty">
          <div className="ic-ic">🔍</div>
          <div className="h">No creators found</div>
          <div className="t">Try different filters or broaden your search.</div>
          <button className="btn-ink" onClick={clearFilters}>Clear All Filters</button>
        </div>
      ) : (
        <div>
          {results.map(c => (
            <CreatorRow key={c.row_id} c={c} onInvite={setInviteTarget} router={router} />
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        creator={inviteTarget}
        onClose={() => setInviteTarget(null)}
        onSubmitted={() => {
          setInviteTarget(null);
          setToast({ kind: 'ok', text: '✓ Invitation queued — Inflx admin will reach out to the creator' });
          setTimeout(() => setToast(null), 4000);
        }}
      />

      {/* Toast */}
      {toast && <div className={`toast${toast.kind === 'err' ? ' err' : ''}`}>{toast.text}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROPOSALS INBOX — folded verbatim from the old /dashboard/proposals page
   (E-2). Rendered as the "Proposals" sub-tab. All logic preserved: accept /
   counter / reject, proposal settings, status tabs. CSS scoped under .prp so
   it does not collide with the influencers page's .inf scope.
   ═══════════════════════════════════════════════════════════════════════════ */

const PRP_NICHE_OPTIONS = ['food', 'fashion', 'fitness', 'travel', 'lifestyle', 'beauty', 'tech', 'gaming', 'finance', 'parenting'];
const PRP_TIER_OPTIONS  = ['nano', 'micro', 'macro', 'mega'];

const PRP_STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'sent',      label: 'New' },
  { key: 'viewed',    label: 'Viewed' },
  { key: 'countered', label: 'Countered' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'rejected',  label: 'Rejected' },
];

const PRP_STATUS_LABEL = {
  sent:      'New',
  viewed:    'Viewed',
  countered: 'Countered',
  accepted:  'Accepted',
  rejected:  'Rejected',
  expired:   'Expired',
  withdrawn: 'Withdrawn',
};

function prpFmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function prpFmtRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const now  = Date.now();
  const sec  = Math.max(1, Math.floor((now - then) / 1000));
  if (sec < 60)       return `${sec}s ago`;
  if (sec < 3600)     return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400)   return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604_800)  return `${Math.floor(sec / 86_400)}d ago`;
  return prpFmtDate(iso);
}

function prpTierFromFollowers(n) {
  const v = Number(n || 0);
  if (v < 10_000)    return 'nano';
  if (v < 100_000)   return 'micro';
  if (v < 1_000_000) return 'macro';
  return 'mega';
}

function prpTierLabel(t) { return (t || '').charAt(0).toUpperCase() + (t || '').slice(1); }

function prpNormaliseNiches(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    try { const j = JSON.parse(raw); return Array.isArray(j) ? j.filter(Boolean) : [raw]; }
    catch { return [raw]; }
  }
  return [];
}

function prpInitials(name, handle) {
  const src = (name || handle || '??').replace(/^@/, '');
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const PRP_CSS = `
.prp *{box-sizing:border-box}
.prp{
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
  --info:#1D4ED8; --info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; color:var(--ink); font-size:13px; line-height:1.45;
}
.prp .mono{font-family:'JetBrains Mono',monospace}

.prp .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.prp .hdr-l h1{font-family:'Outfit';font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.prp .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0 6px}
.prp .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.prp .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono';font-size:11px;font-weight:800;margin-bottom:6px}

.prp .btn-ghost{padding:7px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.prp .btn-ghost:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.prp .btn-ghost:disabled{opacity:.4;cursor:not-allowed;background:var(--white);color:var(--ink)}
.prp .btn-prim{padding:9px 16px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.prp .btn-prim:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.prp .btn-prim:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.prp .btn-yellow{padding:9px 16px;background:var(--yellow);color:var(--ink);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.prp .btn-yellow:hover:not(:disabled){background:var(--yellow-hover);color:var(--ink)}
.prp .btn-yellow:disabled{opacity:.4;cursor:not-allowed;background:var(--yellow);color:var(--ink)}
.prp .btn-danger{padding:9px 16px;background:var(--danger);color:var(--white);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.prp .btn-danger:hover:not(:disabled){background:#C5350E;color:var(--white)}
.prp .btn-danger:disabled{opacity:.4;cursor:not-allowed;background:var(--danger);color:var(--white)}

.prp .set-panel{background:var(--white);border:1px solid var(--border);border-radius:16px;padding:18px 22px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.prp .set-panel h3{font-family:'Outfit';font-size:14px;font-weight:700;color:var(--ink);margin-bottom:14px}
.prp .set-switch{display:flex;gap:10px;padding:14px;background:var(--bg);border:1px solid var(--border);border-radius:12px;align-items:flex-start;cursor:pointer;margin-bottom:14px}
.prp .set-switch input{margin-top:3px;accent-color:var(--yellow);width:16px;height:16px}
.prp .set-switch-t{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:3px}
.prp .set-switch-s{font-size:11px;color:var(--muted-2);line-height:1.5}
.prp .set-row{margin-bottom:14px}
.prp .set-row:last-child{margin-bottom:0}
.prp .set-lbl{font-size:11px;font-weight:700;color:var(--ink);margin-bottom:8px}
.prp .set-lbl .opt{font-weight:500;color:var(--muted-2);font-size:10.5px;margin-left:5px}
.prp .chip-row{display:flex;flex-wrap:wrap;gap:6px}
.prp .chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:600;color:var(--muted);cursor:pointer;text-transform:capitalize;font-family:inherit}
.prp .chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink)}
.prp .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow);font-weight:700}
.prp .set-2col{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:center}
.prp .set-check{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink);cursor:pointer}
.prp .set-check input{accent-color:var(--yellow);width:15px;height:15px}
.prp .set-er-input{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--ink)}
.prp .set-er-input input{width:70px;padding:6px 9px;border:1px solid var(--border);border-radius:8px;font-family:'JetBrains Mono';font-size:13px;font-weight:700;outline:none;color:var(--ink)}
.prp .set-er-input input:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}

.prp .warn{padding:13px 16px;background:var(--yellow-pale);border:1px solid var(--yellow);border-radius:12px;display:flex;align-items:center;gap:12px;margin-bottom:14px}
.prp .warn .ic{width:30px;height:30px;background:var(--yellow);color:var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:14px;flex-shrink:0}
.prp .warn .t{flex:1;font-size:12px;color:var(--ink);line-height:1.5}
.prp .warn .t b{font-weight:700}
.prp .warn .cta{font-size:11.5px;font-weight:700;color:var(--yellow-text);text-decoration:underline;background:transparent;border:0;cursor:pointer;font-family:inherit}
.prp .warn .cta:hover{color:var(--yellow-text)}

.prp .tabs{display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border);overflow-x:auto}
.prp .tab{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:2px solid transparent;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap;background:transparent;margin-bottom:-1px;font-family:inherit}
.prp .tab:hover:not(.act){color:var(--ink)}
.prp .tab.act{color:var(--ink);border-bottom-color:var(--yellow)}
.prp .tab .ct{font-family:'JetBrains Mono';font-size:10.5px;font-weight:800;color:var(--muted-2);background:var(--bg2);padding:2px 7px;border-radius:99px}
.prp .tab.act .ct{background:var(--ink);color:var(--yellow)}

.prp .rc{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:16px;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:start;transition:all .15s;margin-bottom:8px;cursor:pointer;text-align:left;width:100%;font-family:inherit;border-width:1px}
.prp .rc:hover{border-color:var(--muted-3)}
.prp .av{width:42px;height:42px;border-radius:50%;background:var(--yellow-pale);color:var(--yellow-text);display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:14px;flex-shrink:0}
.prp .rc-mid{min-width:0}
.prp .rc-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.prp .rc-name{font-family:'Outfit';font-size:14px;font-weight:700;color:var(--ink)}
.prp .rc-handle{font-family:'JetBrains Mono';font-size:11.5px;color:var(--muted-2)}
.prp .tier-pill{font-family:'JetBrains Mono';font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.prp .tier-pill.nano{background:var(--bg2);color:var(--muted)}
.prp .tier-pill.micro{background:var(--eng-pale);color:var(--eng)}
.prp .tier-pill.macro{background:var(--yellow-pale);color:var(--yellow-text)}
.prp .tier-pill.mega{background:var(--conv-pale);color:var(--conv)}
.prp .rc-city{font-size:10.5px;color:var(--muted-2)}
.prp .rc-niches{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}
.prp .niche-chip{font-family:'JetBrains Mono';font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:99px;background:var(--bg);border:1px solid var(--border);color:var(--ink);text-transform:capitalize}
.prp .niche-chip.overflow{background:var(--ink);color:var(--yellow);border-color:var(--ink)}
.prp .rc-pitch-t{font-family:'Outfit';font-size:13px;font-weight:700;color:var(--ink);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prp .rc-pitch-m{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.5}
.prp .rc-right{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;min-width:130px}
.prp .rc-ask{font-family:'JetBrains Mono';font-size:14px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
.prp .rc-ask-sub{font-family:'JetBrains Mono';font-size:10.5px;color:var(--muted-2)}
.prp .status-pill{font-family:'JetBrains Mono';font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;display:inline-flex;align-items:center;gap:4px}
.prp .status-pill.sent{background:var(--yellow-pale);color:var(--yellow-text)}
.prp .status-pill.viewed{background:var(--info-pale);color:var(--info)}
.prp .status-pill.countered{background:var(--conv-pale);color:var(--conv)}
.prp .status-pill.accepted{background:var(--success-pale);color:var(--success-text)}
.prp .status-pill.rejected{background:var(--danger-pale);color:var(--danger-text)}
.prp .status-pill.expired,.prp .status-pill.withdrawn{background:var(--bg2);color:var(--muted-2)}
.prp .rc-dt{font-family:'JetBrains Mono';font-size:10px;color:var(--muted-2);margin-top:2px}

.prp .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px;position:relative;overflow:hidden}
.prp .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.prp .empty > *{position:relative;z-index:2}
.prp .empty .ic{width:60px;height:60px;background:var(--ink);color:var(--yellow);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:22px;margin:0 auto 14px}
.prp .empty .h{font-family:'Outfit';font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.prp .empty .t{font-size:12px;color:var(--muted);line-height:1.55;max-width:480px;margin:0 auto 16px}
.prp .empty .cta{display:inline-flex;align-items:center;padding:9px 16px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.prp .empty .cta:hover{background:var(--ink-2);color:var(--yellow)}

.prp .loading{padding:40px;text-align:center;color:var(--muted-2);font-size:13px}

.prp .mo{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
.prp .mod{background:var(--white);border-radius:18px;max-width:680px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
.prp .mod-h{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:14px}
.prp .mod-t{font-family:'Outfit';font-size:15px;font-weight:700;color:var(--ink)}
.prp .mod-s{font-family:'JetBrains Mono';font-size:11px;color:var(--muted-2);margin-top:3px}
.prp .mod-x{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--muted-2);font-size:18px;background:transparent;border:0;cursor:pointer}
.prp .mod-x:hover{background:var(--bg)}
.prp .mod-b{flex:1;overflow-y:auto;padding:18px 22px}
.prp .mod-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.prp .mod-stat{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center}
.prp .mod-stat-v{font-family:'JetBrains Mono';font-size:17px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
.prp .mod-stat-l{font-family:'JetBrains Mono';font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:4px}
.prp .mod-sec{margin-bottom:16px}
.prp .mod-sec-h{font-family:'JetBrains Mono';font-size:10.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px}
.prp .mod-pitch{font-size:13px;color:var(--ink);line-height:1.6;white-space:pre-wrap;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
.prp .kv{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-soft);gap:14px}
.prp .kv:last-child{border-bottom:0}
.prp .kv-k{font-size:11.5px;color:var(--muted-2);font-weight:500;flex-shrink:0}
.prp .kv-v{font-size:12px;color:var(--ink);font-weight:700;text-align:right}
.prp .kv-v.mono{font-family:'JetBrains Mono'}
.prp .port{display:flex;flex-direction:column;gap:4px}
.prp .port a{font-family:'JetBrains Mono';font-size:11.5px;color:var(--ink);text-decoration:none;border-bottom:1px dashed var(--muted-3);width:max-content;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prp .port a:hover{color:var(--yellow-text);border-bottom-color:var(--yellow)}
.prp .mod-banner-ok{padding:12px 14px;background:var(--success-pale);border:1px solid rgba(16,185,129,.3);border-radius:10px;font-size:11.5px;color:var(--success-text)}
.prp .mod-banner-ok b{font-weight:700;display:block;margin-bottom:3px}
.prp .mod-banner-no{padding:12px 14px;background:var(--danger-pale);border:1px solid #FBCBC4;border-radius:10px;font-size:11.5px;color:var(--danger-text)}
.prp .mod-banner-no b{font-weight:700;display:block;margin-bottom:3px}
.prp .mod-f{padding:14px 22px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:flex-end;align-items:center;gap:8px}

.prp .mode-panel{padding:14px 22px;border-top:1px solid var(--border);background:var(--bg);display:flex;flex-direction:column;gap:10px}
.prp .mode-textarea{width:100%;padding:10px 13px;border:1px solid var(--border);border-radius:10px;font-family:inherit;font-size:12px;background:var(--white);outline:none;color:var(--ink);resize:vertical;min-height:64px}
.prp .mode-textarea:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.prp .mode-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.prp .mode-f{display:flex;flex-direction:column;gap:6px}
.prp .mode-f-l{font-size:10.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.prp .mode-f-i{padding:9px 12px;border:1px solid var(--border);border-radius:9px;font-family:'JetBrains Mono';font-size:13px;font-weight:700;background:var(--white);outline:none;color:var(--ink)}
.prp .mode-f-i:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.prp .mode-actions{display:flex;justify-content:flex-end;gap:8px}
`;

function ProposalsInbox() {
  const [tab, setTab] = useState('');
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [settings, setSettings]   = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeProposal, setActiveProposal] = useState(null);

  async function load() {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      proposalApi.list(tab || null),
      proposalApi.getSettings(),
    ]);
    setLoading(false);
    if (pRes.success) setProposals(pRes.data?.proposals || []);
    if (sRes.success) setSettings(sRes.data);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const tabCounts = useMemo(() => {
    const onAllTab = !tab;
    const counts = { '': proposals.length };
    for (const t of PRP_STATUS_TABS) {
      if (t.key === '') continue;
      if (onAllTab) {
        counts[t.key] = proposals.filter(p => p.status === t.key).length;
      } else {
        counts[t.key] = t.key === tab ? proposals.length : null;
      }
    }
    return counts;
  }, [proposals, tab]);

  return (
    <div className="prp">
      <style dangerouslySetInnerHTML={{ __html: PRP_CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{loading ? '…' : `${proposals.length} ${tab ? tab : 'pending'}`}</span>
          <h1>Influencer Proposals</h1>
          <div className="rule" />
          <div className="sub">Pitches sent to you by influencers. Toggle settings to control who can pitch you.</div>
        </div>
        <div>
          <button className="btn-ghost" onClick={() => setShowSettings(s => !s)}>
            {showSettings ? '✕ Hide settings' : '⚙ Settings'}
          </button>
        </div>
      </div>

      {showSettings && settings && (
        <PrpSettingsCard
          settings={settings}
          onSaved={() => { setShowSettings(false); load(); }}
        />
      )}

      {settings && !settings.accepts_proposals && !showSettings && (
        <div className="warn">
          <div className="ic">!</div>
          <div className="t"><b>You&apos;re not accepting proposals yet.</b> Influencers can&apos;t pitch you until you turn this on.</div>
          <button className="cta" onClick={() => setShowSettings(true)}>Open settings →</button>
        </div>
      )}

      <div className="tabs">
        {PRP_STATUS_TABS.map(t => {
          const ct = tabCounts[t.key];
          return (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? 'act' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="ct">{ct == null ? '·' : ct}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="loading">Loading proposals…</div>
      ) : proposals.length === 0 ? (
        <div className="empty">
          <div className="ic">📨</div>
          <div className="h">No proposals yet</div>
          <div className="t">
            {settings && !settings.accepts_proposals
              ? <>When an influencer pitches you, it&apos;ll show up here. Turn on proposals in Settings and influencers matching your filters can start reaching out.</>
              : <>When an influencer pitches you, it&apos;ll show up here for your review.</>}
          </div>
          {settings && !settings.accepts_proposals
            ? <button className="cta" onClick={() => setShowSettings(true)}>⚙ Turn on proposals →</button>
            : null}
        </div>
      ) : (
        proposals.map(p => {
          const niches = prpNormaliseNiches(p.influencer_niches);
          const tierKey = prpTierFromFollowers(p.followers_count);
          const visibleNiches = niches.slice(0, 3);
          const overflow = niches.length - visibleNiches.length;
          return (
            <button
              key={p.id}
              type="button"
              className="rc"
              onClick={() => setActiveProposal(p)}
            >
              <div className="av">{prpInitials(p.influencer_name, p.influencer_handle)}</div>
              <div className="rc-mid">
                <div className="rc-top">
                  <span className="rc-name">{p.influencer_name || '—'}</span>
                  <span className="rc-handle">@{p.influencer_handle || '—'}</span>
                  <span className={`tier-pill ${tierKey}`}>{prpTierLabel(tierKey)}</span>
                  {p.influencer_city && <span className="rc-city">· {p.influencer_city}</span>}
                </div>
                {niches.length > 0 && (
                  <div className="rc-niches">
                    {visibleNiches.map(n => (
                      <span key={n} className="niche-chip">{n}</span>
                    ))}
                    {overflow > 0 && <span className="niche-chip overflow">+{overflow}</span>}
                  </div>
                )}
                <div className="rc-pitch-t">{p.pitch_title || '—'}</div>
                <div className="rc-pitch-m">{p.pitch_message || ''}</div>
              </div>
              <div className="rc-right">
                {p.proposed_fee && (
                  <div className="rc-ask">₹{Number(p.proposed_fee).toLocaleString('en-IN')}</div>
                )}
                {p.proposed_commission_pct
                  ? <div className="rc-ask-sub">+ {p.proposed_commission_pct}% comm</div>
                  : p.proposed_fee ? <div className="rc-ask-sub">flat fee</div> : null}
                {!p.proposed_fee && p.proposed_commission_pct && (
                  <div className="rc-ask">{p.proposed_commission_pct}%</div>
                )}
                <span className={`status-pill ${p.status || ''}`}>
                  ● {PRP_STATUS_LABEL[p.status] || (p.status || '').replace(/_/g, ' ')}
                </span>
                <div className="rc-dt">{prpFmtRelative(p.created_at)}</div>
              </div>
            </button>
          );
        })
      )}

      {activeProposal && (
        <PrpProposalDetailModal
          proposal={activeProposal}
          onClose={() => setActiveProposal(null)}
          onChanged={() => { setActiveProposal(null); load(); }}
        />
      )}
    </div>
  );
}

function PrpSettingsCard({ settings, onSaved }) {
  const [acceptsProposals, setAcceptsProposals] = useState(!!settings.accepts_proposals);
  const filters = settings.proposal_filters || {};
  const [minTier, setMinTier]                 = useState(filters.min_tier || '');
  const [allowedNiches, setAllowedNiches]     = useState(new Set(filters.allowed_niches || []));
  const [cityMatch, setCityMatch]             = useState(!!filters.city_match_required);
  const [minER, setMinER]                     = useState(filters.min_engagement_rate ?? '');
  const [onlyPastCollabs, setOnlyPastCollabs] = useState(!!filters.only_past_collabs);
  const [saving, setSaving] = useState(false);

  function toggleNiche(n) {
    setAllowedNiches(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const res = await proposalApi.updateSettings({
      accepts_proposals: acceptsProposals,
      proposal_filters: {
        min_tier: minTier || null,
        allowed_niches: Array.from(allowedNiches),
        city_match_required: cityMatch,
        min_engagement_rate: minER === '' ? null : Number(minER),
        only_past_collabs: onlyPastCollabs,
      },
    });
    setSaving(false);
    if (res.success) onSaved();
  }

  return (
    <div className="set-panel">
      <h3>Proposal settings</h3>

      <label className="set-switch">
        <input type="checkbox" checked={acceptsProposals} onChange={e => setAcceptsProposals(e.target.checked)} />
        <div>
          <div className="set-switch-t">Accept proposals from influencers</div>
          <div className="set-switch-s">When on, influencers matching your filters can pitch you. Turn off to pause new inbound proposals entirely.</div>
        </div>
      </label>

      {acceptsProposals && (
        <>
          <div className="set-row">
            <div className="set-lbl">Minimum tier</div>
            <div className="chip-row">
              <button
                type="button"
                className={`chip ${minTier === '' ? 'act' : ''}`}
                onClick={() => setMinTier('')}
              >Any</button>
              {PRP_TIER_OPTIONS.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${minTier === t ? 'act' : ''}`}
                  onClick={() => setMinTier(t)}
                >{prpTierLabel(t)}</button>
              ))}
            </div>
          </div>

          <div className="set-row">
            <div className="set-lbl">Allowed niches <span className="opt">empty = any</span></div>
            <div className="chip-row">
              {PRP_NICHE_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  className={`chip ${allowedNiches.has(n) ? 'act' : ''}`}
                  onClick={() => toggleNiche(n)}
                >{n}</button>
              ))}
            </div>
          </div>

          <div className="set-row">
            <div className="set-lbl">Additional filters</div>
            <div className="set-2col">
              <label className="set-check">
                <input type="checkbox" checked={cityMatch} onChange={e => setCityMatch(e.target.checked)} />
                City match required
              </label>
              <label className="set-check">
                <input type="checkbox" checked={onlyPastCollabs} onChange={e => setOnlyPastCollabs(e.target.checked)} />
                Only influencers I&apos;ve worked with before
              </label>
              <label className="set-er-input">
                Min engagement %
                <input
                  type="number"
                  step="0.1"
                  value={minER}
                  onChange={e => setMinER(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
          </div>
        </>
      )}

      <button className="btn-prim" onClick={save} disabled={saving} style={{ marginTop: 4 }}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}

function PrpProposalDetailModal({ proposal, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [counterMode, setCounterMode] = useState(false);
  const [counterFee, setCounterFee] = useState(String(proposal.proposed_fee || ''));
  const [counterCommission, setCounterCommission] = useState(String(proposal.proposed_commission_pct || ''));
  const [counterMessage, setCounterMessage] = useState('');
  const [rejectMessage, setRejectMessage] = useState('');
  const [rejectMode, setRejectMode] = useState(false);

  async function handleAccept() {
    if (!confirm('Accept this proposal? A draft contract will be created and you can finalise terms before sending.')) return;
    setBusy(true);
    const res = await proposalApi.accept(proposal.id);
    setBusy(false);
    if (res.success) onChanged();
    else alert(res.error?.message || 'Accept failed');
  }
  async function handleReject() {
    setBusy(true);
    const res = await proposalApi.reject(proposal.id, rejectMessage || null);
    setBusy(false);
    if (res.success) onChanged();
    else alert(res.error?.message || 'Reject failed');
  }
  async function handleCounter() {
    setBusy(true);
    const res = await proposalApi.counter(proposal.id, {
      proposed_fee:            counterFee === '' ? null : Number(counterFee),
      proposed_commission_pct: counterCommission === '' ? null : Number(counterCommission),
    }, counterMessage || null);
    setBusy(false);
    if (res.success) onChanged();
    else alert(res.error?.message || 'Counter failed');
  }

  const canDecide = ['sent', 'viewed'].includes(proposal.status);
  const tierKey   = prpTierFromFollowers(proposal.followers_count);

  return (
    <div className="prp">
      <style dangerouslySetInnerHTML={{ __html: PRP_CSS }} />
      <div className="mo" onClick={onClose}>
        <div className="mod" onClick={e => e.stopPropagation()}>
          <div className="mod-h">
            <div>
              <div className="mod-t">{proposal.pitch_title || '—'}</div>
              <div className="mod-s">
                {proposal.influencer_name || '—'} · @{proposal.influencer_handle || '—'}
                {proposal.influencer_city ? ` · ${proposal.influencer_city}` : ''}
              </div>
            </div>
            <button className="mod-x" onClick={onClose}>×</button>
          </div>

          <div className="mod-b">
            <div className="mod-stats">
              <div className="mod-stat">
                <div className="mod-stat-v">{Number(proposal.followers_count || 0).toLocaleString('en-IN')}</div>
                <div className="mod-stat-l">Followers</div>
              </div>
              <div className="mod-stat">
                <div className="mod-stat-v">{proposal.engagement_rate ? `${proposal.engagement_rate}%` : '—'}</div>
                <div className="mod-stat-l">Engagement</div>
              </div>
              <div className="mod-stat">
                <div className="mod-stat-v">{prpTierLabel(tierKey)}</div>
                <div className="mod-stat-l">Tier</div>
              </div>
            </div>

            {proposal.pitch_message && (
              <div className="mod-sec">
                <div className="mod-sec-h">Pitch</div>
                <div className="mod-pitch">{proposal.pitch_message}</div>
              </div>
            )}

            <div className="mod-sec">
              <div className="mod-sec-h">Proposed terms</div>
              <div className="kv"><span className="kv-k">Goal</span><span className="kv-v">{proposal.goal || '—'}</span></div>
              {proposal.proposed_fee && (
                <div className="kv"><span className="kv-k">Fee</span><span className="kv-v mono">₹{Number(proposal.proposed_fee).toLocaleString('en-IN')}</span></div>
              )}
              {proposal.proposed_commission_pct && (
                <div className="kv"><span className="kv-k">Commission</span><span className="kv-v mono">{proposal.proposed_commission_pct}% per conversion</span></div>
              )}
              {proposal.proposed_deliverables && (
                <div className="kv">
                  <span className="kv-k">Deliverables</span>
                  <span className="kv-v">
                    {(Array.isArray(proposal.proposed_deliverables) ? proposal.proposed_deliverables : []).map(d => `${d.count || 1} × ${d.type}`).join(', ') || '—'}
                  </span>
                </div>
              )}
              {(proposal.proposed_posting_window_start || proposal.proposed_posting_window_end) && (
                <div className="kv">
                  <span className="kv-k">Posting window</span>
                  <span className="kv-v mono">{prpFmtDate(proposal.proposed_posting_window_start)} → {prpFmtDate(proposal.proposed_posting_window_end)}</span>
                </div>
              )}
            </div>

            {(proposal.portfolio_links || []).length > 0 && (
              <div className="mod-sec">
                <div className="mod-sec-h">Portfolio samples</div>
                <div className="port">
                  {proposal.portfolio_links.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">{url}</a>
                  ))}
                </div>
              </div>
            )}

            {proposal.status === 'rejected' && (
              <div className="mod-banner-no">
                <b>Rejected</b>
                {proposal.brand_response_message ? <span>{proposal.brand_response_message}</span> : <span>Declined without a message.</span>}
              </div>
            )}
            {proposal.status === 'accepted' && (
              <div className="mod-banner-ok">
                <b>Accepted — draft contract created</b>
                <span>Find it on the campaigns page to review and approve.</span>
              </div>
            )}
          </div>

          {canDecide && !rejectMode && !counterMode && (
            <div className="mod-f">
              <button className="btn-ghost" disabled={busy} onClick={() => setRejectMode(true)}>Decline</button>
              <button className="btn-yellow" disabled={busy} onClick={() => setCounterMode(true)}>Counter</button>
              <button className="btn-prim" disabled={busy} onClick={handleAccept}>Accept →</button>
            </div>
          )}

          {rejectMode && (
            <div className="mode-panel">
              <textarea
                className="mode-textarea"
                value={rejectMessage}
                onChange={e => setRejectMessage(e.target.value)}
                placeholder="Optional message to the influencer (visible to them)"
              />
              <div className="mode-actions">
                <button className="btn-ghost" onClick={() => setRejectMode(false)} disabled={busy}>Cancel</button>
                <button className="btn-danger" disabled={busy} onClick={handleReject}>
                  {busy ? 'Rejecting…' : 'Confirm reject'}
                </button>
              </div>
            </div>
          )}

          {counterMode && (
            <div className="mode-panel">
              <div className="mode-2col">
                <label className="mode-f">
                  <span className="mode-f-l">Counter fee (₹)</span>
                  <input
                    type="number"
                    className="mode-f-i"
                    value={counterFee}
                    onChange={e => setCounterFee(e.target.value)}
                  />
                </label>
                <label className="mode-f">
                  <span className="mode-f-l">Counter commission %</span>
                  <input
                    type="number"
                    step="0.1"
                    className="mode-f-i"
                    value={counterCommission}
                    onChange={e => setCounterCommission(e.target.value)}
                  />
                </label>
              </div>
              <textarea
                className="mode-textarea"
                value={counterMessage}
                onChange={e => setCounterMessage(e.target.value)}
                placeholder="Why this counter? (visible to influencer)"
              />
              <div className="mode-actions">
                <button className="btn-ghost" onClick={() => setCounterMode(false)} disabled={busy}>Cancel</button>
                <button className="btn-yellow" disabled={busy} onClick={handleCounter}>
                  {busy ? 'Sending…' : 'Send counter'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUPS MANAGER — F-5 server-persisted influencer groups (Groups sub-tab).
   Reuses the parent's .inf CSS scope + the module-level initials() helper.
   List → create (name + multi-select picker) → open (rename / add / remove /
   delete). All persistence via influencerGroupApi (brand-scoped backend).
   ═══════════════════════════════════════════════════════════════════════════ */

function GroupMemberPicker({ existingIds, selectedIds, onToggle }) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const search = (val) => {
    setQ(val);
    clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await influencerApi.search({ q: val, limit: '30' });
        if (res.success || res.ok) {
          const raw = res.data?.creators || res.data?.influencers || [];
          // Only onboarded creators can be group members (need a real influencer id).
          setResults(raw.filter(c => !(c.source === 'scraped' && !c.linked_influencer_id)));
        }
      } catch {}
      setLoading(false);
    }, 300);
  };

  return (
    <div>
      <input className="qin" style={{ width: '100%', marginBottom: 10 }} value={q}
        onChange={e => search(e.target.value)} placeholder="Search by name or @handle…" />
      {loading && <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 8 }}>Searching…</div>}
      {results.map(c => {
        const id = c.linked_influencer_id || c.row_id;
        const already = existingIds.includes(id);
        const sel = selectedIds.includes(id);
        return (
          <div key={c.row_id} className={`grp-pick-row${sel ? ' sel' : ''}`}
            onClick={() => { if (!already) onToggle(id, c); }}
            style={already ? { opacity: .5, cursor: 'not-allowed' } : {}}>
            <div className="chk">{already ? '·' : (sel ? '✓' : '')}</div>
            <div className="av" style={{ width: 32, height: 32, fontSize: 11, borderRadius: 8 }}>
              {initials(c.ig_handle, c.full_name)}
            </div>
            <div className="nm" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                {c.full_name || c.ig_handle}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--muted-2)' }}>
                @{c.ig_handle}{c.city ? ` · ${c.city}` : ''}{already ? ' · already in group' : ''}
              </div>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--muted-2)' }}>
              {fmtNum(c.followers_count)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupsManager({ onCountChange }) {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId]   = useState(null);          // group being viewed
  const [creating, setCreating] = useState(false);        // create modal open
  const [toast, setToast]     = useState(null);

  // Create-modal state
  const [newName, setNewName]         = useState('');
  const [newPicked, setNewPicked]     = useState([]);     // [{ id, ... }]
  const [busy, setBusy]               = useState(false);

  // Detail-view state
  const [renameVal, setRenameVal]     = useState('');
  const [adding, setAdding]           = useState(false);  // add-members panel
  const [addPicked, setAddPicked]     = useState([]);

  const flash = (text, kind) => { setToast({ text, kind }); setTimeout(() => setToast(null), 3500); };

  async function load() {
    setLoading(true);
    const res = await influencerGroupApi.list();
    setLoading(false);
    if (res.success || res.ok) {
      const g = res.data?.groups || [];
      setGroups(g);
      onCountChange?.(g.length);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openGroup = groups.find(g => g.id === openId) || null;

  // ── Create ────────────────────────────────────────────────────────────────
  const openCreate = () => { setNewName(''); setNewPicked([]); setCreating(true); };
  const submitCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await influencerGroupApi.create({ name: newName.trim(), influencer_ids: newPicked.map(p => p.id) });
    setBusy(false);
    if (res.success || res.ok) { setCreating(false); flash('✓ Group created'); await load(); }
    else flash(res?.error?.message || 'Failed to create group', 'err');
  };

  // ── Rename ────────────────────────────────────────────────────────────────
  const submitRename = async () => {
    if (!renameVal.trim() || renameVal.trim() === openGroup?.name) return;
    const res = await influencerGroupApi.rename(openId, renameVal.trim());
    if (res.success || res.ok) { flash('✓ Renamed'); await load(); }
    else flash(res?.error?.message || 'Rename failed', 'err');
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const doDelete = async (id) => {
    const res = await influencerGroupApi.remove(id);
    if (res.success || res.ok) { setOpenId(null); flash('✓ Group deleted'); await load(); }
    else flash(res?.error?.message || 'Delete failed', 'err');
  };

  // ── Members ───────────────────────────────────────────────────────────────
  const submitAddMembers = async () => {
    if (addPicked.length === 0) return;
    setBusy(true);
    const res = await influencerGroupApi.addMembers(openId, addPicked.map(p => p.id));
    setBusy(false);
    if (res.success || res.ok) { setAdding(false); setAddPicked([]); flash('✓ Members added'); await load(); }
    else flash(res?.error?.message || 'Failed to add members', 'err');
  };
  const removeMember = async (infId) => {
    const res = await influencerGroupApi.removeMember(openId, infId);
    if (res.success || res.ok) { flash('✓ Member removed'); await load(); }
    else flash(res?.error?.message || 'Failed to remove member', 'err');
  };

  if (loading) return <div className="spinner" />;

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (openGroup) {
    const existingIds = (openGroup.members || []).map(m => m.id);
    return (
      <div>
        <button className="btn-ghost" onClick={() => { setOpenId(null); setAdding(false); }} style={{ marginBottom: 14 }}>← All groups</button>

        <div className="grp-detail-hd">
          <div className="grp-name-edit">
            <input value={renameVal || openGroup.name} onChange={e => setRenameVal(e.target.value)} />
            <button className="btn-ink" onClick={submitRename}>Rename</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={() => { setAdding(a => !a); setAddPicked([]); }}>{adding ? 'Close' : '+ Add members'}</button>
            <button className="btn-ghost" style={{ color: 'var(--danger-text)' }} onClick={() => doDelete(openGroup.id)}>Delete group</button>
          </div>
        </div>

        {adding && (
          <div className="sbar" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 800, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>Add members</div>
            <GroupMemberPicker existingIds={existingIds} selectedIds={addPicked.map(p => p.id)}
              onToggle={(id, c) => setAddPicked(prev => prev.find(p => p.id === id) ? prev.filter(p => p.id !== id) : [...prev, { id }])} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button className="btn-ink" onClick={submitAddMembers} disabled={busy || addPicked.length === 0}>
                {busy ? 'Adding…' : `Add ${addPicked.length || ''} member${addPicked.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        )}

        <div className="cnt-chip">{openGroup.member_count} member{openGroup.member_count === 1 ? '' : 's'}</div>
        <div style={{ marginTop: 10 }}>
          {(openGroup.members || []).length === 0 ? (
            <div className="empty"><div className="ic-ic">👥</div><div className="h">No members yet</div><div className="t">Add influencers to this group with “+ Add members”.</div></div>
          ) : (openGroup.members || []).map(m => (
            <div key={m.id} className="grp-mem-row">
              <div className="av">{initials(m.instagram_handle, m.full_name)}</div>
              <div className="nm">
                <div className="n">{m.full_name || m.instagram_handle || '—'}</div>
                <div className="h">{m.instagram_handle ? `@${m.instagram_handle}` : ''}</div>
              </div>
              <button className="rm" onClick={() => removeMember(m.id)}>Remove</button>
            </div>
          ))}
        </div>

        {toast && <div className={`toast${toast.kind === 'err' ? ' err' : ''}`}>{toast.text}</div>}
      </div>
    );
  }

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{groups.length} group{groups.length === 1 ? '' : 's'}</span>
          <h1>Influencer Groups</h1>
          <div className="rule" />
          <div className="sub">Save named groups of influencers here, then assign a whole group to a campaign set in one tap.</div>
        </div>
        <button className="btn-ink" onClick={openCreate}>+ New group</button>
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <div className="ic-ic">👥</div>
          <div className="h">No groups yet</div>
          <div className="t">Create your first group of influencers — you’ll be able to add the whole group to a campaign at once.</div>
          <button className="btn-ink" onClick={openCreate}>+ Create a group</button>
        </div>
      ) : (
        <div className="grp-grid">
          {groups.map(g => (
            <button key={g.id} className="grp-card" onClick={() => { setOpenId(g.id); setRenameVal(g.name); setAdding(false); }}>
              <div className="grp-card-name">{g.name}</div>
              <div className="grp-card-ct"><b>{g.member_count}</b> member{g.member_count === 1 ? '' : 's'}</div>
              <div className="grp-mems">
                {(g.members || []).slice(0, 4).map(m => (
                  <span key={m.id} className="grp-mem-pill">{m.instagram_handle ? `@${m.instagram_handle}` : (m.full_name || '—')}</span>
                ))}
                {g.member_count > 4 && <span className="grp-mem-pill">+{g.member_count - 4}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="modal-bg" onClick={() => setCreating(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <div><h3>Create influencer group</h3><p>Name it, then search and pick the influencers to include.</p></div>
              <button className="modal-x" onClick={() => setCreating(false)}>×</button>
            </div>
            <div className="modal-f">
              <div>
                <div className="modal-f-l">Group name</div>
                <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={120} placeholder="e.g. Food bloggers Hyderabad" />
              </div>
              <div>
                <div className="modal-f-l">Add influencers (optional)</div>
                <GroupMemberPicker existingIds={[]} selectedIds={newPicked.map(p => p.id)}
                  onToggle={(id) => setNewPicked(prev => prev.find(p => p.id === id) ? prev.filter(p => p.id !== id) : [...prev, { id }])} />
              </div>
              {newPicked.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{newPicked.length} selected</div>}
            </div>
            <div className="modal-actions">
              <button type="button" className="cancel" onClick={() => setCreating(false)}>Cancel</button>
              <button type="button" className="submit" onClick={submitCreate} disabled={busy || !newName.trim()}>{busy ? 'Creating…' : 'Create group'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast${toast.kind === 'err' ? ' err' : ''}`}>{toast.text}</div>}
    </div>
  );
}
