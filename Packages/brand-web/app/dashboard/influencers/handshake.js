'use client';
/**
 * handshake.js — the brand side of the pre-campaign handshake, inside the
 * Influencers tab. Contract: features/collab-part2-precampaign-handshake
 * (mockup locked 2026-08-11: tabs ①②③⑥⑦ of handshake.html).
 *
 * Three pieces, consumed by page.js:
 *   <RequestComposer/>   — send a request: one creator, a saved group, or everyone
 *                          matching the current Discover filters (one-time snapshot)
 *   <RequestsTab/>       — sent requests, with the counter shown as a side-by-side
 *                          diff and accept / counter-back / decline
 *   <ReadyToBriefTab/>   — agreements waiting for a campaign
 *
 * Friendly labels only here — the wire format is the campaign_goal enum
 * (conversion = "Pay per sale", engagement = "Pay for content", hybrid = "Both").
 */
import { useState, useEffect, useCallback } from 'react';
import { handshakeApi } from '../../../lib/api';

const AIM_LABEL = { conversion: 'Pay per sale', engagement: 'Pay for content', hybrid: 'Both' };
const MODE_LABEL = { visit: 'Store visit', shipment: 'We ship products', remote: 'Remote' };
const fmtD = (d) => (d ? String(d).slice(0, 10) : '—');

// ─── Money/time summary of a terms payload, for list rows ────────────────────
export function termsSummary(t) {
  if (!t) return '—';
  const bits = [];
  if (t.money?.commission_pct != null) bits.push(`${t.money.commission_pct}%`);
  if (t.money?.fee != null) bits.push(`₹${Number(t.money.fee).toLocaleString('en-IN')}`);
  if (t.time?.post_by) bits.push(`post by ${fmtD(t.time.post_by)}`);
  else if (t.time?.window_start) bits.push(`${fmtD(t.time.window_start)} → ${fmtD(t.time.window_end)}`);
  return bits.join(' · ') || '—';
}

