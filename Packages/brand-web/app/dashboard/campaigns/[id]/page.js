'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { campaignApi, fmtRupees } from '../../../../lib/api';

/* ─── Helpers (locked palette) ───────────────────────────────────────────── */

const STATUS_BADGE = {
  draft:          { bg: 'bg-[#F4F4F5]', text: 'text-[#52525B]', dot: 'bg-[#A1A1AA]', label: 'Draft' },
  pending_wallet: { bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]', dot: 'bg-[#E0A800]', label: 'Pending wallet' },
  published:      { bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]', dot: 'bg-[#E0A800]', label: 'Published' },
  active:         { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', dot: 'bg-[#10B981]', label: 'Active' },
  live:           { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', dot: 'bg-[#10B981]', label: 'Live' },
  completed:      { bg: 'bg-[#F4F4F5]', text: 'text-[#1F1F22]', dot: 'bg-[#71717A]', label: 'Completed' },
  cancelled:      { bg: 'bg-[#FDEEE9]', text: 'text-[#B91C1C]', dot: 'bg-[#E8401A]', label: 'Cancelled' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.3px] whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── Drill-down tile ────────────────────────────────────────────────────── */

function DrillTile({ href, icon, iconDark, label, value, sub }) {
  return (
    <Link
      href={href}
      className="bg-white border border-[#E4E4E7] rounded-[16px] p-[18px] hover:border-[#0A0A0A] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-14px_rgba(0,0,0,0.08)] transition-all flex flex-col gap-1.5 cursor-pointer no-underline"
    >
      <div className="flex justify-between items-center mb-1">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-extrabold text-base ${iconDark ? 'bg-[#0A0A0A] text-[#FFC107]' : 'bg-[#FFC107] text-[#0A0A0A]'}`}>
          {icon}
        </div>
        <span className="font-mono font-bold text-[#A1A1AA] text-lg">→</span>
      </div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#71717A] mt-1">{label}</div>
      <div className="font-mono font-bold text-2xl text-[#0A0A0A] -tracking-[0.4px] leading-[1.1]">{value}</div>
      <div className="text-xs text-[#52525B]">{sub}</div>
    </Link>
  );
}

/* ─── Action queue row ────────────────────────────────────────────────────── */

function ActionRow({ href, tone, icon, title, meta }) {
  const isDanger = tone === 'danger';
  return (
    <Link
      href={href}
      className="flex items-start gap-3 py-3 border-t border-[#E4E4E7] first:border-t-0 first:pt-0 group hover:bg-[#FAFAFA] -mx-3 px-3 rounded-lg transition-colors no-underline"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDanger ? 'bg-[#FDEEE9]' : 'bg-[#FFF7CC]'}`}>
        <span className={`font-display font-extrabold text-sm ${isDanger ? 'text-[#E8401A]' : 'text-[#0A0A0A]'}`}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-[12.5px] text-[#0A0A0A] mb-0.5 group-hover:text-[#E0A800] transition-colors">{title}</div>
        <div className="text-[11px] text-[#71717A]">{meta}</div>
      </div>
    </Link>
  );
}

/* ─── Campaign Detail Page (HUB) ──────────────────────────────────────────── */

export default function CampaignDetailHubPage() {
  const { id } = useParams();
  const router = useRouter();

  const [campaign, setCampaign]     = useState(null);
  const [escrow, setEscrow]         = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [conversions, setConversions] = useState(null);
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [briefOpen, setBriefOpen]   = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      campaignApi.get(id),
      campaignApi.get(`${id}/escrow`).catch(() => ({ success: false })),
      campaignApi.getEngagement(id).catch(() => ({ success: false })),
      campaignApi.getConversions(id).catch(() => ({ success: false })),
      campaignApi.get(`${id}/products`).catch(() => ({ success: false })),
    ]).then(([campRes, escRes, engRes, convRes, prodRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (campRes.success) setCampaign(campRes.data?.campaign || campRes.data);
      else setError(campRes.error?.message || 'Failed to load campaign');
      if (escRes?.success)  setEscrow(escRes.data);
      if (engRes?.success)  setEngagement(engRes.data);
      if (convRes?.success) setConversions(convRes.data);
      if (prodRes?.success) setProductsData(prodRes.data);
    }).catch(err => {
      if (cancelled) return;
      setLoading(false);
      setError(err.message || 'Network error');
    });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center text-[#71717A] font-body">
        Loading campaign…
      </div>
    );
  }
  if (error || !campaign) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center">
        <div className="font-display text-lg font-bold text-[#0A0A0A] mb-2">{error || 'Campaign not found'}</div>
        <button onClick={() => router.back()} className="px-4 py-2 bg-[#F4F4F5] text-[#0A0A0A] rounded-[10px] font-semibold text-sm">← Back</button>
      </div>
    );
  }

  const sets = campaign.sets || [];
  const allInfluencers = sets.flatMap(s => (s.influencers || []).map(ci => ({ ...ci, set_name: s.name, set_goal: s.goal, set_mode: s.influencer_mode })));
  const totalInf       = allInfluencers.length;
  const activeInf      = allInfluencers.filter(ci => ['active','live'].includes(ci.status)).length;
  const negotiatingInf = allInfluencers.filter(ci => ci.status === 'negotiating').length;
  const appliedInf     = allInfluencers.filter(ci => ci.status === 'applied').length;
  const openCallSets   = sets.filter(s => s.influencer_mode === 'open_group').length;
  const handpickSets   = sets.length - openCallSets;

  let totalDel = 0, doneDel = 0, reviewQueue = 0, liveConfirmQueue = 0;
  for (const ci of allInfluencers) {
    const dc = ci.deliverable_counts || {};
    totalDel += dc.total || 0;
    doneDel  += (dc.live || 0) + (dc.approved || 0);
    for (const d of (ci.deliverables || [])) {
      if (d.status === 'submitted' || d.status === 'under_review') reviewQueue++;
      if (d.status === 'approved' && d.live_url) liveConfirmQueue++;
    }
  }
  const progressPct = totalDel > 0 ? Math.round((doneDel / totalDel) * 100) : 0;

  const applicationsCount = sets
    .filter(s => s.influencer_mode === 'open_group')
    .flatMap(s => s.influencers || [])
    .filter(ci => ci.status === 'applied').length;

  const totalBudget     = Number(campaign.total_budget) || 0;
  const allocatedBudget = allInfluencers.reduce((sum, ci) => sum + (Number(ci.agreed_fee) || 0), 0);
  const budgetPct       = totalBudget > 0 ? Math.round((allocatedBudget / totalBudget) * 100) : 0;

  const setGoals      = sets.map(s => (s.goal || '').toLowerCase()).filter(Boolean);
  const hasFeeBearing = setGoals.some(g => g === 'engagement' || g === 'hybrid');
  const hasConversion = setGoals.some(g => g === 'conversion' || g === 'hybrid');

  const engagementTotals = engagement?.totals || {};
  const totalLikes    = engagementTotals.total_likes;
  const totalComments = engagementTotals.total_comments;
  const totalViews    = engagementTotals.total_views;
  const avgER         = engagementTotals.avg_er;

  const escrowEntries = escrow?.entries || escrow?.escrow_entries || [];
  const escrowLocked   = escrowEntries.filter(e => e.status === 'locked').reduce((s, e) => s + Number(e.amount || 0), 0);
  const escrowReleased = escrowEntries.filter(e => e.status === 'released').reduce((s, e) => s + Number(e.amount || 0), 0);
  const t2Locked       = escrowEntries.filter(e => e.tranche_number === 2 && e.status === 'locked').reduce((s, e) => s + Number(e.amount || 0), 0);

  const convSummary = conversions?.summary || {};
  const convCount   = conversions?.total_transactions ?? convSummary.total_transactions ?? 0;
  const convRevenue = conversions?.total_revenue      ?? convSummary.total_revenue      ?? 0;
  const convCommission = conversions?.total_commission ?? convSummary.total_commission ?? 0;

  const productsList   = productsData?.products || [];
  const publishedCount = productsList.filter(p => p.publish_status === 'published').length;
  const totalProducts  = productsList.length;

  const actionItems = [];
  if (applicationsCount > 0) actionItems.push({
    key: 'apps', tone: 'pending', icon: '!',
    title: `${applicationsCount} application${applicationsCount !== 1 ? 's' : ''} waiting`,
    meta: 'Open-call applicants to review',
    href: `/dashboard/campaigns/${id}/influencers?status=applied`,
  });
  if (reviewQueue > 0) actionItems.push({
    key: 'reviews', tone: 'pending', icon: '⌕',
    title: `${reviewQueue} deliverable${reviewQueue !== 1 ? 's' : ''} to review`,
    meta: 'Approve or request revision',
    href: `/dashboard/campaigns/${id}/reviews?tab=reviews`,
  });
  if (liveConfirmQueue > 0) actionItems.push({
    key: 'live', tone: 'danger', icon: '▶',
    title: `${liveConfirmQueue} live URL${liveConfirmQueue !== 1 ? 's' : ''} to confirm`,
    meta: t2Locked > 0 ? `Releases up to ${fmtRupees(t2Locked)} Tranche-2` : 'Releases Tranche-2 once all confirmed',
    href: `/dashboard/campaigns/${id}/reviews?tab=live`,
  });

  return (
    <div className="max-w-6xl font-body">
      {/* Breadcrumb */}
      <div className="font-mono text-[11px] font-medium text-[#71717A] uppercase tracking-[0.3px] mb-1.5">
        <Link href="/dashboard" className="text-[#71717A] hover:text-[#0A0A0A] no-underline">/dashboard</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <Link href="/dashboard/campaigns" className="text-[#71717A] hover:text-[#0A0A0A] no-underline">campaigns</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <span className="text-[#0A0A0A] font-bold">{(campaign.id || '').slice(0, 8)}</span>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-2">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#0A0A0A] -tracking-[0.6px]">{campaign.name}</h1>
          <div className="w-11 h-1 bg-[#FFC107] rounded-full mt-1.5 mb-2.5"></div>
          <div className="text-[12.5px] text-[#52525B]">
            <span className="font-mono font-semibold text-[#0A0A0A]">{formatDate(campaign.start_date)} → {formatDate(campaign.end_date)}</span>
            <span className="text-[#D4D4D8] mx-2">·</span>
            <span className="font-mono font-semibold text-[#0A0A0A]">{sets.length}</span> set{sets.length !== 1 ? 's' : ''}
            <span className="text-[#D4D4D8] mx-2">·</span>
            <span className="font-mono font-semibold text-[#0A0A0A]">{totalInf}</span> influencer{totalInf !== 1 ? 's' : ''}
            {totalDel > 0 && (<>
              <span className="text-[#D4D4D8] mx-2">·</span>
              <span className="font-mono font-semibold text-[#0A0A0A]">{totalDel}</span> deliverable{totalDel !== 1 ? 's' : ''}
            </>)}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StatusBadge status={campaign.status} />
        </div>
      </div>

      {/* Hub grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 mt-6">
        <div>
          {/* Summary card */}
          <section className="bg-gradient-to-br from-[#FFFDEB] to-[#FFF7CC] border border-[#FFC107]/30 rounded-[20px] p-6 relative overflow-hidden mb-5">
            <div className="absolute -top-12 -right-12 w-44 h-44 bg-[#FFC107] rounded-full opacity-[0.22]"></div>
            <div className="absolute -top-5 right-12 w-20 h-20 bg-[#FFC107] rounded-full opacity-[0.14]"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-end gap-6 mb-4">
                <div>
                  <div className="text-[11.5px] font-extrabold text-[#6B5A00] uppercase tracking-[0.6px] mb-0.5">Campaign progress</div>
                  <div className="font-mono font-bold text-[48px] text-[#0A0A0A] -tracking-[1.2px] leading-none">
                    {progressPct}<span className="text-[28px] text-[#71717A]">%</span>
                  </div>
                </div>
                <div className="text-[13px] text-[#52525B] text-right">
                  {totalDel > 0 ? (
                    <>
                      <span className="font-mono font-semibold text-[#0A0A0A]">{doneDel}</span> of{' '}
                      <span className="font-mono font-semibold text-[#0A0A0A]">{totalDel}</span> deliverables<br />
                      live or approved
                    </>
                  ) : 'No deliverables yet'}
                </div>
              </div>
              <div className="h-2 bg-black/10 rounded-full overflow-hidden mb-5">
                <div className="h-full bg-[#0A0A0A] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="px-1">
                  <div className="text-[10.5px] font-bold text-[#52525B] uppercase tracking-[0.4px] mb-1">Budget</div>
                  <div className="font-mono font-bold text-[22px] text-[#0A0A0A] -tracking-[0.4px]">{totalBudget > 0 ? `${budgetPct}%` : '—'}</div>
                  <div className="text-[11.5px] text-[#71717A] mt-0.5">
                    {totalBudget > 0 ? `${fmtRupees(allocatedBudget)} / ${fmtRupees(totalBudget)}` : 'No budget set'}
                  </div>
                </div>
                <div className="pl-4 border-l border-black/10">
                  <div className="text-[10.5px] font-bold text-[#52525B] uppercase tracking-[0.4px] mb-1">Active</div>
                  <div className="font-mono font-bold text-[22px] text-[#0A0A0A] -tracking-[0.4px]">{activeInf} / {totalInf}</div>
                  <div className="text-[11.5px] text-[#71717A] mt-0.5">influencers</div>
                </div>
                <div className="pl-4 border-l border-black/10">
                  <div className="text-[10.5px] font-bold text-[#52525B] uppercase tracking-[0.4px] mb-1">Reach</div>
                  <div className="font-mono font-bold text-[22px] text-[#0A0A0A] -tracking-[0.4px]">
                    {totalLikes != null
                      ? (totalLikes >= 100000 ? `${(totalLikes / 100000).toFixed(1)}L` : Number(totalLikes).toLocaleString('en-IN'))
                      : '—'}
                  </div>
                  <div className="text-[11.5px] text-[#71717A] mt-0.5">total likes</div>
                </div>
                <div className="pl-4 border-l border-black/10">
                  <div className="text-[10.5px] font-bold text-[#52525B] uppercase tracking-[0.4px] mb-1">Avg ER</div>
                  <div className="font-mono font-bold text-[22px] text-[#0A0A0A] -tracking-[0.4px]">{avgER != null ? `${Number(avgER).toFixed(1)}%` : '—'}</div>
                  <div className="text-[11.5px] text-[#71717A] mt-0.5">engagement rate</div>
                </div>
              </div>
            </div>
          </section>

          {/* Drill-down section header */}
          <div className="flex items-center gap-2.5 mb-3.5 mt-2">
            <span className="inline-flex items-center gap-2.5 bg-[#FFC107] pl-1.5 pr-3.5 py-1 rounded-full">
              <span className="w-[26px] h-[26px] rounded-full bg-[#0A0A0A] text-[#FFC107] flex items-center justify-center font-display font-extrabold text-xs">◫</span>
              <span className="font-display font-bold text-[11.5px] text-[#0A0A0A] uppercase tracking-[0.5px]">Explore</span>
            </span>
            <span className="text-xs text-[#71717A] ml-auto">Tap a tile to drill in</span>
          </div>

          {/* Tile grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 mb-6">
            <DrillTile
              href={`/dashboard/campaigns/${id}/sets`}
              icon="⊟"
              label="Sets"
              value={sets.length}
              sub={<>{openCallSets > 0 && <><span className="font-mono font-semibold text-[#0A0A0A]">{openCallSets}</span> open call · </>}<span className="font-mono font-semibold text-[#0A0A0A]">{handpickSets}</span> handpick</>}
            />
            <DrillTile
              href={`/dashboard/campaigns/${id}/influencers`}
              icon="★"
              label="Influencers"
              value={totalInf}
              sub={<>
                <span className="font-mono font-semibold text-[#0A0A0A]">{activeInf}</span> active
                {negotiatingInf > 0 && <> · <span className="font-mono font-semibold text-[#0A0A0A]">{negotiatingInf}</span> negotiating</>}
                {appliedInf > 0 && <> · <span className="font-mono font-semibold text-[#0A0A0A]">{appliedInf}</span> applied</>}
              </>}
            />
            <DrillTile
              href={`/dashboard/campaigns/${id}/reviews`}
              icon="▶"
              label="Content"
              value={totalDel > 0 ? `${doneDel} / ${totalDel}` : '0'}
              sub={<>live{(reviewQueue + liveConfirmQueue) > 0 && <> · <span className="font-mono font-semibold text-[#0A0A0A]">{reviewQueue + liveConfirmQueue}</span> in queue</>}</>}
            />
            {hasFeeBearing && escrowEntries.length > 0 && (
              <DrillTile
                href={`/dashboard/campaigns/${id}/escrow`}
                icon="₹"
                iconDark
                label="Escrow"
                value={fmtRupees(escrowReleased)}
                sub={<>released · <span className="font-mono font-semibold text-[#0A0A0A]">{fmtRupees(escrowLocked)}</span> locked</>}
              />
            )}
            {hasConversion && (convCount > 0 || convRevenue > 0) && (
              <DrillTile
                href={`/dashboard/conversions?campaign=${id}`}
                icon="⊞"
                iconDark
                label="Conversions"
                value={Number(convCount).toLocaleString('en-IN')}
                sub={<><span className="font-mono font-semibold text-[#0A0A0A]">{fmtRupees(convRevenue)}</span> revenue · <span className="font-mono font-semibold text-[#0A0A0A]">{fmtRupees(convCommission)}</span> comm</>}
              />
            )}
            {hasConversion && totalProducts > 0 && (
              <DrillTile
                href={`/dashboard/campaigns/${id}/influencers`}
                icon="▤"
                label="Publishing"
                value={`${publishedCount} / ${totalProducts}`}
                sub={<>products live{productsData?.is_brand_level_offer && <> · brand-level offer</>}</>}
              />
            )}
          </div>

          {/* Inline analytics */}
          {(totalLikes != null || avgER != null) && (
            <section className="bg-white border border-[#E4E4E7] rounded-[16px] p-[18px] mb-5">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="inline-flex items-center gap-2.5 bg-[#FFC107] pl-1.5 pr-3.5 py-1 rounded-full">
                  <span className="w-[26px] h-[26px] rounded-full bg-[#0A0A0A] text-[#FFC107] flex items-center justify-center font-display font-extrabold text-xs">∼</span>
                  <span className="font-display font-bold text-[11.5px] text-[#0A0A0A] uppercase tracking-[0.5px]">Analytics</span>
                </span>
                <span className="text-xs text-[#71717A] ml-auto">From <span className="font-mono font-semibold text-[#0A0A0A]">{doneDel}</span> live deliverable{doneDel !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
                <div className="bg-[#FFF7CC] rounded-[10px] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#6B5A00] mb-1">Likes</div>
                  <div className="font-mono font-bold text-xl text-[#6B5A00] -tracking-[0.3px]">{totalLikes != null ? Number(totalLikes).toLocaleString('en-IN') : '—'}</div>
                </div>
                <div className="bg-[#D1FAE5] rounded-[10px] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#047857] mb-1">Comments</div>
                  <div className="font-mono font-bold text-xl text-[#047857] -tracking-[0.3px]">{totalComments != null ? Number(totalComments).toLocaleString('en-IN') : '—'}</div>
                </div>
                <div className="bg-[#F4F4F5] rounded-[10px] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#1F1F22] mb-1">Views</div>
                  <div className="font-mono font-bold text-xl text-[#1F1F22] -tracking-[0.3px]">{totalViews != null && totalViews > 0 ? Number(totalViews).toLocaleString('en-IN') : '—'}</div>
                </div>
                <div className="bg-[#FFFDEB] rounded-[10px] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#6B5A00] mb-1">Avg ER</div>
                  <div className="font-mono font-bold text-xl text-[#6B5A00] -tracking-[0.3px]">{avgER != null ? `${Number(avgER).toFixed(1)}%` : '—'}</div>
                </div>
              </div>
              <div className="mt-3.5 text-[11px] text-[#71717A]">
                Reach &amp; saves not shown — they need the influencer&apos;s Instagram Business API to be connected.
              </div>
            </section>
          )}

          {/* Brief */}
          {campaign.brief && (
            <button
              type="button"
              onClick={() => setBriefOpen(o => !o)}
              className="block w-full text-left bg-white border border-[#E4E4E7] rounded-[14px] p-[18px] hover:border-[#D4D4D8] transition-colors"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 font-display font-bold text-[13.5px] text-[#0A0A0A]">
                  <span className="w-[3px] h-3.5 bg-[#FFC107] rounded-sm"></span>
                  Campaign brief
                </div>
                <span className="font-mono font-bold text-[#71717A] text-lg">{briefOpen ? '∧' : '∨'}</span>
              </div>
              {briefOpen && (
                <div className="mt-3 pt-3 border-t border-[#E4E4E7] text-[13px] text-[#1F1F22] leading-relaxed">
                  {campaign.brief}
                </div>
              )}
            </button>
          )}
        </div>

        {/* Right rail */}
        <aside className="flex flex-col gap-3.5 lg:sticky lg:top-20 self-start">
          {actionItems.length > 0 && (
            <div className="bg-white border border-[#E4E4E7] rounded-[16px] p-[18px]">
              <h3 className="font-display font-bold text-[13px] text-[#0A0A0A] flex items-center gap-2.5 mb-2">
                Needs your attention
                <span className="ml-auto bg-[#0A0A0A] text-[#FFC107] font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-full">{actionItems.length}</span>
              </h3>
              <div className="text-[11.5px] text-[#52525B] mb-3">Items waiting on a brand action.</div>
              {actionItems.map(a => (
                <ActionRow key={a.key} href={a.href} tone={a.tone} icon={a.icon} title={a.title} meta={a.meta} />
              ))}
            </div>
          )}
          <div className="bg-white border border-[#E4E4E7] rounded-[16px] p-[18px]">
            <h3 className="font-display font-bold text-[13px] text-[#0A0A0A] mb-2">Web-only tools</h3>
            <div className="text-[11.5px] text-[#52525B]">
              Contract signing · negotiation chat · production scheduling are inline modals from the{' '}
              <Link href={`/dashboard/campaigns/${id}/influencers`} className="text-[#0A0A0A] font-semibold border-b border-dotted border-[#A1A1AA] no-underline">Influencers list</Link>.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
