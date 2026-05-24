'use client';
import { useEffect, useMemo, useState } from 'react';
import { proposalApi } from '../../../lib/api';

// ─── Constants (preserved from OLD) ─────────────────────────────────────────
const NICHE_OPTIONS = ['food', 'fashion', 'fitness', 'travel', 'lifestyle', 'beauty', 'tech', 'gaming', 'finance', 'parenting'];
const TIER_OPTIONS  = ['nano', 'micro', 'macro', 'mega'];

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'sent',      label: 'New' },
  { key: 'viewed',    label: 'Viewed' },
  { key: 'countered', label: 'Countered' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'rejected',  label: 'Rejected' },
];

// Locked-palette status pill mapping (replaces wave1 STATUS_PILL).
const STATUS_LABEL = {
  sent:      'New',
  viewed:    'Viewed',
  countered: 'Countered',
  accepted:  'Accepted',
  rejected:  'Rejected',
  expired:   'Expired',
  withdrawn: 'Withdrawn',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const now  = Date.now();
  const sec  = Math.max(1, Math.floor((now - then) / 1000));
  if (sec < 60)       return `${sec}s ago`;
  if (sec < 3600)     return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400)   return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604_800)  return `${Math.floor(sec / 86_400)}d ago`;
  return fmtDate(iso);
}

function tierFromFollowers(n) {
  const v = Number(n || 0);
  if (v < 10_000)    return 'nano';
  if (v < 100_000)   return 'micro';
  if (v < 1_000_000) return 'macro';
  return 'mega';
}

function tierLabel(t) { return (t || '').charAt(0).toUpperCase() + (t || '').slice(1); }

// `influencer_niches` arrives from the SELECT as a Postgres text[] → JS array.
// Defensive: handle string-pickled JSON too, and treat falsy as empty.
function normaliseNiches(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    try { const j = JSON.parse(raw); return Array.isArray(j) ? j.filter(Boolean) : [raw]; }
    catch { return [raw]; }
  }
  return [];
}

