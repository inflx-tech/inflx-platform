'use client';

/**
 * /admin/pricing/tiers — Phase A10.5
 *
 * List page with "+ New tier" button + create modal. Click any tier
 * to open the 3-section editor at /admin/pricing/tiers/[tier_key].
 *
 * A10.5 fixes:
 *  - Tier list now surfaces non-success API responses loudly instead
 *    of silently rendering the empty state (the bug founder saw in prod).
 *  - "+ New tier" button creates a tier with defaults (monthly ₹0 +
 *    13 tier_features rows pre-populated with catalog defaults + 1
 *    monthly price row); founder then edits in the detail page.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '../../../../lib/api';

function fmtINR(n) { if (n == null) return '—'; return '₹' + Number(n).toLocaleString('en-IN'); }
function fmtLimit(n) { if (n == null) return '—'; if (n === -1) return '∞'; return Number(n).toLocaleString('en-IN'); }
const SLUG_RE = /^[a-z][a-z0-9_]{1,39}$/;

export default function PricingTiersListPage() {
  const router = useRouter();
  const [tiers, setTiers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draftKey, setDraftKey]     = useState('');
  const [draftName, setDraftName]   = useState('');
  const [draftDesc, setDraftDesc]   = useState('');
  const [creating, setCreating]     = useState(false);
  const [createErr, setCreateErr]   = useState(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await adminApi.listSubscriptionTiers();
      if (res?.success === false) {
        // Surface the real failure instead of silent empty render.
        setErr(`${res.error?.code || 'ERROR'} — ${res.error?.message || 'Could not load tiers'}`);
        setTiers([]);
      } else {
        setTiers(res?.data?.tiers || []);
      }
    } catch (e) {
      setErr(e?.message || 'Load failed (thrown)');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setDraftKey(''); setDraftName(''); setDraftDesc('');
    setCreateErr(null);
    setShowCreate(true);
  }

  async function submitCreate() {
    setCreateErr(null);
    const k = draftKey.trim().toLowerCase();
    const n = draftName.trim();
    if (!SLUG_RE.test(k)) {
      setCreateErr('Tier key must be lowercase letters/numbers/underscores, start with a letter, 2-40 chars.');
      return;
    }
    if (n.length < 2 || n.length > 80) {
      setCreateErr('Display name must be 2-80 chars.');
      return;
    }
    setCreating(true);
    try {
      const res = await adminApi.createSubscriptionTier({
        tier_key: k, name: n, description: draftDesc.trim() || null,
      });
      if (res?.success === false) {
        setCreateErr(`${res.error?.code || 'ERROR'} — ${res.error?.message || 'Create failed'}`);
        setCreating(false);
        return;
      }
      setShowCreate(false);
      setCreating(false);
      // Navigate straight to the editor so admin can set price + features.
      router.push(`/admin/pricing/tiers/${encodeURIComponent(k)}`);
    } catch (e) {
      setCreateErr(e?.message || 'Create failed (thrown)');
      setCreating(false);
    }
  }

  return (
    <div className="px-6 py-6 max-w-6xl">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-t1">Subscription Tiers (L1)</h1>
        <div className="flex gap-2">
          <Link href="/admin/pricing/features" className="px-4 py-2 border border-border2 rounded-lg text-sm font-bold hover:bg-bg2">Manage features catalog →</Link>
          <button onClick={openCreate} className="px-4 py-2 bg-navy text-white rounded-lg text-sm font-bold">+ New tier</button>
        </div>
      </div>
      <p className="text-sm text-t2 mb-6">SaaS plans + their feature entitlements + monthly/yearly pricing. Click any tier to edit basics, prices, and per-feature inclusion/quotas/config.</p>

      {err && <div className="mb-4 p-3 bg-red-pale text-red rounded-lg text-sm"><strong>Load error:</strong> {err}</div>}
      {loading && <div className="text-t3 text-sm">Loading…</div>}

      {!loading && !err && (
        <div className="bg-white border border-border2 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg2">
              <tr className="text-left text-xs text-t2 uppercase tracking-wider">
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Price/mo (legacy col)</th>
                <th className="px-4 py-3">Campaigns</th>
                <th className="px-4 py-3">Sets</th>
                <th className="px-4 py-3">Influencers/cycle</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map(t => (
                <tr key={t.tier_key} className="border-t border-border2 hover:bg-bg2/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-[11px] font-mono text-t3">{t.tier_key}</div>
                  </td>
                  <td className="px-4 py-3">{fmtINR(t.monthly_price_inr)}</td>
                  <td className="px-4 py-3">{fmtLimit(t.max_campaigns)}</td>
                  <td className="px-4 py-3">{fmtLimit(t.max_sets_per_campaign)}</td>
                  <td className="px-4 py-3">{fmtLimit(t.max_influencers_per_cycle)}</td>
                  <td className="px-4 py-3">{fmtLimit(t.max_products)}</td>
                  <td className="px-4 py-3">{t.active ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/pricing/tiers/${encodeURIComponent(t.tier_key)}`} className="px-3 py-1.5 bg-navy text-white rounded text-xs font-bold">Edit</Link>
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-t3 italic">No tiers found. Click "+ New tier" to create one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-t3 italic mt-4">Note: legacy quota columns above (Campaigns / Sets / Influencers / Products) shown for back-compat. Authoritative quotas live in <strong>tier_features</strong> per-feature now and are edited in the tier detail page.</p>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => !creating && setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">Create new tier</h2>
            <p className="text-xs text-t2 mb-4">Creates the tier with sensible defaults (₹0 monthly price, all features included=false, quotas at catalog default). Edit price + features + quotas in the detail page after.</p>

            <label className="block mb-3">
              <span className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Tier key (slug, lowercase)</span>
              <input
                value={draftKey}
                onChange={e => setDraftKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. starter, business, scale"
                disabled={creating}
                className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm font-mono focus:border-navy outline-none"
              />
            </label>

            <label className="block mb-3">
              <span className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Display name</span>
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="e.g. Starter, Business, Scale"
                disabled={creating}
                className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm focus:border-navy outline-none"
              />
            </label>

            <label className="block mb-4">
              <span className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Description (optional)</span>
              <textarea
                value={draftDesc}
                onChange={e => setDraftDesc(e.target.value)}
                placeholder="Short summary shown on the brand's upgrade card."
                rows={2}
                disabled={creating}
                className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm focus:border-navy outline-none resize-none"
              />
            </label>

            {createErr && <div className="mb-3 p-2.5 bg-red-pale text-red rounded text-xs">{createErr}</div>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} disabled={creating}
                      className="px-4 py-2 border border-border2 rounded-lg text-sm font-bold disabled:opacity-50">Cancel</button>
              <button onClick={submitCreate} disabled={creating}
                      className="px-4 py-2 bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {creating ? 'Creating…' : 'Create + edit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
