'use client';

/**
 * INFLX Meals — restaurant control surface (Wave 2).
 * Two tabs: "Offers & setup" + "Today's orders".
 * All endpoints preserved verbatim from wave1 — pure visual restyle.
 * CSS scoped under .ml wrapper per Flow 16 locked palette.
 */

import { useEffect, useState } from 'react';
import { mealsApi, fmtMoney } from '../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const PARTY = [
  { key: 'single', label: '🧍 Single' },
  { key: 'duo',    label: '👥 For 2' },
  { key: 'trio',   label: '👨‍👩‍👦 For 3' },
  { key: 'family', label: '👨‍👩‍👧‍👦 Family' },
  { key: 'office', label: '🏢 Office' },
];

// ─── Locked palette CSS scoped under .ml ────────────────────────────────────
const CSS = `
.ml *{box-sizing:border-box}
.ml{
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
  max-width:1200px; margin:0 auto;
}
.ml .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.ml .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.ml .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.ml .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.ml .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.ml .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.ml .btn-ink{padding:8px 14px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.ml .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.ml .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}

.ml .subtabs{display:inline-flex;gap:2px;background:var(--bg2);border-radius:12px;padding:4px;margin-bottom:14px}
.ml .subtab{padding:8px 18px;border-radius:9px;font-size:12.5px;font-weight:700;color:var(--muted);background:transparent;display:inline-flex;align-items:center;gap:6px;border:0;cursor:pointer;font-family:inherit;white-space:nowrap}
.ml .subtab:hover:not(.act):not(:disabled){color:var(--ink);background:transparent}
.ml .subtab.act{background:var(--ink);color:var(--yellow)}
.ml .subtab.act:hover:not(:disabled){background:var(--ink);color:var(--yellow)}
.ml .subtab .ct{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;background:rgba(255,255,255,.12);color:inherit;padding:2px 7px;border-radius:99px}
.ml .subtab:not(.act) .ct{background:var(--white);color:var(--muted-2)}

.ml .two-col{display:grid;grid-template-columns:1fr 300px;gap:18px}
@media (max-width: 900px){.ml .two-col{grid-template-columns:1fr}}

/* AI suggestions card */
.ml .ai-card{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:14px;padding:16px;margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.ml .ai-card-l{flex:1;min-width:200px}
.ml .ai-card-t{font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:6px}
.ml .ai-card-s{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--yellow-text);margin-top:4px;line-height:1.5}

.ml .sec-title{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.5px;font-weight:800;margin:14px 0 8px}

.ml .err-msg{padding:10px 14px;background:var(--danger-pale);border:1px solid #FBCBC4;border-radius:10px;font-size:11.5px;color:var(--danger-text);margin-bottom:14px}

/* Party-size chips */
.ml .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.ml .chip{padding:8px 14px;border-radius:99px;background:var(--white);border:1.5px solid var(--border);font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit}
.ml .chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.ml .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.ml .chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.ml .chip .ct{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;opacity:.7;margin-left:2px}

/* Offer card */
.ml .offer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px}
@media (max-width: 720px){.ml .offer-grid{grid-template-columns:1fr}}
.ml .offer{background:var(--white);border:1.5px solid var(--border);border-radius:14px;padding:14px;display:flex;gap:12px;transition:all .15s}
.ml .offer.acc{border-color:var(--success);box-shadow:0 0 0 1px var(--success-pale)}
.ml .offer-img{width:64px;height:64px;border-radius:10px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--muted-3);flex-shrink:0;overflow:hidden}
.ml .offer-img.has{background:var(--yellow-pale);color:var(--yellow-text)}
.ml .offer-img.placeholder{border:1px dashed var(--muted-3);font-size:18px;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--muted-2);flex-direction:column;text-align:center;line-height:1}
.ml .offer-img.placeholder .em{font-size:18px;margin-bottom:2px}
.ml .offer-img.placeholder .lbl{font-size:8px}
.ml .offer-img img{width:100%;height:100%;object-fit:cover}
.ml .offer-body{flex:1;min-width:0}
.ml .offer-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.ml .offer-kind{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);margin-top:3px;text-transform:capitalize}
.ml .offer-status{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;background:var(--bg2);color:var(--muted-2);text-transform:uppercase;letter-spacing:.3px}
.ml .offer-status.suggested{background:var(--conv-pale);color:var(--conv)}
.ml .offer-status.active,.ml .offer-status.accepted{background:var(--success-pale);color:var(--success-text)}
.ml .offer-status.rejected,.ml .offer-status.archived{background:var(--danger-pale);color:var(--danger-text)}
.ml .offer-price{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:var(--ink);margin-top:6px}
.ml .offer-price .old{color:var(--muted-3);text-decoration:line-through;font-weight:600;margin-right:6px;font-size:12px}
.ml .offer-actions{display:flex;gap:5px;margin-top:8px}
.ml .offer-actions button{flex:1;padding:6px;font-size:10.5px;font-weight:700;border-radius:7px;border:1px solid;cursor:pointer;font-family:inherit;background:var(--white)}
.ml .offer-actions button:hover:not(:disabled){opacity:.92}
.ml .offer-actions .accept{background:var(--success);border-color:var(--success);color:var(--white)}
.ml .offer-actions .accept:hover:not(:disabled){background:#0E9F6E;border-color:#0E9F6E;color:var(--white)}
.ml .offer-actions .modify{background:var(--white);border-color:var(--border);color:var(--muted)}
.ml .offer-actions .modify:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.ml .offer-actions .reject,.ml .offer-actions .remove{background:var(--white);border-color:rgba(232,64,26,.3);color:var(--danger-text)}
.ml .offer-actions .reject:hover:not(:disabled),.ml .offer-actions .remove:hover:not(:disabled){background:var(--danger-pale);border-color:var(--danger);color:var(--danger-text)}

/* Create-by-chat box */
.ml .chat-box{background:var(--white);border:2px dashed var(--yellow);border-radius:14px;padding:16px;margin-top:14px}
.ml .chat-box h3{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:6px;margin-bottom:6px}
.ml .chat-box .sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-bottom:10px;line-height:1.5}
.ml .chat-thread{background:var(--bg);border:1px solid var(--border-soft);border-radius:10px;padding:10px;margin-bottom:10px;display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto}
.ml .chat-msg{max-width:80%;padding:7px 12px;border-radius:14px;font-size:12px;line-height:1.45}
.ml .chat-msg.me{background:var(--ink);color:var(--white);align-self:flex-end;border-bottom-right-radius:4px}
.ml .chat-msg.bot{background:var(--white);color:var(--ink);align-self:flex-start;border:1px solid var(--border);border-bottom-left-radius:4px}
.ml .chat-input{display:flex;gap:8px;align-items:end}
.ml .chat-input textarea{flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:12.5px;font-family:inherit;resize:none;outline:none;color:var(--ink);background:var(--white)}
.ml .chat-input textarea:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}

/* Empty for party */
.ml .empty-party{background:var(--white);border:2px dashed var(--border);border-radius:14px;padding:36px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted-2);margin-bottom:14px}

/* Sidebar cards */
.ml .side-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px}
.ml .side-card h3{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.ml .side-card .helper{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted-2);margin-bottom:10px;line-height:1.4}
.ml .side-card .row{display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border-soft)}
.ml .side-card .row:last-child{border-bottom:0}
.ml .side-card .row b{color:var(--ink);font-weight:700;font-family:'JetBrains Mono',monospace}
.ml .side-card .row b.on{color:var(--success-text)}

/* Discount clock */
.ml .clock-row{display:flex;gap:5px;align-items:center;margin-bottom:6px}
.ml .clock-row input{width:42px;padding:5px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;text-align:center;font-family:'JetBrains Mono',monospace;outline:none;color:var(--ink);background:var(--white)}
.ml .clock-row input:focus{border-color:var(--yellow);box-shadow:0 0 0 2px var(--yellow-pale)}
.ml .clock-row select{flex:1;padding:5px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:var(--white);font-family:inherit;outline:none;color:var(--ink)}
.ml .clock-row select:focus{border-color:var(--yellow)}
.ml .clock-row .pct{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--yellow-text);font-weight:800}
.ml .clock-row .x{padding:2px 6px;color:var(--muted-2);background:transparent;font-size:16px;border:0;cursor:pointer;font-family:inherit}
.ml .clock-row .x:hover{color:var(--danger-text)}
.ml .add-step{width:100%;margin-top:6px;padding:6px;font-size:11px;font-weight:700;color:var(--yellow-text);border:1px dashed var(--yellow);background:transparent;border-radius:8px;cursor:pointer;font-family:inherit}
.ml .add-step:hover{background:var(--yellow-50)}
.ml .save-clock{width:100%;margin-top:8px;padding:8px;font-size:11.5px;font-weight:700;background:var(--ink);color:var(--yellow);border-radius:9px;border:0;cursor:pointer;font-family:inherit}
.ml .save-clock:hover{background:var(--ink-2);color:var(--yellow)}
.ml .saved-msg{display:block;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--success-text);margin-top:6px;font-weight:700}

/* Today tab — stats */
.ml .st-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
@media (max-width: 720px){.ml .st-grid{grid-template-columns:repeat(2,1fr)}}
.ml .st{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.ml .st.attn{background:var(--yellow-50);border-color:var(--yellow)}
.ml .st .l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.5px}
.ml .st .v{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.3px;margin-top:4px}
.ml .st .v.yel{color:var(--yellow-text)}
.ml .st .v.green{color:var(--success-text)}
.ml .st .s{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);margin-top:4px}

/* Progress card */
.ml .progress-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px}
.ml .progress-card h3{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.ml .progress-bar{height:10px;background:var(--bg);border-radius:99px;overflow:hidden;margin-top:8px}
.ml .progress-fill{height:100%;background:linear-gradient(90deg,var(--yellow) 0%,var(--yellow-hover) 100%);border-radius:99px}
.ml .progress-meta{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);margin-bottom:6px}
.ml .progress-meta b{color:var(--ink)}

/* Table */
.ml .tbl{width:100%;border-collapse:collapse;font-size:12px}
.ml .tbl thead th{text-align:left;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;padding:8px;border-bottom:1px solid var(--border)}
.ml .tbl tbody td{padding:10px 8px;border-bottom:1px solid var(--border-soft);font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--ink)}
.ml .tbl tbody td:first-child{font-family:'Outfit',sans-serif;font-weight:700}
.ml .tbl .deliver{font-family:inherit;font-size:11px;font-weight:700;color:var(--yellow-text);background:transparent;cursor:pointer;border:0;padding:0}
.ml .tbl .deliver:hover{color:var(--ink)}
.ml .tbl .status-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;display:inline-block}
.ml .tbl .status-pill.paid{background:var(--success-pale);color:var(--success-text)}
.ml .tbl .status-pill.preparing,.ml .tbl .status-pill.out_for_delivery{background:var(--yellow-pale);color:var(--yellow-text)}
.ml .tbl .status-pill.delivered{background:var(--success-pale);color:var(--success-text)}
.ml .tbl .status-pill.cancelled,.ml .tbl .status-pill.refunded{background:var(--danger-pale);color:var(--danger-text)}
.ml .tbl .status-pill.default{background:var(--bg2);color:var(--muted)}

.ml .empty-line{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--muted-2);padding:20px;text-align:center}
.ml .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:ml-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes ml-spin{to{transform:rotate(360deg)}}

/* Unmatched */
.ml .unmatched{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink)}
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultConfig() {
  return { enabled: false, delivery_radius_km: 5, max_discount_pct: 25, never_below_cost: true, auto_offer: false, discount_clock: [] };
}

function computeDisplayPrice(rule) {
  const items = Array.isArray(rule.items_json) ? rule.items_json : [];
  const itemsSum = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  const base = rule.base_price != null ? Number(rule.base_price) : itemsSum;
  let discounted = base;
  if (rule.discount_type === 'flat' && rule.discount_value != null) discounted = base - Number(rule.discount_value);
  else if (rule.discount_type === 'percentage' && rule.discount_value != null) discounted = base * (1 - Number(rule.discount_value) / 100);
  return { base: Math.round(base), discounted: Math.round(discounted) };
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MealsPage() {
  const [tab, setTab] = useState('setup');

  return (
    <div className="ml">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">🍽 Restaurant control</span>
          <h1>🍽 INFLX Meals</h1>
          <div className="rule" />
          <div className="sub">Plan-ahead meals — your prices, your offers, self-delivery within 5 km.</div>
        </div>
      </div>

      <div className="subtabs" role="tablist">
        <button className={`subtab${tab === 'setup' ? ' act' : ''}`} onClick={() => setTab('setup')}>Offers &amp; setup</button>
        <button className={`subtab${tab === 'today' ? ' act' : ''}`} onClick={() => setTab('today')}>Today's orders</button>
      </div>

      {tab === 'setup' ? <SetupTab /> : <TodayTab />}
    </div>
  );
}

// ─── Setup tab ──────────────────────────────────────────────────────────────

function SetupTab() {
  const [party, setParty]       = useState('family');
  const [rules, setRules]       = useState([]);
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [aiMode, setAiMode]     = useState(null);
  const [suggestError, setSuggestError] = useState(null);

  async function load() {
    setLoading(true);
    const [r, c] = await Promise.all([mealsApi.listOfferRules(), mealsApi.getConfig()]);
    if (r.success) setRules(r.data.offer_rules || []);
    if (c.success) setConfig(c.data.config || defaultConfig());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id, status, rejected_reason) {
    const res = await mealsApi.updateOfferRule(id, { status, ...(rejected_reason ? { rejected_reason } : {}) });
    if (res.success) load();
  }

  async function generateSuggestions() {
    setSuggesting(true); setSuggestError(null);
    const res = await mealsApi.suggestOffers();
    setSuggesting(false);
    if (res.success) { setAiMode(res.data.ai_mode); load(); }
    else setSuggestError(res.error?.message || 'Could not generate suggestions');
  }

  const suggested = rules.filter(r => r.status === 'suggested');
  const shown = rules.filter(r => r.party_size === party && r.status !== 'suggested');
  const countByParty = (k) => rules.filter(r => r.party_size === k && r.status !== 'suggested').length;

  return (
    <div className="two-col">
      <div>
        {/* AI suggestions */}
        <div className="ai-card">
          <div className="ai-card-l">
            <div className="ai-card-t">✨ AI offer suggestions</div>
            <div className="ai-card-s">
              {suggested.length > 0
                ? `${suggested.length} suggested ${suggested.length === 1 ? 'combo' : 'combos'} waiting for your review (Accept / Modify / Reject).`
                : 'Generate offer combinations from your menu. AI picks the combinations — you set the final prices.'}
              {aiMode && <span style={{ marginLeft: 8, opacity: .65 }}>ai · {aiMode}</span>}
            </div>
          </div>
          <button className="btn-ink" onClick={generateSuggestions} disabled={suggesting} data-testid="meals-suggest-btn">
            {suggesting ? 'Generating…' : (suggested.length > 0 ? 'Generate more' : '✨ Generate AI suggestions')}
          </button>
        </div>
        {suggestError && <div className="err-msg">{suggestError}</div>}

        {suggested.length > 0 && (
          <>
            <div className="sec-title">✨ AI suggested — review &amp; accept</div>
            <div className="offer-grid">
              {suggested.map(r => <OfferCard key={r.id} rule={r} onStatus={setStatus} />)}
            </div>
          </>
        )}

        {/* Party-size chips */}
        <div className="chip-row">
          {PARTY.map(p => (
            <button key={p.key} className={`chip${party === p.key ? ' act' : ''}`} onClick={() => setParty(p.key)}>
              {p.label}<span className="ct">{countByParty(p.key)}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="spinner" />
        ) : shown.length === 0 ? (
          <div className="empty-party">No offers for this party size yet. Create one below.</div>
        ) : (
          <div className="offer-grid">
            {shown.map(r => <OfferCard key={r.id} rule={r} onStatus={setStatus} />)}
          </div>
        )}

        <CreateOfferBox party={party} onCreated={load} />
      </div>

      {/* Sidebar */}
      <div>
        <DiscountClock config={config} setConfig={setConfig} />
        <Limits config={config} />
      </div>
    </div>
  );
}

function OfferCard({ rule, onStatus }) {
  const accepted = rule.status === 'accepted' || rule.status === 'active';
  const price = computeDisplayPrice(rule);
  const statusCls = rule.status || 'default';
  return (
    <div className={`offer${accepted ? ' acc' : ''}`}>
      {rule.photo_url ? (
        <div className="offer-img has">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rule.photo_url} alt="" />
        </div>
      ) : (
        <div className="offer-img placeholder">
          <span className="em">📷</span>
          <span className="lbl">No photo</span>
        </div>
      )}
      <div className="offer-body">
        <div className="offer-name">{rule.name}</div>
        <div className="offer-kind">
          <span className={`offer-status ${statusCls}`}>{rule.status}</span>
          <span style={{ marginLeft: 6 }}>{String(rule.offer_kind || '').replace(/_/g, ' ')}</span>
        </div>
        <div className="offer-price">
          {price.discounted != null && price.discounted !== price.base && (
            <span className="old">{fmtMoney(price.base)}</span>
          )}
          {fmtMoney(price.discounted ?? price.base)}
        </div>
        <div className="offer-actions">
          {accepted ? (
            <>
              <button className="modify">Modify</button>
              <button className="remove" onClick={() => onStatus(rule.id, 'archived')}>Remove</button>
            </>
          ) : (
            <>
              <button className="accept" onClick={() => onStatus(rule.id, 'active')}>Accept</button>
              <button className="modify">Modify</button>
              <button className="reject" onClick={() => onStatus(rule.id, 'rejected', 'owner rejected')}>Reject</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateOfferBox({ party, onCreated }) {
  const [desc, setDesc]   = useState('');
  const [thread, setThread] = useState([]);
  const [busy, setBusy]   = useState(false);

  async function send() {
    const text = desc.trim();
    if (!text || busy) return;
    setBusy(true);
    setThread(t => [...t, { from: 'me', text }]);
    const message = text + (party && !/\b(single|duo|trio|family|office|people|ppl|persons|for \d|solo)\b/i.test(text)
      ? ` for ${party}`
      : '');
    const res = await mealsApi.restaurantChat({ message });
    setBusy(false);
    if (!res.success) {
      setThread(t => [...t, { from: 'bot', text: res.error?.message || 'Could not parse. Try again.' }]);
      return;
    }
    const d = res.data;
    if (d.stage === 'clarify') {
      setThread(t => [...t, { from: 'bot', text: d.question }]);
    } else if (d.stage === 'built') {
      const r = d.offer_rule;
      const bits = [];
      if (r.discount_value) bits.push(`${r.discount_type === 'percentage' ? r.discount_value + '%' : '₹' + r.discount_value} off`);
      if ((r.freebies_json || []).length) bits.push(`free ${r.freebies_json.join(' + ')}`);
      setThread(t => [...t, { from: 'bot', text: `Built "${r.name}" (${r.party_size}, base ₹${Math.round(r.base_price || 0)}${bits.length ? ', ' + bits.join(', ') : ''}). Review & Accept it above ↑` }]);
      setDesc('');
      onCreated();
    }
  }

  return (
    <div className="chat-box">
      <h3>✏️ Create your own offer — by chat</h3>
      <div className="sub">
        Describe the offer in plain English. AI picks the combination + freebies from your menu; you stay in control of prices. Example: <i>"family pack with 2 chicken biryani + 2 veg biryani, ₹90 off, free raita"</i>.
      </div>
      {thread.length > 0 && (
        <div className="chat-thread">
          {thread.map((m, i) => (
            <div key={i} className={`chat-msg ${m.from}`}>{m.text}</div>
          ))}
        </div>
      )}
      <div className="chat-input">
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="e.g. family pack with 2 chicken biryani + 2 veg biryani, ₹90 off, free raita"
          rows={2}
          data-testid="meals-rchat-input"
        />
        <button className="btn-ink" onClick={send} disabled={busy || !desc.trim()} data-testid="meals-rchat-send">
          {busy ? 'Building…' : 'Build with chat'}
        </button>
      </div>
    </div>
  );
}

function DiscountClock({ config, setConfig }) {
  const [saved, setSaved] = useState(false);
  const clock = (config && config.discount_clock) || [];

  function update(idx, key, val) {
    const next = clock.map((row, i) => (i === idx ? { ...row, [key]: val } : row));
    setConfig({ ...config, discount_clock: next });
  }
  function add() {
    setConfig({ ...config, discount_clock: [...clock, { unit: 'hour', n: 2, pct: 5 }] });
  }
  function remove(idx) {
    setConfig({ ...config, discount_clock: clock.filter((_, i) => i !== idx) });
  }
  async function save() {
    const res = await mealsApi.putConfig({ ...config });
    if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <div className="side-card">
      <h3>Your discount clock</h3>
      <div className="helper">Editable — set how your price falls as the cutoff nears.</div>
      <div>
        {clock.map((row, i) => (
          <div key={i} className="clock-row">
            <input value={row.n} onChange={e => update(i, 'n', Number(e.target.value))} />
            <select value={row.unit} onChange={e => update(i, 'unit', e.target.value)}>
              <option value="day">day(s) before</option>
              <option value="hour">hour(s) before</option>
            </select>
            <input value={row.pct} onChange={e => update(i, 'pct', Number(e.target.value))} />
            <span className="pct">%</span>
            <button className="x" onClick={() => remove(i)}>×</button>
          </div>
        ))}
      </div>
      <button className="add-step" onClick={add}>+ Add a step</button>
      <button className="save-clock" onClick={save}>Save discount clock</button>
      {saved && <span className="saved-msg">✓ Saved · applies to all auto-offers</span>}
    </div>
  );
}

function Limits({ config }) {
  const c = config || defaultConfig();
  return (
    <div className="side-card">
      <h3>Your limits (safety)</h3>
      <div className="row">Never discount below cost <b className={c.never_below_cost ? 'on' : ''}>{c.never_below_cost ? 'on' : 'off'}</b></div>
      <div className="row">Max total discount <b>{c.max_discount_pct}%</b></div>
      <div className="row">Delivery radius <b>{c.delivery_radius_km} km</b></div>
      <div className="row">Auto-offer <b className={c.auto_offer ? 'on' : ''}>{c.auto_offer ? 'ON' : 'OFF'}</b></div>
    </div>
  );
}

// ─── Today tab ──────────────────────────────────────────────────────────────

function TodayTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await mealsApi.getDashboard();
    if (res.success) setData(res.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function deliver(id) {
    const res = await mealsApi.deliverOrder(id);
    if (res.success) load();
  }

  if (loading) return <div className="spinner" />;
  if (!data) return <div className="empty-line">No data.</div>;

  const s = data.stats || {};
  const pct = s.capacity ? Math.round((s.confirmed / s.capacity) * 100) : 0;

  return (
    <div className="two-col">
      <div>
        <div className="st-grid">
          <div className="st">
            <div className="l">Confirmed</div>
            <div className="v">{s.confirmed ?? 0}</div>
            <div className="s">orders</div>
          </div>
          <div className={`st${(s.capacity_left ?? 0) < (s.capacity ?? 0) * 0.3 ? ' attn' : ''}`}>
            <div className="l">Capacity Left</div>
            <div className="v yel">{s.capacity_left ?? '—'}</div>
            <div className="s">of {s.capacity ?? '—'}</div>
          </div>
          <div className="st">
            <div className="l">Locked Revenue</div>
            <div className="v green">{fmtMoney(s.revenue ?? 0)}</div>
            <div className="s">incl. tax</div>
          </div>
          <div className="st">
            <div className="l">Meals to Cook</div>
            <div className="v">{s.meals ?? 0}</div>
            <div className="s">total items</div>
          </div>
        </div>

        <div className="progress-card">
          <h3>Order book filling</h3>
          <div className="progress-meta">
            <span>{s.confirmed ?? 0} of {s.capacity ?? '—'} orders · <b>{pct}% full</b></span>
            <span>{s.capacity_left ?? '—'} slots open</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="progress-card">
          <h3>Incoming orders</h3>
          {(!data.orders || data.orders.length === 0) ? (
            <div className="empty-line">No orders for this slot yet.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer</th><th>Party</th><th>Amount</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map(o => {
                  const pillCls = ['paid','preparing','out_for_delivery','delivered','cancelled','refunded'].includes(o.status) ? o.status : 'default';
                  return (
                    <tr key={o.id}>
                      <td>{o.customer_name || 'Customer'}</td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{o.party_size || '—'}</td>
                      <td>{fmtMoney(o.amount)}</td>
                      <td><span className={`status-pill ${pillCls}`}>● {o.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {['paid', 'preparing', 'out_for_delivery'].includes(o.status) && (
                          <button className="deliver" onClick={() => deliver(o.id)}>Mark delivered</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div>
        <div className="side-card">
          <h3>Kitchen prep (so far)</h3>
          {(!data.prep_summary || data.prep_summary.length === 0) ? (
            <div className="helper" style={{ margin: 0 }}>Nothing to cook yet.</div>
          ) : (
            data.prep_summary.map(p => (
              <div key={p.name} className="row">{p.name}<b>{p.qty}</b></div>
            ))
          )}
        </div>

        <div className="side-card">
          <h3>Unmatched requests</h3>
          {(!data.unmatched || data.unmatched.length === 0) ? (
            <div className="helper" style={{ margin: 0 }}>No unmatched requests.</div>
          ) : (
            data.unmatched.map(u => (
              <div key={u.id} className="unmatched">{u.raw_text || `${u.party_size || ''} · ${u.slot_label || ''}`}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
