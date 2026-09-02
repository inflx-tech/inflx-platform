'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { campaignApi, deliverableApi, contractApi, fmtRupees } from '../../../../lib/api';
import { StageRail, PrimeBar, deriveCampaignStage } from './CommandRail';
import { MediaPreview } from './reviewParts';
import { contractLockAmount } from '../../../../lib/contracts';
import PayoutSection from './PayoutSection';
import ProductionSection from './ProductionSection';

/* ════════════════════════════════════════════════════════════════════════════
   Campaign Command Center — full-width hierarchy view.
   Contract: features/redesign-campaign-command-center (mockup locked
   2026-06-11, walkthrough W5a–W5e). Campaign → sets → influencers →
   deliverables + products, analytics at every level, review states visible,
   refresh restored (campaign-wide + per-deliverable).
   ══════════════════════════════════════════════════════════════════════════ */

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

/* Deliverable-state pills (the honest set: every state visible) */
const DEL_PILL = {
  live:               { cls: 'bg-[#D1FAE5] text-[#047857]',  label: 'LIVE' },
  submitted:          { cls: 'bg-[#FFF7CC] text-[#6B5A00]',  label: 'SUBMITTED' },
  under_review:       { cls: 'bg-[#FFF7CC] text-[#6B5A00]',  label: 'UNDER REVIEW' },
  approved:           { cls: 'bg-[#DBEAFE] text-[#1D4ED8]',  label: 'APPROVED' },
  approved_live:      { cls: 'bg-[#DBEAFE] text-[#1D4ED8]',  label: 'AWAITING LIVE-CONFIRM' },
  revision_requested: { cls: 'bg-[#FDEEE9] text-[#B91C1C]',  label: 'REVISION REQUESTED' },
  pending:            { cls: 'bg-[#F4F4F5] text-[#52525B]',  label: 'PENDING' },
};

function delPill(d) {
  if (d.status === 'approved' && d.live_url) return DEL_PILL.approved_live;
  return DEL_PILL[d.status] || DEL_PILL.pending;
}

const GOAL_TAG = {
  conversion: 'bg-[#F3E8FF] text-[#7E22CE]',
  engagement: 'bg-[#CFFAFE] text-[#0E7490]',
  hybrid:     'bg-[#FFF7CC] text-[#6B5A00]',
};

const DEL_ICON = { reel: '🎬', post: '🖼', story: '📖', youtube_video: '▶️', youtube_short: '▶️' };

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
const nf = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));

/* Wallet lock = (fee + bonus) × (1 + platform_fee_pct/100) — now single-sourced in
   lib/contracts (A3), shared with the campaigns-list strip + influencers modal. */

function MiniStat({ v, k }) {
  return (
    <div className="text-right min-w-[52px]">
      <div className="font-mono font-bold text-[13.5px] text-[#0A0A0A] leading-tight">{v}</div>
      <div className="text-[9px] font-bold tracking-[0.4px] text-[#A1A1AA]">{k}</div>
    </div>
  );
}

/* Sales ministat — purple accent to distinguish conversions from engagement */
function SalesStat({ v, k }) {
  return (
    <div className="text-right min-w-[52px]">
      <div className="font-mono font-bold text-[13.5px] text-[#7E22CE] leading-tight">{v}</div>
      <div className="text-[9px] font-bold tracking-[0.4px] text-[#A1A1AA]">{k}</div>
    </div>
  );
}

/* ─── Inline media preview (signed R2 URL → <img>/<video>), copied from
   reviews/page.js so content can be reviewed without leaving this page. ── */
/* MediaPreview moved to ./reviewParts (A2 — shared, was duplicated with /reviews). */

/* Per-creator stage tracker — Allocated → Approval → Contract → Content → Live.
   Derived purely from existing ci.status + deliverable statuses. */
