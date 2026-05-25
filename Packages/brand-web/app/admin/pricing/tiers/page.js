'use client';

/**
 * /admin/pricing/tiers — Phase A10 tier list.
 *
 * Lists every tier with quick at-a-glance numbers; click any tier to
 * open the 3-section editor at /admin/pricing/tiers/[tier_key].
 * "+ New tier" button is intentionally NOT implemented in A10 — adding
 * a new tier requires more than just an INSERT (tier_features need 13
 * seed rows; price rows need scaffolding). Will land in a small A10.5
 * follow-up. For now admin edits the 4 existing tiers (free / growth /
 * pro / enterprise) deeply via the per-tier editor.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '../../../../lib/api';

function fmtINR(n) { if (n == null) return '—'; return '₹' + Number(n).toLocaleString('en-IN'); }
function fmtLimit(n) { if (n == null) return '—'; if (n === -1) return '∞'; return Number(n).toLocaleString('en-IN'); }

export default function PricingTiersListPage() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await adminApi.listSubscriptionTiers();
      setTiers(res.data?.tiers || []);
    } catch (e) { setErr(e?.message || 'Load failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="px-6 py-6 max-w-6xl">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-t1">Subscription Tiers (L1)</h1>
        <Link href="/admin/pricing/features" className="px-4 py-2 border border-border2 rounded-lg text-sm font-bold hover:bg-bg2">Manage features catalog →</Link>
      </div>
      <p className="text-sm text-t2 mb-6">SaaS plans + their feature entitlements + monthly/yearly pricing. Click any tier to edit basics, prices, and per-feature inclusion/quotas/config.</p>

      {err && <div className="mb-4 p-3 bg-red-pale text-red rounded-lg text-sm">{err}</div>}
      {loading && <div className="text-t3 text-sm">Loading…</div>}

      {!loading && (
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
                <tr><td colSpan={8} className="px-4 py-6 text-center text-t3 italic">No tiers yet. Run migration M061 to seed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-t3 italic mt-4">Note: the legacy quota columns above (Campaigns / Sets / Influencers / Products) shown for back-compat. The authoritative quotas live in <strong>tier_features</strong> per-feature now and are edited in the tier detail page.</p>
    </div>
  );
}
