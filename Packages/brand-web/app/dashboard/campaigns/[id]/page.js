'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { campaignApi, brandApi, deliverableApi, negotiationApi, contractApi, productionApi, applicationApi, fmtRupees, fmtMoney, fmtNum } from '../../../../lib/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = {
    draft: 'bg-gray-100 text-gray-500',
    pending_wallet: 'bg-yellow-100 text-yellow-700',
    published: 'bg-blue-100 text-blue-700',
    active: 'bg-teal-100 text-teal-700',
    live: 'bg-teal-100 text-teal-700',
    completed: 'bg-navy-pale text-navy',
    cancelled: 'bg-red-100 text-red-600',
    // Influencer statuses
    invited: 'bg-blue-100 text-blue-700',
    accepted: 'bg-teal-100 text-teal-700',
    negotiating: 'bg-yellow-100 text-yellow-700',
    contracted: 'bg-purple-100 text-purple-700',
    declined: 'bg-red-100 text-red-600',
    expired: 'bg-gray-100 text-gray-500',
    // Deliverable statuses
    pending: 'bg-gray-100 text-gray-500',
    submitted: 'bg-blue-100 text-blue-700',
    under_review: 'bg-orange-100 text-orange-700',
    revision_requested: 'bg-red-100 text-red-600',
    approved: 'bg-teal-100 text-teal-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${cfg[status] || 'bg-gray-100 text-gray-500'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function GoalBadge({ goal }) {
  const cfg = {
    conversion: 'bg-purple-100 text-purple-700',
    engagement: 'bg-blue-100 text-blue-700',
    hybrid: 'bg-orange-100 text-orange-700',
  };
  return goal ? (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cfg[goal] || 'bg-gray-100 text-gray-500'}`}>
      {goal}
    </span>
  ) : null;
}

function TrancheIcon({ status }) {
  if (status === 'released') return <span className="text-teal text-sm">✓</span>;
  if (status === 'locked')   return <span className="text-navy text-sm">🔒</span>;
  if (status === 'queued')   return <span className="text-yellow-500 text-sm">⏳</span>;
  return <span className="text-gray-300 text-sm">○</span>;
}

function Avatar({ handle, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  const initials = (handle || '??').slice(0, 2).toUpperCase();
  return (
    <div className={`${sz} rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Media Preview (for deliverable content) ────────────────────────────────

function MediaPreview({ deliverableId, mediaType }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!deliverableId) return;
    deliverableApi.getMediaUrl(deliverableId).then(res => {
      if (res.success && res.data?.url) setUrl(res.data.url);
      else setError(true);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, [deliverableId]);

  if (loading) return <div className="mb-3 bg-gray-50 rounded-lg p-4 text-center"><div className="text-xs text-gray-400">Loading media...</div></div>;
  if (error || !url) return null;

  const isVideo = (mediaType || '').startsWith('video');

  return (
    <div className="mb-3 bg-gray-900 rounded-lg overflow-hidden">
      {isVideo ? (
        <video
          src={url}
          controls
          playsInline
          className="w-full max-h-[400px]"
          style={{ objectFit: 'contain' }}
        />
      ) : (
        <img
          src={url}
          alt="Submitted content"
          className="w-full max-h-[400px] object-contain"
        />
      )}
    </div>
  );
}

// ─── Deliverable Stats Card (live deliverable engagement) ────────────────────

function DeliverableStatsCard({ deliverableId, type }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Fetch existing stats from getById endpoint
    deliverableApi.get(deliverableId).then(res => {
      if (res.success && res.data?.stats) setStats(res.data.stats);
    });
  }, [deliverableId]);

  async function handleRefresh() {
    setRefreshing(true);
    const res = await deliverableApi.refreshStats(deliverableId);
    if (res.success && res.data?.stats) {
      setStats(res.data.stats);
    } else {
      alert(res.error?.message || 'Failed to refresh stats');
    }
    setRefreshing(false);
  }

  const fmt = (n) => {
    if (!n && n !== 0) return '--';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  };

  // G.3: honest metrics only. Apify's public Instagram scraper reliably
  // returns likes + comments for every content type, and the video view
  // count (stored in the `impressions` column) for reels. Reach, true
  // impressions, saves, and shares require the Instagram Graph API +
  // the influencer's business account — not available here, always 0.
  const isReel = type === 'reel';
  const tiles = [
    { label: 'Likes',    val: stats?.likes },
    { label: 'Comments', val: stats?.comments },
  ];
  if (isReel) tiles.push({ label: 'Views', val: stats?.impressions });

  return (
    <div className="mt-3 bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-gray-500 uppercase">Live Performance</div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-[10px] font-bold text-navy bg-white border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? 'Fetching...' : 'Refresh Stats'}
        </button>
      </div>
      {stats ? (
        <>
          <div className={`grid ${isReel ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-2`}>
            {tiles.map(s => (
              <div key={s.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                <div className="text-sm font-bold text-gray-800">{fmt(s.val)}</div>
                <div className="text-[9px] text-gray-400 uppercase font-semibold">{s.label}</div>
              </div>
            ))}
          </div>
          {stats.engagement_rate != null && (
            <div className="bg-navy/5 rounded-lg p-2 text-center">
              <span className="text-lg font-bold text-navy">{parseFloat(stats.engagement_rate).toFixed(2)}%</span>
              <span className="text-[9px] text-gray-400 uppercase font-semibold ml-2">Engagement Rate</span>
            </div>
          )}
          <div className="text-[9px] text-gray-400 text-center mt-1.5 leading-tight">
            Reach &amp; saves aren&apos;t public — they need the influencer&apos;s Instagram Business API to be connected.
            {stats.scraped_at && <><br/>Last updated: {new Date(stats.scraped_at).toLocaleString('en-IN')}</>}
          </div>
        </>
      ) : (
        <div className="text-[10px] text-gray-400 text-center py-2">
          No stats yet. Click &quot;Refresh Stats&quot; to fetch live data from Instagram.
        </div>
      )}
    </div>
  );
}

// ─── Negotiation Modal ────────────────────────────────────────────────────────

