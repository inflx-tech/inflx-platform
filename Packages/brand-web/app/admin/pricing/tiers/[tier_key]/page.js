'use client';

/**
 * /admin/pricing/tiers/[tier_key] — Phase A10 tier editor (3 sections).
 *
 * Section A — Basics: display name, description, sort_order, active, monthly_price (legacy column kept for back-compat).
 * Section B — Pricing: monthly + yearly price rows with discount preview.
 * Section C — Features & Quotas: tier_features inclusion/quota/config grouped by category.
 *
 * Mutations require superadmin per backend route guards.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '../../../../../lib/api';

const CATEGORIES = [
  { key: 'influencer',  label: 'Influencer' },
  { key: 'campaigns',   label: 'Campaigns' },
  { key: 'products',    label: 'Products' },
  { key: 'brand_store', label: 'Brand store' },
  { key: 'support',     label: 'Support' },
];

const AREA_SCOPES = ['city', 'state', 'all_india'];

export default function TierEditorPage() {
  const params = useParams();
  const router = useRouter();
  const tierKey = params.tier_key;

  const [tier, setTier]         = useState(null);
  const [prices, setPrices]     = useState([]);
  const [tfList, setTfList]     = useState([]);     // per-feature row state
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [ok, setOk]             = useState(null);
  const [saving, setSaving]     = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const [t, p, f] = await Promise.all([
        adminApi.listSubscriptionTiers(),
        adminApi.listTierPrices(tierKey),
        adminApi.listTierFeatures(tierKey),
      ]);
      const row = (t.data?.tiers || []).find(x => x.tier_key === tierKey);
      if (!row) { setErr(`Tier ${tierKey} not found`); return; }
      setTier(row);
      setPrices(p.data?.prices || []);
      setTfList((f.data?.features || []).map(x => ({
        feature_key:  x.feature_key,
        label:        x.label,
        category:     x.category,
        feature_type: x.feature_type,
        unit:         x.unit,
        included:     x.included,
        quota_value:  x.quota_value != null ? x.quota_value : (x.default_quota != null ? x.default_quota : ''),
        config:       x.config || {},
        notes:        x.notes || '',
        description:  x.description,
      })));
    } catch (e) {
      setErr(e?.message || 'Failed to load tier');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [tierKey]);

  function updateTf(idx, patch) {
    setTfList(list => list.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function updateTfConfig(idx, key, value) {
    setTfList(list => list.map((r, i) => i === idx ? { ...r, config: { ...r.config, [key]: value } } : r));
  }

  async function saveAll() {
    setSaving(true); setErr(null); setOk(null);
    try {
      // Save tier basics
      await adminApi.updateSubscriptionTier(tier.tier_key, {
        name: tier.name,
        description: tier.description,
        active: tier.active,
        sort_order: tier.sort_order,
      });
      // Save tier_features bulk
      await adminApi.upsertTierFeatures(tier.tier_key, tfList.map(r => ({
        feature_key:  r.feature_key,
        included:     !!r.included,
        quota_value:  r.feature_type === 'quota' && r.quota_value !== '' ? parseFloat(r.quota_value) : null,
        config:       r.feature_type === 'config' ? r.config : {},
        notes:        r.notes || null,
      })));
      setOk('Tier saved');
      await load();
    } catch (e) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function addPrice(period) {
    if (prices.find(p => p.billing_period === period)) { setErr(`${period} price already exists for this tier`); return; }
    setErr(null);
    try {
      const res = await adminApi.createTierPrice(tier.tier_key, { billing_period: period, price_inr: 0, active: false });
      if (!res.success) { setErr(res.error?.message || 'Add price failed'); return; }
      await load();
    } catch (e) { setErr(e?.message || 'Add price failed'); }
  }

  async function savePrice(p, updates) {
    setErr(null);
    try {
      const res = await adminApi.updatePrice(p.id, updates);
      if (!res.success) { setErr(res.error?.message || 'Save price failed'); return; }
      await load();
    } catch (e) { setErr(e?.message || 'Save price failed'); }
  }

  const monthlyPrice = prices.find(p => p.billing_period === 'monthly' && p.active);
  const yearlyPrice  = prices.find(p => p.billing_period === 'yearly'  && p.active);
  const discountPct  = (monthlyPrice && yearlyPrice && Number(monthlyPrice.price_inr) > 0)
    ? (1 - Number(yearlyPrice.price_inr) / (12 * Number(monthlyPrice.price_inr))) * 100
    : null;

  if (loading) return <div className="px-6 py-6 text-t3">Loading…</div>;
  if (!tier)   return <div className="px-6 py-6"><div className="text-red">{err || 'Not found'}</div><Link href="/admin/pricing/tiers" className="text-navy underline text-sm">← back to tier list</Link></div>;

  const grouped = CATEGORIES.map(c => ({ ...c, rows: tfList.filter(r => r.category === c.key) }));

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="mb-4">
        <Link href="/admin/pricing/tiers" className="text-navy text-sm">← Back to tier list</Link>
      </div>
      <h1 className="text-2xl font-bold text-t1 mb-1">{tier.name}</h1>
      <p className="text-sm text-t2 mb-6 font-mono">{tier.tier_key}</p>

      {err && <div className="mb-4 p-3 bg-red-pale text-red rounded-lg text-sm">{err}</div>}
      {ok  && <div className="mb-4 p-3 bg-green-pale text-green-700 rounded-lg text-sm">{ok}</div>}

      {/* ── Section A — Basics ── */}
      <section className="mb-6 bg-white border border-border2 rounded-xl p-5">
        <h2 className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Basics</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs font-bold text-t3 uppercase">Display name</span>
            <input value={tier.name || ''} onChange={e => setTier({ ...tier, name: e.target.value })} className="w-full mt-1 border border-border2 rounded px-2 py-1.5 text-sm" /></label>
          <label className="block"><span className="text-xs font-bold text-t3 uppercase">Sort order</span>
            <input type="number" value={tier.sort_order || 0} onChange={e => setTier({ ...tier, sort_order: parseInt(e.target.value, 10) || 0 })} className="w-full mt-1 border border-border2 rounded px-2 py-1.5 text-sm" /></label>
          <label className="col-span-2 block"><span className="text-xs font-bold text-t3 uppercase">Description</span>
            <textarea value={tier.description || ''} onChange={e => setTier({ ...tier, description: e.target.value })} rows={2} className="w-full mt-1 border border-border2 rounded px-2 py-1.5 text-sm" /></label>
          <label className="flex items-center gap-2 col-span-2"><input type="checkbox" checked={!!tier.active} onChange={e => setTier({ ...tier, active: e.target.checked })} /> <span className="text-sm">Active (appears in brand upgrade page)</span></label>
        </div>
      </section>

      {/* ── Section B — Pricing ── */}
      <section className="mb-6 bg-white border border-border2 rounded-xl p-5">
        <h2 className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Pricing</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-t3 uppercase"><th className="pb-2">Period</th><th className="pb-2">Price (₹)</th><th className="pb-2">Active</th><th></th></tr></thead>
          <tbody>
            {prices.map(p => (
              <tr key={p.id} className="border-t border-border2">
                <td className="py-2 font-mono">{p.billing_period}</td>
                <td className="py-2"><input type="number" defaultValue={p.price_inr} id={`price-${p.id}`} className="w-32 border border-border2 rounded px-2 py-1 text-sm" /></td>
                <td className="py-2"><input type="checkbox" defaultChecked={p.active} id={`active-${p.id}`} /></td>
                <td className="py-2 text-right">
                  <button onClick={() => savePrice(p, {
                    price_inr: parseFloat(document.getElementById(`price-${p.id}`).value) || 0,
                    active:    document.getElementById(`active-${p.id}`).checked,
                  })} className="px-3 py-1 bg-navy text-white rounded text-xs font-bold mr-1">Save</button>
                  <button onClick={() => adminApi.deletePrice(p.id).then(load)} className="px-2 py-1 text-red text-xs">Deactivate</button>
                </td>
              </tr>
            ))}
            {prices.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-t3 italic">No prices yet</td></tr>}
          </tbody>
        </table>
        <div className="flex gap-2 mt-3 text-sm">
          {!prices.find(p => p.billing_period === 'monthly') && <button onClick={() => addPrice('monthly')} className="px-3 py-1.5 border border-border2 rounded text-xs">+ Add monthly</button>}
          {!prices.find(p => p.billing_period === 'yearly')  && <button onClick={() => addPrice('yearly')}  className="px-3 py-1.5 border border-border2 rounded text-xs">+ Add yearly</button>}
          {discountPct != null && (
            <div className="ml-auto text-xs text-t2">
              Implied yearly discount: <strong className="text-green-700">{discountPct.toFixed(1)}%</strong>
              {discountPct < 0 && <span className="text-red ml-2">(yearly costs MORE than 12 × monthly — review)</span>}
            </div>
          )}
        </div>
      </section>

      {/* ── Section C — Features & Quotas ── */}
      <section className="mb-6 bg-white border border-border2 rounded-xl p-5">
        <h2 className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Features & Quotas</h2>
        {grouped.map(cat => (
          <div key={cat.key} className="mb-5">
            <h3 className="text-xs font-bold text-t3 uppercase tracking-wider mb-2">{cat.label}</h3>
            <div className="space-y-2">
              {cat.rows.map((r, _i) => {
                const idx = tfList.indexOf(r);
                return (
                  <div key={r.feature_key} className="flex items-start gap-3 p-3 border border-border2 rounded-lg">
                    <input type="checkbox" checked={!!r.included} onChange={e => updateTf(idx, { included: e.target.checked })} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm">{r.label}</span>
                        <span className="text-xs text-t3 font-mono">{r.feature_key}</span>
                        <span className="text-xs text-t3">· {r.feature_type}</span>
                      </div>
                      {r.description && <div className="text-xs text-t2 mt-0.5">{r.description}</div>}
                      {r.feature_type === 'quota' && r.included && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-t2">Limit:</span>
                          <input type="number" value={r.quota_value} onChange={e => updateTf(idx, { quota_value: e.target.value })} className="w-32 border border-border2 rounded px-2 py-1 text-xs" placeholder="-1 = unlimited" />
                          {r.unit && <span className="text-xs text-t3">{r.unit}</span>}
                        </div>
                      )}
                      {r.feature_type === 'config' && r.included && r.feature_key === 'discover_filter' && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <label className="block">Area scope
                            <select value={r.config.area_scope || 'city'} onChange={e => updateTfConfig(idx, 'area_scope', e.target.value)} className="w-full mt-0.5 border border-border2 rounded px-2 py-1">
                              {AREA_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select></label>
                          <label className="block">Niches limit (-1 = unlimited)
                            <input type="number" value={r.config.niches_limit ?? ''} onChange={e => updateTfConfig(idx, 'niches_limit', parseInt(e.target.value, 10) || 0)} className="w-full mt-0.5 border border-border2 rounded px-2 py-1" /></label>
                        </div>
                      )}
                      {r.feature_type === 'config' && r.included && r.feature_key === 'open_group_broadcast' && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <label className="block">Area scope
                            <select value={r.config.area_scope || 'city'} onChange={e => updateTfConfig(idx, 'area_scope', e.target.value)} className="w-full mt-0.5 border border-border2 rounded px-2 py-1">
                              {AREA_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select></label>
                          <label className="block">Max recipients (-1 = unlimited)
                            <input type="number" value={r.config.max_recipients ?? ''} onChange={e => updateTfConfig(idx, 'max_recipients', parseInt(e.target.value, 10) || 0)} className="w-full mt-0.5 border border-border2 rounded px-2 py-1" /></label>
                        </div>
                      )}
                    </div>
                    {r.is_enforced && <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">ENFORCED</span>}
                  </div>
                );
              })}
              {cat.rows.length === 0 && <div className="text-xs text-t3 italic">No features in this category</div>}
            </div>
          </div>
        ))}
      </section>

      <div className="flex justify-end gap-3">
        <Link href="/admin/pricing/tiers" className="px-4 py-2 text-t2 text-sm">Cancel</Link>
        <button onClick={saveAll} disabled={saving} className="px-6 py-2 bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  );
}
