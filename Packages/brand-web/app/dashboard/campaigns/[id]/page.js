'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { campaignApi, deliverableApi, negotiationApi, contractApi, fmtRupees, fmtMoney, fmtNum } from '../../../../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
                <div className="font-bold text-sm">₹{((t.proposed_fee || 0) / 100).toFixed(0)}</div>
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
                Influencer proposes: <strong>₹{((lastTurn.proposed_fee || 0) / 100).toFixed(0)}</strong>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => onRespond('accept', lastTurn?.proposed_fee, '')}
                disabled={loading}
                className="flex-1 py-2.5 bg-teal-500 text-white font-bold text-xs rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors">
                Accept ₹{((lastTurn?.proposed_fee || 0) / 100).toFixed(0)}
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
            <button onClick={() => onRespond('counter', Math.round(parseFloat(counterFee || '0') * 100), note)}
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

function ContractModal({ inf, contract, loading, onClose, onSign }) {
  if (!contract) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">No contract found for this influencer.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold">Close</button>
      </div>
    </div>
  );

  const rows = [
    { label: 'Influencer', value: contract.influencer_name || `@${inf.instagram_handle}` },
    { label: 'Agreed Fee', value: `₹${((contract.influencer_fee || 0) / 100).toFixed(0)}` },
    { label: 'Posting Date', value: contract.posting_date ? new Date(contract.posting_date).toLocaleDateString('en-IN') : '—' },
    { label: 'Revision Limit', value: contract.revision_limit ?? 2 },
    { label: 'Influencer Signed', value: contract.influencer_signed_at ? new Date(contract.influencer_signed_at).toLocaleString('en-IN') : 'Not yet' },
    { label: 'Contract Status', value: contract.status?.replace(/_/g, ' ') },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-gray-900">Review & Sign Contract</h2>
            <p className="text-xs text-gray-400 mt-0.5">@{inf.instagram_handle} · {contract.campaign_name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
        </div>

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
          {contract.pdf_url && (
            <a href={contract.pdf_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 mt-2 text-xs text-navy font-semibold hover:underline">
              📄 View Contract PDF
            </a>
          )}
        </div>

        {contract.status === 'pending_brand' ? (
          <div className="p-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-3">By signing, you confirm the above terms. Tranche 1 ({contract.influencer_fee ? `₹${((contract.influencer_fee * 0.25) / 100).toFixed(0)}` : '25%'}) will be queued for release.</p>
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
      </div>
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

  // ── Load campaign (sets + influencers included) ──────────────────────────
  useEffect(() => {
    campaignApi.get(id).then(res => {
      setLoading(false);
      if (res.success) setCampaign(res.data?.campaign || res.data);
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
  }, [tab]);

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

  async function openNegModal(inf) {
    if (!inf.negotiation_id) { showToast('No negotiation thread found'); return; }
    const res = await negotiationApi.get(inf.negotiation_id);
    if (res.success) setNegModal({ inf, negotiation: res.data?.negotiation || res.data });
    else showToast(res.error?.message || 'Failed to load negotiation');
  }

  async function handleNegRespond(action, proposedFee, note) {
    if (!negModal) return;
    setNegLoading(true);
    const res = await negotiationApi.respond(negModal.inf.negotiation_id, { action, proposed_fee: proposedFee, note });
    setNegLoading(false);
    if (res.success) {
      showToast(action === 'accept' ? 'Offer accepted!' : action === 'decline' ? 'Offer declined' : 'Counter sent');
      setNegModal(null);
      campaignApi.get(id).then(r => { if (r.success) setCampaign(r.data?.campaign || r.data); });
    } else showToast(res.error?.message || 'Failed');
  }

  async function openContractModal(inf) {
    const res = await contractApi.get(inf.id);
    if (res.success) setContractModal({ inf, contract: res.data?.contract || res.data });
    else showToast(res.error?.message || 'Failed to load contract');
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
  if (!campaign) return <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm">Campaign not found</div>;

  // ── Derived data ─────────────────────────────────────────────────────────
  const sets         = campaign.sets || [];
  const allInfluencers = sets.flatMap(s => (s.influencers || []).map(inf => ({ ...inf, _set: s })));
  const totalBudget  = Number(campaign.total_budget || 0);
  const setBudgetSum = sets.reduce((t, s) => t + Number(s.set_budget || 0), 0);
  const totalInfluencers = allInfluencers.length;

  const TABS = ['overview', 'content', 'analytics', 'conversions'];

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

        {/* Budget strip */}
        {totalBudget > 0 && (
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
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Budget', value: fmtRupees(totalBudget), sub: totalBudget === 0 ? 'Commission only' : '' },
              { label: 'Sets', value: sets.length },
              { label: 'Influencers', value: totalInfluencers },
              { label: 'Status', value: campaign.status?.replace(/_/g, ' ') },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{s.label}</div>
                <div className="font-display text-lg font-extrabold text-gray-900 capitalize">{s.value}</div>
                {s.sub && <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>}
              </div>
            ))}
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
              const setInfs = set.influencers || [];
              return (
                <div key={set.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Set header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-800">{set.name}</span>
                      <GoalBadge goal={set.goal} />
                      <span className="text-[10px] text-gray-400 capitalize">{set.influencer_mode || 'handpick'}</span>
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
                        if (fmts?.length) return <span>🎬 {fmts.map(f => `${f.count || 1}× ${f.type || f}`).join(', ')}</span>;
                      } catch { return null; }
                    })()}
                    {set.brief && <span className="truncate max-w-xs">📝 {set.brief}</span>}
                  </div>

                  {/* Influencers */}
                  {setInfs.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                      No influencers assigned to this set
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {setInfs.map(inf => (
                        <div key={inf.id} className="flex items-start justify-between px-4 py-3 hover:bg-gray-50 transition-colors gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <Avatar handle={inf.instagram_handle} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-gray-800">@{inf.instagram_handle}</span>
                                <StatusBadge status={inf.status} />
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
                                {inf.influencer_budget > 0 && (
                                  <span>💰 Budget: <strong className="text-gray-700">{fmtRupees(inf.influencer_budget)}</strong></span>
                                )}
                                {inf.commission_pct > 0 && (
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
                              <button onClick={() => openNegModal(inf)}
                                className="px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold text-[10px] rounded-lg hover:bg-yellow-100 transition-colors">
                                Respond
                              </button>
                            )}
                            {inf.status === 'accepted' && (
                              <button onClick={() => openContractModal(inf)}
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
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="flex items-center gap-0.5"><TrancheIcon status={inf.t1_status} /> T1</span>
                              <span className="flex items-center gap-0.5"><TrancheIcon status={inf.t2_status} /> T2</span>
                              <span className="flex items-center gap-0.5"><TrancheIcon status={inf.t3_status} /> T3</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
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
                {d.submission_url && (
                  <div className="mb-3 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                    <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Submitted URL</div>
                    <a href={d.submission_url} target="_blank" rel="noreferrer" className="text-navy underline break-all">{d.submission_url}</a>
                  </div>
                )}
                {d.brand_feedback && (
                  <div className="mb-3 bg-orange-50 rounded-lg px-3 py-2 text-xs text-orange-700">
                    <div className="text-[9px] font-bold uppercase mb-1">Your Feedback</div>
                    {d.brand_feedback}
                  </div>
                )}
                {d.status === 'under_review' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleReview(d.id, 'approve', '')}
                      className="px-4 py-2 bg-teal-500 text-white font-bold text-xs rounded-lg flex-1 hover:bg-teal-600 transition-colors">
                      ✓ Approve
                    </button>
                    <button onClick={() => { const fb = prompt('Enter revision feedback:'); if (fb) handleReview(d.id, 'revision', fb); }}
                      className="px-4 py-2 bg-orange-50 text-orange-700 font-bold text-xs rounded-lg flex-1 hover:bg-orange-100 transition-colors">
                      ↩ Request Revision
                    </button>
                  </div>
                )}
                {d.status === 'approved' && (
                  <button onClick={() => handleConfirmLive(d.id)}
                    className="w-full px-4 py-2 bg-navy text-white font-bold text-xs rounded-lg hover:opacity-90 transition-opacity">
                    Confirm Live
                  </button>
                )}
              </div>
            ));
          })()}
        </div>
      )}

      {/* ── ANALYTICS TAB ────────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <div>
          {!engagement ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading analytics…</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Reach',      value: fmtNum(engagement.totals?.total_reach) },
                  { label: 'Total Impressions', value: fmtNum(engagement.totals?.total_impressions) },
                  { label: 'Blended ER',        value: `${engagement.totals?.blended_er || 0}%` },
                  { label: 'Benchmark ER',      value: `${engagement.totals?.category_benchmark_er || 3.8}%` },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{s.label}</div>
                    <div className="font-display text-xl font-extrabold text-gray-900">{s.value}</div>
                  </div>
                ))}
              </div>
              {engagement.daily_reach?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4">Daily Reach</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={engagement.daily_reach}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E0E4EF" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <Tooltip formatter={v => [fmtNum(v), 'Reach']} />
                      <Line type="monotone" dataKey="reach" stroke="#F47920" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {engagement.by_influencer?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-600 uppercase tracking-wider">Per Influencer</div>
                  {engagement.by_influencer.map(inf => (
                    <div key={inf.influencer_id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 text-sm">
                      <div className="font-medium text-gray-800">@{inf.instagram_handle}</div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Reach: <strong className="text-gray-800">{fmtNum(inf.reach)}</strong></span>
                        <span>ER: <strong className="text-gray-800">{inf.engagement_rate || 0}%</strong></span>
                        <span>Likes: <strong className="text-gray-800">{fmtNum(inf.likes)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CONVERSIONS TAB ──────────────────────────────────────────────── */}
      {tab === 'conversions' && (
        <div>
          {!conversions ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading conversions…</div>
          ) : (
            <div className="space-y-4">
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
              {conversions.by_influencer?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-600 uppercase tracking-wider">Per Influencer</div>
                  {conversions.by_influencer.map(inf => (
                    <div key={inf.influencer_id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 text-sm">
                      <div className="font-medium text-gray-800">@{inf.instagram_handle || inf.influencer_id}</div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Sales: <strong className="text-gray-800">{fmtNum(inf.transaction_count)}</strong></span>
                        <span>Revenue: <strong className="text-gray-800">{fmtMoney(inf.revenue_paise)}</strong></span>
                        <span>Commission: <strong className="text-teal-600">{fmtMoney(inf.commission_paise)}</strong></span>
                      </div>
                    </div>
                  ))}
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
        loading={contractLoading}
        onClose={() => setContractModal(null)}
        onSign={handleBrandSign}
      />}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 animate-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
