'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { brandInboxApi, applicationApi, fmtRupees, fmtNum } from '../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'applications', label: 'Applications',     desc: 'Open-group applicants waiting on your approve / reject' },
  { key: 'negotiations', label: 'Negotiations',     desc: 'Counter-offers waiting for your response' },
  { key: 'reviews',      label: 'Content reviews',  desc: 'Submitted deliverables to approve / revise' },
  { key: 'signatures',   label: 'Contract signs',   desc: 'Contracts the influencer signed; needs you to countersign' },
  { key: 'failures',     label: 'Failures',         desc: 'Contracts/PDFs that failed to generate; retry them' },
];

const TIER_CLS = { nano: 'nano', micro: 'micro', mid: 'mid', macro: 'macro', mega: 'mega', celebrity: 'macro' };

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

function fmtDateShort(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

// ─── Locked palette CSS scoped under .ibx ───────────────────────────────────
const CSS = `
.ibx *{box-sizing:border-box}
.ibx{
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
  max-width:920px; margin:0 auto;
}
.ibx .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.ibx .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.ibx .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.ibx .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.ibx .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.ibx .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}

.ibx .subtabs{display:inline-flex;gap:2px;background:var(--bg2);border-radius:12px;padding:4px;margin-bottom:14px;flex-wrap:wrap;max-width:100%}
.ibx .subtab{padding:8px 16px;border-radius:9px;font-size:12.5px;font-weight:700;color:var(--muted);background:transparent;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:0;cursor:pointer;font-family:inherit}
.ibx .subtab:hover:not(.act):not(:disabled){color:var(--ink);background:transparent}
.ibx .subtab.act{background:var(--ink);color:var(--yellow)}
.ibx .subtab.act:hover:not(:disabled){background:var(--ink);color:var(--yellow)}
.ibx .subtab .ct{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;background:rgba(255,255,255,.12);color:inherit;padding:2px 7px;border-radius:99px}
.ibx .subtab:not(.act) .ct{background:var(--white);color:var(--muted-2)}
.ibx .tab-desc{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-bottom:14px}

/* Application card (rich) */
.ibx .ic{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:8px}
.ibx .ic:hover{border-color:var(--muted-3)}
.ibx .ic-clickable{cursor:pointer}
.ibx .ic-clickable:hover{border-color:var(--ink)}
.ibx .ic-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
.ibx .ic-top-l{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.ibx .ic-top-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ibx .ic-handle{font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--ink)}
.ibx .ic-tier-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.ibx .ic-tier-pill.nano{background:var(--bg2);color:var(--muted)}
.ibx .ic-tier-pill.micro{background:var(--info-pale);color:var(--info)}
.ibx .ic-tier-pill.mid{background:var(--eng-pale);color:var(--eng)}
.ibx .ic-tier-pill.macro{background:var(--conv-pale);color:var(--conv)}
.ibx .ic-tier-pill.mega{background:var(--yellow-pale);color:var(--yellow-text)}
.ibx .ic-camp{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ibx .ic-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);display:flex;flex-wrap:wrap;gap:8px}
.ibx .ic-meta b{color:var(--ink);font-weight:600}
.ibx .ic-niche{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted-2);margin-top:2px}
.ibx .ic-niche b{color:var(--ink)}
.ibx .ic-view{font-family:inherit;font-size:11.5px;font-weight:700;color:var(--ink);text-decoration:none;white-space:nowrap;padding:4px 0}
.ibx .ic-view:hover{color:var(--yellow-text);background:transparent}
.ibx .ic-actions{display:flex;gap:8px;margin-top:8px}
.ibx .ic-btn{flex:1;padding:8px;font-size:11.5px;font-weight:700;border-radius:10px;border:1px solid;cursor:pointer;font-family:inherit}
.ibx .ic-btn.reject{background:var(--danger-pale);border-color:rgba(232,64,26,.3);color:var(--danger-text)}
.ibx .ic-btn.reject:hover:not(:disabled){background:var(--danger);border-color:var(--danger);color:var(--white)}
.ibx .ic-btn.approve{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.ibx .ic-btn.approve:hover:not(:disabled){background:var(--ink-2);border-color:var(--ink-2);color:var(--yellow)}
.ibx .ic-btn:disabled{opacity:.4;cursor:not-allowed}

/* Click-to-nav row card */
.ibx .ic-nav{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;padding:0}
.ibx .ic-nav-l{min-width:0;display:flex;flex-direction:column;gap:3px}
.ibx .ic-nav-name{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.ibx .ic-nav-name .handle{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink)}
.ibx .ic-nav-name .sep{color:var(--muted-3);font-size:11px}
.ibx .ic-nav-name .camp{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--muted-2)}
.ibx .ic-nav-name .rev{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:5px;background:var(--yellow-pale);color:var(--yellow-text);text-transform:uppercase;letter-spacing:.3px}
.ibx .ic-nav-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2)}
.ibx .ic-nav-meta b{color:var(--ink);font-weight:600}
.ibx .ic-nav-meta .exp{color:var(--danger-text);font-weight:700;margin-left:8px}
.ibx .ic-nav-fee{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:var(--ink);text-align:right;min-width:90px}
.ibx .ic-nav-fee .l{font-family:'Outfit',sans-serif;font-size:9px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:1px;display:block}
.ibx .ic-nav-chev{color:var(--yellow);font-size:18px;font-weight:800;flex-shrink:0}

/* Info card */
.ibx .info-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start}
.ibx .info-card.success{border-left:3px solid var(--success)}
.ibx .info-card.warn{border-left:3px solid var(--yellow)}
.ibx .info-card.danger{border-left:3px solid var(--danger)}
.ibx .info-card .em{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.ibx .info-card.success .em{background:var(--success-pale);color:var(--success-text)}
.ibx .info-card.warn .em{background:var(--yellow-pale);color:var(--yellow-text)}
.ibx .info-card.danger .em{background:var(--danger-pale);color:var(--danger-text)}
.ibx .info-card .body{flex:1;min-width:0}
.ibx .info-card .ti{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ibx .info-card .ti .ct{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;color:var(--ink);background:var(--bg2);padding:2px 8px;border-radius:6px}
.ibx .info-card .ti .ct.warn{background:var(--yellow-pale);color:var(--yellow-text)}
.ibx .info-card .ti .ct.danger{background:var(--danger-pale);color:var(--danger-text)}
.ibx .info-card .ti .ct.success{background:var(--success-pale);color:var(--success-text)}
.ibx .info-card p{font-size:12px;color:var(--muted);line-height:1.5}
.ibx .info-card p b{color:var(--ink);font-weight:600;font-family:'JetBrains Mono',monospace;background:var(--bg2);padding:1px 5px;border-radius:4px;font-size:11px}

/* Empty / loading */
.ibx .empty-tab{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--muted-2);padding:32px 16px;text-align:center}
.ibx .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:ibx-spin .8s linear infinite;margin:60px auto;display:block}
@keyframes ibx-spin{to{transform:rotate(360deg)}}
`;

// ─── Tab Panels ─────────────────────────────────────────────────────────────

function ApplicationsTab({ onChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  function load() {
    setLoading(true);
    brandInboxApi.applications().then(r => {
      setLoading(false);
      if (r.success) {
        setRows(r.data?.applications || []);
        onChange?.();
      }
    });
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function act(a, action) {
    if (action === 'reject' && !confirm(`Reject @${a.instagram_handle}? They'll be notified.`)) return;
    setBusy(p => ({ ...p, [a.campaign_influencer_id]: action }));
    const fn = action === 'approve' ? applicationApi.approve : applicationApi.reject;
    const res = await fn(a.campaign_id, a.campaign_influencer_id);
    setBusy(p => { const n = { ...p }; delete n[a.campaign_influencer_id]; return n; });
    if (!res.success) {
      alert(res.error?.message || `Could not ${action} application.`);
      return;
    }
    if (action === 'approve' && res.data?.slots_filled) {
      alert(`Approved. Slots now full — ${res.data.closed_out_count || 0} other applicant(s) were notified.`);
    }
    load();
  }

  if (loading) return <div className="spinner" />;
  if (rows.length === 0) return <div className="empty-tab">No applications waiting on you.</div>;

  return (
    <div>
      {rows.map(a => {
        const isBusy = !!busy[a.campaign_influencer_id];
        const tierCls = TIER_CLS[a.tier] || 'nano';
        return (
          <div key={a.campaign_influencer_id} className="ic">
            <div className="ic-top">
              <div className="ic-top-l">
                <div className="ic-top-row">
                  <span className="ic-handle">@{a.instagram_handle || '—'}</span>
                  {a.tier && <span className={`ic-tier-pill ${tierCls}`}>{a.tier}</span>}
                  <span className="ic-camp">· {a.campaign_name}{a.set_name ? ` · ${a.set_name}` : ''}</span>
                </div>
                <div className="ic-meta">
                  {a.influencer_name && <span>{a.influencer_name}</span>}
                  {a.followers_count != null && <span>· <b>{fmtNum(a.followers_count)}</b> followers</span>}
                  {a.engagement_rate != null && <span>· <b>{parseFloat(a.engagement_rate).toFixed(1)}%</b> ER</span>}
                  {a.city && <span>· {a.city}</span>}
                </div>
                {Array.isArray(a.niche) && a.niche.length > 0 && (
                  <div className="ic-niche">Niche: <b>{a.niche.join(', ')}</b></div>
                )}
              </div>
              <Link href={`/dashboard/influencers/${a.influencer_profile_id}`} className="ic-view">
                View profile →
              </Link>
            </div>
            <div className="ic-actions">
              <button className="ic-btn reject" disabled={isBusy} onClick={() => act(a, 'reject')}>
                {isBusy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
              <button className="ic-btn approve" disabled={isBusy} onClick={() => act(a, 'approve')}>
                {isBusy === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NegotiationsTab({ onChange }) {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    brandInboxApi.negotiations('awaiting_brand').then(r => {
      setLoading(false);
      if (r.success) {
        setRows(r.data?.negotiations || []);
        onChange?.();
      }
    });
    /* eslint-disable-next-line */
  }, []);
  if (loading) return <div className="spinner" />;
  if (rows.length === 0) return <div className="empty-tab">Nothing waiting on you here.</div>;
  return (
    <div>
      {rows.map(n => (
        <div key={n.id} className="ic ic-clickable" onClick={() => router.push(`/dashboard/campaigns/${n.campaign_id}`)}>
          <div className="ic-nav">
            <div className="ic-nav-l">
              <div className="ic-nav-name">
                <span className="handle">@{n.influencer_handle}</span>
                <span className="sep">·</span>
                <span className="camp">{n.campaign_name}</span>
              </div>
              <div className="ic-nav-meta">
                Last counter: <b>{n.last_proposed_fee != null ? fmtRupees(n.last_proposed_fee) : '—'}</b>
                <span> · {fmtDateShort(n.created_at)}</span>
                {n.expires_at && <span className="exp">expires {fmtDateShort(n.expires_at)}</span>}
              </div>
            </div>
            <div className="ic-nav-fee">
              {n.last_proposed_fee != null ? fmtRupees(n.last_proposed_fee) : '—'}
              <span className="l">last counter</span>
            </div>
            <div className="ic-nav-chev">›</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({ onChange }) {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    brandInboxApi.deliverables('submitted').then(r => {
      setLoading(false);
      if (r.success) {
        setRows(r.data?.deliverables || []);
        onChange?.();
      }
    });
    /* eslint-disable-next-line */
  }, []);
  if (loading) return <div className="spinner" />;
  if (rows.length === 0) return <div className="empty-tab">No content awaiting review.</div>;
  return (
    <div>
      {rows.map(d => (
        <div key={d.id} className="ic ic-clickable" onClick={() => router.push(`/dashboard/campaigns/${d.campaign_id}?tab=content&deliverable=${d.id}`)}>
          <div className="ic-nav">
            <div className="ic-nav-l">
              <div className="ic-nav-name">
                <span className="handle">@{d.influencer_handle}</span>
                <span className="sep">·</span>
                <span className="camp">{(d.type || '').replace(/_/g, ' ')}</span>
                {d.revision_count > 0 && <span className="rev">REV {d.revision_count}</span>}
              </div>
              <div className="ic-nav-meta">
                {d.campaign_name}<span> · submitted {fmtDateShort(d.submitted_at)}</span>
              </div>
            </div>
            <div style={{ minWidth: 90 }}></div>
            <div className="ic-nav-chev">›</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SignaturesTab({ summary }) {
  const ct = Number(summary?.signatures_count || 0);
  return (
    <div className="info-card success">
      <div className="em">📝</div>
      <div className="body">
        <div className="ti">Contract sign-offs {ct > 0 && <span className="ct success">{ct} pending</span>}</div>
        <p>Contracts requiring your signature appear inside each campaign's hierarchy. Open the campaign and click the influencer row marked <b>pending_brand</b> to countersign.</p>
      </div>
    </div>
  );
}

function FailuresTab({ summary }) {
  const cf = Number(summary?.contracts_failed || 0);
  const pf = Number(summary?.pdf_failed || 0);
  return (
    <div>
      <div className="info-card warn">
        <div className="em">⚠</div>
        <div className="body">
          <div className="ti">Contracts that failed to auto-create <span className="ct warn">{cf}</span></div>
          <p>Open the affected campaign and click the influencer row — you'll see a <b>Retry contract</b> button when this happens.</p>
        </div>
      </div>
      <div className="info-card danger">
        <div className="em">📄</div>
        <div className="body">
          <div className="ti">Contracts whose PDF failed to generate <span className="ct danger">{pf}</span></div>
          <p>Open the contract modal and click <b>Regenerate</b>. The error is shown beneath the PDF preview.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Inner Page ─────────────────────────────────────────────────────────────

function InboxPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = TABS.find(t => t.key === params.get('tab')) || TABS[0];

  // Summary for header count + sub-tab counts (refetched on tab change to stay fresh)
  const [summary, setSummary] = useState(null);
  function loadSummary() {
    brandInboxApi.summary().then(r => {
      if (r.success) setSummary(r.data?.summary || {});
    });
  }
  useEffect(() => { loadSummary(); }, []);

  // Each tab gets a chance to refresh the summary when its data changes (best-effort)
  const onChildChange = () => loadSummary();

  const counts = {
    applications: summary?.applications_count ?? null,
    negotiations: summary?.negotiations_count ?? null,
    reviews:      summary?.reviews_count ?? null,
    signatures:   summary?.signatures_count ?? null,
    failures:     (Number(summary?.contracts_failed || 0) + Number(summary?.pdf_failed || 0)) || null,
  };
  const totalWaiting = Object.values(counts).reduce((acc, v) => acc + (Number(v) || 0), 0);

  const Body = {
    applications: ApplicationsTab,
    negotiations: NegotiationsTab,
    reviews:      ReviewsTab,
    signatures:   () => <SignaturesTab summary={summary} />,
    failures:     () => <FailuresTab summary={summary} />,
  }[tab.key];

  return (
    <div className="ibx">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{totalWaiting > 0 ? `${totalWaiting} items waiting` : 'Inbox'}</span>
          <h1>Inbox</h1>
          <div className="rule" />
          <div className="sub">Items waiting on your action across applications, negotiations, content reviews, contract signing, and failures.</div>
        </div>
      </div>

      <div className="subtabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab.key === t.key}
            className={`subtab${tab.key === t.key ? ' act' : ''}`}
            onClick={() => router.push(`/dashboard/inbox?tab=${t.key}`)}
          >
            {t.label}
            {counts[t.key] != null && <span className="ct">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <div className="tab-desc">{tab.desc}</div>

      {Body.length === 0 ? <Body /> : <Body onChange={onChildChange} />}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="ibx">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="spinner" />
      </div>
    }>
      <InboxPageInner />
    </Suspense>
  );
}