function NegotiationModal({ inf, negotiation, loading, onClose, onRespond }) {
  const [counterFee, setCounterFee] = useState('');
  const [note, setNote] = useState('');
  const turns = negotiation?.turns || [];
  const lastTurn = turns[turns.length - 1];
  const isMyTurn = negotiation?.next_turn === 'brand';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-gray-900">Negotiation</h2>
              <p className="text-xs text-gray-400 mt-0.5">@{inf.instagram_handle}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
          </div>
        </div>

        {/* Turn history */}
        <div className="p-5 space-y-3 max-h-64 overflow-y-auto">
          {turns.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No turns yet</p>
          ) : turns.map((t, i) => (
            <div key={i} className={`flex ${t.by_role === 'brand' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-xl px-3 py-2 text-xs ${t.by_role === 'brand' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-800'}`}>
                <div className="font-bold mb-0.5">{t.by_role === 'brand' ? 'You' : `@${inf.instagram_handle}`}</div>
                <div className="font-bold text-sm">₹{parseFloat(t.proposed_fee || 0).toFixed(0)}</div>
                {t.note && <div className="mt-1 opacity-80">{t.note}</div>}
                <div className="text-[9px] opacity-60 mt-1 capitalize">{t.action}</div>
              </div>
            </div>
          ))}
        </div>

        {isMyTurn ? (
          <div className="p-5 border-t border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-600">Your turn to respond:</p>
            {lastTurn && (
              <div className="bg-orange-50 rounded-lg px-3 py-2 text-xs text-orange-700">
                Influencer proposes: <strong>₹{parseFloat(lastTurn.proposed_fee || 0).toFixed(0)}</strong>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => onRespond('accept', lastTurn?.proposed_fee, '')}
                disabled={loading}
                className="flex-1 py-2.5 bg-teal-500 text-white font-bold text-xs rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors">
                Accept ₹{parseFloat(lastTurn?.proposed_fee || 0).toFixed(0)}
              </button>
              <button onClick={() => onRespond('decline', 0, '')}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-50 text-red-600 font-bold text-xs rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors">
                Decline
              </button>
            </div>
            <div className="text-xs text-gray-500 font-semibold text-center">— or counter —</div>
            <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
              <span className="px-3 py-2.5 text-sm font-bold text-gray-500 bg-gray-50">₹</span>
              <input value={counterFee} onChange={e => setCounterFee(e.target.value)} type="number"
                placeholder="Your counter fee" className="flex-1 py-2.5 px-2 text-sm outline-none" />
            </div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none" />
            <button onClick={() => onRespond('counter', parseFloat(counterFee || '0'), note)}
              disabled={loading || !counterFee}
              className="w-full py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
              Send Counter Offer
            </button>
          </div>
        ) : (
          <div className="p-5 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400">Waiting for influencer to respond…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Contract Countersign Modal ───────────────────────────────────────────────

const STANDARD_CLAUSES_WEB = [
  {
    id: 'commercial_rights',
    label: 'Commercial Usage Rights',
    description: 'Brand may repurpose your content in paid ads / social / offline marketing.',
    options: [30, 60, 90, 180, 365],
    optionLabel: 'days',
  },
  {
    id: 'category_exclusivity',
    label: 'Category Exclusivity',
    description: 'Influencer won\'t promote competing brands in same category.',
    options: [7, 14, 30],
    optionLabel: 'days',
  },
  {
    id: 'content_ownership',
    label: 'Content Ownership Transfer',
    description: 'Brand owns final approved content; influencer keeps it on their profile.',
    options: [],
  },
];

function ContractModal({ inf, contract, suggestedContentRequirements, goal, loading, brandWalletBalance = 0, platformFeePct = 8, onClose, onSign, onApprove }) {
  // ── HOOKS MUST RUN UNCONDITIONALLY (Rules of Hooks). ──────────────────
  // Compute initial state from contract; fall back to safe defaults when
  // contract is null so we can still call useState on every render. The
  // null-check + early-return now happens AFTER all hook declarations.
  const safeContract = contract || {};
  const initialClauses = (() => {
    const cc = safeContract.custom_clauses;
    if (!cc) return {};
    if (typeof cc === 'string') { try { return (JSON.parse(cc).clauses) || {}; } catch { return {}; } }
    return cc.clauses || {};
  })();
  const initialNotes = (() => {
    const cc = safeContract.custom_clauses;
    if (!cc) return '';
    if (typeof cc === 'string') { try { return (JSON.parse(cc).notes) || ''; } catch { return ''; } }
    return cc.notes || '';
  })();
  const initialRequirements = (() => {
    // Prefer the brand's saved value. Otherwise use the backend's auto-composed
    // starter (deliverables + brief + posting date + coupon) as a baseline.
    if (safeContract.content_requirements && String(safeContract.content_requirements).trim()) {
      return String(safeContract.content_requirements);
    }
    return suggestedContentRequirements || '';
  })();
  const [clauses, setClauses]     = useState(initialClauses);
  const [extraNotes, setExtraNotes] = useState(initialNotes);
  const [bonusAmount, setBonusAmount] = useState(String(safeContract.bonus_amount || ''));
  const [contentReq, setContentReq] = useState(initialRequirements);
  // Production mode picker — visit | shipment | remote. Defaults to whatever's
  // saved (re-edit case) or 'remote' for first-time approval (the safe no-op).
  const [productionMode, setProductionMode] = useState(safeContract.production_mode || 'remote');
  const [pdfSrc, setPdfSrc]       = useState(null);
  const [pdfError, setPdfError]   = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Fetch a fresh presigned R2 URL for the contract PDF whenever the modal
  // opens for a new contract. Using the signed URL directly in an iframe is
  // the fix for the "0 KB download" issue — browsers can render + download
  // the PDF without needing an Authorization header.
  useEffect(() => {
    if (!safeContract.id) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    contractApi.getPdfUrl(safeContract.id).then(res => {
      if (cancelled) return;
      setPdfLoading(false);
      if (res?.success && res.data?.url) {
        setPdfSrc(res.data.url);
      } else {
        setPdfError(res?.error?.message || 'Could not load contract PDF');
      }
    });
    return () => { cancelled = true; };
  }, [safeContract.id]);

  // Now the conditional early-return (after all hooks)
  if (!contract) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">No contract found for this influencer.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold">Close</button>
      </div>
    </div>
  );

  // Goal-aware rows. Conversion campaigns have no fee → show commission instead.
  // Hybrid shows both. Default falls back to engagement (fee) if goal is missing.
  const goalLower      = (goal || 'engagement').toLowerCase();
  const showFee        = goalLower === 'engagement' || goalLower === 'hybrid';
  const showCommission = goalLower === 'conversion' || goalLower === 'hybrid';

  // Brand can edit the draft OR re-edit it after sending (as long as the
  // influencer hasn't signed). isEditing controls the whole edit form UI;
  // isReApprove flips copy to "Update & Re-send" when we're editing a
  // contract that's already in pending_influencer.
  const isDraft     = contract.status === 'draft';
  const isReApprove = contract.status === 'pending_influencer' && !contract.influencer_signed_at;
  const isEditing   = isDraft || isReApprove;

  function toggleClause(id) {
    setClauses(prev => {
      const cur = prev[id];
      if (cur?.enabled) return { ...prev, [id]: { ...cur, enabled: false } };
      const def = STANDARD_CLAUSES_WEB.find(c => c.id === id);
      return { ...prev, [id]: { enabled: true, value: def?.options?.[0] || null } };
    });
  }
  function setClauseValue(id, value) {
    setClauses(prev => ({ ...prev, [id]: { ...(prev[id] || {}), enabled: true, value } }));
  }

  const rows = [
    { label: 'Influencer', value: contract.influencer_name || `@${inf.instagram_handle}` },
    ...(showFee ? [{
      label: 'Agreed Fee',
      value: `₹${Number(contract.influencer_fee || inf.influencer_budget || 0).toLocaleString('en-IN')}`
    }] : []),
    ...(showCommission ? [{
      label: 'Commission',
      value: inf.commission_pct ? `${parseFloat(inf.commission_pct)}% per conversion` : '—'
    }] : []),
    { label: 'Posting Date', value: contract.posting_date ? new Date(contract.posting_date).toLocaleDateString('en-IN') : '—' },
    { label: 'Revision Limit', value: contract.revision_limit ?? 2 },
    { label: 'Influencer Signed', value: contract.influencer_signed_at ? new Date(contract.influencer_signed_at).toLocaleString('en-IN') : 'Not yet' },
    { label: 'Contract Status', value: contract.status?.replace(/_/g, ' ') },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
        {/* Sticky header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="font-display font-bold text-gray-900">Review & Sign Contract</h2>
            <p className="text-xs text-gray-400 mt-0.5">@{inf.instagram_handle} · {contract.campaign_name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
        </div>

        {/* Scrollable body — everything except the sticky header / footer */}
        <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-2">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-gray-400 text-xs font-medium">{r.label}</span>
              <span className="font-semibold text-gray-800 text-xs capitalize">{r.value}</span>
            </div>
          ))}
          {contract.content_requirements && (
            <div className="mt-3 bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
              <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Content Requirements</div>
              {contract.content_requirements}
            </div>
          )}
          {/* Inline PDF preview — uses the presigned R2 URL returned by
              /contracts/:id/pdf-url. The signed URL needs no auth header so
              browsers render it inline and "Download" saves the real file. */}
          {contract.id && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Contract PDF</span>
                <div className="flex items-center gap-3">
                  {pdfSrc && (
                    <a href={pdfSrc} target="_blank" rel="noreferrer"
                      className="text-xs text-navy font-semibold hover:underline">Open / Download ↗</a>
                  )}
                  <button
                    onClick={async () => {
                      const res = await contractApi.regeneratePdf(contract.id);
                      if (res.success && res.data?.url) {
                        setPdfSrc(res.data.url);
                        setPdfError(null);
                      } else if (res.success) {
                        // Backend didn't inline a URL — refetch it.
                        const urlRes = await contractApi.getPdfUrl(contract.id);
                        if (urlRes?.success && urlRes.data?.url) setPdfSrc(urlRes.data.url);
                      } else {
                        alert(res.error?.message || 'Regenerate failed');
                      }
                    }}
                    className="text-xs text-gray-500 font-semibold hover:text-gray-700">
                    Regenerate
                  </button>
                </div>
              </div>
              {pdfLoading && (
                <div className="w-full h-[420px] border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                  Preparing contract PDF…
                </div>
              )}
              {pdfError && !pdfLoading && (
                <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  {pdfError}
                </div>
              )}
              {pdfSrc && !pdfLoading && !pdfError && (
                <iframe
                  id={`contract-pdf-${contract.id}`}
                  src={pdfSrc}
                  className="w-full h-[420px] border border-gray-200 rounded-lg bg-gray-50"
                  title="Contract PDF"
                />
              )}
              {contract.pdf_generation_error && (
                <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  Last PDF generation failed: {contract.pdf_generation_error}
                </div>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="p-5 border-t border-gray-100 space-y-4 bg-amber-50/30">
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
              <div className="text-xs font-bold text-amber-900 mb-1">
                {isReApprove ? '✏️ Update Terms Before Influencer Signs' : '📝 Draft — Your Review'}
              </div>
              <div className="text-[11px] text-amber-800 leading-relaxed">
                {isReApprove
                  ? 'The influencer has not signed yet, so you can still edit the content requirements, clauses, and bonus. Click Update & Re-send to notify them.'
                  : 'The influencer accepted your offer. Confirm the content requirements, tick any optional clauses, and add a bonus if you want, then send.'}
              </div>
            </div>

            {/* Content Requirements — auto-filled from deliverables + brief. */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-bold text-gray-700">Content Requirements</div>
                {suggestedContentRequirements && contentReq !== suggestedContentRequirements && (
                  <button onClick={() => setContentReq(suggestedContentRequirements)}
                    className="text-[10px] font-semibold text-navy hover:underline">
                    Restore default
                  </button>
                )}
              </div>
              <textarea value={contentReq} onChange={e => setContentReq(e.target.value)}
                placeholder="What exactly should the influencer create?"
                className="w-full border border-gray-200 rounded-lg p-2 text-xs font-mono leading-relaxed"
                rows={10}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Pre-filled from the campaign brief + deliverables. Edit freely — this text is what the influencer sees in the signed PDF.
              </p>
            </div>

            {/* Clause toggles */}
            <div>
              <div className="text-xs font-bold text-gray-700 mb-2">Optional Clauses</div>
              {STANDARD_CLAUSES_WEB.map(c => {
                const cur = clauses[c.id];
                const enabled = !!cur?.enabled;
                return (
                  <div key={c.id} className={`mb-2 border rounded-lg p-2 ${enabled ? 'border-teal-400 bg-teal-50' : 'border-gray-200'}`}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={enabled} onChange={() => toggleClause(c.id)} className="mt-1" />
                      <div className="flex-1">
                        <div className="text-[12px] font-bold text-gray-800">{c.label}</div>
                        <div className="text-[10px] text-gray-500">{c.description}</div>
                      </div>
                    </label>
                    {enabled && c.options.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2 ml-6">
                        {c.options.map(opt => (
                          <button key={opt} onClick={() => setClauseValue(c.id, opt)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cur.value === opt ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                            {opt} {c.optionLabel}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <div className="text-xs font-bold text-gray-700 mb-1">Additional Notes (optional)</div>
              <textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)}
                placeholder="e.g. must wear blue shirt, tag our outlet"
                className="w-full border border-gray-200 rounded-lg p-2 text-xs" rows={2} />
            </div>

            {showFee && (() => {
              // Live wallet check — bonus pushes total escrow lock past
              // brand's wallet balance? Show running breakdown + warning,
              // and the approve button below disables itself when over.
              const baseFeeNum   = parseFloat(contract.influencer_fee || inf.influencer_budget || 0);
              const bonusNum     = parseFloat(bonusAmount) || 0;
              const totalFeeNum  = baseFeeNum + bonusNum;
              const lockNeeded   = totalFeeNum * (1 + platformFeePct / 100);
              const overByNum    = lockNeeded - brandWalletBalance;
              const isOver       = overByNum > 0.01;
              return (
                <div>
                  <div className="text-xs font-bold text-gray-700 mb-1">Bonus on top of fee (optional)</div>
                  <div className={`flex items-center border-2 rounded-lg overflow-hidden ${isOver ? 'border-red-500' : 'border-navy'}`}>
                    <span className="px-3 text-base font-bold text-gray-500">₹</span>
                    <input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)}
                      placeholder="0" min="0"
                      className="flex-1 py-2 px-2 text-base font-bold outline-none" />
                  </div>
                  {/* Live breakdown — shown whenever there's a bonus OR
                      whenever the total exceeds the wallet, so the brand
                      sees exactly why their approve might be blocked. */}
                  {(bonusNum > 0 || isOver) && (
                    <div className={`mt-2 rounded-lg p-2.5 text-[11px] ${isOver ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className="flex justify-between text-gray-600">
                        <span>Base fee</span>
                        <span>₹{baseFeeNum.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 mt-0.5">
                        <span>+ Bonus</span>
                        <span>₹{bonusNum.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-gray-800 mt-1 pt-1 border-t border-gray-200">
                        <span>Influencer total</span>
                        <span>₹{totalFeeNum.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 mt-0.5">
                        <span>+ {platformFeePct}% platform fee</span>
                        <span>₹{(lockNeeded - totalFeeNum).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-900 mt-1 pt-1 border-t border-gray-300">
                        <span>Wallet escrow at signing</span>
                        <span>₹{lockNeeded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 mt-1">
                        <span>Wallet balance</span>
                        <span>₹{brandWalletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      {isOver && (
                        <div className="mt-2 pt-2 border-t border-red-200 text-red-700 font-semibold">
                          Wallet short by ₹{overByNum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}.{' '}
                          <a href="/dashboard/wallet" className="underline">Top up wallet →</a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Production mode — how will the influencer actually create the
                content? Locked once influencer signs; pickable here. */}
            <div>
              <div className="text-xs font-bold text-gray-700 mb-1.5">How will the content be produced?</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'visit',    label: 'Visit',    icon: '🏬', sub: 'Influencer visits your store / location' },
                  { v: 'shipment', label: 'Shipment', icon: '📦', sub: 'You ship product to influencer' },
                  { v: 'remote',   label: 'Remote',   icon: '💻', sub: 'No physical exchange' },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setProductionMode(opt.v)}
                    className={`p-2 rounded-lg border-2 text-left transition-colors ${productionMode === opt.v ? 'border-navy bg-navy-pale/30' : 'border-gray-200 bg-white hover:border-navy/40'}`}>
                    <div className="text-base">{opt.icon}</div>
                    <div className="text-[11px] font-bold text-gray-800 mt-0.5">{opt.label}</div>
                    <div className="text-[9px] text-gray-500 leading-snug mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                You'll fill in address / time / shipping details after both parties sign.
              </p>
            </div>

            {(() => {
              // Recompute the wallet check so we can disable the button
              // when fee+bonus pushes past wallet. Backend also enforces
              // this — frontend disable is just for UX clarity.
              const baseFeeNum  = parseFloat(contract.influencer_fee || inf.influencer_budget || 0);
              const bonusNum    = parseFloat(bonusAmount) || 0;
              const lockNeeded  = (baseFeeNum + bonusNum) * (1 + platformFeePct / 100);
              const isOver      = showFee && lockNeeded > brandWalletBalance + 0.01;
              return (
                <button onClick={() => onApprove({
                  custom_clauses:       { clauses, notes: extraNotes || null },
                  bonus_amount:         parseFloat(bonusAmount) || 0,
                  content_requirements: contentReq || null,
                  production_mode:      productionMode,
                })} disabled={loading || isOver}
                  className="w-full py-3 bg-gradient-to-r from-navy to-navy/80 text-white font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Sending…' : isOver ? 'Top up wallet to send' : (isReApprove ? 'Update & Re-send to Influencer' : 'Approve & Send to Influencer')}
                </button>
              );
            })()}
          </div>
        ) : contract.status === 'pending_brand' ? (
          <div className="p-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-3">
              {showFee
                ? `By signing, you confirm the above terms. Tranche 1 (${contract.influencer_fee ? `₹${(contract.influencer_fee * 0.25).toLocaleString('en-IN')}` : '25%'}) will be queued for release.`
                : `By signing, you confirm the above terms. Commissions will be paid as conversions happen, after the 30-day return window.`}
            </p>
            <button onClick={onSign} disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-navy to-navy/80 text-white font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
              {loading ? 'Signing…' : 'Sign Contract'}
            </button>
          </div>
        ) : (
          <div className="p-5 border-t border-gray-100 text-center text-xs text-gray-400">
            {contract.brand_signed_at ? `You signed on ${new Date(contract.brand_signed_at).toLocaleString('en-IN')}` : 'Waiting for influencer signature first.'}
          </div>
        )}

        {/* Production coordination (only after contract is active). The
            production mode picker on the approve form decides what shows
            here — visit form, shipment dispatch form, or a "remote" notice. */}
        {contract.status === 'active' && (
          <ProductionPanel contractId={contract.id} />
        )}
        </div>{/* /scrollable body */}
      </div>
    </div>
  );
}

// ─── Production Panel (visible after contract activates) ──────────────────────

function ProductionPanel({ contractId }) {
  const [event, setEvent] = useState(null);
  const [mode, setMode] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Visit form state
  const [vAddress, setVAddress]     = useState('');
  const [vCity, setVCity]           = useState('');
  const [vPincode, setVPincode]     = useState('');
  const [vScheduledAt, setVScheduledAt] = useState('');  // datetime-local
  const [vWindow, setVWindow]       = useState(60);
  const [vContactName, setVContactName] = useState('');
  const [vContactPhone, setVContactPhone] = useState('');

  // Shipment form state
  const [courier, setCourier] = useState('');
  const [awb, setAwb] = useState('');
  const [expectedAt, setExpectedAt] = useState('');

  async function load() {
    setLoading(true);
    const res = await productionApi.get(contractId);
    setLoading(false);
    if (res.success) {
      setEvent(res.data?.production_event || null);
      setMode(res.data?.production_mode || null);
      setLog(res.data?.log || []);
      const e = res.data?.production_event;
      if (e) {
        setVAddress(e.visit_address || '');
        setVCity(e.visit_city || '');
        setVPincode(e.visit_pincode || '');
        setVScheduledAt(e.visit_scheduled_at ? new Date(e.visit_scheduled_at).toISOString().slice(0, 16) : '');
        setVWindow(e.visit_window_minutes || 60);
        setVContactName(e.visit_contact_name || '');
        setVContactPhone(e.visit_contact_phone || '');
        setCourier(e.shipment_courier || '');
        setAwb(e.shipment_awb || '');
        setExpectedAt(e.shipment_expected_at ? new Date(e.shipment_expected_at).toISOString().slice(0, 10) : '');
      }
    }
  }

  useEffect(() => { load(); }, [contractId]);

  async function saveVisitDetails() {
    setSaving(true); setError(null);
    const res = await productionApi.setVisitDetails(contractId, {
      visit_address: vAddress.trim(),
      visit_city:    vCity.trim() || null,
      visit_pincode: vPincode.trim() || null,
      visit_scheduled_at: vScheduledAt ? new Date(vScheduledAt).toISOString() : null,
      visit_window_minutes: Number(vWindow) || null,
      visit_contact_name: vContactName.trim() || null,
      visit_contact_phone: vContactPhone.trim() || null,
    });
    setSaving(false);
    if (res.success) load();
    else setError(res.error?.message || 'Save failed');
  }

  async function saveDispatch() {
    if (!event) return;
    setSaving(true); setError(null);
    const res = await productionApi.dispatch(event.id, {
      courier:     courier.trim(),
      awb:         awb.trim(),
      expected_at: expectedAt ? new Date(expectedAt).toISOString() : null,
    });
    setSaving(false);
    if (res.success) load();
    else setError(res.error?.message || 'Dispatch failed');
  }

  async function markVisitDone() {
    if (!event) return;
    setSaving(true); setError(null);
    const res = await productionApi.complete(event.id, {});
    setSaving(false);
    if (res.success) load();
    else setError(res.error?.message || 'Complete failed');
  }

  if (loading) return <div className="p-5 border-t border-gray-100 text-xs text-gray-400">Loading production…</div>;
  if (mode === 'remote' || !event) {
    return (
      <div className="p-5 border-t border-gray-100">
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 text-center">
          {mode === 'remote'
            ? '💻 Remote mode — no physical coordination needed. Influencer will start content from the brief.'
            : 'No production event yet. The influencer will see logistics here once you fill them in.'}
        </div>
      </div>
    );
  }

  const STATUS_COLORS = {
    proposed:     'bg-amber-100 text-amber-800',
    confirmed:    'bg-blue-100 text-blue-800',
    in_progress:  'bg-purple-100 text-purple-800',
    completed:    'bg-teal-100 text-teal-800',
    cancelled:    'bg-red-100 text-red-700',
  };
  const statusCls = STATUS_COLORS[event.status] || 'bg-gray-100 text-gray-700';

  return (
    <div className="p-5 border-t border-gray-100 bg-navy-pale/20">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-bold text-gray-700">
            {event.mode === 'visit' ? '🏬 Visit Coordination' : '📦 Product Shipment'}
          </div>
          <div className="text-[10px] text-gray-500">
            Influencer: {event.mode === 'visit'
              ? (event.status === 'proposed' ? 'awaiting confirmation' : event.status === 'confirmed' ? 'will visit on schedule' : 'visit complete')
              : (event.status === 'proposed' ? 'awaiting address confirmation' : event.status === 'confirmed' ? 'awaiting dispatch' : event.status === 'in_progress' ? 'package in transit' : 'package received')}
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusCls}`}>
          {event.status.replace(/_/g, ' ')}
        </span>
      </div>

      {error && <div className="mb-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      {event.mode === 'visit' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={vAddress} onChange={e => setVAddress(e.target.value)} placeholder="Address line"
              className="col-span-2 border border-gray-200 rounded-lg p-2 text-xs" />
            <input value={vCity} onChange={e => setVCity(e.target.value)} placeholder="City"
              className="border border-gray-200 rounded-lg p-2 text-xs" />
            <input value={vPincode} onChange={e => setVPincode(e.target.value)} placeholder="Pincode"
              className="border border-gray-200 rounded-lg p-2 text-xs" />
            <input type="datetime-local" value={vScheduledAt} onChange={e => setVScheduledAt(e.target.value)}
              className="border border-gray-200 rounded-lg p-2 text-xs" />
            <select value={vWindow} onChange={e => setVWindow(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-xs">
              <option value={30}>30 min window</option>
              <option value={60}>1 hour window</option>
              <option value={120}>2 hour window</option>
              <option value={240}>Half day</option>
            </select>
            <input value={vContactName} onChange={e => setVContactName(e.target.value)} placeholder="Contact name"
              className="border border-gray-200 rounded-lg p-2 text-xs" />
            <input value={vContactPhone} onChange={e => setVContactPhone(e.target.value)} placeholder="Contact phone"
              className="border border-gray-200 rounded-lg p-2 text-xs" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveVisitDetails} disabled={saving || !vAddress.trim()}
              className="flex-1 py-2 bg-navy text-white text-xs font-bold rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : event.visit_address ? 'Update visit details' : 'Send to influencer'}
            </button>
            {event.status === 'confirmed' && (
              <button onClick={markVisitDone} disabled={saving}
                className="flex-1 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                Mark visit done
              </button>
            )}
          </div>
          {event.reschedule_count_brand > 0 && (
            <div className="text-[10px] text-gray-500">Reschedules used: {event.reschedule_count_brand} of 2</div>
          )}
        </div>
      )}

      {event.mode === 'shipment' && (
        <div className="space-y-2">
          <div className="text-[11px] text-gray-600 bg-white border border-gray-200 rounded p-2">
            <span className="font-semibold">Shipping to: </span>
            {[event.shipment_to_address_line, event.shipment_to_city, event.shipment_to_state, event.shipment_to_pincode].filter(Boolean).join(', ') || 'Address not yet provided'}
          </div>
          {event.status === 'confirmed' && (
            <>
              <input value={courier} onChange={e => setCourier(e.target.value)} placeholder="Courier (e.g. Bluedart, Delhivery)"
                list="courier-suggestions"
                className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
              <datalist id="courier-suggestions">
                <option value="Bluedart" /><option value="Delhivery" /><option value="Shiprocket" />
                <option value="DTDC" /><option value="India Post" /><option value="Ekart" />
                <option value="XpressBees" /><option value="Ecom Express" />
              </datalist>
              <input value={awb} onChange={e => setAwb(e.target.value)} placeholder="AWB / Tracking number"
                className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
              <input type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
              <button onClick={saveDispatch} disabled={saving || !courier.trim() || !awb.trim()}
                className="w-full py-2 bg-navy text-white text-xs font-bold rounded-lg disabled:opacity-50">
                {saving ? 'Marking…' : 'Mark as dispatched'}
              </button>
            </>
          )}
          {event.status === 'in_progress' && (
            <div className="text-[11px] bg-white border border-gray-200 rounded p-2">
              <div><span className="font-semibold">Courier:</span> {event.shipment_courier || '—'}</div>
              <div><span className="font-semibold">AWB:</span> {event.shipment_awb || '—'}</div>
              {event.shipment_expected_at && <div><span className="font-semibold">Expected:</span> {new Date(event.shipment_expected_at).toLocaleDateString('en-IN')}</div>}
              <div className="text-gray-500 mt-1">Awaiting influencer to confirm receipt.</div>
            </div>
          )}
          {event.status === 'completed' && (
            <div className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded p-2">
              ✓ Package received {event.shipment_received_confirmed_at ? `on ${new Date(event.shipment_received_confirmed_at).toLocaleDateString('en-IN')}` : ''}.
            </div>
          )}
        </div>
      )}

      {/* Audit log strip */}
      {log.length > 0 && (
        <details className="mt-3">
          <summary className="text-[10px] text-gray-500 font-semibold cursor-pointer hover:text-gray-700">
            History ({log.length} action{log.length !== 1 ? 's' : ''})
          </summary>
          <div className="mt-2 space-y-1">
            {log.map(l => (
              <div key={l.id} className="text-[10px] text-gray-600 flex gap-2">
                <span className="text-gray-400 w-24 flex-shrink-0">{new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-gray-400 w-16 flex-shrink-0 capitalize">{l.actor_role}</span>
                <span>{(l.action || '').replace(/_/g, ' ')}{l.notes ? ` — ${l.notes}` : ''}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Campaign Detail Page ─────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [tab, setTab]             = useState('overview');
  const [campaign, setCampaign]   = useState(null);
  const [liveData, setLiveData]   = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [conversions, setConversions] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState('');
  const [negModal, setNegModal]   = useState(null); // { inf, negotiation }
  const [negLoading, setNegLoading] = useState(false);
  const [contractModal, setContractModal] = useState(null); // { inf, contract }
  const [contractLoading, setContractLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellingInf, setCancellingInf] = useState(null); // campaign_influencer id being cancelled

  const [loadError, setLoadError] = useState(null);
  const [campaignProducts, setCampaignProducts] = useState(null);

  // Drill-down expanded state for overview tree
  const [expandedSets, setExpandedSets] = useState({});
  const [expandedInfs, setExpandedInfs] = useState({});
  // Product tab influencer filter
  const [productInfFilter, setProductInfFilter] = useState('all');
  // Analytics drill-down
  const [expandedAnalyticsSets, setExpandedAnalyticsSets] = useState({});
  const [expandedAnalyticsInfs, setExpandedAnalyticsInfs] = useState({});
  // Conversions drill-down
  const [expandedConvInfs, setExpandedConvInfs] = useState({});

  // ── Load campaign (sets + influencers included) ──────────────────────────
  useEffect(() => {
    campaignApi.get(id).then(res => {
      setLoading(false);
      if (res.success) {
        setCampaign(res.data?.campaign || res.data);
      } else {
        setLoadError(res.error?.message || res.error?.code || 'Failed to load campaign');
      }
    }).catch(err => {
      setLoading(false);
      setLoadError(err.message || 'Network error');
    });
  }, [id]);

  // ── Lazy-load tab-specific data ──────────────────────────────────────────
  useEffect(() => {
    if (tab === 'content' && !liveData) {
      campaignApi.getLive(id).then(res => {
        if (res.success) setLiveData(res.data?.campaign || res.data);
      });
    }
    if (tab === 'analytics' && !engagement) {
      campaignApi.getEngagement(id).then(res => { if (res.success) setEngagement(res.data); });
    }
    if (tab === 'conversions' && !conversions) {
      campaignApi.getConversions(id).then(res => { if (res.success) setConversions(res.data); });
    }
    if (tab === 'products' && !campaignProducts) {
      // Fetch products assigned to this campaign via influencer offers
      campaignApi.get(id + '/products').then(res => {
        if (res.success) setCampaignProducts(res.data || { products: [], influencers: [] });
      });
    }
  }, [tab]);

  // Auto-load engagement + conversions + products when campaign first loads
  // so the Overview tab can show real campaign-level rollups without the
  // user having to switch tabs first.
  useEffect(() => {
    if (!campaign) return;
    if (!engagement) {
      campaignApi.getEngagement(id).then(res => { if (res.success) setEngagement(res.data); });
    }
    // Conversion / hybrid only — engagement-only campaigns don't have these.
    const goalsLocal = (campaign.sets || []).map(s => (s.goal || '').toLowerCase()).filter(Boolean);
    const hasConversionLocal = goalsLocal.some(g => g === 'conversion' || g === 'hybrid');
    if (hasConversionLocal) {
      if (!conversions) {
        campaignApi.getConversions(id).then(res => { if (res.success) setConversions(res.data); });
      }
      if (!campaignProducts) {
        campaignApi.get(id + '/products').then(res => {
          if (res.success) setCampaignProducts(res.data || { products: [], influencers: [] });
        });
      }
    }
  }, [campaign?.id]);

  // If user lands on a tab that's not visible for this goal, snap to overview.
  // NOTE: TABS is declared AFTER this hook (after the loading guards), so we
  // cannot reference it directly here — that would throw ReferenceError on
  // first render due to const TDZ. Instead recompute the tab list inline.
  useEffect(() => {
    if (!campaign) return;
    const setsLocal = campaign.sets || [];
    const goalSetLocal = new Set(setsLocal.map(s => (s.goal || '').toLowerCase()).filter(Boolean));
    const isEngagementOnly = goalSetLocal.size > 0 && [...goalSetLocal].every(g => g === 'engagement');
    const visibleTabs = isEngagementOnly
      ? ['overview', 'content', 'analytics']
      : ['overview', 'products', 'content', 'analytics', 'conversions'];
    if (!visibleTabs.includes(tab)) setTab('overview');
  }, [campaign?.id]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleReview(deliverableId, action, feedback) {
    const res = await deliverableApi.review(deliverableId, { action, feedback });
    if (res.success) {
      showToast(`Content ${action === 'approve' ? 'approved' : 'sent for revision'}`);
      // Refresh live data
      campaignApi.getLive(id).then(r => { if (r.success) setLiveData(r.data?.campaign || r.data); });
    } else showToast(res.error?.message || 'Action failed');
  }

  async function handleConfirmLive(deliverableId) {
    const res = await deliverableApi.confirmLive(deliverableId);
    if (res.success) {
      showToast('Content marked as live!');
      campaignApi.getLive(id).then(r => { if (r.success) setLiveData(r.data?.campaign || r.data); });
    } else showToast(res.error?.message || 'Failed');
  }

  async function openNegModal(inf, goal) {
    let res;
    if (inf.negotiation_id) {
      res = await negotiationApi.get(inf.negotiation_id);
    } else if (inf.status === 'negotiating') {
      // Fallback: look up negotiation by campaign_influencer_id
      res = await negotiationApi.getByCampaignInfluencer(inf.id);
    } else {
      showToast('No negotiation thread found');
      return;
    }
    if (res.success) setNegModal({ inf, negotiation: res.data?.negotiation || res.data, goal });
    else showToast(res.error?.message || 'Failed to load negotiation');
  }

  async function handleNegRespond(action, proposedFee, note) {
    if (!negModal) return;
    setNegLoading(true);
    const negId = negModal.negotiation?.id || negModal.inf.negotiation_id;
    const res = await negotiationApi.respond(negId, { action, proposed_fee: proposedFee, note });
    setNegLoading(false);
    if (res.success) {
      showToast(action === 'accept' ? 'Offer accepted!' : action === 'decline' ? 'Offer declined' : 'Counter sent');
      setNegModal(null);
      campaignApi.get(id).then(r => { if (r.success) setCampaign(r.data?.campaign || r.data); });
    } else showToast(res.error?.message || 'Failed');
  }

  async function openContractModal(inf, goal) {
    // Fetch contract + brand profile in parallel — we need wallet balance
    // and platform fee % for the live "can the brand actually pay this?"
    // check in the bonus row.
    const [contractRes, brandRes] = await Promise.all([
      contractApi.get(inf.id),
      brandApi.getMe(),
    ]);
    if (contractRes.success) {
      const brand = brandRes.data?.brand || brandRes.data || {};
      setContractModal({
        inf,
        contract: contractRes.data?.contract || contractRes.data,
        suggested_content_requirements: contractRes.data?.suggested_content_requirements || '',
        goal,
        brand_wallet_balance: parseFloat(brand.wallet_balance || 0),
        platform_fee_pct:     parseFloat(brand.platform_fee_pct || 8),
      });
    } else {
      showToast(contractRes.error?.message || 'Failed to load contract');
    }
  }

  async function handleApproveContract(payload) {
    if (!contractModal?.contract) return;
    setContractLoading(true);
    const res = await contractApi.approve(contractModal.contract.id, payload);
    setContractLoading(false);
    if (res.success) {
      const wasReApprove = res.data?.re_approved;
      showToast(wasReApprove ? 'Updated terms sent \u2014 influencer notified.' : 'Contract sent to influencer for signing.');
      setContractModal(null);
      campaignApi.get(id).then(r => { if (r.success) setCampaign(r.data?.campaign || r.data); });
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

  async function handleBrandSign() {
    if (!contractModal?.contract) return;
    setContractLoading(true);
    const res = await contractApi.brandSign(contractModal.contract.id);
    setContractLoading(false);
    if (res.success) {
      showToast('Contract signed! Tranche 1 queued.');
      setContractModal(null);
      campaignApi.get(id).then(r => { if (r.success) setCampaign(r.data?.campaign || r.data); });
    } else showToast(res.error?.message || 'Failed');
  }

  async function handleCancel() {
    if (!window.confirm(`Cancel campaign "${campaign.name}"? Any unreleased escrow will be refunded to your wallet.`)) return;
    setCancelling(true);
    const res = await campaignApi.cancel(id);
    setCancelling(false);
    if (res.success) {
      showToast(`Campaign cancelled. Refund: ₹${res.data?.refund_rupees || '0.00'}`);
      setCampaign(prev => ({ ...prev, status: 'cancelled' }));
    } else showToast(res.error?.message || 'Failed to cancel');
  }

  async function handleCancelInfluencer(inf) {
    if (!window.confirm(`Cancel assignment for @${inf.instagram_handle}? They will be notified.`)) return;
    setCancellingInf(inf.id);
    const res = await campaignApi.cancelInfluencer(id, inf.id);
    setCancellingInf(null);
    if (res.success) {
      showToast(`Assignment cancelled for @${inf.instagram_handle}. Refund: ₹${res.data?.refund_rupees || '0.00'}`);
      campaignApi.get(id).then(r => { if (r.success) setCampaign(r.data?.campaign || r.data); });
    } else showToast(res.error?.message || 'Failed to cancel assignment');
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading campaign…</div>;
  if (!campaign) return <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm">Campaign not found{loadError ? `: ${loadError}` : ''} <button className="ml-2 underline" onClick={() => { setLoading(true); setLoadError(null); campaignApi.get(id).then(res => { setLoading(false); if (res.success) setCampaign(res.data?.campaign || res.data); else setLoadError(JSON.stringify(res)); }); }}>Retry</button></div>;

  // ── Derived data ─────────────────────────────────────────────────────────
  const sets         = campaign.sets || [];
  const allInfluencers = sets.flatMap(s => (s.influencers || []).map(inf => ({ ...inf, _set: s })));
  const totalBudget  = Number(campaign.total_budget || 0);
  const setBudgetSum = sets.reduce((t, s) => t + Number(s.set_budget || 0), 0);
  const totalInfluencers = allInfluencers.length;

  // Goal classification — a campaign is "conversion-only" if every set is
  // conversion, "engagement-only" if every set is engagement, otherwise hybrid/mixed.
  const goalSet = new Set(sets.map(s => (s.goal || '').toLowerCase()).filter(Boolean));
  const hasConversion        = goalSet.has('conversion') || goalSet.has('hybrid');
  const hasEngagement        = goalSet.has('engagement') || goalSet.has('hybrid');
  const isConversionCampaign = goalSet.size > 0 && [...goalSet].every(g => g === 'conversion');
  const isEngagementCampaign = goalSet.size > 0 && [...goalSet].every(g => g === 'engagement');

  // Tab visibility per goal:
  //  Engagement only  → Overview / Content / Analytics
  //  Conversion only  → Overview / Products / Content / Analytics / Conversions
  //  Hybrid (or mix)  → Overview / Products / Content / Analytics / Conversions
  const TABS = isEngagementCampaign
    ? ['overview', 'content', 'analytics']
    : ['overview', 'products', 'content', 'analytics', 'conversions'];

  // Campaign-level rollups computed from already-loaded data.
  const allDeliverables = allInfluencers.flatMap(i => i.deliverables || []);
  const deliverableCounts = {
    total:       allDeliverables.length,
    submitted:   allDeliverables.filter(d => ['submitted', 'under_review'].includes(d.status)).length,
    approved:    allDeliverables.filter(d => d.status === 'approved').length,
    live:        allDeliverables.filter(d => d.status === 'live').length,
    pending:     allDeliverables.filter(d => d.status === 'pending').length,
    revision:    allDeliverables.filter(d => d.status === 'revision_requested').length,
  };
  const activeOffers = allInfluencers.filter(i => ['contracted','active','live'].includes(i.status)).length;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <a href="/dashboard/campaigns" className="text-gray-400 hover:text-gray-600">← Campaigns</a>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 font-medium truncate">{campaign.name}</span>
      </div>

      {/* Campaign header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-display text-xl font-bold text-gray-900">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
              <span>📅 {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('en-IN') : '—'} – {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('en-IN') : '—'}</span>
              <span>👤 {totalInfluencers} influencer{totalInfluencers !== 1 ? 's' : ''}</span>
              <span>📂 {sets.length} set{sets.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {campaign.status === 'draft' && (
              <a href={`/dashboard/campaigns/new?id=${id}`}
                className="px-4 py-2 bg-orange-50 border border-orange-200 text-orange-700 font-bold text-xs rounded-xl hover:bg-orange-100 transition-colors">
                ✏️ Continue Editing
              </a>
            )}
            {['draft', 'pending_wallet'].includes(campaign.status) && (
              <button onClick={handleCancel} disabled={cancelling}
                className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 font-bold text-xs rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50">
                {cancelling ? 'Cancelling…' : '✕ Cancel Campaign'}
              </button>
            )}
            <a href={`/dashboard/campaigns/${id}/escrow`}
              className="px-4 py-2 bg-white border border-gray-200 text-xs font-semibold text-gray-600 rounded-xl hover:border-navy hover:text-navy transition-colors">
              Escrow →
            </a>
          </div>
        </div>

        {/* Budget strip — hidden for conversion campaigns */}
        {totalBudget > 0 && !isConversionCampaign && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Campaign budget</span>
              <span className="font-semibold text-gray-700">{fmtRupees(setBudgetSum)} allocated / {fmtRupees(totalBudget)} total</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${setBudgetSum > totalBudget ? 'bg-red-500' : setBudgetSum / totalBudget > 0.8 ? 'bg-yellow-400' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`}
                style={{ width: `${Math.min(100, totalBudget > 0 ? (setBudgetSum / totalBudget) * 100 : 0)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors capitalize ${tab === t ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/*
            Goal-aware campaign-level stats.
            • Engagement-only: budget + activity (no commission/transactions)
            • Conversion-only: commerce metrics (no budget concept)
            • Hybrid: a mix of both
            We removed the misleading single "Commission Rate" stat — each
            influencer negotiates their own % so an average is meaningless.
          */}
          {(() => {
            // Overview tiles only use funnel + money. Engagement numbers live
            // on the Analytics tab (G.4) so we don't pull them here.
            const txCount      = conversions?.total_transactions ?? conversions?.summary?.total_transactions ?? null;
            const txRevenue    = conversions?.total_revenue      ?? conversions?.summary?.total_revenue      ?? null;
            const txCommission = conversions?.total_commission   ?? conversions?.summary?.total_commission   ?? null;
            const productCount = campaignProducts?.products?.length ?? campaignProducts?.summary?.total_products ?? null;

            // Build the stat cards — Overview shows funnel + money only.
            // Performance metrics (deliverables, reach, engagement, ER) live
            // in the Analytics tab so Overview stays focused on "who / where
            // / how much". G.2 cleanup.
            let cards = [];

            cards.push({ label: 'Influencers',  value: totalInfluencers });
            cards.push({ label: 'Active Offers', value: activeOffers, sub: `of ${totalInfluencers} invited` });
            cards.push({ label: 'Sets',         value: sets.length });
            cards.push({ label: 'Status',       value: (campaign.status || '—').replace(/_/g, ' ') });

            // Money / commerce rollups
            if (hasEngagement) {
              cards.push({ label: 'Total Budget', value: fmtRupees(totalBudget) });
            }
            if (hasConversion) {
              cards.push({ label: 'Total Products', value: productCount != null ? productCount : '—', sub: productCount == null ? 'Loading…' : '' });
              cards.push({ label: 'Conversions',    value: txCount != null ? Number(txCount).toLocaleString('en-IN') : '—' });
              cards.push({ label: 'Revenue',        value: txRevenue != null ? fmtRupees(txRevenue) : '—' });
              cards.push({ label: 'Commission Paid', value: txCommission != null ? fmtRupees(txCommission) : '—' });
            }

            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {cards.map((s, i) => (
                  <div key={`${s.label}-${i}`} className="bg-white rounded-xl border border-gray-200 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{s.label}</div>
                    <div className="font-display text-lg font-extrabold text-gray-900 capitalize">{s.value}</div>
                    {s.sub && <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Drill-Down Hierarchy Tree ───────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">Campaign Hierarchy</div>
            </div>
            <div className="p-4">
              {/* Campaign root */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-gray-900">{campaign.name}</span>
                <StatusBadge status={campaign.status} />
              </div>
              {/* Sets */}
              {sets.map(set => {
                const setInfs = set.influencers || [];
                const setKey = `set-${set.id}`;
                const isSetOpen = expandedSets[setKey];
                return (
                  <div key={set.id} className="ml-4 border-l-2 border-gray-200 pl-4 mt-2">
                    <button onClick={() => setExpandedSets(prev => ({ ...prev, [setKey]: !prev[setKey] }))}
                      className="flex items-center gap-2 text-left w-full group hover:bg-gray-50 rounded-lg py-1 -ml-2 pl-2 transition-colors">
                      <span className={`text-gray-400 text-xs transition-transform ${isSetOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                      <span className="text-sm font-semibold text-gray-800">{set.name}</span>
                      <GoalBadge goal={set.goal} />
                      {set.window_start && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(set.window_start).toLocaleDateString('en-IN')} - {set.window_end ? new Date(set.window_end).toLocaleDateString('en-IN') : '?'}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-auto">{setInfs.length} influencer{setInfs.length !== 1 ? 's' : ''}</span>
                    </button>
                    {isSetOpen && setInfs.map(inf => {
                      const infKey = `inf-${inf.id}`;
                      const isInfOpen = expandedInfs[infKey];
                      // Backend enrichment (K.1). Defaults kept so pre-deploy data still renders.
                      const dc    = inf.deliverable_counts || {
                        total: 0, pending: 0, submitted: 0, under_review: 0,
                        revision_requested: 0, approved: 0, live: 0,
                      };
                      const tr    = inf.tranche_statuses || { t1: null, t2: null, t3: null };
                      const setGoal        = (set.goal || 'engagement').toLowerCase();
                      const isEngagement   = setGoal === 'engagement';
                      const isConversion   = setGoal === 'conversion';
                      const isHybrid       = setGoal === 'hybrid';
                      const showCommFields = isConversion || isHybrid;
                      const showTxLine     = (isConversion || isHybrid) && inf.transaction_count != null;
                      // Deliverable summary — goal-aware copy + real per-status counts.
                      const delivPieces = [];
                      if (dc.live)               delivPieces.push(`${dc.live} live`);
                      if (dc.approved)           delivPieces.push(`${dc.approved} approved`);
                      if (dc.submitted || dc.under_review)
                        delivPieces.push(`${(dc.submitted || 0) + (dc.under_review || 0)} awaiting review`);
                      if (dc.revision_requested) delivPieces.push(`${dc.revision_requested} in revision`);
                      if (dc.pending)            delivPieces.push(`${dc.pending} pending`);
                      const delivDetail = dc.total > 0
                        ? (delivPieces.length ? delivPieces.join(' \u00B7 ') : `${dc.total} pending`)
                        : (inf.status === 'invited' || inf.status === 'negotiating' || inf.status === 'accepted'
                            ? 'not yet generated \u2014 waiting on contract'
                            : 'none');
                      return (
                        <div key={inf.id} className="ml-4 border-l-2 border-gray-100 pl-4 mt-1">
                          <button onClick={() => setExpandedInfs(prev => ({ ...prev, [infKey]: !prev[infKey] }))}
                            className="flex items-center gap-2 text-left w-full group hover:bg-gray-50 rounded-lg py-1 -ml-2 pl-2 transition-colors">
                            <span className={`text-gray-400 text-xs transition-transform ${isInfOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                            <Avatar handle={inf.instagram_handle} size="sm" />
                            <span className="text-sm font-medium text-gray-800">{inf.influencer_name || `@${inf.instagram_handle}`}</span>
                            {inf.instagram_handle && <span className="text-[10px] text-gray-400">@{inf.instagram_handle}</span>}
                            <StatusBadge status={inf.status} />
                          </button>
                          {isInfOpen && (
                            <div className="ml-8 mt-1 space-y-1 text-xs text-gray-500 pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {inf.offer_type && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold">{inf.offer_type}</span>}
                                {showCommFields && inf.commission_pct && <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold">{parseFloat(inf.commission_pct)}% commission</span>}
                                {inf.coupon_code && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-mono">{inf.coupon_code}</span>}
                              </div>
                              {/* Deliverables — always shown since every goal has content to deliver. */}
                              <div className="flex items-center gap-1">
                                <span className="text-gray-300">{isConversion ? '└' : '├'}</span>
                                <span>
                                  Deliverables: <strong className="text-gray-700">{dc.total}</strong>
                                  <span className="text-gray-400 ml-1">({delivDetail})</span>
                                </span>
                              </div>
                              {/* Products — only meaningful for conversion / hybrid sets. */}
                              {!isEngagement && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-300">├</span>
                                  <span>Products: <span className="text-gray-400">
                                    {inf.offer_type === 'flat' || inf.offer_type === 'percentage'
                                      ? 'All brand products (brand-level offer)'
                                      : 'Assigned per campaign'}
                                  </span></span>
                                </div>
                              )}
                              {/* Transactions — only meaningful for conversion / hybrid sets. */}
                              {showTxLine && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-300">└</span>
                                  <span>Transactions: <strong className="text-gray-700">{inf.transaction_count}</strong></span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sets breakdown */}
          {sets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="text-4xl mb-3">📦</div>
              <div className="font-bold text-gray-700 mb-1">No sets yet</div>
              <div className="text-xs text-gray-400 mb-4">Sets define goal, influencers and content</div>
              <a href={`/dashboard/campaigns/new?id=${id}`} className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-xs rounded-xl">
                Add Sets
              </a>
            </div>
          ) : (
            sets.map((set, si) => {
              const allRows = set.influencers || [];
              const mode = set.influencer_mode || 'handpick';
              const isOpenGroup = mode === 'open_group';
              // For open-group sets, hide the broadcast list and pre-contract
              // statuses — only show influencers who are actually in the
              // contract pipeline. Handpick keeps the full list.
              const OPEN_GROUP_HIDDEN = ['invited','applied','declined','rejected_by_brand','slots_filled','expired'];
              const setInfs = isOpenGroup
                ? allRows.filter(r => !OPEN_GROUP_HIDDEN.includes(r.status))
                : allRows;
              const applied = isOpenGroup ? allRows.filter(r => r.status === 'applied') : [];
              const approvedCount = isOpenGroup
                ? allRows.filter(r => ['accepted','contracted','active','completed'].includes(r.status)).length
                : 0;
              return (
                <div key={set.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Set header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-800">{set.name}</span>
                      <GoalBadge goal={set.goal} />
                      <span className="text-[10px] text-gray-400 capitalize">{mode}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {set.set_budget > 0 && <span className="font-semibold text-gray-700">{fmtRupees(set.set_budget)}</span>}
                      {set.coupon_prefix && <span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded">PREFIX: {set.coupon_prefix}</span>}
                    </div>
                  </div>

                  {/* Set meta row */}
                  <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-50 text-xs text-gray-400 flex-wrap">
                    {set.window_start && (
                      <span>📅 {new Date(set.window_start).toLocaleDateString('en-IN')} – {set.window_end ? new Date(set.window_end).toLocaleDateString('en-IN') : '?'}</span>
                    )}
                    {set.formats_json && (() => {
                      try {
                        const fmts = typeof set.formats_json === 'string' ? JSON.parse(set.formats_json) : set.formats_json;
                        if (fmts?.length) return <span>🎬 {fmts.map(f => `${f.count || 1}× ${typeof f === 'string' ? f : (f.type || f.name || 'content')}`).join(', ')}</span>;
                      } catch { return null; }
                    })()}
                    {set.brief && <span className="truncate max-w-xs">📝 {set.brief}</span>}
                  </div>

                  {/* Open-group funnel summary: broadcast → applied → approved */}
                  {isOpenGroup && (
                    <div className="px-4 py-2.5 bg-blue-50/50 border-b border-blue-100 text-xs text-blue-800 flex items-center gap-4 flex-wrap">
                      <span><strong>{allRows.length}</strong> broadcast</span>
                      <span>·</span>
                      <span><strong>{applied.length}</strong> applied</span>
                      <span>·</span>
                      <span><strong>{approvedCount}</strong>/{set.max_cap || '—'} approved</span>
                    </div>
                  )}

                  {/* Open-group applications waiting on brand approval */}
                  {isOpenGroup && applied.length > 0 && (
                    <div className="border-b border-gray-100">
                      <div className="px-4 py-2.5 bg-amber-50 text-xs font-bold text-amber-900">
                        Applications ({applied.length}) — pending your review
                      </div>
                      <div className="divide-y divide-gray-50">
                        {applied.map(app => (
                          <div key={app.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar handle={app.instagram_handle} />
                              <div className="min-w-0">
                                <div className="font-semibold text-sm text-gray-800 truncate">@{app.instagram_handle}</div>
                                <div className="text-[11px] text-gray-500 truncate">
                                  {app.influencer_name || ''}
                                  {app.influencer_budget != null ? ` · ${fmtRupees(app.influencer_budget)}` : ''}
                                </div>
                                {app.influencer_id && (
                                  <a
                                    href={`/dashboard/influencers/${app.influencer_id}`}
                                    className="text-[11px] font-bold text-navy hover:underline"
                                  >
                                    View profile →
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={async () => {
                                  if (!confirm(`Reject @${app.instagram_handle}? They'll be notified.`)) return;
                                  const r = await applicationApi.reject(id, app.id);
                                  if (!r.success) { alert(r.error?.message || 'Reject failed'); return; }
                                  campaignApi.get(id).then(res => { if (res.success) setCampaign(res.data?.campaign || res.data); });
                                }}
                                className="px-3 py-1.5 bg-red-50 border border-red-300 text-red-700 font-bold text-[11px] rounded-lg hover:bg-red-100 transition-colors"
                              >
                                Reject
                              </button>
                              <button
                                onClick={async () => {
                                  const r = await applicationApi.approve(id, app.id);
                                  if (!r.success) { alert(r.error?.message || 'Approve failed'); return; }
                                  if (r.data?.slots_filled) {
                                    alert(`Approved. Slots are now full — ${r.data.closed_out_count || 0} other applicant(s) were notified.`);
                                  }
                                  campaignApi.get(id).then(res => { if (res.success) setCampaign(res.data?.campaign || res.data); });
                                }}
                                className="px-3 py-1.5 bg-navy text-white font-bold text-[11px] rounded-lg hover:bg-navy-dark transition-colors"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Influencers */}
                  {setInfs.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                      {isOpenGroup
                        ? (applied.length > 0
                            ? 'No influencers approved yet. Review applications above.'
                            : 'No applications yet. The campaign is broadcasting to matched influencers.')
                        : 'No influencers assigned to this set'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {setInfs.map(inf => {
                        // Goal-aware per-row (set is in scope from outer map)
                        const goalLower      = (set.goal || 'engagement').toLowerCase();
                        const showFee        = goalLower === 'engagement' || goalLower === 'hybrid';
                        const showCommission = goalLower === 'conversion' || goalLower === 'hybrid';
                        const showTranches   = showFee;   // No fee → no tranches
                        return (
                        <div key={inf.id} className="flex items-start justify-between px-4 py-3 hover:bg-gray-50 transition-colors gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <Avatar handle={inf.instagram_handle} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-gray-800">@{inf.instagram_handle}</span>
                                <StatusBadge status={inf.status} />
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
                                {showFee && inf.influencer_budget > 0 && (
                                  <span>💰 Budget: <strong className="text-gray-700">{fmtRupees(inf.influencer_budget)}</strong></span>
                                )}
                                {showCommission && inf.commission_pct > 0 && (
                                  <span>📊 Commission: <strong className="text-gray-700">{inf.commission_pct}%</strong></span>
                                )}
                                {inf.posting_date && (
                                  <span>📅 Post: <strong className="text-gray-700">{new Date(inf.posting_date).toLocaleDateString('en-IN')}</strong></span>
                                )}
                                {inf.coupon_code && (
                                  <span className="font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">🎟 {inf.coupon_code}</span>
                                )}
                                {inf.offer_type && (
                                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded capitalize">{inf.offer_type}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Tranche status + action buttons */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {inf.status === 'negotiating' && (
                              <button onClick={() => openNegModal(inf, set.goal)}
                                className="px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold text-[10px] rounded-lg hover:bg-yellow-100 transition-colors">
                                Respond
                              </button>
                            )}
                            {inf.status === 'accepted' && (
                              <button onClick={() => openContractModal(inf, set.goal)}
                                className="px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 font-bold text-[10px] rounded-lg hover:bg-teal-100 transition-colors">
                                Sign Contract
                              </button>
                            )}
                            {['invited', 'accepted', 'negotiating'].includes(inf.status) && (
                              <button onClick={() => handleCancelInfluencer(inf)}
                                disabled={cancellingInf === inf.id}
                                className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 font-bold text-[10px] rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                                {cancellingInf === inf.id ? 'Cancelling…' : 'Cancel'}
                              </button>
                            )}
                            {showTranches && (
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="flex items-center gap-0.5"><TrancheIcon status={inf.tranche_statuses?.t1} /> T1</span>
                                <span className="flex items-center gap-0.5"><TrancheIcon status={inf.tranche_statuses?.t2} /> T2</span>
                                <span className="flex items-center gap-0.5"><TrancheIcon status={inf.tranche_statuses?.t3} /> T3</span>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── PRODUCTS TAB ─────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="space-y-4">
          {!campaignProducts ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading products…</div>
          ) : (campaignProducts.products || []).length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📦</div>
              <div className="text-gray-500 text-sm font-semibold">No products listed yet</div>
              <div className="text-gray-400 text-xs mt-1">Add products in the Listings page first.</div>
            </div>
          ) : (
            <>
              {/* Influencer filter pills */}
              {(campaignProducts.influencers || []).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Filter by Influencer</div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => setProductInfFilter('all')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${productInfFilter === 'all' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      All Influencers
                    </button>
                    {campaignProducts.influencers.map(inf => (
                      <button key={inf.id}
                        onClick={() => setProductInfFilter(inf.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${productInfFilter === inf.id ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <span className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-[9px] font-bold text-orange-600 flex-shrink-0">
                          {inf.name?.[0] || '?'}
                        </span>
                        {inf.name || `@${inf.handle}`}
                        {inf.coupon_code && <span className="font-mono opacity-70 text-[9px]">({inf.coupon_code})</span>}
                      </button>
                    ))}
                  </div>
                  {/* Influencer detail row for selected */}
                  {productInfFilter !== 'all' && (() => {
                    const sel = campaignProducts.influencers.find(i => i.id === productInfFilter);
                    if (!sel) return null;
                    return (
                      <div className="flex items-center gap-3 text-sm bg-navy/5 rounded-lg px-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">{sel.name?.[0]}</div>
                        <div className="flex-1">
                          <span className="font-semibold text-gray-900">{sel.name}</span>
                          <span className="text-gray-400 ml-1 text-xs">@{sel.handle}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          {sel.offer_type && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{sel.offer_type}</span>}
                          {sel.discount_value && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">{sel.discount_value}% OFF</span>}
                          {sel.coupon_code && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-mono">{sel.coupon_code}</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${sel.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{sel.status}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Summary bar */}
              {campaignProducts.summary && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                    <div className="text-lg font-extrabold text-gray-900">{campaignProducts.summary.total_products}</div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase">Total Products</div>
                  </div>
                  <div className="bg-white rounded-xl border border-green-200 p-3 text-center">
                    <div className="text-lg font-extrabold text-green-600">{campaignProducts.summary.published}</div>
                    <div className="text-[10px] text-green-500 font-semibold uppercase">Published</div>
                  </div>
                  <div className="bg-white rounded-xl border border-amber-200 p-3 text-center">
                    <div className="text-lg font-extrabold text-amber-600">{campaignProducts.summary.pending}</div>
                    <div className="text-[10px] text-amber-500 font-semibold uppercase">Pending</div>
                  </div>
                </div>
              )}

              {/* Brand-level offer banner — shown when no per-influencer
                  product allocation exists. Every influencer effectively
                  promotes the entire catalogue, so per-influencer filter is
                  meaningless. */}
              {campaignProducts.is_brand_level_offer && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <strong>Brand-level offer:</strong> no specific products were allocated per influencer.
                  Every influencer promotes the entire catalogue ({campaignProducts.products.length} products).
                </div>
              )}

              {/* Product list with status — filtered by selected influencer */}
              <div className="space-y-2">
                {(campaignProducts.products || [])
                  .filter(p => {
                    if (productInfFilter === 'all') return true;
                    if (campaignProducts.is_brand_level_offer) return true; // every influencer sees every product
                    // Match the new assigned_to_influencers array shape from the
                    // backend (campaign_influencer_id is the filter key from
                    // the pill above). Falls back to the legacy fields too.
                    const arr = p.assigned_to_influencers || [];
                    return arr.some(a => a.campaign_influencer_id === productInfFilter)
                      || p.assigned_to === productInfFilter
                      || p.influencer_id === productInfFilter
                      || (p.published_by || []).some(pb => pb.influencer_id === productInfFilter);
                  })
                  .map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                    <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">🚗</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.section || 'General'} · {fmtRupees(p.price)}</div>
                      {p.description && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{p.description}</div>}
                      {/* Show assigned influencer chips on each product */}
                      {(p.assigned_to_influencers || []).length > 0 && (
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] text-gray-400 uppercase font-bold">Assigned:</span>
                          {(p.assigned_to_influencers || []).map(a => (
                            <span key={a.campaign_influencer_id} className="inline-flex items-center gap-1 bg-orange-50 px-1.5 py-0.5 rounded">
                              <span className="w-3.5 h-3.5 rounded-full bg-orange-100 flex items-center justify-center text-[8px] font-bold text-orange-600">{(a.name || a.handle)?.[0]}</span>
                              <span className="text-[10px] text-gray-700 font-semibold">@{a.handle || a.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {p.published_by?.length > 0 && (
                        <div className="mt-1.5 bg-green-50 rounded-md px-2 py-1 inline-block">
                          <span className="text-[10px] text-green-700 italic">"{p.published_by[0].note_text}"</span>
                          <span className="text-[9px] text-green-500 ml-1">-- {p.published_by[0].influencer_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {p.publish_status === 'published' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(campaignProducts.products || []).filter(p => {
                  if (productInfFilter === 'all') return true;
                    if (!campaignProducts?.has_specific_products) return true; // brand-level offer = show all
                  return p.assigned_to === productInfFilter || p.influencer_id === productInfFilter || (p.published_by || []).some(pb => pb.influencer_id === productInfFilter);
                }).length === 0 && productInfFilter !== 'all' && (
                  <div className="text-center py-8 text-gray-400 text-sm">All brand products shown — no specific product selection was made for this influencer during campaign creation</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CONTENT TAB ──────────────────────────────────────────────────── */}
      {tab === 'content' && (
        <div className="space-y-4">
          {!liveData ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading content…</div>
          ) : (() => {
            const liveSets = liveData?.sets || [];
            const allDeliverables = liveSets.flatMap(s =>
              (s.influencers || []).flatMap(inf =>
                (inf.deliverables || [])
                  .filter(d => ['submitted', 'under_review', 'revision_requested', 'approved', 'live'].includes(d.status))
                  .map(d => ({ ...d, _inf: inf, _set: s }))
              )
            );

            if (allDeliverables.length === 0) {
              return <div className="text-center py-12 text-gray-400 text-sm">No submitted content yet</div>;
            }

            return allDeliverables.map(d => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Avatar handle={d._inf.instagram_handle} size="sm" />
                      <div>
                        <div className="font-semibold text-sm text-gray-800">@{d._inf.instagram_handle}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="bg-navy-pale text-navy text-[10px] font-bold px-2 py-0.5 rounded uppercase">{d.type}</span>
                          <StatusBadge status={d.status} />
                          <span className="text-[10px] text-gray-400">{d._set.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {d.media_key && (
                  <MediaPreview deliverableId={d.id} mediaType={d.media_type} />
                )}
                {(d.submitted_url || d.submission_url) && !d.media_key && (
                  <div className="mb-3 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                    <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Submitted URL</div>
                    <a href={d.submitted_url || d.submission_url} target="_blank" rel="noreferrer" className="text-navy underline break-all">{d.submitted_url || d.submission_url}</a>
                  </div>
                )}
                {d.live_url && (
                  <div className="mb-3 bg-teal-50 rounded-lg px-3 py-2 text-xs text-teal-700">
                    <div className="text-[9px] font-bold uppercase mb-1">Live URL</div>
                    <a href={d.live_url} target="_blank" rel="noreferrer" className="text-teal-700 underline break-all">{d.live_url}</a>
                  </div>
                )}
                {d.brand_feedback && (
                  <div className="mb-3 bg-orange-50 rounded-lg px-3 py-2 text-xs text-orange-700">
                    <div className="text-[9px] font-bold uppercase mb-1">Your Feedback</div>
                    {d.brand_feedback}
                  </div>
                )}
                {(d.status === 'submitted' || d.status === 'under_review') && (
                  <div className="flex gap-2">
                    <button onClick={() => handleReview(d.id, 'approve', '')}
                      className="px-4 py-2 bg-teal-500 text-white font-bold text-xs rounded-lg flex-1 hover:bg-teal-600 transition-colors">
                      ✓ Approve
                    </button>
                    <button onClick={() => { const fb = prompt('Enter revision feedback:'); if (fb) handleReview(d.id, 'request_revision', fb); }}
                      className="px-4 py-2 bg-orange-50 text-orange-700 font-bold text-xs rounded-lg flex-1 hover:bg-orange-100 transition-colors">
                      ↩ Request Revision
                    </button>
                  </div>
                )}
                {d.status === 'approved' && d.live_url && (
                  <button onClick={() => handleConfirmLive(d.id)}
                    className="w-full px-4 py-2 bg-navy text-white font-bold text-xs rounded-lg hover:opacity-90 transition-opacity">
                    Confirm Live
                  </button>
                )}
                {d.status === 'approved' && !d.live_url && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    Waiting for influencer to submit live URL...
                  </div>
                )}
                {d.status === 'live' && (
                  <DeliverableStatsCard deliverableId={d.id} type={d.type} />
                )}
              </div>
            ));
          })()}
        </div>
      )}

      {/* ── ANALYTICS TAB — Drill-Down ──────────────────────────────────
          G.4: campaign-level tiles now combine deliverable pipeline
          counts (moved from Overview) with Apify-reliable engagement
          metrics — likes, comments, reel views, avg ER. Reach /
          impressions / saves / shares are dropped because Instagram
          hides them from public scraping, so they were always 0 and
          misleading. Per-set and per-influencer rows follow the same
          honest metric set. */}
      {tab === 'analytics' && (
        <div>
          {!engagement ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading analytics...</div>
          ) : (
            <div className="space-y-4">
              {/* Campaign-level summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Deliverables',    value: deliverableCounts.total },
                  { label: 'Awaiting Review', value: deliverableCounts.submitted },
                  { label: 'Live',            value: deliverableCounts.live },
                  { label: 'In Revision',     value: deliverableCounts.revision },
                  { label: 'Total Likes',     value: fmtNum(engagement.totals?.total_likes) },
                  { label: 'Total Comments',  value: fmtNum(engagement.totals?.total_comments) },
                  { label: 'Total Views',     value: fmtNum(engagement.totals?.total_views), sub: 'reels only' },
                  { label: 'Avg ER %',        value: `${engagement.totals?.avg_er || 0}%` },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{s.label}</div>
                    <div className="font-display text-xl font-extrabold text-gray-900">{s.value}</div>
                    {s.sub && <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>}
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-gray-400 leading-snug px-1">
                Reach, impressions, saves and shares aren&apos;t shown: Instagram
                only exposes them through the Graph API (business-account OAuth),
                which isn&apos;t wired up yet.
              </div>

              {/* Per-set breakdown cards */}
              {engagement.by_set?.length > 0 ? engagement.by_set.map(set => {
                const setKey = `aset-${set.set_id}`;
                const isOpen = expandedAnalyticsSets[setKey];
                const infList = (engagement.by_influencer || []).filter(inf => inf.set_id === set.set_id);
                return (
                  <div key={set.set_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button onClick={() => setExpandedAnalyticsSets(prev => ({ ...prev, [setKey]: !prev[setKey] }))}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left">
                      <div className="flex items-center gap-2">
                        <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                        <span className="font-bold text-sm text-gray-800">{set.set_name || 'Set'}</span>
                        <GoalBadge goal={set.goal} />
                        <span className="text-[10px] text-gray-400">{set.influencers} influencer{set.influencers === 1 ? '' : 's'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Likes: <strong className="text-gray-700">{fmtNum(set.likes)}</strong></span>
                        <span>Comments: <strong className="text-gray-700">{fmtNum(set.comments)}</strong></span>
                        {set.views > 0 && <span>Views: <strong className="text-gray-700">{fmtNum(set.views)}</strong></span>}
                        <span>ER: <strong className="text-gray-700">{set.engagement_rate}%</strong></span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-gray-50">
                        {infList.length === 0 ? (
                          <div className="px-4 py-4 text-xs text-gray-400 text-center">No influencer data for this set</div>
                        ) : infList.map(inf => {
                          const infKey = `ainf-${inf.influencer_id}`;
                          const isInfOpen = expandedAnalyticsInfs[infKey];
                          const deliverableStats = inf.deliverables || [];
                          return (
                            <div key={inf.influencer_id}>
                              <button onClick={() => setExpandedAnalyticsInfs(prev => ({ ...prev, [infKey]: !prev[infKey] }))}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                                <div className="flex items-center gap-2">
                                  <span className={`text-gray-300 text-[10px] transition-transform ${isInfOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                                  <Avatar handle={inf.instagram_handle} size="sm" />
                                  <span className="font-medium text-sm text-gray-800">@{inf.instagram_handle}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                  <span>Likes: <strong className="text-gray-800">{fmtNum(inf.likes)}</strong></span>
                                  <span>Comments: <strong className="text-gray-800">{fmtNum(inf.comments)}</strong></span>
                                  {inf.views > 0 && <span>Views: <strong className="text-gray-800">{fmtNum(inf.views)}</strong></span>}
                                  <span>ER: <strong className="text-gray-800">{inf.engagement_rate || 0}%</strong></span>
                                </div>
                              </button>
                              {isInfOpen && deliverableStats.length > 0 && (
                                <div className="px-6 pb-3">
                                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-7 gap-2 px-3 py-2 text-[9px] font-bold text-gray-400 uppercase border-b border-gray-100">
                                      <span>Type</span><span>Status</span><span>Likes</span><span>Comments</span><span>Views</span><span>ER</span><span className="text-right">Refresh</span>
                                    </div>
                                    {deliverableStats.map((d, di) => (
                                      <div key={d.id || di} className="grid grid-cols-7 gap-2 px-3 py-2 text-xs text-gray-600 border-b border-gray-50 last:border-0 items-center">
                                        <span className="font-semibold uppercase text-navy">{d.type}</span>
                                        <span><StatusBadge status={d.status} /></span>
                                        <span>{fmtNum(d.likes)}</span>
                                        <span>{fmtNum(d.comments)}</span>
                                        <span>{d.type === 'reel' ? fmtNum(d.views) : <span className="text-gray-300">—</span>}</span>
                                        <span>{d.engagement_rate != null ? `${d.engagement_rate}%` : '—'}</span>
                                        <span className="text-right">
                                          {d.status === 'live' && d.id ? (
                                            <button
                                              onClick={async () => {
                                                const res = await deliverableApi.refreshStats(d.id);
                                                if (res.success) {
                                                  campaignApi.getEngagement(id).then(r => { if (r.success) setEngagement(r.data); });
                                                } else {
                                                  alert(res.error?.message || 'Refresh failed');
                                                }
                                              }}
                                              className="text-[10px] font-bold text-navy bg-white border border-gray-200 rounded px-2 py-0.5 hover:bg-navy hover:text-white transition-colors"
                                              title="Re-scrape Instagram engagement now"
                                            >
                                              ↻
                                            </button>
                                          ) : <span className="text-gray-300">—</span>}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {isInfOpen && deliverableStats.length === 0 && (
                                <div className="px-6 pb-3 text-xs text-gray-400">No deliverables in this contract yet.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-xs text-gray-400 text-center">
                  No influencers onboarded yet — once you invite creators and they accept, per-set and per-influencer performance will appear here.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CONVERSIONS TAB — Drill-Down ──────────────────────────────── */}
      {tab === 'conversions' && (
        <div>
          {!conversions ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading conversions...</div>
          ) : (
            <div className="space-y-4">
              {/* Campaign-level totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Transactions', value: fmtNum(conversions.total_transactions) },
                  { label: 'Total Revenue',       value: fmtMoney(conversions.total_revenue_paise) },
                  { label: 'Commission Paid',     value: fmtMoney(conversions.total_commission_paise) },
                  { label: 'Conversion Rate',     value: `${conversions.conversion_rate || 0}%` },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{s.label}</div>
                    <div className="font-display text-xl font-extrabold text-gray-900">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Per-influencer breakdown table with expandable transaction rows */}
              {conversions.by_influencer?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-6 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <span className="col-span-2">Influencer</span>
                    <span>Transactions</span>
                    <span>Revenue</span>
                    <span>Commission</span>
                    <span>ROI</span>
                  </div>
                  {conversions.by_influencer.map(inf => {
                    const infKey = `cinf-${inf.influencer_id}`;
                    const isOpen = expandedConvInfs[infKey];
                    const roi = inf.revenue_paise && inf.commission_paise
                      ? ((inf.revenue_paise - inf.commission_paise) / inf.commission_paise * 100).toFixed(0)
                      : '--';
                    return (
                      <div key={inf.influencer_id}>
                        <button onClick={() => setExpandedConvInfs(prev => ({ ...prev, [infKey]: !prev[infKey] }))}
                          className="w-full grid grid-cols-6 gap-2 px-4 py-3 border-b border-gray-50 text-sm hover:bg-gray-50 transition-colors text-left items-center">
                          <div className="col-span-2 flex items-center gap-2">
                            <span className={`text-gray-300 text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                            <Avatar handle={inf.instagram_handle} size="sm" />
                            <span className="font-medium text-gray-800">@{inf.instagram_handle || inf.influencer_id}</span>
                          </div>
                          <div className="font-bold text-gray-900">{fmtNum(inf.transaction_count)}</div>
                          <div className="font-semibold text-gray-800">{fmtMoney(inf.revenue_paise)}</div>
                          <div className="font-semibold text-teal-600">{fmtMoney(inf.commission_paise)}</div>
                          <div className={`font-bold ${roi !== '--' && Number(roi) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {roi !== '--' ? `${roi}%` : '--'}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100">
                            {(inf.transactions || []).length > 0 ? (
                              <div className="space-y-1">
                                <div className="grid grid-cols-5 gap-2 text-[9px] font-bold text-gray-400 uppercase px-2 pb-1 border-b border-gray-100">
                                  <span>Date</span><span>Type</span><span>Amount</span><span>Commission</span><span>Status</span>
                                </div>
                                {inf.transactions.map((tx, ti) => (
                                  <div key={ti} className="grid grid-cols-5 gap-2 text-xs text-gray-600 px-2 py-1.5 bg-white rounded border border-gray-50">
                                    <span>{tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN') : '--'}</span>
                                    <span className="capitalize">{tx.type || tx.transaction_type || '--'}</span>
                                    <span className="font-semibold">{fmtMoney(tx.amount_paise)}</span>
                                    <span className="text-teal-600">{fmtMoney(tx.commission_paise)}</span>
                                    <span><StatusBadge status={tx.status || 'completed'} /></span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 text-center py-2">
                                Transaction details not available. View {fmtNum(inf.transaction_count)} transaction{inf.transaction_count !== 1 ? 's' : ''} totalling {fmtMoney(inf.revenue_paise)}.
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
          )}
        </div>
      )}

      {/* ── NEGOTIATION MODAL ──────────────────────────────────────────────── */}
      {negModal && <NegotiationModal
        inf={negModal.inf}
        negotiation={negModal.negotiation}
        loading={negLoading}
        onClose={() => setNegModal(null)}
        onRespond={handleNegRespond}
      />}

      {/* ── CONTRACT COUNTERSIGN MODAL ─────────────────────────────────────── */}
      {contractModal && <ContractModal
        inf={contractModal.inf}
        contract={contractModal.contract}
        suggestedContentRequirements={contractModal.suggested_content_requirements}
        goal={contractModal.goal}
        loading={contractLoading}
        brandWalletBalance={contractModal.brand_wallet_balance}
        platformFeePct={contractModal.platform_fee_pct}
        onClose={() => setContractModal(null)}
        onSign={handleBrandSign}
        onApprove={handleApproveContract}
      />}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 animate-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