// ─── Composer ─────────────────────────────────────────────────────────────────
export function RequestComposer({ target, onClose, onSent }) {
  // target: { influencer } | { group } | { filters }  (filters = current Discover set)
  const [aim, setAim] = useState('conversion');
  const [commission, setCommission] = useState('');
  const [fee, setFee] = useState('');
  const [postBy, setPostBy] = useState('');
  const [winStart, setWinStart] = useState('');
  const [winEnd, setWinEnd] = useState('');
  // Optional terms — each with its importance marker. '' = not stated.
  const [scopeLevel, setScopeLevel] = useState('');
  const [scopeCategory, setScopeCategory] = useState('');
  const [scopeImp, setScopeImp] = useState('preference');
  const [mode, setMode] = useState('');
  const [modeImp, setModeImp] = useState('preference');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);   // broadcast only
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);

  const isBroadcast = !!target.filters;

  useEffect(() => {
    if (!isBroadcast) return;
    handshakeApi.broadcastPreview(target.filters).then(res => {
      if (res.success) setPreview(res.data);
    }).catch(() => {});
  }, [isBroadcast]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildTerms = () => {
    const t = { aim, money: {}, time: {} };
    if (aim !== 'engagement' && commission) t.money.commission_pct = Number(commission);
    if (aim !== 'conversion' && fee) t.money.fee = Number(fee);
    if (aim === 'conversion') t.time.post_by = postBy || null;
    else { t.time.window_start = winStart || null; t.time.window_end = winEnd || null; }
    const importance = {};
    if (scopeLevel) {
      t.scope = scopeLevel === 'category'
        ? { level: 'category', category: scopeCategory || null }
        : { level: scopeLevel };
      importance.scope = scopeImp;
    }
    if (mode) { t.mode = mode; importance.mode = modeImp; }
    if (Object.keys(importance).length) t.importance = importance;
    return t;
  };

  const send = async () => {
    setBusy(true); setErr('');
    const body = { terms: buildTerms(), message: message || null };
    if (target.influencer) body.influencer_id = target.influencer.id;
    else if (target.group) body.group_id = target.group.id;
    else body.filters = target.filters;
    try {
      const res = await handshakeApi.send(body);
      if (res.success) { setResult(res.data); onSent && onSent(res.data); }
      else setErr(res.error?.message || 'Could not send');
    } catch (e) { setErr(e.message || 'Could not send'); }
    setBusy(false);
  };

  const who = target.influencer ? `@${target.influencer.instagram_handle || target.influencer.full_name}`
    : target.group ? `${target.group.name} (${target.group.member_count} creators)`
    : preview ? `${preview.reachable} of ${preview.matched} matching creators` : 'matching creators…';

  // Sent — show the honest outcome, including who was skipped and why.
  if (result) {
    return (
      <div className="hs-modal" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="hs-card">
          <h3>Request sent</h3>
          <div className="hs-note ok">Sent to <b>{result.sent_count}</b> creator{result.sent_count === 1 ? '' : 's'}.</div>
          {result.skipped_count > 0 && (
            <div className="hs-note warn">
              <b>{result.skipped_count} skipped:</b>
              <ul>{result.skipped.map((s, i) => <li key={i}>{s.reason}</li>)}</ul>
            </div>
          )}
          <div className="hs-row-btns"><button className="hs-btn pri" onClick={onClose}>Done</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="hs-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="hs-card">
        <h3>Request a collaboration</h3>
        <div className="hs-sub">To: <b>{who}</b> — no campaign needed. Money and time are always negotiable; everything else is optional.</div>

        {isBroadcast && preview && preview.capped && (
          <div className="hs-note warn">{preview.matched} creators match, but one broadcast reaches at most {preview.cap}. Sends once, as a snapshot — you'll see exactly who was contacted.</div>
        )}

        <label className="hs-lbl">Aim</label>
        <div className="hs-tog">
          {['conversion', 'engagement', 'hybrid'].map(a => (
            <button key={a} className={aim === a ? 'act' : ''} onClick={() => setAim(a)}>{AIM_LABEL[a]}</button>
          ))}
        </div>

        <div className="hs-grid">
          {aim !== 'engagement' && (
            <div><label className="hs-lbl">Commission % <span className="hs-pill neg">negotiable</span></label>
              <input className="hs-inp" type="number" value={commission} onChange={e => setCommission(e.target.value)} placeholder="e.g. 12" /></div>
          )}
          {aim !== 'conversion' && (
            <div><label className="hs-lbl">Fee (₹) <span className="hs-pill neg">negotiable</span></label>
              <input className="hs-inp" type="number" value={fee} onChange={e => setFee(e.target.value)} placeholder="e.g. 25000" /></div>
          )}
          {aim === 'conversion' ? (
            <div><label className="hs-lbl">Post by <span className="hs-pill neg">negotiable</span></label>
              <input className="hs-inp" type="date" value={postBy} onChange={e => setPostBy(e.target.value)} /></div>
          ) : (<>
            <div><label className="hs-lbl">Window start</label>
              <input className="hs-inp" type="date" value={winStart} onChange={e => setWinStart(e.target.value)} /></div>
            <div><label className="hs-lbl">Window end</label>
              <input className="hs-inp" type="date" value={winEnd} onChange={e => setWinEnd(e.target.value)} /></div>
          </>)}
        </div>
        {aim === 'conversion' && <div className="hs-hint">A sales collaboration has no end date — this is the posting expectation, and it runs while stock lasts.</div>}

        <div className="hs-opt">
          <label className="hs-lbl">What they'd promote <span className="hs-pill mut">optional</span></label>
          <div className="hs-tog sm">
            {['', 'store', 'category', 'products'].map(s => (
              <button key={s || 'none'} className={scopeLevel === s ? 'act' : ''} onClick={() => setScopeLevel(s)}>
                {s === '' ? 'Not stated' : s === 'store' ? 'Whole store' : s === 'category' ? 'A category' : 'Specific products'}
              </button>
            ))}
          </div>
          {scopeLevel === 'category' && (
            <input className="hs-inp" style={{ marginTop: 6 }} value={scopeCategory} onChange={e => setScopeCategory(e.target.value)} placeholder="Category name" />
          )}
          {scopeLevel && <ImportancePicker value={scopeImp} onChange={setScopeImp} />}
        </div>

        <div className="hs-opt">
          <label className="hs-lbl">How you'd work together <span className="hs-pill mut">optional</span></label>
          <div className="hs-tog sm">
            {['', 'visit', 'shipment', 'remote'].map(m => (
              <button key={m || 'none'} className={mode === m ? 'act' : ''} onClick={() => setMode(m)}>
                {m === '' ? 'Not stated' : MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {mode && <ImportancePicker value={modeImp} onChange={setModeImp} />}
        </div>

        <div className="hs-hint">Deliverables are deliberately not asked — the creator proposes what they can do, and it becomes part of the agreement.</div>

        <label className="hs-lbl" style={{ marginTop: 10 }}>Message</label>
        <textarea className="hs-inp" rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="Why you want to work with them" />

        {err && <div className="hs-note bad">{err}</div>}
        <div className="hs-row-btns">
          <button className="hs-btn sec" onClick={onClose}>Cancel</button>
          <button className="hs-btn pri" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send request'}</button>
        </div>
      </div>
    </div>
  );
}

function ImportancePicker({ value, onChange }) {
  return (
    <div className="hs-imp">
      <span>How much it matters:</span>
      <button className={value === 'requirement' ? 'act' : ''} onClick={() => onChange('requirement')}>Requirement</button>
      <button className={value === 'preference' ? 'act' : ''} onClick={() => onChange('preference')}>Preference</button>
      {value === 'preference'
        ? <em>asked as a question — declining it doesn't break the deal</em>
        : <em>must be settled before agreeing — cannot be countered</em>}
    </div>
  );
}

// ─── The counter, as a diff ───────────────────────────────────────────────────
function CounterDiff({ request }) {
  const orig = request.terms_json || {};
  const counter = request.counter_terms_json || {};
  const rows = [];
  const push = (label, a, b) => { if (b !== undefined && JSON.stringify(a) !== JSON.stringify(b)) rows.push([label, a, b]); };
  push('Commission', orig.money?.commission_pct != null ? `${orig.money.commission_pct}%` : '—',
       counter.money?.commission_pct != null ? `${counter.money.commission_pct}%` : undefined);
  push('Fee', orig.money?.fee != null ? `₹${orig.money.fee}` : '—',
       counter.money?.fee != null ? `₹${counter.money.fee}` : undefined);
  push('Post by', fmtD(orig.time?.post_by), counter.time?.post_by ? fmtD(counter.time.post_by) : undefined);
  push('Working style', MODE_LABEL[orig.mode] || '—', counter.mode ? MODE_LABEL[counter.mode] : undefined);
  if (counter.deliverables) {
    rows.push(['Deliverables', orig.deliverables ? 'proposed' : 'left to them',
      counter.deliverables.map(d => `${d.count} ${d.type}`).join(' + ')]);
  }
  if (!rows.length) return null;
  return (
    <div className="hs-diff">
      {rows.map(([label, a, b]) => (
        <div key={label} className="hs-diff-row">
          <span className="hs-diff-lbl">{label}</span>
          <span className="hs-diff-old">{a}</span>
          <span className="hs-diff-arr">→</span>
          <span className="hs-diff-new">{b}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Requests tab ─────────────────────────────────────────────────────────────
export function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    handshakeApi.list().then(res => {
      if (res.success) setRequests(res.data?.requests || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const act = async (id, fn) => { setBusy(id); await fn().catch(() => {}); setBusy(null); load(); };

  if (loading) return <div className="hs-empty">Loading…</div>;
  if (!requests.length) return (
    <div className="hs-empty">
      <b>No requests yet.</b><br />Find a creator in Discover and hit <i>Request collab</i> — you agree money and timing first, and build the campaign after.
    </div>
  );

  return (
    <div className="hs-list">
      {requests.map(r => (
        <div key={r.id} className="hs-req">
          <div className="hs-req-head">
            <div className="hs-av">{(r.influencer_name || r.instagram_handle || '?')[0].toUpperCase()}</div>
            <div className="hs-req-who">
              <div className="hs-req-name">{r.influencer_name || `@${r.instagram_handle}`}</div>
              <div className="hs-req-meta">{termsSummary(r.terms_json)}{r.origin !== 'direct' ? ` · via ${r.origin}` : ''}</div>
            </div>
            <span className={`hs-st ${r.status}`}>{r.status}</span>
          </div>
          {r.status === 'countered' && r.counter_by === 'creator' && (
            <>
              <CounterDiff request={r} />
              <div className="hs-row-btns">
                <button className="hs-btn pri sm" disabled={busy === r.id} onClick={() => act(r.id, () => handshakeApi.accept(r.id))}>Accept their terms</button>
                <button className="hs-btn dgr sm" disabled={busy === r.id} onClick={() => act(r.id, () => handshakeApi.decline(r.id))}>Decline</button>
              </div>
            </>
          )}
          {['sent', 'viewed'].includes(r.status) && (
            <div className="hs-row-btns">
              <button className="hs-btn sec sm" disabled={busy === r.id} onClick={() => act(r.id, () => handshakeApi.withdraw(r.id))}>Withdraw</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Ready to brief ───────────────────────────────────────────────────────────
export function ReadyToBriefTab({ router }) {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handshakeApi.agreements().then(res => {
      if (res.success) setAgreements(res.data?.agreements || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="hs-empty">Loading…</div>;
  if (!agreements.length) return (
    <div className="hs-empty">
      <b>Nothing waiting to be briefed.</b><br />When a creator agrees terms — from your request or their pitch — they land here until you build the campaign.
    </div>
  );

  return (
    <div className="hs-list">
      <div className="hs-note key">
        These creators <b>agreed terms</b> and are waiting for a campaign. Each agreement is used once and expires after the admin-set window if never briefed.
      </div>
      {agreements.map(a => (
        <div key={a.id} className="hs-req">
          <div className="hs-req-head">
            <div className="hs-av">{(a.influencer_name || a.instagram_handle || '?')[0].toUpperCase()}</div>
            <div className="hs-req-who">
              <div className="hs-req-name">{a.influencer_name || `@${a.instagram_handle}`}</div>
              <div className="hs-req-meta">
                {AIM_LABEL[(a.terms_json || {}).aim] || '—'} · {termsSummary(a.terms_json)} · expires {fmtD(a.expires_at)}
              </div>
            </div>
            <button className="hs-btn pri sm" onClick={() => router.push(`/dashboard/campaigns/new?agreement=${a.id}`)}>
              Brief into a campaign →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CSS (namespaced under .inf, matching the page) ──────────────────────────
export const HANDSHAKE_CSS = `
.inf .hs-modal{position:fixed;inset:0;background:rgba(10,10,10,.45);display:grid;place-items:center;z-index:60;padding:18px;overflow:auto}
.inf .hs-card{background:var(--white);border-radius:15px;padding:19px;max-width:560px;width:100%;max-height:90vh;overflow:auto}
.inf .hs-card h3{font-size:15px;font-weight:800;margin:0 0 4px}
.inf .hs-sub{font-size:11.5px;color:var(--muted-2);font-weight:600;margin-bottom:13px}
.inf .hs-lbl{display:block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin:10px 0 5px}
.inf .hs-inp{width:100%;border:1px solid var(--border);border-radius:9px;padding:8px 10px;font-size:12px;font-family:inherit;background:var(--white)}
.inf .hs-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.inf .hs-tog{display:flex;border:1px solid var(--border);border-radius:9px;overflow:hidden}
.inf .hs-tog button{flex:1;border:none;background:var(--white);padding:8px 6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--muted);border-right:1px solid var(--border)}
.inf .hs-tog button:last-child{border-right:none}
.inf .hs-tog button.act{background:var(--ink);color:var(--yellow)}
.inf .hs-tog.sm button{padding:6px 4px;font-size:10.5px}
.inf .hs-opt{border:1px solid var(--border-soft);border-radius:10px;padding:10px;margin-top:10px}
.inf .hs-imp{display:flex;gap:6px;align-items:center;margin-top:7px;flex-wrap:wrap;font-size:10px;color:var(--muted-3);font-weight:700}
.inf .hs-imp button{border:1px solid var(--border);background:var(--white);border-radius:999px;padding:3px 9px;font-size:9.5px;font-weight:750;cursor:pointer;font-family:inherit;color:var(--muted)}
.inf .hs-imp button.act{background:var(--ink);color:#fff;border-color:var(--ink)}
.inf .hs-imp em{font-style:normal;font-weight:600;font-size:9.5px;color:var(--muted-2)}
.inf .hs-hint{font-size:10.5px;color:var(--muted-2);font-weight:600;margin-top:7px;line-height:1.5}
.inf .hs-pill{display:inline-block;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;vertical-align:middle}
.inf .hs-pill.neg{background:var(--success-pale,#D1FAE5);color:var(--success-text,#047857)}
.inf .hs-pill.mut{background:var(--bg2);color:var(--muted)}
.inf .hs-note{font-size:11px;font-weight:650;border-radius:9px;padding:9px 12px;margin:10px 0;line-height:1.5}
.inf .hs-note.ok{background:#D1FAE5;color:#047857}
.inf .hs-note.warn{background:var(--yellow-50,#FFFDEB);color:var(--yellow-text,#6B5A00)}
.inf .hs-note.bad{background:#FDEEE9;color:#B91C1C}
.inf .hs-note.key{background:var(--yellow-50,#FFFDEB);color:var(--yellow-text,#6B5A00)}
.inf .hs-note ul{margin:5px 0 0 16px;padding:0}
.inf .hs-row-btns{display:flex;gap:8px;margin-top:12px;justify-content:flex-end;flex-wrap:wrap}
.inf .hs-btn{border:none;border-radius:9px;padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}
.inf .hs-btn.sm{padding:6px 11px;font-size:11px}
.inf .hs-btn.pri{background:var(--yellow);color:var(--ink)}
.inf .hs-btn.sec{background:var(--white);border:1px solid var(--border);color:var(--ink)}
.inf .hs-btn.dgr{background:var(--white);border:1px solid #FBCBC4;color:#B91C1C}
.inf .hs-btn:disabled{opacity:.5;cursor:not-allowed}
.inf .hs-list{display:flex;flex-direction:column;gap:10px}
.inf .hs-req{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:12px}
.inf .hs-req-head{display:flex;align-items:center;gap:10px}
.inf .hs-av{width:32px;height:32px;border-radius:50%;background:var(--ink);color:var(--yellow);display:grid;place-items:center;font-size:12px;font-weight:800;flex:0 0 auto}
.inf .hs-req-who{flex:1;min-width:0}
.inf .hs-req-name{font-size:12.5px;font-weight:750}
.inf .hs-req-meta{font-size:10.5px;color:var(--muted-2);font-weight:650}
.inf .hs-st{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;font-family:'JetBrains Mono',monospace;padding:3px 8px;border-radius:4px;background:var(--bg2);color:var(--muted)}
.inf .hs-st.agreed{background:#D1FAE5;color:#047857}
.inf .hs-st.countered{background:var(--yellow-pale,#FFF7CC);color:var(--yellow-text,#6B5A00)}
.inf .hs-st.declined,.inf .hs-st.expired{background:#FDEEE9;color:#B91C1C}
.inf .hs-diff{border-top:1px solid var(--border-soft);margin-top:10px;padding-top:8px}
.inf .hs-diff-row{display:grid;grid-template-columns:110px 1fr auto 1fr;gap:8px;align-items:center;padding:4px 0;font-size:11.5px}
.inf .hs-diff-lbl{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--muted-3)}
.inf .hs-diff-old{font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--muted-2);text-decoration:line-through}
.inf .hs-diff-arr{color:var(--muted-3);font-weight:800}
.inf .hs-diff-new{font-family:'JetBrains Mono',monospace;font-weight:800;background:var(--yellow-pale,#FFF7CC);border-radius:6px;padding:2px 7px;display:inline-block}
.inf .hs-empty{text-align:center;padding:40px 16px;color:var(--muted-2);font-size:12.5px;font-weight:600;line-height:1.7}
`;