function initials(name, handle) {
  const src = (name || handle || '??').replace(/^@/, '');
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// ─── Locked palette CSS (scoped under .prp — day-1 discipline) ──────────────
const CSS = `
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

/* crumb + header */
.prp .crumb{font-family:'JetBrains Mono';font-size:11px;color:var(--muted-2);letter-spacing:.3px;text-transform:uppercase;margin-bottom:14px}
.prp .crumb b{color:var(--ink);font-weight:800}
.prp .crumb .sep{color:var(--muted-3);margin:0 6px}
.prp .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.prp .hdr-l h1{font-family:'Outfit';font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.prp .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0 6px}
.prp .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.prp .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono';font-size:11px;font-weight:800;margin-bottom:6px}

/* buttons (every :hover re-asserts color; every :disabled locks bg+color) */
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

/* settings panel */
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

/* warning banner */
.prp .warn{padding:13px 16px;background:var(--yellow-pale);border:1px solid var(--yellow);border-radius:12px;display:flex;align-items:center;gap:12px;margin-bottom:14px}
.prp .warn .ic{width:30px;height:30px;background:var(--yellow);color:var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:14px;flex-shrink:0}
.prp .warn .t{flex:1;font-size:12px;color:var(--ink);line-height:1.5}
.prp .warn .t b{font-weight:700}
.prp .warn .cta{font-size:11.5px;font-weight:700;color:var(--yellow-text);text-decoration:underline;background:transparent;border:0;cursor:pointer;font-family:inherit}
.prp .warn .cta:hover{color:var(--yellow-text)}

/* status tabs */
.prp .tabs{display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border);overflow-x:auto}
.prp .tab{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:2px solid transparent;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap;background:transparent;margin-bottom:-1px;font-family:inherit}
.prp .tab:hover:not(.act){color:var(--ink)}
.prp .tab.act{color:var(--ink);border-bottom-color:var(--yellow)}
.prp .tab .ct{font-family:'JetBrains Mono';font-size:10.5px;font-weight:800;color:var(--muted-2);background:var(--bg2);padding:2px 7px;border-radius:99px}
.prp .tab.act .ct{background:var(--ink);color:var(--yellow)}

/* row card */
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

/* empty state */
.prp .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px;position:relative;overflow:hidden}
.prp .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.prp .empty > *{position:relative;z-index:2}
.prp .empty .ic{width:60px;height:60px;background:var(--ink);color:var(--yellow);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:22px;margin:0 auto 14px}
.prp .empty .h{font-family:'Outfit';font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.prp .empty .t{font-size:12px;color:var(--muted);line-height:1.55;max-width:480px;margin:0 auto 16px}
.prp .empty .cta{display:inline-flex;align-items:center;padding:9px 16px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.prp .empty .cta:hover{background:var(--ink-2);color:var(--yellow)}

/* loading */
.prp .loading{padding:40px;text-align:center;color:var(--muted-2);font-size:13px}

/* modal */
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

/* mode panels (reject + counter) */
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

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ProposalsPage() {
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

  // Per-tab counts — derived client-side from already-loaded array.
  // NOTE: when `tab !== ''` the server returns only that subset, so the
  // "All" count and other-tab counts won't be accurate unless we're on All.
  // We mitigate by also computing total length for the active tab and
  // showing per-tab counts only when on "All" (otherwise show length for
  // active tab only + '·' for others).
  const tabCounts = useMemo(() => {
    const onAllTab = !tab;
    const counts = { '': proposals.length };
    for (const t of STATUS_TABS) {
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
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="crumb">/dashboard <span className="sep">/</span> <b>proposals</b></div>

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
        <SettingsCard
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
        {STATUS_TABS.map(t => {
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
          const niches = normaliseNiches(p.influencer_niches);
          const tierKey = tierFromFollowers(p.followers_count);
          const visibleNiches = niches.slice(0, 3);
          const overflow = niches.length - visibleNiches.length;
          return (
            <button
              key={p.id}
              type="button"
              className="rc"
              onClick={() => setActiveProposal(p)}
            >
              <div className="av">{initials(p.influencer_name, p.influencer_handle)}</div>
              <div className="rc-mid">
                <div className="rc-top">
                  <span className="rc-name">{p.influencer_name || '—'}</span>
                  <span className="rc-handle">@{p.influencer_handle || '—'}</span>
                  <span className={`tier-pill ${tierKey}`}>{tierLabel(tierKey)}</span>
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
                  ● {STATUS_LABEL[p.status] || (p.status || '').replace(/_/g, ' ')}
                </span>
                <div className="rc-dt">{fmtRelative(p.created_at)}</div>
              </div>
            </button>
          );
        })
      )}

      {activeProposal && (
        <ProposalDetailModal
          proposal={activeProposal}
          onClose={() => setActiveProposal(null)}
          onChanged={() => { setActiveProposal(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Settings card (preserved logic; restyled to locked palette) ────────────
function SettingsCard({ settings, onSaved }) {
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
              {TIER_OPTIONS.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${minTier === t ? 'act' : ''}`}
                  onClick={() => setMinTier(t)}
                >{tierLabel(t)}</button>
              ))}
            </div>
          </div>

          <div className="set-row">
            <div className="set-lbl">Allowed niches <span className="opt">empty = any</span></div>
            <div className="chip-row">
              {NICHE_OPTIONS.map(n => (
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

// ─── Detail modal (preserved action logic; restyled) ────────────────────────
function ProposalDetailModal({ proposal, onClose, onChanged }) {
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
  const tierKey   = tierFromFollowers(proposal.followers_count);

  return (
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
              <div className="mod-stat-v">{tierLabel(tierKey)}</div>
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
                <span className="kv-v mono">{fmtDate(proposal.proposed_posting_window_start)} → {fmtDate(proposal.proposed_posting_window_end)}</span>
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
  );
}
