'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { campaignApi, deliverableApi, fmtRupees } from '../../../../../lib/api';

/* ─── Media preview (signed R2 URL → <img>/<video>) ───────────────────────── */

function MediaPreview({ deliverableId, mediaType }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!deliverableId) return;
    let cancelled = false;
    deliverableApi.getMediaUrl(deliverableId).then(res => {
      if (cancelled) return;
      if (res.success && res.data?.url) setUrl(res.data.url);
      else setErrored(true);
    }).catch(() => { if (!cancelled) setErrored(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deliverableId]);

  if (loading) {
    return (
      <div className="mb-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-[12px] p-6 text-center">
        <div className="text-[11px] text-[#71717A]">Loading media…</div>
      </div>
    );
  }
  if (errored || !url) return null;

  const isVideo = (mediaType || '').startsWith('video');
  return (
    <div className="mb-3 bg-[#0A0A0A] rounded-[12px] overflow-hidden">
      {isVideo ? (
        <video src={url} controls playsInline className="w-full max-h-[380px]" style={{ objectFit: 'contain' }} />
      ) : (
        <img src={url} alt="Submitted content" className="w-full max-h-[380px] object-contain" />
      )}
    </div>
  );
}

/* ─── Deliverable stats card (live-deliverable engagement metrics) ────────── */

