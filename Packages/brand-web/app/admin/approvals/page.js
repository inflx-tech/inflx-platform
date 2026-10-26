'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Admin -> Approvals.
 * Contract: features/admin-people-pipeline
 *
 * This used to be the decision desk itself — one of three places a brand or influencer
 * could be approved, rejected, or suspended, and the three didn't always agree (a real
 * bug: a suspended brand had no button, anywhere, that put it back to approved).
 *
 * It is now a lightweight cross-entity summary: pending counts, and two cards that
 * deep-link into the two Pending Verification tabs, which are now the ONLY places
 * those decisions get made. This page takes no action itself.
 */

function CountTile({ label, value, color = 'navy' }) {
  const colors = { navy: 'text-navy', teal: 'text-teal', orange: 'text-orange', gold: 'text-yellow-600', t1: 'text-t1' };
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-3xl font-extrabold ${colors[color] || 'text-t1'}`}>{value}</div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await adminApi.getStats();
      setLoading(false);
      if (res.success) setStats(res.data || null);
    })();
  }, []);

  const brandsPending = stats?.pending_approvals?.brands || 0;
  const influencersPending = stats?.pending_verifications || 0;
  const invitationsPending = stats?.pending_invitations || 0;
  const productsPending = stats?.pending_products || 0;   // product-approval-switch
  const totalPending = brandsPending + influencersPending + productsPending;

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Approvals</h1>
        <p className="text-xs text-t3 mt-0.5 max-w-xl">
          Everything waiting on a decision right now, across both people pipelines, in one
          glance. Decisions happen on the Pending Verification tabs — this page only counts
          and routes there.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-t3 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <CountTile label="Total pending" value={totalPending} color="t1" />
            <CountTile label="Brands" value={brandsPending} color="navy" />
            <CountTile label="Influencers" value={influencersPending} color="orange" />
            <CountTile label="Products" value={productsPending} color="teal" />
            <CountTile label="Invitations" value={invitationsPending} color="gold" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* product-approval-switch: products waiting for INFLX while the switch is on */}
            <div className="bg-white rounded-xl border border-border p-5 md:col-span-2" data-testid="products-pending-card">
              <div className="flex items-center justify-between mb-2">
                <div className="font-display text-sm font-bold text-t1">Products waiting to go live</div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal text-white">{productsPending} waiting</span>
              </div>
              <p className="text-xs text-t3 mb-4">
                {productsPending > 0
                  ? `${productsPending} product${productsPending === 1 ? ' is' : 's are'} waiting for your approval before ${productsPending === 1 ? 'it is' : 'they are'} in the brand's store.`
                  : 'No products waiting. (Products wait only while Product approval is on in Settings → Platform.)'}
              </p>
              <a href="/admin/products" className="inline-block px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                Review in Product Queue →
              </a>
            </div>
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-display text-sm font-bold text-t1">Brands needing a decision</div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-pale text-yellow-700">{brandsPending} pending</span>
              </div>
              <p className="text-xs text-t3 mb-4">
                {brandsPending > 0
                  ? `${brandsPending} brand application${brandsPending === 1 ? ' is' : 's are'} waiting for a decision.`
                  : 'No brand applications waiting right now.'}
              </p>
              <a href="/admin/brands?tab=pending" className="inline-block px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                Review in Brands → Pending Verification →
              </a>
            </div>
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-display text-sm font-bold text-t1">Influencers needing a decision</div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange text-white">{influencersPending} pending</span>
              </div>
              <p className="text-xs text-t3 mb-4">
                {influencersPending > 0
                  ? `${influencersPending} creator profile${influencersPending === 1 ? ' is' : 's are'} waiting for identity verification.`
                  : 'No creator profiles waiting right now.'}
              </p>
              <a href="/admin/influencers?tab=pending" className="inline-block px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                Review in Influencers → Pending Verification →
              </a>
            </div>
          </div>

          <div className="mt-5 bg-surface2 border border-border2/60 rounded-xl p-4">
            <p className="text-[11px] text-t3 leading-relaxed">
              <span className="font-bold text-t2">No approve / reject buttons live on this page.</span>{' '}
              That's deliberate — before this change, a brand or influencer could be approved
              from three different screens that didn't always agree (one already caused a real
              bug: a suspended brand had no way back to approved). Now there is exactly one
              decision desk per entity type, and this page only tells you it's time to go there.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