const STAGE_LABELS = ['Allocated', 'Approval', 'Contract', 'Content', 'Live'];
function ciStageIndex(ci) {
  const dels = ci.deliverables || [];
  const anyLive = dels.some(d => d.status === 'live');
  const anyContent = dels.some(d => ['submitted', 'under_review', 'approved', 'revision_requested', 'live'].includes(d.status));
  if (anyLive) return 4;
  if (anyContent) return 3;
  if (['contracted', 'active', 'live'].includes(ci.status)) return 2;
  if (['accepted', 'negotiating'].includes(ci.status)) return 1;
  if (ci.status === 'completed') return 4;
  return 0; // invited / applied / declined / default
}
function StageTracker({ ci }) {
  const cur = ciStageIndex(ci);
  return (
    <div className="flex items-center gap-1.5 ml-[46px] mb-2.5">
      {STAGE_LABELS.map((label, i) => {
        const done = i < cur;
        const here = i === cur;
        return (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1 text-[9.5px] font-extrabold rounded-[7px] px-2 py-1 tracking-[0.3px] ${
              here ? 'bg-[#FFC107] text-[#0A0A0A]' : done ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#F4F4F5] text-[#A1A1AA]'}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: here ? '#0A0A0A' : done ? '#10B981' : '#D4D4D8' }} />
              {label}
            </span>
            {i < STAGE_LABELS.length - 1 && <span className={`text-[10px] ${done ? 'text-[#10B981]' : 'text-[#D4D4D8]'}`}>→</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ════ Page ════ */

export default function CampaignCommandCenterPage() {
  const { id } = useParams();
  const router = useRouter();

  const [campaign, setCampaign]       = useState(null);
  const [escrow, setEscrow]           = useState(null);
  const [engagement, setEngagement]   = useState(null);
  const [conversions, setConversions] = useState(null);
  const [productsData, setProductsData] = useState(null);
  const [clicksData, setClicksData]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [tab, setTab]                 = useState('hier');
  const [pendingContracts, setPendingContracts] = useState([]); // this campaign's contracts awaiting brand signature
  const [signingId, setSigningId]     = useState(null);
  const [openSets, setOpenSets]       = useState({});
  const [openInfs, setOpenInfs]       = useState({});
  const [briefOpen, setBriefOpen]     = useState(false);
  const [refreshingAll, setRefreshingAll] = useState('');
  const [refreshingOne, setRefreshingOne] = useState(null);
  const [toast, setToast]             = useState('');
  const [busyId, setBusyId]           = useState(null);
  const [openContent, setOpenContent] = useState({});

  const loadAll = useCallback((cancelledRef) => {
    return Promise.all([
      campaignApi.get(id),
      campaignApi.get(`${id}/escrow`).catch(() => ({ success: false })),
      campaignApi.getEngagement(id).catch(() => ({ success: false })),
      campaignApi.getConversions(id).catch(() => ({ success: false })),
      campaignApi.get(`${id}/products`).catch(() => ({ success: false })),
      campaignApi.getClicks(id).catch(() => ({ success: false })),
      // Contracts awaiting brand signature (all pending across brand); we filter
      // to THIS campaign below. Active/completed contracts are derived from the
      // per-creator ci.status already present in the campaign payload.
      contractApi.listPending().catch(() => ({ success: false })),
    ]).then(([campRes, escRes, engRes, convRes, prodRes, clickRes, contractRes]) => {
      if (cancelledRef?.cancelled) return;
      setLoading(false);
      if (campRes.success) setCampaign(campRes.data?.campaign || campRes.data);
      else setError(campRes.error?.message || 'Failed to load campaign');
      if (escRes?.success)  setEscrow(escRes.data);
      if (engRes?.success)  setEngagement(engRes.data);
      if (convRes?.success) setConversions(convRes.data);
      if (prodRes?.success) setProductsData(prodRes.data);
      if (clickRes?.success) setClicksData(clickRes.data);
      if (contractRes?.success) {
        setPendingContracts((contractRes.data?.contracts || []).filter(c => String(c.campaign_id) === String(id)));
      }
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const ref = { cancelled: false };
    loadAll(ref).catch(err => { if (!ref.cancelled) { setLoading(false); setError(err.message || 'Network error'); } });
    return () => { ref.cancelled = true; };
  }, [id, loadAll]);

  // Deep-link support: /dashboard/campaigns/:id?tab=contracts opens the tab
  // directly (used by the campaigns-list signature strip).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URLSearchParams(window.location.search).get('tab');
    if (['hier', 'prod', 'contracts', 'production', 'ana', 'payout'].includes(t)) setTab(t);
  }, []);

  if (loading) {
    return <div className="py-16 text-center text-[#71717A] font-body">Loading campaign…</div>;
  }
  if (error || !campaign) {
    return (
      <div className="py-16 text-center">
        <div className="font-display text-lg font-bold text-[#0A0A0A] mb-2">{error || 'Campaign not found'}</div>
        <button onClick={() => router.back()} className="px-4 py-2 bg-[#F4F4F5] text-[#0A0A0A] rounded-[10px] font-semibold text-sm">← Back</button>
      </div>
    );
  }

  /* ── Derive the hierarchy + rollups ─────────────────────────────────────── */
  const sets = campaign.sets || [];
  const allInfluencers = sets.flatMap(s => (s.influencers || []).map(ci => ({ ...ci, set_id: s.id, set_name: s.name, set_goal: s.goal })));
  const totalInf  = allInfluencers.length;
  const activeInf = allInfluencers.filter(ci => ['active', 'live'].includes(ci.status)).length;

  let totalDel = 0, liveDel = 0, reviewQueue = 0, liveConfirmQueue = 0;
  for (const ci of allInfluencers) {
    const dc = ci.deliverable_counts || {};
    totalDel += dc.total || 0;
    for (const d of (ci.deliverables || [])) {
      if (d.status === 'live') liveDel++;
      if (d.status === 'submitted' || d.status === 'under_review') reviewQueue++;
      if (d.status === 'approved' && d.live_url) liveConfirmQueue++;
    }
  }

  const totalBudget     = Number(campaign.total_budget) || 0;
  const allocatedBudget = allInfluencers.reduce((sum, ci) => sum + (Number(ci.agreed_fee) || 0), 0);

  const totals = engagement?.totals || {};
  const bySet  = engagement?.by_set || [];
  const byInf  = engagement?.by_influencer || [];
  const engBySetId = Object.fromEntries(bySet.map(s => [s.set_id, s]));
  const engByInfId = Object.fromEntries(byInf.map(i => [i.influencer_id, i]));
  // engagement per-deliverable stats keyed by deliverable id
  const engByDelId = {};
  for (const inf of byInf) for (const d of (inf.deliverables || [])) engByDelId[d.id] = d;

  const escrowEntries  = escrow?.entries || escrow?.escrow_entries || [];
  const escrowLocked   = escrowEntries.filter(e => e.status === 'locked').reduce((s, e) => s + Number(e.amount || 0), 0);
  const escrowReleased = escrowEntries.filter(e => e.status === 'released').reduce((s, e) => s + Number(e.amount || 0), 0);

  const convSummary = conversions?.summary || {};
  const convTotals  = conversions?.totals || {};
  // backend shape (commission.service.getBrandConversions): totals.total_sales /
  // total_revenue / total_commission_paid; by_influencer[] keyed by influencer_id.
  const convCount      = conversions?.total_transactions ?? convSummary.total_transactions ?? convTotals.total_sales ?? 0;
  const convRevenue    = conversions?.total_revenue      ?? convSummary.total_revenue      ?? convTotals.total_revenue ?? 0;
  const convCommission = convTotals.total_commission_paid ?? 0;
  const hasConversions = (convCount > 0 || convRevenue > 0);

  // Per-influencer conversions, keyed by influencer_id (matches engByInfId key).
  const convByInf = Object.fromEntries((conversions?.by_influencer || []).map(c => [c.influencer_id, c]));
  // Per-set conversions computed CLIENT-SIDE (no by_set in payload): sum
  // by_influencer rows grouped by the set each influencer belongs to.
  const setIdByInfId = {};
  for (const s of sets) for (const ci of (s.influencers || [])) if (ci.influencer_id != null) setIdByInfId[ci.influencer_id] = s.id;
  const convBySetId = {};
  for (const c of (conversions?.by_influencer || [])) {
    const sid = setIdByInfId[c.influencer_id];
    if (sid == null) continue;
    if (!convBySetId[sid]) convBySetId[sid] = { sales_count: 0, revenue: 0, commission_paid: 0 };
    convBySetId[sid].sales_count    += Number(c.sales_count || 0);
    convBySetId[sid].revenue        += Number(c.revenue || 0);
    convBySetId[sid].commission_paid += Number(c.commission_paid || 0);
  }

  // Store-clicks rollup (Phase 2). Backend GROUP BYs link_clicks per influencer
  // and per set; key the same way the engagement maps do (influencer_id / set_id).
  const clicksByInfId  = Object.fromEntries((clicksData?.by_influencer || []).map(c => [c.influencer_id, Number(c.clicks) || 0]));
  const clicksBySetId  = Object.fromEntries((clicksData?.by_set || []).map(c => [c.set_id, Number(c.clicks) || 0]));
  const totalClicks    = Number(clicksData?.total_clicks) || 0;

  const productsList = productsData?.products || [];
  const isBrandLevelOffer = !!productsData?.is_brand_level_offer;
  // ci → set lookup so each product can show its set(s) without backend change
  const setByCiId = {};
  for (const s of sets) for (const ci of (s.influencers || [])) setByCiId[ci.id] = s.name;
  const productSetNames = (p) => {
    if (isBrandLevelOffer || !(p.assigned_to_influencers || []).length) return 'All sets';
    const names = [...new Set(p.assigned_to_influencers.map(a => setByCiId[a.campaign_influencer_id]).filter(Boolean))];
    return names.join(' · ') || '—';
  };
  const productsForCi = (ciId) =>
    isBrandLevelOffer ? productsList
      : productsList.filter(p => (p.assigned_to_influencers || []).some(a => a.campaign_influencer_id === ciId));

  // appliedCount feeds the Command Center stage derivation (A1); the old
  // actionItems banner it also drove was replaced by StageRail + PrimeBar.
  const appliedCount = allInfluencers.filter(ci => ci.status === 'applied').length;

  // default expansion: every set open; influencers with action states open
  const isSetOpen = (sid) => openSets[sid] !== undefined ? openSets[sid] : true;
  const isInfOpen = (ciid, hasAction) => openInfs[ciid] !== undefined ? openInfs[ciid] : hasAction;

  /* ── Refresh actions ────────────────────────────────────────────────────── */
  async function refreshDeliverable(delId) {
    setRefreshingOne(delId);
    const res = await deliverableApi.refreshStats(delId);
    if (res?.success) {
      const eng = await campaignApi.getEngagement(id);
      if (eng?.success) setEngagement(eng.data);
    } else {
      alert(res?.error?.message || 'Refresh failed');
    }
    setRefreshingOne(null);
  }

  async function refreshAllAnalytics() {
    const liveIds = [];
    for (const inf of byInf) for (const d of (inf.deliverables || [])) if (d.status === 'live') liveIds.push(d.id);
    if (liveIds.length === 0) {
      setRefreshingAll('refetching…');
      const eng = await campaignApi.getEngagement(id);
      if (eng?.success) setEngagement(eng.data);
      setRefreshingAll('');
      return;
    }
    for (let i = 0; i < liveIds.length; i++) {
      setRefreshingAll(`re-scraping ${i + 1}/${liveIds.length}…`);
      await deliverableApi.refreshStats(liveIds[i]).catch(() => null);
    }
    setRefreshingAll('updating totals…');
    const eng = await campaignApi.getEngagement(id);
    if (eng?.success) setEngagement(eng.data);
    setRefreshingAll('');
  }

  /* ── Inline content-review actions (no navigation away) ─────────────────── */
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function inlineReview(delId, action) {
    let feedback = null;
    if (action === 'request_revision') {
      feedback = window.prompt('What needs to change?');
      if (feedback == null) return;
      feedback = feedback.trim();
      if (!feedback) { alert('Feedback is required to request revision.'); return; }
    }
    setBusyId(delId);
    const res = await deliverableApi.review(delId, { action, feedback });
    if (res?.success) {
      showToast(action === 'approve' ? 'Content approved.' : 'Sent for revision.');
      await loadAll();
    } else {
      showToast(res?.error?.message || 'Action failed');
    }
    setBusyId(null);
  }

  async function inlineConfirmLive(delId) {
    setBusyId(delId);
    const res = await deliverableApi.confirmLive(delId);
    if (res?.success) {
      const amt = res.data?.t2_amount;
      showToast(amt ? `Live confirmed. Tranche-2 of ${fmtRupees(amt)} released.` : 'Live confirmed.');
      await loadAll();
    } else {
      showToast(res?.error?.message || 'Failed to confirm');
    }
    setBusyId(null);
  }

  /* ── Date-change request decision (Phase 3) ─────────────────────────────── */
  async function decideDateChange(ciId, requestId, action) {
    setBusyId(requestId);
    const res = await campaignApi.decideDateChange(ciId, requestId, action);
    if (res?.success) {
      showToast(action === 'approve' ? 'New posting dates approved.' : 'Date-change request declined.');
      await loadAll();
    } else {
      showToast(res?.error?.message || 'Action failed');
    }
    setBusyId(null);
  }

  /* ── Contract counter-sign (folded from the old Contracts tab) ──────────── */
  async function signContract(contractId) {
    setSigningId(contractId);
    const res = await contractApi.brandSign(contractId);
    if (res?.success) {
      showToast('Contract counter-signed — funds locked.');
      await loadAll();
    } else {
      showToast(res?.error?.message || 'Sign failed');
    }
    setSigningId(null);
  }

  // Per-creator contract rows for the Contracts tab. Pending-signature rows come
  // from the filtered listPending payload (matched by handle); active/completed
  // are derived from ci.status already in the campaign hierarchy.
  // Match pending contracts by campaign_influencer_id (the real key). The old
  // Instagram-handle string join was fragile — duplicate/renamed handles or a
  // missing handle silently mis-matched or lost the contract. Falls back to the
  // handle only if an older payload lacks the id.
  const pendingByCiId = {};
  const pendingByHandle = {};
  for (const c of pendingContracts) {
    if (c.campaign_influencer_id) pendingByCiId[String(c.campaign_influencer_id)] = c;
    const h = String(c.instagram_handle || '').replace(/^@/, '').toLowerCase();
    if (h) pendingByHandle[h] = c;
  }
  function contractStateFor(ci) {
    const handle = String(ci.instagram_handle || ci.handle || ci.influencer_name || ci.name || '').replace(/^@/, '').toLowerCase();
    const pending = pendingByCiId[String(ci.id)] || pendingByHandle[handle];
    if (pending) return { key: 'pending', label: 'Pending your signature', cls: 'bg-[#FFF7CC] text-[#6B5A00]', contractId: pending.id, lock: contractLockAmount(pending) };
    if (ci.status === 'completed') return { key: 'completed', label: 'Completed', cls: 'bg-[#F4F4F5] text-[#1F1F22]' };
    if (['contracted', 'active', 'live'].includes(ci.status)) return { key: 'live', label: 'Live', cls: 'bg-[#D1FAE5] text-[#047857]' };
    return { key: 'draft', label: 'Draft', cls: 'bg-[#F4F4F5] text-[#52525B]' };
  }
  const contractRows = allInfluencers.map(ci => ({ ci, state: contractStateFor(ci) }));
  const pendingCount = contractRows.filter(r => r.state.key === 'pending').length;

  // Fund & Publish (A1) — the previously-missing first action.
  async function handlePublish() {
    const res = await campaignApi.publish(id);
    if (res.success) {
      showToast('Campaign published.');
      loadAll({ cancelled: false });
    } else if (res.error?.code === 'WALLET_INSUFFICIENT') {
      showToast('Fund the wallet with the full campaign budget first.');
      router.push('/dashboard/wallet');
    } else {
      showToast(res.error?.message || 'Could not publish campaign.');
    }
  }
  // collab-part5 — End is the deliberate finish for a campaign that will never close by
  // itself. Because completing takes every participating creator's products out of follower
  // discovery, the consequence is spelled out before the brand confirms rather than
  // discovered afterwards by a creator whose link went quiet.
  const [ending, setEnding] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const canEnd = ['published', 'active', 'live'].includes(campaign.status);
  async function handleEnd() {
    setEnding(true);
    const res = await campaignApi.end(id);
    setEnding(false);
    setEndOpen(false);
    if (res.success) {
      showToast(`Campaign ended. ${res.data?.creators_notified ?? 0} creator(s) notified.`);
      loadAll({ cancelled: false });
    } else {
      // The server names the real reason — unreleased payment, or work awaiting review.
      showToast(res.error?.message || 'Could not end campaign.');
    }
  }

  const stageInfo = deriveCampaignStage(campaign.status, { id, appliedCount, pendingCount, reviewQueue, liveConfirmQueue });

  /* ════ Render ════ */
  return (
    <div className="font-body">
      {/* Breadcrumb + header */}
      <div className="font-mono text-[11px] font-medium text-[#71717A] uppercase tracking-[0.3px] mb-1.5">
        <Link href="/dashboard" className="text-[#71717A] hover:text-[#0A0A0A] no-underline">/dashboard</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <Link href="/dashboard/campaigns" className="text-[#71717A] hover:text-[#0A0A0A] no-underline">campaigns</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <span className="text-[#0A0A0A] font-bold">{(campaign.id || '').slice(0, 8)}</span>
      </div>
      <div className="flex items-end justify-between gap-5 flex-wrap mb-4">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#0A0A0A] -tracking-[0.6px]">{campaign.name}</h1>
          <div className="w-11 h-1 bg-[#FFC107] rounded-full mt-1.5 mb-2"></div>
          <div className="text-[12.5px] text-[#52525B]">
            {/* collab-part5 — no end date is an intentional state (a sales campaign runs
                until the brand ends it), so it reads "Ongoing" rather than an em-dash that
                looks like missing data. */}
            <span className="font-mono font-semibold text-[#0A0A0A]">
              {formatDate(campaign.start_date)} → {campaign.end_date ? formatDate(campaign.end_date) : 'Ongoing'}
            </span>
            <span className="text-[#D4D4D8] mx-2">·</span>
            <span className="font-mono font-semibold text-[#0A0A0A]">{sets.length}</span> set{sets.length !== 1 ? 's' : ''}
            <span className="text-[#D4D4D8] mx-2">·</span>
            <span className="font-mono font-semibold text-[#0A0A0A]">{totalInf}</span> influencer{totalInf !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StatusBadge status={campaign.status} />
          {canEnd && (
            <button
              onClick={() => setEndOpen(true)}
              className="bg-[#0A0A0A] text-[#FFC107] border-none rounded-[10px] px-3.5 py-2 text-[12px] font-extrabold cursor-pointer">
              End campaign
            </button>
          )}
        </div>
      </div>

      {endOpen && (
        <div className="fixed inset-0 bg-black/45 grid place-items-center z-50 p-4" onClick={() => setEndOpen(false)}>
          <div className="bg-white rounded-[14px] max-w-[440px] w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-[17px] font-bold text-[#0A0A0A]">End &ldquo;{campaign.name}&rdquo;?</h3>
            <p className="text-[12px] text-[#52525B] mt-1 mb-3">This closes the collaboration for everyone in it.</p>
            <div className="text-[12px] text-[#0A0A0A]">
              <div className="flex justify-between gap-3 py-1.5 border-b border-[#F4F4F5]">
                <span className="text-[#52525B]">{totalInf} creator{totalInf !== 1 ? 's' : ''}&apos; products</span>
                <span className="font-semibold text-right">leave the shopping app</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-[#F4F4F5]">
                <span className="text-[#52525B]">Their share links</span>
                <span className="font-semibold text-right">stop earning</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-[#F4F4F5]">
                <span className="text-[#52525B]">They are</span>
                <span className="font-semibold text-right">notified</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-[#F4F4F5]">
                <span className="text-[#52525B]">Commission already earned</span>
                <span className="font-semibold text-right">unaffected</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <span className="text-[#52525B]">Recorded as</span>
                <span className="font-semibold text-right">Completed, not cancelled</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleEnd} disabled={ending}
                className="flex-1 bg-[#FFC107] text-[#0A0A0A] border-none rounded-[10px] py-2.5 text-[12.5px] font-extrabold cursor-pointer disabled:opacity-60">
                {ending ? 'Ending…' : 'End campaign'}
              </button>
              <button onClick={() => setEndOpen(false)}
                className="bg-white border border-[#E4E4E7] text-[#0A0A0A] rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold cursor-pointer">
                Keep it running
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Command Center — stage rail + primary action bar (A1, features/brand-cc-shell).
          Replaces the ad-hoc needs-you banner; drives Fund & Publish + the next step. */}
      <StageRail current={stageInfo.stageKey} />
      <PrimeBar prime={stageInfo.prime} onPublish={handlePublish} onTab={setTab} />

      {/* Full-width header strip */}
      <div className="bg-white border border-[#E4E4E7] rounded-[14px] px-5 py-4 mb-4 flex items-center flex-wrap gap-y-3">
        <div className="flex-1 min-w-[150px] px-4 first:pl-0 border-r border-[#F4F4F5]">
          <div className="text-[10px] font-extrabold text-[#71717A] tracking-[0.5px]">CONTENT</div>
          <div className="font-mono font-bold text-[19px] text-[#0A0A0A] mt-0.5">
            {reviewQueue}<span className="text-[11px] text-[#71717A] font-semibold"> to review</span>
            {' · '}{liveConfirmQueue}<span className="text-[11px] text-[#71717A] font-semibold"> awaiting live</span>
            {' · '}{liveDel}<span className="text-[11px] text-[#71717A] font-semibold"> live</span>
          </div>
          <div className="text-[10px] text-[#A1A1AA] mt-0.5">{totalDel} deliverable{totalDel !== 1 ? 's' : ''} total</div>
        </div>
        <div className="flex-1 min-w-[120px] px-4 border-r border-[#F4F4F5]">
          <div className="text-[10px] font-extrabold text-[#71717A] tracking-[0.5px]">BUDGET</div>
          <div className="font-mono font-bold text-[19px] text-[#0A0A0A] mt-0.5">{totalBudget > 0 ? fmtRupees(allocatedBudget) : '—'}</div>
          <div className="text-[10px] text-[#A1A1AA] mt-0.5">{totalBudget > 0 ? `of ${fmtRupees(totalBudget)} allocated` : 'commission-only'}</div>
        </div>
        {escrowEntries.length > 0 && (
          <div className="flex-1 min-w-[130px] px-4 border-r border-[#F4F4F5]">
            <div className="text-[10px] font-extrabold text-[#71717A] tracking-[0.5px]">ESCROW</div>
            <div className="font-mono font-bold text-[19px] text-[#0A0A0A] mt-0.5">{fmtRupees(escrowReleased)}</div>
            <div className="text-[10px] text-[#A1A1AA] mt-0.5">released · {fmtRupees(escrowLocked)} locked · <button type="button" onClick={() => setTab('payout')} className="text-[#6B5A00] font-bold">detail ↗</button></div>
          </div>
        )}
        {(convCount > 0 || convRevenue > 0) && (
          <div className="flex-1 min-w-[130px] px-4 border-r border-[#F4F4F5]">
            <div className="text-[10px] font-extrabold text-[#71717A] tracking-[0.5px]">CONVERSIONS</div>
            <div className="font-mono font-bold text-[19px] text-[#0A0A0A] mt-0.5">{nf(convCount)}</div>
            <div className="text-[10px] text-[#A1A1AA] mt-0.5">{fmtRupees(convRevenue)} revenue · <Link href={`/dashboard/conversions?campaign=${id}`} className="text-[#6B5A00] font-bold no-underline">detail ↗</Link></div>
          </div>
        )}
        {totalClicks > 0 && (
          <div className="flex-1 min-w-[110px] px-4 border-r border-[#F4F4F5]">
            <div className="text-[10px] font-extrabold text-[#71717A] tracking-[0.5px]">STORE CLICKS</div>
            <div className="font-mono font-bold text-[19px] text-[#0A0A0A] mt-0.5">{nf(totalClicks)}</div>
            <div className="text-[10px] text-[#A1A1AA] mt-0.5">from creator share links</div>
          </div>
        )}
        <div className="flex-1 min-w-[100px] px-4 border-r border-[#F4F4F5]">
          <div className="text-[10px] font-extrabold text-[#71717A] tracking-[0.5px]">LIKES</div>
          <div className="font-mono font-bold text-[19px] text-[#0A0A0A] mt-0.5">{nf(totals.total_likes)}</div>
          <div className="text-[10px] text-[#A1A1AA] mt-0.5">{activeInf}/{totalInf} influencers active</div>
        </div>
        <div className="flex-1 min-w-[90px] px-4">
          <div className="text-[10px] font-extrabold text-[#71717A] tracking-[0.5px]">AVG ER</div>
          <div className="font-mono font-bold text-[19px] text-[#0A0A0A] mt-0.5">{totals.avg_er != null ? `${Number(totals.avg_er).toFixed(1)}%` : '—'}</div>
          <div className="text-[10px] text-[#A1A1AA] mt-0.5">from {liveDel} live post{liveDel !== 1 ? 's' : ''}</div>
        </div>
        <div className="pl-4">
          <button
            onClick={refreshAllAnalytics}
            disabled={!!refreshingAll}
            className={`bg-[#FFC107] rounded-[10px] px-4 py-2.5 text-[12px] font-extrabold text-[#0A0A0A] whitespace-nowrap ${refreshingAll ? 'opacity-60' : 'hover:bg-[#E0A800]'}`}
          >
            {refreshingAll ? `↻ ${refreshingAll}` : '↻ Refresh analytics'}
          </button>
          <div className="text-[9.5px] text-[#A1A1AA] mt-1 text-center">re-scrapes every live post</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { k: 'hier', label: 'Hierarchy' },
          ...(productsList.length > 0 ? [{ k: 'prod', label: 'Products', n: productsList.length }] : []),
          { k: 'contracts', label: 'Contracts', n: pendingCount > 0 ? pendingCount : undefined },
          { k: 'production', label: 'Production' },
          { k: 'payout', label: 'Payout' },
          { k: 'ana', label: 'Analytics' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`rounded-[10px] px-4 py-2 text-[12.5px] font-bold border ${tab === t.k ? 'bg-[#0A0A0A] text-[#FFC107] border-[#0A0A0A]' : 'bg-white text-[#52525B] border-[#E4E4E7] hover:border-[#0A0A0A]'}`}>
            {t.label}{t.n != null && <span className={`ml-1.5 rounded-[7px] px-1.5 py-0.5 text-[10px] ${tab === t.k ? 'bg-[#FFC107]/25 text-[#FFC107]' : 'bg-[#F4F4F5] text-[#52525B]'}`}>{t.n}</span>}
          </button>
        ))}
      </div>

      {/* ════ HIERARCHY ════ */}
      {tab === 'hier' && (
        <div>
          {sets.length === 0 && (
            <div className="bg-white border border-[#E4E4E7] rounded-[14px] p-10 text-center text-[#71717A] text-sm">
              No sets yet — add the first one in the INFLX brand app on your phone.
            </div>
          )}
          {sets.map(set => {
            const eng = engBySetId[set.id] || {};
            const open = isSetOpen(set.id);
            const infs = set.influencers || [];
            const setConv = convBySetId[set.id];
            const setWantsSales = ['conversion', 'hybrid'].includes(set.goal) || (setConv && setConv.sales_count > 0);
            return (
              <div key={set.id} className="bg-white border border-[#E4E4E7] rounded-[14px] mb-3 overflow-hidden">
                <button onClick={() => setOpenSets(o => ({ ...o, [set.id]: !open }))}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-[#FFFDEB] text-left">
                  <span className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] transition-transform ${open ? 'rotate-90 bg-[#FFF7CC]' : 'bg-[#F4F4F5]'}`}>▶</span>
                  <span>
                    <span className="block font-display font-extrabold text-[14.5px] text-[#0A0A0A]">{set.name}</span>
                    <span className="block text-[11px] text-[#71717A]">{set.influencer_mode === 'open_group' ? 'open call' : 'handpick'} · {infs.length} influencer{infs.length !== 1 ? 's' : ''}</span>
                  </span>
                  {set.goal && (
                    <span className={`text-[9.5px] font-extrabold rounded-[7px] px-2 py-1 tracking-[0.4px] uppercase ${GOAL_TAG[set.goal] || 'bg-[#F4F4F5] text-[#52525B]'}`}>
                      {set.goal}{set.set_budget ? ` · ${fmtRupees(set.set_budget)}` : ''}
                    </span>
                  )}
                  <span className="ml-auto flex gap-4 items-center">
                    <MiniStat v={nf(eng.views)} k="VIEWS" />
                    <MiniStat v={nf(eng.likes)} k="LIKES" />
                    <MiniStat v={nf(eng.comments)} k="COMMENTS" />
                    <MiniStat v={eng.engagement_rate != null ? `${eng.engagement_rate}%` : '—'} k="ER" />
                    <MiniStat v={nf(clicksBySetId[set.id] || 0)} k="CLICKS" />
                    {setWantsSales && <SalesStat v={nf(setConv?.sales_count || 0)} k="SALES" />}
                    {setWantsSales && <SalesStat v={fmtRupees(setConv?.revenue || 0)} k="REVENUE" />}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-[#F4F4F5]">
                    {infs.length === 0 && <div className="px-10 py-4 text-[12px] text-[#A1A1AA]">No influencers in this set yet.</div>}
                    {infs.map(ci => {
                      const ieng = engByInfId[ci.influencer_id] || {};
                      const handle = ci.instagram_handle || ci.handle || ieng.instagram_handle || ci.influencer_name || ci.name || '—';
                      const dels = ci.deliverables || [];
                      const pendingDateChange = ci.pending_date_change || null;
                      const hasAction = !!pendingDateChange || dels.some(d => ['submitted', 'under_review'].includes(d.status) || (d.status === 'approved' && d.live_url));
                      const iOpen = isInfOpen(ci.id, hasAction || infs.length === 1);
                      // Effective posting window: per-creator window (set via an
                      // approved date-change) overrides the set window.
                      const effStart = ci.window_start || ci.set_window_start;
                      const effEnd   = ci.window_end   || ci.set_window_end;
                      const hasCreatorWindow = !!(ci.window_start || ci.window_end);
                      const ciProducts = productsForCi(ci.id);
                      const ciConv = convByInf[ci.influencer_id];
                      const ciWantsSales = ['conversion', 'hybrid'].includes(set.goal) || (ciConv && ciConv.sales_count > 0);
                      const reviewCount = dels.filter(d => ['submitted', 'under_review'].includes(d.status)).length;
                      const statusPill = reviewCount > 0
                        ? { cls: 'bg-[#FFF7CC] text-[#6B5A00]', label: `${reviewCount} TO REVIEW` }
                        : (['active', 'live'].includes(ci.status) ? { cls: 'bg-[#D1FAE5] text-[#047857]', label: ci.status.toUpperCase() }
                          : { cls: 'bg-[#F4F4F5] text-[#52525B]', label: (ci.status || '').replace('_', ' ').toUpperCase() });
                      return (
                        <div key={ci.id} className="border-b border-[#F4F4F5] last:border-b-0 pl-9 pr-4">
                          <button onClick={() => setOpenInfs(o => ({ ...o, [ci.id]: !iOpen }))}
                            className="w-full flex items-center gap-3 py-3 text-left">
                            <span className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] transition-transform ${iOpen ? 'rotate-90 bg-[#FFF7CC]' : 'bg-[#F4F4F5]'}`}>▶</span>
                            <span className="w-[34px] h-[34px] rounded-full bg-[#FFC107] flex items-center justify-center font-extrabold text-[13px]">
                              {String(handle).replace('@', '').charAt(0).toUpperCase()}
                            </span>
                            <span>
                              <span className="block font-bold text-[13.5px] text-[#0A0A0A]">@{String(handle).replace('@', '')}</span>
                              <span className="block text-[11px] text-[#71717A]">
                                {ci.agreed_fee ? `${fmtRupees(ci.agreed_fee)} fee` : ci.commission_pct ? `${Number(ci.commission_pct)}% commission` : ''}
                                {ciProducts.length > 0 ? ` · ${ciProducts.length} product${ciProducts.length !== 1 ? 's' : ''}` : ''}
                                {' · '}
                                <Link href={`/dashboard/campaigns/${id}/influencers`} onClick={e => e.stopPropagation()} className="text-[#6B5A00] font-bold no-underline">manage ↗</Link>
                              </span>
                            </span>
                            <span className={`text-[9px] font-extrabold rounded-[7px] px-2 py-1 tracking-[0.4px] ${statusPill.cls}`}>{statusPill.label}</span>
                            <span className="ml-auto flex gap-4 items-center">
                              <MiniStat v={nf(ieng.views)} k="VIEWS" />
                              <MiniStat v={nf(ieng.likes)} k="LIKES" />
                              <MiniStat v={ieng.engagement_rate != null ? `${ieng.engagement_rate}%` : '—'} k="ER" />
                              <MiniStat v={nf(clicksByInfId[ci.influencer_id] || 0)} k="CLICKS" />
                              {ciWantsSales && <SalesStat v={nf(ciConv?.sales_count || 0)} k="SALES" />}
                              {ciWantsSales && <SalesStat v={fmtRupees(ciConv?.revenue || 0)} k="REVENUE" />}
                              {ciWantsSales && ciConv?.commission_paid > 0 && <SalesStat v={fmtRupees(ciConv.commission_paid)} k="COMM" />}
                            </span>
                          </button>

                          {iOpen && (
                            <div className="pb-3.5">
                              <StageTracker ci={ci} />

                              {/* Effective posting window (per-creator overrides set window) */}
                              {(effStart || effEnd) && (
                                <div className="ml-[46px] mb-2 text-[11px] text-[#71717A]">
                                  <span className="font-bold text-[#52525B]">Posting window:</span>{' '}
                                  <span className="font-mono font-semibold text-[#0A0A0A]">{formatDate(effStart)} → {formatDate(effEnd)}</span>
                                  {hasCreatorWindow && <span className="ml-1.5 text-[9.5px] font-extrabold rounded-[6px] px-1.5 py-0.5 bg-[#DBEAFE] text-[#1D4ED8] tracking-[0.3px]">CUSTOM</span>}
                                </div>
                              )}

                              {/* Date-change request — brand approve / reject (Phase 3) */}
                              {pendingDateChange && (
                                <div className="ml-[46px] mb-2.5 rounded-[10px] border border-[#FFC107] bg-[#FFFDEB] px-3.5 py-3">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-base">📅</span>
                                    <span className="text-[12.5px] font-extrabold text-[#0A0A0A]">Date-change request</span>
                                    <span className="text-[9px] font-extrabold rounded-[7px] px-2 py-1 tracking-[0.4px] bg-[#FFF7CC] text-[#6B5A00]">PENDING</span>
                                  </div>
                                  <div className="text-[11.5px] text-[#52525B] mb-1">
                                    Wants <span className="font-mono font-semibold text-[#0A0A0A]">{formatDate(pendingDateChange.requested_start)} → {formatDate(pendingDateChange.requested_end)}</span>
                                    {(effStart || effEnd) && <span className="text-[#A1A1AA]"> (currently {formatDate(effStart)} → {formatDate(effEnd)})</span>}
                                  </div>
                                  {pendingDateChange.reason && (
                                    <div className="text-[11.5px] text-[#1F1F22] mb-2 italic">“{pendingDateChange.reason}”</div>
                                  )}
                                  <div className="flex gap-2.5 mt-1">
                                    <button
                                      onClick={() => decideDateChange(ci.id, pendingDateChange.id, 'approve')}
                                      disabled={busyId === pendingDateChange.id}
                                      className="bg-[#0A0A0A] rounded-[8px] px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#FFC107] hover:bg-[#1F1F22] disabled:opacity-50">
                                      {busyId === pendingDateChange.id ? 'Working…' : 'Approve new dates'}
                                    </button>
                                    <button
                                      onClick={() => decideDateChange(ci.id, pendingDateChange.id, 'reject')}
                                      disabled={busyId === pendingDateChange.id}
                                      className="bg-white border border-[#E4E4E7] rounded-[8px] px-3 py-1.5 text-[11.5px] font-bold text-[#0A0A0A] hover:border-[#0A0A0A] disabled:opacity-50">
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}

                              {dels.map(d => {
                                const pill = delPill(d);
                                const stats = engByDelId[d.id] || {};
                                const needsReview = ['submitted', 'under_review'].includes(d.status);
                                const needsLiveConfirm = d.status === 'approved' && d.live_url;
                                const isBusy = busyId === d.id;
                                const contentOpen = !!openContent[d.id];
                                return (
                                  <div key={d.id} className="my-1.5 ml-[46px]">
                                  <div
                                    className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${needsReview ? 'bg-[#FFFDEB] border-[#FFC107]' : 'bg-[#FAFAFA] border-[#F4F4F5]'}`}>
                                    <span className="text-base">{DEL_ICON[d.type] || '🎬'}</span>
                                    <span>
                                      <span className="block text-[12.5px] font-bold text-[#0A0A0A] capitalize">{(d.type || '').replace('_', ' ')}</span>
                                      <span className="block text-[10.5px] text-[#71717A]">
                                        {d.status === 'live' && d.live_url && <a href={d.live_url} target="_blank" rel="noreferrer" className="text-[#6B5A00] font-bold no-underline">view post ↗</a>}
                                        {needsReview && (d.submitted_at ? `submitted ${formatDate(d.submitted_at)}` : 'awaiting your review')}
                                        {needsLiveConfirm && 'influencer says it’s posted'}
                                        {d.status === 'pending' && 'not submitted yet'}
                                        {d.status === 'revision_requested' && `revision ${d.revision_count || 1} requested`}
                                      </span>
                                    </span>
                                    <span className={`text-[9px] font-extrabold rounded-[7px] px-2 py-1 tracking-[0.4px] ${pill.cls}`}>{pill.label}</span>
                                    <span className="ml-auto flex gap-3.5 items-center">
                                      {d.status === 'live' && (
                                        <>
                                          <MiniStat v={nf(stats.likes)} k="LIKES" />
                                          <MiniStat v={nf(stats.comments)} k="COMMENTS" />
                                          {stats.views != null && <MiniStat v={nf(stats.views)} k="VIEWS" />}
                                          <MiniStat v={stats.engagement_rate != null ? `${stats.engagement_rate}%` : '—'} k="ER" />
                                          <button
                                            onClick={() => refreshDeliverable(d.id)}
                                            disabled={refreshingOne === d.id}
                                            title="Re-scrape this post now"
                                            className="w-7 h-7 rounded-[8px] bg-white border border-[#E4E4E7] text-[13px] hover:bg-[#FFF7CC] hover:border-[#FFC107] disabled:opacity-50">
                                            {refreshingOne === d.id ? '…' : '↻'}
                                          </button>
                                        </>
                                      )}
                                      {needsReview && (
                                        <>
                                          <button
                                            onClick={() => setOpenContent(o => ({ ...o, [d.id]: !o[d.id] }))}
                                            className="bg-white border border-[#E4E4E7] rounded-[8px] px-3 py-1.5 text-[11.5px] font-bold text-[#0A0A0A] hover:border-[#0A0A0A]">
                                            {contentOpen ? 'Hide content' : 'View content'}
                                          </button>
                                          <button
                                            onClick={() => inlineReview(d.id, 'approve')}
                                            disabled={isBusy}
                                            className="bg-[#0A0A0A] rounded-[8px] px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#FFC107] hover:bg-[#1F1F22] disabled:opacity-50">
                                            {isBusy ? 'Working…' : 'Approve'}
                                          </button>
                                          <button
                                            onClick={() => inlineReview(d.id, 'request_revision')}
                                            disabled={isBusy}
                                            className="bg-white border border-[#E4E4E7] rounded-[8px] px-3 py-1.5 text-[11.5px] font-bold text-[#0A0A0A] hover:border-[#0A0A0A] disabled:opacity-50">
                                            Request revision
                                          </button>
                                        </>
                                      )}
                                      {needsLiveConfirm && (
                                        <>
                                          <button
                                            onClick={() => inlineConfirmLive(d.id)}
                                            disabled={isBusy}
                                            className="bg-[#FFC107] rounded-[8px] px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#0A0A0A] hover:bg-[#E0A800] disabled:opacity-50">
                                            {isBusy ? 'Confirming…' : 'Confirm live · release T2'}
                                          </button>
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  {needsReview && contentOpen && (
                                    <div className="mt-1.5 px-1">
                                      {d.caption && (
                                        <div className="mb-2 p-2.5 rounded-[10px] bg-white border border-[#E4E4E7] text-[12px] text-[#1F1F22] leading-relaxed whitespace-pre-wrap">
                                          {d.caption}
                                        </div>
                                      )}
                                      <MediaPreview deliverableId={d.id} mediaType={d.media_type || d.type} />
                                    </div>
                                  )}
                                  </div>
                                );
                              })}
                              {dels.length === 0 && <div className="ml-[46px] text-[11.5px] text-[#A1A1AA] my-1.5">No deliverables yet.</div>}

                              {ciProducts.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 ml-[46px] mt-2">
                                  {ciProducts.slice(0, 12).map(p => (
                                    <span key={p.id} className="bg-white border border-[#E4E4E7] rounded-[9px] px-2.5 py-1.5 text-[11px] font-semibold text-[#1F1F22]">
                                      {p.name} <span className="text-[#A1A1AA] font-medium">· {p.section || '—'} · {fmtRupees(p.price)}</span>
                                    </span>
                                  ))}
                                  {ciProducts.length > 12 && (
                                    <button onClick={() => setTab('prod')} className="text-[11px] font-bold text-[#6B5A00] px-2">+{ciProducts.length - 12} more →</button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ════ PRODUCTS ════ */}
      {tab === 'prod' && (
        <div>
          <div className="bg-white border border-[#E4E4E7] rounded-[14px] overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA]">
                  {['PRODUCT', 'CATEGORY / SECTION', 'SET', 'INFLUENCER(S)', 'PRICE', 'STATUS'].map(h => (
                    <th key={h} className="text-left text-[10px] font-extrabold tracking-[0.5px] text-[#71717A] px-4 py-3 border-b border-[#E4E4E7]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productsList.map(p => (
                  <tr key={p.id} className="hover:bg-[#FFFDEB]">
                    <td className="px-4 py-3 border-b border-[#F4F4F5] text-[12.5px] font-bold text-[#0A0A0A]">{p.name}</td>
                    <td className="px-4 py-3 border-b border-[#F4F4F5] text-[12px] text-[#52525B]">{[p.category_key, p.section].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-3 border-b border-[#F4F4F5] text-[12px] text-[#52525B]">{productSetNames(p)}</td>
                    <td className="px-4 py-3 border-b border-[#F4F4F5] text-[12px] text-[#52525B]">
                      {isBrandLevelOffer || !(p.assigned_to_influencers || []).length
                        ? 'All campaign influencers'
                        : p.assigned_to_influencers.map(a => `@${a.handle || a.name}`).join(' · ')}
                    </td>
                    <td className="px-4 py-3 border-b border-[#F4F4F5] font-mono text-[12px] font-bold text-[#0A0A0A]">{fmtRupees(p.price)}</td>
                    <td className="px-4 py-3 border-b border-[#F4F4F5]">
                      <span className={`text-[9px] font-extrabold rounded-[7px] px-2 py-1 tracking-[0.4px] ${p.publish_status === 'published' ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#F4F4F5] text-[#52525B]'}`}>
                        {p.publish_status === 'published' ? 'LIVE IN STORE' : 'PENDING'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-2">
            {isBrandLevelOffer
              ? 'Brand-level offer — every influencer in this campaign promotes the whole catalogue.'
              : 'Each product shows exactly where it lives: set → influencer(s) → category.'}
            {' '}&quot;Live in store&quot; = the influencer has published their note for it.
          </div>
        </div>
      )}

      {/* ════ CONTRACTS ════ */}
      {tab === 'contracts' && (
        <div>
          {contractRows.length === 0 ? (
            <div className="bg-white border border-[#E4E4E7] rounded-[14px] p-10 text-center text-[#71717A] text-sm">
              No contracts yet — contracts appear once an influencer accepts and signs.
            </div>
          ) : (
            <div className="bg-white border border-[#E4E4E7] rounded-[14px] overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA]">
                    {['INFLUENCER', 'SET', 'FEE / COMMISSION', 'STATUS', ''].map((h, i) => (
                      <th key={i} className="text-left text-[10px] font-extrabold tracking-[0.5px] text-[#71717A] px-4 py-3 border-b border-[#E4E4E7]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contractRows.map(({ ci, state }) => {
                    const handle = String(ci.instagram_handle || ci.handle || ci.influencer_name || ci.name || '—').replace(/^@/, '');
                    return (
                      <tr key={ci.id} className="hover:bg-[#FFFDEB]">
                        <td className="px-4 py-3 border-b border-[#F4F4F5] text-[12.5px] font-bold text-[#0A0A0A]">@{handle}</td>
                        <td className="px-4 py-3 border-b border-[#F4F4F5] text-[12px] text-[#52525B]">{ci.set_name || '—'}</td>
                        <td className="px-4 py-3 border-b border-[#F4F4F5] font-mono text-[12px] text-[#0A0A0A]">
                          {ci.agreed_fee ? fmtRupees(ci.agreed_fee) : ci.commission_pct ? `${Number(ci.commission_pct)}% commission` : '—'}
                          {state.key === 'pending' && state.lock != null && (
                            <span className="block text-[10.5px] text-[#71717A] mt-0.5">locks {fmtRupees(state.lock)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-b border-[#F4F4F5]">
                          <span className={`text-[9px] font-extrabold rounded-[7px] px-2 py-1 tracking-[0.4px] ${state.cls}`}>{state.label.toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3 border-b border-[#F4F4F5] text-right">
                          {state.key === 'pending' && (
                            <button
                              onClick={() => signContract(state.contractId)}
                              disabled={signingId === state.contractId}
                              className="bg-[#0A0A0A] rounded-[8px] px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#FFC107] hover:bg-[#1F1F22] disabled:opacity-50 whitespace-nowrap">
                              {signingId === state.contractId ? 'Signing…' : 'Counter-sign'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-[11px] text-[#A1A1AA] mt-2">
            Counter-sign contracts influencers have signed to lock funds and start the campaign.
            Draft = terms not yet finalised · Live = signed &amp; active · Completed = campaign wrapped.
          </div>
        </div>
      )}

      {/* ════ PAYOUT (A4 — folds the retired /escrow route) ════ */}
      {tab === 'production' && (
        <ProductionSection id={id} influencers={allInfluencers} />
      )}

      {tab === 'payout' && (
        <PayoutSection id={id} onOpenConversions={() => setTab('ana')} />
      )}

      {/* ════ ANALYTICS ════ */}
      {tab === 'ana' && (
        <div>
          <div className="text-[10.5px] font-extrabold text-[#71717A] tracking-[0.5px] mb-2">LEVEL 1 — CAMPAIGN</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { k: 'LIKES', v: nf(totals.total_likes) },
              { k: 'COMMENTS', v: nf(totals.total_comments) },
              { k: 'VIEWS', v: nf(totals.total_views) },
              { k: 'AVG ER', v: totals.avg_er != null ? `${Number(totals.avg_er).toFixed(1)}%` : '—' },
            ].map(c => (
              <div key={c.k} className="bg-white border border-[#E4E4E7] rounded-[12px] p-4">
                <div className="text-[10px] font-extrabold text-[#71717A] tracking-[0.5px]">{c.k}</div>
                <div className="font-mono font-bold text-[24px] text-[#0A0A0A] mt-1">{c.v}</div>
              </div>
            ))}
          </div>

          {hasConversions && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {[
                { k: 'SALES', v: nf(convCount) },
                { k: 'REVENUE', v: fmtRupees(convRevenue) },
                { k: 'COMMISSION PAID', v: fmtRupees(convCommission) },
              ].map(c => (
                <div key={c.k} className="bg-white border border-[#F3E8FF] rounded-[12px] p-4">
                  <div className="text-[10px] font-extrabold text-[#7E22CE] tracking-[0.5px]">{c.k}</div>
                  <div className="font-mono font-bold text-[24px] text-[#0A0A0A] mt-1">{c.v}</div>
                </div>
              ))}
            </div>
          )}

          {bySet.length > 0 && (<>
            <div className="text-[10.5px] font-extrabold text-[#71717A] tracking-[0.5px] mb-2">LEVEL 2 — BY SET</div>
            {bySet.map(s => {
              const maxViews = Math.max(...bySet.map(x => x.views || 0), 1);
              const sConv = convBySetId[s.set_id];
              return (
                <div key={s.set_id} className="bg-white border border-[#E4E4E7] rounded-[12px] p-4 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[13px] text-[#0A0A0A]">{s.set_name} <span className="text-[11px] text-[#71717A] font-medium">· {s.goal || '—'} · {s.influencers} influencer{s.influencers !== 1 ? 's' : ''}</span></span>
                    <span className="font-mono text-[11.5px] text-[#52525B]">{nf(s.views)} views · {nf(s.likes)} likes · {nf(s.comments)} comments · ER {s.engagement_rate}% · {nf(clicksBySetId[s.set_id] || 0)} clicks</span>
                  </div>
                  {sConv && sConv.sales_count > 0 && (
                    <div className="font-mono text-[11.5px] text-[#7E22CE] mt-1">{nf(sConv.sales_count)} sales · {fmtRupees(sConv.revenue)} revenue · {fmtRupees(sConv.commission_paid)} commission</div>
                  )}
                  <div className="h-[6px] bg-[#F4F4F5] rounded-[3px] mt-2"><div className="h-[6px] bg-[#FFC107] rounded-[3px]" style={{ width: `${Math.round(((s.views || 0) / maxViews) * 100)}%` }} /></div>
                </div>
              );
            })}
          </>)}

          {byInf.length > 0 && (<>
            <div className="text-[10.5px] font-extrabold text-[#71717A] tracking-[0.5px] mb-2 mt-5">LEVEL 3 — BY INFLUENCER</div>
            {byInf.map(i => {
              const maxViews = Math.max(...byInf.map(x => x.views || 0), 1);
              const liveN = (i.deliverables || []).filter(d => d.status === 'live').length;
              const otherN = (i.deliverables || []).length - liveN;
              const iConv = convByInf[i.influencer_id];
              return (
                <div key={i.influencer_id} className="bg-white border border-[#E4E4E7] rounded-[12px] p-4 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[13px] text-[#0A0A0A]">{i.handle} <span className="text-[11px] text-[#71717A] font-medium">· {i.set_name} · {liveN} live{otherN > 0 ? ` + ${otherN} other` : ''}</span></span>
                    <span className="font-mono text-[11.5px] text-[#52525B]">{nf(i.views)} views · {nf(i.likes)} likes · ER {i.engagement_rate}% · {nf(clicksByInfId[i.influencer_id] || 0)} clicks</span>
                  </div>
                  {iConv && iConv.sales_count > 0 && (
                    <div className="font-mono text-[11.5px] text-[#7E22CE] mt-1">{nf(iConv.sales_count)} sales · {fmtRupees(iConv.revenue)} revenue · {fmtRupees(iConv.commission_paid)} commission{iConv.roi ? ` · ROI ${iConv.roi}×` : ''}</div>
                  )}
                  <div className="h-[6px] bg-[#F4F4F5] rounded-[3px] mt-2"><div className="h-[6px] bg-[#FFC107] rounded-[3px]" style={{ width: `${Math.round(((i.views || 0) / maxViews) * 100)}%` }} /></div>
                </div>
              );
            })}
          </>)}

          {Object.keys(engByDelId).length > 0 && (<>
            <div className="text-[10.5px] font-extrabold text-[#71717A] tracking-[0.5px] mb-2 mt-5">LEVEL 4 — BY DELIVERABLE</div>
            {byInf.flatMap(i => (i.deliverables || []).map(d => ({ ...d, handle: i.handle }))).map(d => (
              <div key={d.id} className="bg-white border border-[#E4E4E7] rounded-[12px] px-4 py-3 mb-2 flex items-center gap-3">
                <span>{DEL_ICON[d.type] || '🎬'}</span>
                <span className="font-bold text-[12.5px] text-[#0A0A0A]">{d.handle} <span className="capitalize font-medium text-[#52525B]">{(d.type || '').replace('_', ' ')}</span></span>
                <span className={`text-[9px] font-extrabold rounded-[7px] px-2 py-1 tracking-[0.4px] ${delPill(d).cls}`}>{delPill(d).label}</span>
                <span className="ml-auto font-mono text-[11.5px] text-[#52525B]">
                  {d.status === 'live'
                    ? <>{nf(d.likes)} likes · {nf(d.comments)} comments{d.views != null ? <> · {nf(d.views)} views</> : null} · ER {d.engagement_rate != null ? `${d.engagement_rate}%` : '—'}{d.scraped_at ? <> · scraped {formatDate(d.scraped_at)}</> : null}</>
                    : 'no stats until live'}
                </span>
                {d.status === 'live' && (
                  <button onClick={() => refreshDeliverable(d.id)} disabled={refreshingOne === d.id}
                    className="w-7 h-7 rounded-[8px] bg-white border border-[#E4E4E7] text-[13px] hover:bg-[#FFF7CC] hover:border-[#FFC107] disabled:opacity-50">
                    {refreshingOne === d.id ? '…' : '↻'}
                  </button>
                )}
              </div>
            ))}
          </>)}
          <div className="text-[11px] text-[#A1A1AA] mt-3">
            Reach &amp; saves not shown — they need the influencer&apos;s Instagram Business API to be connected.
            Stats auto-refresh daily; ↻ re-scrapes a post on demand.
          </div>
        </div>
      )}

      {/* Brief (kept from the previous design) */}
      {campaign.brief && (
        <button type="button" onClick={() => setBriefOpen(o => !o)}
          className="block w-full text-left bg-white border border-[#E4E4E7] rounded-[14px] p-[18px] hover:border-[#D4D4D8] transition-colors mt-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 font-display font-bold text-[13.5px] text-[#0A0A0A]">
              <span className="w-[3px] h-3.5 bg-[#FFC107] rounded-sm"></span>
              Campaign brief
            </div>
            <span className="font-mono font-bold text-[#71717A] text-lg">{briefOpen ? '∧' : '∨'}</span>
          </div>
          {briefOpen && (
            <div className="mt-3 pt-3 border-t border-[#E4E4E7] text-[13px] text-[#1F1F22] leading-relaxed">{campaign.brief}</div>
          )}
        </button>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#0A0A0A] text-white text-[12px] font-semibold px-4 py-3 rounded-[12px] shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