function DeliverableStatsCard({ deliverableId, type }) {
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!deliverableId) return;
    let cancelled = false;
    deliverableApi.get(deliverableId).then(res => {
      if (!cancelled && res.success && res.data?.stats) setStats(res.data.stats);
    });
    return () => { cancelled = true; };
  }, [deliverableId]);

  async function handleRefresh() {
    setRefreshing(true);
    const res = await deliverableApi.refreshStats(deliverableId);
    if (res.success && res.data?.stats) setStats(res.data.stats);
    else alert(res.error?.message || 'Failed to refresh stats');
    setRefreshing(false);
  }

  const fmt = (n) => {
    if (n == null) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  };

  const isReel = type === 'reel';
  const tiles = [
    { label: 'Likes',    val: stats?.likes,       bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]' },
    { label: 'Comments', val: stats?.comments,    bg: 'bg-[#D1FAE5]', text: 'text-[#047857]' },
  ];
  if (isReel) tiles.push({ label: 'Views', val: stats?.impressions, bg: 'bg-[#F4F4F5]', text: 'text-[#1F1F22]' });

  return (
    <div className="mt-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-[12px] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#71717A]">Live performance</div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-[10.5px] font-bold text-[#0A0A0A] bg-white border border-[#E4E4E7] rounded-[8px] px-2.5 py-1 hover:border-[#0A0A0A] disabled:opacity-50 transition-colors"
        >
          {refreshing ? 'Fetching…' : 'Refresh stats'}
        </button>
      </div>
      {stats ? (
        <>
          <div className={`grid ${isReel ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-2`}>
            {tiles.map(t => (
              <div key={t.label} className={`rounded-[10px] p-2.5 text-center ${t.bg}`}>
                <div className={`font-mono font-bold text-base ${t.text}`}>{fmt(t.val)}</div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.3px] text-[#71717A] mt-0.5">{t.label}</div>
              </div>
            ))}
          </div>
          {stats.engagement_rate != null && (
            <div className="bg-[#FFFDEB] border border-[#FFC107]/40 rounded-[10px] p-2.5 text-center">
              <span className="font-mono font-bold text-lg text-[#0A0A0A]">{parseFloat(stats.engagement_rate).toFixed(2)}%</span>
              <span className="text-[9.5px] font-bold uppercase tracking-[0.3px] text-[#71717A] ml-2">Engagement rate</span>
            </div>
          )}
          <div className="text-[10px] text-[#71717A] text-center mt-2 leading-snug">
            Reach &amp; saves aren&apos;t public — they need the influencer&apos;s Instagram Business API to be connected.
            {stats.scraped_at && <><br />Last updated: {new Date(stats.scraped_at).toLocaleString('en-IN')}</>}
          </div>
        </>
      ) : (
        <div className="text-[10.5px] text-[#71717A] text-center py-2">
          No stats yet. Click &quot;Refresh stats&quot; to fetch from Instagram.
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_BADGE = {
  submitted:           { bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]', label: 'Submitted' },
  under_review:        { bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]', label: 'Under review' },
  revision_requested:  { bg: 'bg-[#FDEEE9]', text: 'text-[#B91C1C]', label: 'Revision' },
  approved:            { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', label: 'Approved' },
  live:                { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', label: 'Live' },
};

function StatusPill({ status }) {
  const cfg = STATUS_BADGE[status] || { bg: 'bg-[#F4F4F5]', text: 'text-[#52525B]', label: (status || '').replace(/_/g, ' ') };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.3px] ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

/* ─── Reviews queue page ─────────────────────────────────────────────────── */

export default function CampaignReviewsPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'live' ? 'live' : 'reviews';

  const [campaign, setCampaign] = useState(null);
  const [tab, setTab]           = useState(initialTab);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [toast, setToast]       = useState('');
  const [busyId, setBusyId]     = useState(null);

  const loadCampaign = useCallback(() => {
    return campaignApi.get(id).then(res => {
      if (res.success) setCampaign(res.data?.campaign || res.data);
      else setError(res.error?.message || 'Failed to load campaign');
    }).catch(err => setError(err.message || 'Network error'));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadCampaign().finally(() => setLoading(false));
  }, [id, loadCampaign]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleReview(delId, action) {
    let feedback = null;
    if (action === 'request_revision') {
      feedback = window.prompt('What needs to change?');
      if (feedback == null) return;
      feedback = feedback.trim();
      if (!feedback) { alert('Feedback is required to request revision.'); return; }
    }
    setBusyId(delId);
    const res = await deliverableApi.review(delId, { action, feedback });
    setBusyId(null);
    if (res.success) {
      showToast(action === 'approve' ? 'Content approved.' : 'Sent for revision.');
      loadCampaign();
    } else {
      showToast(res.error?.message || 'Action failed');
    }
  }

  async function handleConfirmLive(delId) {
    setBusyId(delId);
    const res = await deliverableApi.confirmLive(delId);
    setBusyId(null);
    if (res.success) {
      const released = res.data?.tranche_released;
      if (released?.amount) {
        showToast(`Live confirmed. Tranche-2 of ${fmtRupees(released.amount)} released.`);
      } else {
        showToast('Live confirmed.');
      }
      loadCampaign();
    } else {
      showToast(res.error?.message || 'Failed to confirm');
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center text-[#71717A] font-body">
        Loading review queue…
      </div>
    );
  }
  if (error || !campaign) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <div className="font-display text-lg font-bold text-[#0A0A0A] mb-2">{error || 'Campaign not found'}</div>
        <Link href="/dashboard/campaigns" className="text-[#0A0A0A] underline font-semibold text-sm">← Back to campaigns</Link>
      </div>
    );
  }

  const sets = campaign.sets || [];
  const flat = [];
  for (const s of sets) {
    for (const inf of (s.influencers || [])) {
      for (const d of (inf.deliverables || [])) {
        flat.push({
          ...d,
          _set_name: s.name,
          _influencer_name: inf.influencer_name || inf.instagram_handle || 'Influencer',
          _instagram_handle: inf.instagram_handle,
        });
      }
    }
  }

  const reviewQueue = flat.filter(d => d.status === 'submitted' || d.status === 'under_review');
  const liveConfirmQueue = flat.filter(d => d.status === 'approved' && d.live_url);

  const list = tab === 'reviews' ? reviewQueue : liveConfirmQueue;

  return (
    <div className="max-w-5xl font-body">
      {/* Breadcrumb */}
      <div className="font-mono text-[11px] font-medium text-[#71717A] uppercase tracking-[0.3px] mb-1.5">
        <Link href="/dashboard" className="text-[#71717A] hover:text-[#0A0A0A] no-underline">/dashboard</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <Link href="/dashboard/campaigns" className="text-[#71717A] hover:text-[#0A0A0A] no-underline">campaigns</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <Link href={`/dashboard/campaigns/${id}`} className="text-[#71717A] hover:text-[#0A0A0A] no-underline">{(campaign.id || '').slice(0, 8)}</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <span className="text-[#0A0A0A] font-bold">reviews</span>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-5">
        <div>
          <h1 className="font-display text-[26px] font-bold text-[#0A0A0A] -tracking-[0.5px]">Review queue</h1>
          <div className="w-11 h-1 bg-[#FFC107] rounded-full mt-1.5 mb-2.5"></div>
          <div className="text-[12.5px] text-[#52525B]">
            <span className="font-medium text-[#71717A]">{campaign.name}</span>
          </div>
        </div>
        <Link
          href={`/dashboard/campaigns/${id}`}
          className="px-3.5 py-2 bg-white border border-[#E4E4E7] rounded-[10px] text-[12.5px] font-semibold text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors no-underline"
        >
          ← Back to campaign
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E4E4E7] mb-5">
        <button
          type="button"
          onClick={() => setTab('reviews')}
          className={`px-4 py-2.5 text-[12.5px] font-bold -mb-px border-b-2 transition-colors ${tab === 'reviews' ? 'border-[#FFC107] text-[#0A0A0A]' : 'border-transparent text-[#71717A] hover:text-[#0A0A0A]'}`}
        >
          To review <span className="font-mono ml-1 text-[#71717A]">({reviewQueue.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('live')}
          className={`px-4 py-2.5 text-[12.5px] font-bold -mb-px border-b-2 transition-colors ${tab === 'live' ? 'border-[#FFC107] text-[#0A0A0A]' : 'border-transparent text-[#71717A] hover:text-[#0A0A0A]'}`}
        >
          Confirm live <span className="font-mono ml-1 text-[#71717A]">({liveConfirmQueue.length})</span>
        </button>
      </div>

      {/* Confirm-live hint */}
      {tab === 'live' && liveConfirmQueue.length > 0 && (
        <div className="mb-4 p-3 rounded-[12px] bg-[#FFFDEB] border border-[#FFC107]/40 text-[12px] text-[#6B5A00]">
          Confirming a live URL releases the influencer&apos;s Tranche-2 escrow. Verify each post is up before confirming.
        </div>
      )}

      {/* List */}
      {list.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E4E4E7] rounded-[16px] py-16 text-center">
          <div className="font-display font-bold text-[#0A0A0A] mb-1">
            {tab === 'reviews' ? 'No content waiting for review' : 'No live URLs to confirm'}
          </div>
          <div className="text-xs text-[#71717A]">
            {tab === 'reviews' ? 'New submissions will appear here.' : 'Approved posts that influencers mark live will show up here.'}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map(d => {
            const submittedAt = d.submitted_at ? fmtDate(d.submitted_at) : null;
            const approvedAt  = d.approved_at ? fmtDate(d.approved_at) : null;
            const isBusy      = busyId === d.id;
            const isReview    = tab === 'reviews';

            return (
              <article key={d.id} className="bg-white border border-[#E4E4E7] rounded-[16px] p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-display font-bold text-[14.5px] text-[#0A0A0A] truncate">{d._influencer_name}</span>
                      {d._instagram_handle && (
                        <span className="font-mono text-[11.5px] text-[#71717A]">@{d._instagram_handle}</span>
                      )}
                      <StatusPill status={d.status} />
                    </div>
                    <div className="text-[11.5px] text-[#71717A]">
                      <span className="font-semibold capitalize text-[#0A0A0A]">{d.type || 'content'}</span>
                      <span className="text-[#D4D4D8] mx-1.5">·</span>
                      <span>{d._set_name}</span>
                      {submittedAt && (
                        <>
                          <span className="text-[#D4D4D8] mx-1.5">·</span>
                          submitted <span className="font-mono font-semibold text-[#0A0A0A]">{submittedAt}</span>
                        </>
                      )}
                      {!isReview && approvedAt && (
                        <>
                          <span className="text-[#D4D4D8] mx-1.5">·</span>
                          approved <span className="font-mono font-semibold text-[#0A0A0A]">{approvedAt}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Caption / brief notes */}
                {d.caption && (
                  <div className="mb-3 p-2.5 rounded-[10px] bg-[#FAFAFA] border border-[#E4E4E7] text-[12px] text-[#1F1F22] leading-relaxed whitespace-pre-wrap">
                    {d.caption}
                  </div>
                )}

                {/* Media preview (reviews tab only — live tab links to live URL) */}
                {isReview && d.id && <MediaPreview deliverableId={d.id} mediaType={d.media_type || d.type} />}

                {/* Live URL row (confirm-live tab) */}
                {!isReview && d.live_url && (
                  <div className="mb-3 flex items-center justify-between gap-3 p-3 rounded-[10px] bg-[#FAFAFA] border border-[#E4E4E7]">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#71717A] mb-0.5">Live URL</div>
                      <a
                        href={d.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] text-[#0A0A0A] hover:underline truncate block"
                      >
                        {d.live_url}
                      </a>
                    </div>
                    <a
                      href={d.live_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-white border border-[#E4E4E7] text-[#0A0A0A] font-bold text-[11px] rounded-[8px] hover:border-[#0A0A0A] no-underline whitespace-nowrap"
                    >
                      Open post ↗
                    </a>
                  </div>
                )}

                {/* Live stats card */}
                {!isReview && d.id && d.live_url && (
                  <DeliverableStatsCard deliverableId={d.id} type={d.type} />
                )}

                {/* Action buttons */}
                <div className="mt-3 pt-3 border-t border-[#F4F4F5] flex items-center gap-2 flex-wrap">
                  {isReview ? (
                    <>
                      <button
                        onClick={() => handleReview(d.id, 'approve')}
                        disabled={isBusy}
                        className="px-4 py-2 bg-[#0A0A0A] text-[#FFC107] font-bold text-[12px] rounded-[10px] hover:bg-[#1F1F22] disabled:opacity-50 transition-colors"
                      >
                        {isBusy ? 'Working…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReview(d.id, 'request_revision')}
                        disabled={isBusy}
                        className="px-4 py-2 bg-white border border-[#E4E4E7] text-[#0A0A0A] font-bold text-[12px] rounded-[10px] hover:border-[#0A0A0A] disabled:opacity-50 transition-colors"
                      >
                        Request revision
                      </button>
                      {(d.revision_count || 0) > 0 && (
                        <span className="text-[10.5px] font-bold text-[#71717A] ml-1">
                          Revisions used: <span className="font-mono text-[#0A0A0A]">{d.revision_count}</span>{d.revision_limit != null ? ` / ${d.revision_limit}` : ''}
                        </span>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleConfirmLive(d.id)}
                      disabled={isBusy}
                      className="px-4 py-2 bg-[#FFC107] text-[#0A0A0A] font-bold text-[12px] rounded-[10px] hover:bg-[#E0A800] disabled:opacity-50 transition-colors"
                    >
                      {isBusy ? 'Confirming…' : 'Confirm live · release T2'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#0A0A0A] text-white text-[12px] font-semibold px-4 py-3 rounded-[12px] shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
