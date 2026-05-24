'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { influencerApi, brandApi, creatorInvitationApi, fmtNum, fmtRupees } from '../../../lib/api';

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

  return (
    <button className="ic" onClick={onClickRow}>
      <div className="av">
        {c.profile_pic_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.profile_pic_url} alt={c.ig_handle} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : inits}
      </div>
      <div className="ic-mid">
        <div className="ic-top">
          {c.full_name && <span className="ic-name">{c.full_name}</span>}
          <span className="ic-handle">@{c.ig_handle}</span>
          {c.is_inflx_verified && <span className="ic-verify">✓</span>}
          <span className={`tier-pill ${tierClass}`}><span className="d"></span>{tier?.label || c.tier || 'Unknown'}</span>
          {c.rank_score != null && <span className="rank-mini">⭐ {Number(c.rank_score).toFixed(1)}</span>}
          {isUnclaimed && <span className="ic-tag">scraped</span>}
          {stale && <span className="ic-tag stale">data {staleDays(c.last_calculated_at)}d old</span>}
        </div>
        <div className="ic-meta">
          {c.city && <span>📍 <b>{c.city}</b></span>}
          {c.niche && (<><span className="sep">·</span><span>🎨 <b>{c.niche}</b></span></>)}
          {collabBit && (<><span className="sep">·</span><span>{collabBit}</span></>)}
        </div>
      </div>
      <div className="ic-stats">
        <div className="ic-st"><div className="ic-st-v">{fmtNum(c.followers_count)}</div><div className="ic-st-l">Followers</div></div>
        <div className="ic-st"><div className={`ic-st-v ${erClass(c.view_based_er)}`}>{Number(c.view_based_er || 0).toFixed(1)}%</div><div className="ic-st-l">View ER</div></div>
        <div className="ic-st"><div className="ic-st-v">{fmtNum(c.avg_views)}</div><div className="ic-st-l">Avg Views</div></div>
      </div>
      <div className="ic-rate-mini">
        {c.estimated_min_rate ? `${fmtRupees(c.estimated_min_rate)} – ${fmtRupees(c.estimated_max_rate)}` : '—'}
        <span className="l">Est. rate</span>
      </div>
      <button className={`ic-action-btn ${isUnclaimed ? 'invite' : 'add'}`} onClick={onClickAction}>
        {isUnclaimed ? '✉ Invite' : '+ Add'}
      </button>
    </button>
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
  if (brandStatus !== 'approved') {
    return (
      <div className="inf">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
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
