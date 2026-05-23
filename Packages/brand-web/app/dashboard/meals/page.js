'use client';

/**
 * INFLX Meals — restaurant control surface (P2).
 * Two tabs realising the locked mockups:
 *   - "Offers & setup"  → mockup 01 (party-size tabs, offer cards with
 *      photo + Accept/Modify/Reject, editable discount clock, limits,
 *      create-your-own offer).
 *   - "Today's orders"  → mockup 04 (R5 dashboard: order-book fill,
 *      locked revenue, kitchen prep, incoming orders, unmatched requests).
 * Deterministic only — AI suggestions arrive in a later phase.
 */

import { useEffect, useState } from 'react';
import { mealsApi, fmtMoney } from '../../../lib/api';

const PARTY = [
  { key: 'single', label: '🧍 Single' },
  { key: 'duo',    label: '👥 For 2' },
  { key: 'trio',   label: '👨‍👩‍👦 For 3' },
  { key: 'family', label: '👨‍👩‍👧‍👦 Family' },
  { key: 'office', label: '🏢 Office' },
];

export default function MealsPage() {
  const [tab, setTab] = useState('setup');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy-deep">🍽️ INFLX Meals</h1>
          <p className="text-sm text-gray-500">Plan-ahead meals — your prices, your offers, self-delivery within 5 km.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <TabButton active={tab === 'setup'} onClick={() => setTab('setup')}>Offers &amp; setup</TabButton>
        <TabButton active={tab === 'today'} onClick={() => setTab('today')}>Today&apos;s orders</TabButton>
      </div>

      {tab === 'setup' ? <SetupTab /> : <TodayTab />}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active ? 'border-orange text-navy-deep' : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

// ── Setup tab (mockup 01) ─────────────────────────────────────────────────────

function SetupTab() {
  const [party, setParty] = useState('family');
  const [rules, setRules] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [aiMode, setAiMode] = useState(null);
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

  const suggested = rules.filter((r) => r.status === 'suggested');
  const shown = rules.filter((r) => r.party_size === party && r.status !== 'suggested');
  const countByParty = (k) => rules.filter((r) => r.party_size === k && r.status !== 'suggested').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div>
        {/* AI suggestions */}
        <div className="bg-orange/5 border border-orange/30 rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-navy-deep">✨ AI offer suggestions</h3>
            <p className="text-xs text-gray-500">
              {suggested.length > 0
                ? `${suggested.length} suggested ${suggested.length === 1 ? 'combo' : 'combos'} waiting for your review (Accept / Modify / Reject).`
                : 'Generate offer combinations from your menu. AI picks the combinations — you set the final prices.'}
              {aiMode && <span className="ml-2 text-[10px] uppercase text-gray-400">ai · {aiMode}</span>}
            </p>
          </div>
          <button
            onClick={generateSuggestions}
            disabled={suggesting}
            className="bg-orange text-white font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            data-testid="meals-suggest-btn"
          >
            {suggesting ? 'Generating…' : (suggested.length > 0 ? 'Generate more' : '✨ Generate AI suggestions')}
          </button>
        </div>
        {suggestError && <p className="text-xs text-red-600 mb-3">{suggestError}</p>}

        {suggested.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-2">
              ✨ AI suggested — review &amp; accept
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggested.map((r) => <OfferCard key={r.id} rule={r} onStatus={setStatus} />)}
            </div>
          </div>
        )}

        {/* Party-size tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PARTY.map((p) => (
            <button
              key={p.key}
              onClick={() => setParty(p.key)}
              className={`px-3.5 py-2 rounded-full text-sm font-bold border transition-colors ${
                party === p.key ? 'bg-navy-deep text-white border-navy-deep' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {p.label}<span className="opacity-60 ml-1 font-semibold">{countByParty(p.key)}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading offers…</p>
        ) : shown.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
            No offers for this party size yet. Create one below.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shown.map((r) => <OfferCard key={r.id} rule={r} onStatus={setStatus} />)}
          </div>
        )}

        <CreateOfferBox party={party} onCreated={load} />
      </div>

      <div className="space-y-4">
        <DiscountClock config={config} setConfig={setConfig} />
        <Limits config={config} />
      </div>
    </div>
  );
}

function OfferCard({ rule, onStatus }) {
  const accepted = rule.status === 'accepted' || rule.status === 'active';
  const price = computeDisplayPrice(rule);
  return (
    <div className={`bg-white rounded-xl border p-3.5 relative ${accepted ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200'}`}>
      <div className="flex gap-3">
        {rule.photo_url ? (
          <img src={rule.photo_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
        ) : (
          <div className="w-16 h-16 rounded-lg border border-dashed border-pink-300 text-pink-600 flex flex-col items-center justify-center text-[10px] font-bold">
            📷<span>No photo</span>
          </div>
        )}
        <div className="min-w-0">
          <div className="font-bold text-sm text-navy-deep truncate">{rule.name}</div>
          <div className="text-[11px] text-gray-400 capitalize">{String(rule.offer_kind).replace('_', ' ')} · {rule.status}</div>
          <div className="text-sm font-bold mt-1">
            {price.discounted != null && price.discounted !== price.base && (
              <span className="text-gray-400 line-through font-medium mr-1.5">{fmtMoney(price.base)}</span>
            )}
            {fmtMoney(price.discounted ?? price.base)}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 mt-3">
        {accepted ? (
          <>
            <button className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600">Modify</button>
            <button onClick={() => onStatus(rule.id, 'archived')} className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white border border-red-200 text-red-600">Remove</button>
          </>
        ) : (
          <>
            <button onClick={() => onStatus(rule.id, 'active')} className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white">Accept</button>
            <button className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600">Modify</button>
            <button onClick={() => onStatus(rule.id, 'rejected', 'owner rejected')} className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white border border-red-200 text-red-600">Reject</button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateOfferBox({ party, onCreated }) {
  // Restaurant chat (P-RCHAT): owner describes an offer in plain English,
  // the AI extracts items/discount/freebies/triggers, backend joins
  // prices from brand_products. The result lands as `status='suggested'`
  // for the same Accept/Modify/Reject flow.
  const [desc, setDesc] = useState('');
  const [thread, setThread] = useState([]);  // [{from:'me'|'bot', text}]
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = desc.trim();
    if (!text || busy) return;
    setBusy(true);
    setThread((t) => [...t, { from: 'me', text }]);
    const message = text + (party && !/\b(single|duo|trio|family|office|people|ppl|persons|for \d|solo)\b/i.test(text)
      ? ` for ${party}`
      : '');
    const res = await mealsApi.restaurantChat({ message });
    setBusy(false);
    if (!res.success) {
      setThread((t) => [...t, { from: 'bot', text: res.error?.message || 'Could not parse. Try again.' }]);
      return;
    }
    const d = res.data;
    if (d.stage === 'clarify') {
      setThread((t) => [...t, { from: 'bot', text: d.question }]);
    } else if (d.stage === 'built') {
      const r = d.offer_rule;
      const bits = [];
      if (r.discount_value) bits.push(`${r.discount_type === 'percentage' ? r.discount_value + '%' : '₹' + r.discount_value} off`);
      if ((r.freebies_json || []).length) bits.push(`free ${r.freebies_json.join(' + ')}`);
      setThread((t) => [...t, { from: 'bot', text: `Built “${r.name}” (${r.party_size}, base ₹${Math.round(r.base_price || 0)}${bits.length ? ', ' + bits.join(', ') : ''}). Review &amp; Accept it above ↑` }]);
      setDesc('');
      onCreated();
    }
  }

  return (
    <div className="mt-5 bg-white border border-dashed border-pink-300 rounded-xl p-4">
      <h3 className="text-sm font-bold text-pink-700 mb-1">✏️ Create your own offer — by chat</h3>
      <p className="text-xs text-gray-500 mb-3">
        Describe the offer in plain English. AI picks the combination + freebies from your menu;
        you stay in control of prices. Example: <i>"family pack with 2 chicken biryani + 2 veg biryani, ₹90 off, free raita"</i>.
      </p>
      {thread.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 space-y-2 text-xs">
          {thread.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <span className={`inline-block max-w-[80%] px-3 py-2 rounded-2xl ${m.from === 'me' ? 'bg-navy-deep text-white rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm'}`}>
                {m.text}
              </span>
            </div>
          ))}
        </div>
      )}
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="e.g. family pack with 2 chicken biryani + 2 veg biryani, ₹90 off, free raita"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
        rows={2}
        data-testid="meals-rchat-input"
      />
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-[11px] text-gray-400">AI parses combinations; prices come from your menu.</span>
        <button
          onClick={send}
          disabled={busy || !desc.trim()}
          className="bg-pink-700 text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40"
          data-testid="meals-rchat-send"
        >
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
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-1">Your discount clock</h3>
      <p className="text-[11px] text-gray-400 mb-3">Editable — set how your price falls as the cutoff nears.</p>
      <div className="space-y-2">
        {clock.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input value={row.n} onChange={(e) => update(i, 'n', Number(e.target.value))} className="w-12 border border-gray-200 rounded px-1 py-1 text-xs text-center" />
            <select value={row.unit} onChange={(e) => update(i, 'unit', e.target.value)} className="flex-1 border border-gray-200 rounded px-1 py-1 text-xs">
              <option value="day">day(s) before</option>
              <option value="hour">hour(s) before</option>
            </select>
            <input value={row.pct} onChange={(e) => update(i, 'pct', Number(e.target.value))} className="w-12 border border-gray-200 rounded px-1 py-1 text-xs text-center" />
            <span className="text-orange font-bold text-xs">%</span>
            <button onClick={() => remove(i)} className="text-gray-400 px-1">×</button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 w-full text-xs font-bold text-orange border border-dashed border-orange/40 rounded-lg py-1.5">+ Add a step</button>
      <button onClick={save} className="mt-2 w-full text-xs font-bold bg-navy-deep text-white rounded-lg py-2">Save discount clock</button>
      {saved && <span className="block text-[11px] text-green-600 font-bold mt-1.5">✓ Saved · applies to all auto-offers</span>}
    </div>
  );
}

function Limits({ config }) {
  const c = config || defaultConfig();
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-2">Your limits (safety)</h3>
      <div className="text-xs text-gray-600 space-y-1">
        <div>Never discount below cost: <b>{c.never_below_cost ? 'on' : 'off'}</b></div>
        <div>Max total discount: <b>{c.max_discount_pct}%</b></div>
        <div>Delivery radius: <b>{c.delivery_radius_km} km</b></div>
        <div>Auto-offer: <b className={c.auto_offer ? 'text-green-600' : ''}>{c.auto_offer ? 'ON' : 'OFF'}</b></div>
      </div>
    </div>
  );
}

// ── Today tab (mockup 04) ─────────────────────────────────────────────────────

function TodayTab() {
  const [data, setData] = useState(null);
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

  if (loading) return <p className="text-sm text-gray-400">Loading today&apos;s order book…</p>;
  if (!data) return <p className="text-sm text-gray-400">No data.</p>;

  const s = data.stats || {};
  const pct = s.capacity ? Math.round((s.confirmed / s.capacity) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat value={s.confirmed ?? 0} label="orders confirmed" />
          <Stat value={s.capacity_left ?? '—'} label={`capacity left${s.capacity ? ` (of ${s.capacity})` : ''}`} accent="orange" />
          <Stat value={fmtMoney(s.revenue ?? 0)} label="locked revenue" accent="green" />
          <Stat value={s.meals ?? 0} label="meals to cook" />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <h3 className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-3">Order book filling</h3>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{s.confirmed ?? 0} of {s.capacity ?? '—'} orders · <b className="text-navy-deep">{pct}% full</b></span>
            <span>{s.capacity_left ?? '—'} slots open</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-3">Incoming orders</h3>
          {(!data.orders || data.orders.length === 0) ? (
            <p className="text-sm text-gray-400">No orders for this slot yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-gray-400 text-left border-b border-gray-100">
                  <th className="pb-2">Customer</th><th className="pb-2">Party</th><th className="pb-2">Amount</th><th className="pb-2">Status</th><th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50">
                    <td className="py-2 font-semibold">{o.customer_name || 'Customer'}</td>
                    <td className="py-2 capitalize text-gray-500">{o.party_size || '—'}</td>
                    <td className="py-2 font-bold">{fmtMoney(o.amount)}</td>
                    <td className="py-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 capitalize">{o.status}</span></td>
                    <td className="py-2 text-right">
                      {['paid', 'preparing', 'out_for_delivery'].includes(o.status) && (
                        <button onClick={() => deliver(o.id)} className="text-[11px] font-bold text-orange">Mark delivered</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-3">Kitchen prep (so far)</h3>
          {(!data.prep_summary || data.prep_summary.length === 0) ? (
            <p className="text-xs text-gray-400">Nothing to cook yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.prep_summary.map((p) => (
                <div key={p.name} className="flex justify-between"><span>{p.name}</span><b>{p.qty}</b></div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-3">Unmatched requests</h3>
          {(!data.unmatched || data.unmatched.length === 0) ? (
            <p className="text-xs text-gray-400">No unmatched requests.</p>
          ) : (
            <div className="space-y-2">
              {data.unmatched.map((u) => (
                <div key={u.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                  <div className="text-xs text-navy-deep">{u.raw_text || `${u.party_size || ''} · ${u.slot_label || ''}`}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, accent }) {
  const color = accent === 'green' ? 'text-green-600' : accent === 'orange' ? 'text-orange' : 'text-navy-deep';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5">
      <div className={`text-xl font-extrabold ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

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
