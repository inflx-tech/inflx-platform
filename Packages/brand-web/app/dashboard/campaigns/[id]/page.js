'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { campaignApi, brandApi, deliverableApi, negotiationApi, contractApi, fmtRupees, fmtMoney, fmtNum } from '../../../../lib/api';
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

function DeliverableStatsCard({ deliverableId }) {
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
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[
              { label: 'Likes', val: stats.likes },
              { label: 'Comments', val: stats.comments },
              { label: 'Saves', val: stats.saves },
              { label: 'Shares', val: stats.shares },
              { label: 'Reach', val: stats.reach },
              { label: 'Impressions', val: stats.impressions },
            ].map(s => (
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
          {stats.scraped_at && (
            <div className="text-[9px] text-gray-400 text-center mt-1">
              Last updated: {new Date(stats.scraped_at).toLocaleString('en-IN')}
            </div>
          )}
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

function ContractModal({ inf, contract, goal, loading, onClose, onSign, onApprove }) {
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

  // Draft state: brand reviews + edits clauses + bonus, then "Approve & Send"
  const isDraft = contract.status === 'draft';
  const initialClauses = (() => {
    const cc = contract.custom_clauses;
    if (!cc) return {};
    if (typeof cc === 'string') { try { return (JSON.parse(cc).clauses) || {}; } catch { return {}; } }
    return cc.clauses || {};
  })();
  const initialNotes = (() => {
    const cc = contract.custom_clauses;
    if (!cc) return '';
    if (typeof cc === 'string') { try { return (JSON.parse(cc).notes) || ''; } catch { return ''; } }
    return cc.notes || '';
  })();
  const [clauses, setClauses]     = useState(initialClauses);
  const [extraNotes, setExtraNotes] = useState(initialNotes);
  const [bonusAmount, setBonusAmount] = useState(String(contract.bonus_amount || ''));

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
          {/* Inline PDF preview — always embeds the streaming endpoint, which
              regenerates the PDF on demand from the live contract row. */}
          {contract.id && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Contract PDF</span>
                <div className="flex items-center gap-3">
                  <a href={contractApi.pdfUrl(contract.id)} target="_blank" rel="noreferrer"
                    className="text-xs text-navy font-semibold hover:underline">Open ↗</a>
                  <button
                    onClick={async () => {
                      const res = await contractApi.regeneratePdf(contract.id);
                      if (res.success || res.ok) {
                        // Force iframe reload by tweaking the URL
                        const iframe = document.getElementById(`contract-pdf-${contract.id}`);
                        if (iframe) iframe.src = contractApi.pdfUrl(contract.id) + `&_=${Date.now()}`;
                      } else {
                        alert(res.error?.message || 'Regenerate failed');
                      }
                    }}
                    className="text-xs text-gray-500 font-semibold hover:text-gray-700">
                    Regenerate
                  </button>
                </div>
              </div>
              <iframe
                id={`contract-pdf-${contract.id}`}
                src={contractApi.pdfUrl(contract.id)}
                className="w-full h-[420px] border border-gray-200 rounded-lg bg-gray-50"
                title="Contract PDF"
              />
              {contract.pdf_generation_error && (
                <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  Last PDF generation failed: {contract.pdf_generation_error}
                </div>
              )}
            </div>
          )}
        </div>

        {isDraft ? (
          <div className="p-5 border-t border-gray-100 space-y-4 bg-amber-50/30">
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
              <div className="text-xs font-bold text-amber-900 mb-1">📝 Draft — Your Review</div>
              <div className="text-[11px] text-amber-800 leading-relaxed">
                The influencer accepted your offer. Tick any optional clauses + add a bonus if you want, then send.
              </div>
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

            {showFee && (
              <div>
                <div className="text-xs font-bold text-gray-700 mb-1">Bonus on top of fee (optional)</div>
                <div className="flex items-center border-2 border-navy rounded-lg overflow-hidden">
                  <span className="px-3 text-base font-bold text-gray-500">₹</span>
                  <input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 py-2 px-2 text-base font-bold outline-none" />
                </div>
              </div>
            )}

            <button onClick={() => onApprove({
              custom_clauses: { clauses, notes: extraNotes || null },
              bonus_amount: parseFloat(bonusAmount) || 0,
            })} disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-navy to-navy/80 text-white font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50">
              {loading ? 'Sending…' : 'Approve & Send to Influencer'}
            </button>
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
  useEffect(() => {
    if (campaign && !TABS.includes(tab)) {
      setTab('overview');
    }
  }, [campaign?.id, TABS.length]);

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
    const res = await contractApi.get(inf.id);
    if (res.success) setContractModal({ inf, contract: res.data?.contract || res.data, goal });
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

  async function handleApproveContract(payload) {
    if (!contractModal?.contract) return;
    setContractLoading(true);
    const res = await contractApi.approve(contractModal.contract.id, payload);
    setContractLoading(false);
    if (res.success) {
      showToast('Contract sent to influencer for signing.');
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
            // Pull lazy-loaded engagement + conversions data into rollups
            const engOverall   = engagement?.overall || engagement?.totals || {};
            const totalReach   = engOverall.reach        ?? engOverall.total_reach   ?? null;
            const totalEng     = engOverall.engagement   ?? engOverall.total_engagement ?? null;
            const avgER        = engOverall.engagement_rate ?? engOverall.avg_engagement_rate ?? null;
            const txCount      = conversions?.total_transactions ?? conversions?.summary?.total_transactions ?? null;
            const txRevenue    = conversions?.total_revenue      ?? conversions?.summary?.total_revenue      ?? null;
            const txCommission = conversions?.total_commission   ?? conversions?.summary?.total_commission   ?? null;
            const productCount = campaignProducts?.products?.length ?? campaignProducts?.summary?.total_products ?? null;

            // Build the stat cards based on goal
            let cards = [];

            // Always-on first row (universal)
            cards.push({ label: 'Influencers',  value: totalInfluencers });
            cards.push({ label: 'Active Offers', value: activeOffers, sub: `of ${totalInfluencers} invited` });
            cards.push({ label: 'Sets',         value: sets.length });
            cards.push({ label: 'Status',       value: (campaign.status || '—').replace(/_/g, ' ') });

            // Activity row (deliverables — always relevant)
            cards.push({ label: 'Deliverables Total', value: deliverableCounts.total });
            cards.push({ label: 'Awaiting Review',    value: deliverableCounts.submitted, sub: deliverableCounts.submitted > 0 ? 'Open Content tab' : '' });
            cards.push({ label: 'Live',               value: deliverableCounts.live });
            cards.push({ label: 'In Revision',        value: deliverableCounts.revision });

            // Engagement rollups (everyone benefits from these)
            cards.push({ label: 'Total Reach',     value: totalReach != null ? Number(totalReach).toLocaleString('en-IN') : '—' });
            cards.push({ label: 'Total Engagement', value: totalEng != null ? Number(totalEng).toLocaleString('en-IN') : '—' });
            cards.push({ label: 'Avg ER %',        value: avgER != null ? `${Number(avgER).toFixed(1)}%` : '—' });

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
                      const deliverables = inf.deliverables || [];
                      const products = inf.products || [];
                      const transactions = inf.transactions || [];
                      // Goal-aware: only show fields that apply to the parent set's goal.
                      const setGoal       = (set.goal || 'engagement').toLowerCase();
                      const showFeeFields = setGoal === 'engagement' || setGoal === 'hybrid';
                      const showCommFields = setGoal === 'conversion' || setGoal === 'hybrid';
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
                              <div className="flex items-center gap-1">
                                <span className="text-gray-300">├</span>
                                <span>Deliverables: <strong className="text-gray-700">{deliverables.length || 0}</strong>
                                  {deliverables.length > 0 ? <span className="text-gray-400 ml-1">({[...new Set(deliverables.map(d => d.type))].filter(Boolean).join(', ')})</span>
                                    : <span className="text-gray-400 ml-1">(awaiting — {inf.status})</span>}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-300">├</span>
                                <span>Products: <span className="text-gray-400">All brand products (brand-level offer)</span></span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-300">└</span>
                                <span>Transactions: <strong className="text-gray-700">{transactions.length || 0}</strong></span>
                              </div>
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
                        if (fmts?.length) return <span>🎬 {fmts.map(f => `${f.count || 1}× ${typeof f === 'string' ? f : (f.type || f.name || 'content')}`).join(', ')}</span>;
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
                                <span className="flex items-center gap-0.5"><TrancheIcon status={inf.t1_status} /> T1</span>
                                <span className="flex items-center gap-0.5"><TrancheIcon status={inf.t2_status} /> T2</span>
                                <span className="flex items-center gap-0.5"><TrancheIcon status={inf.t3_status} /> T3</span>
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
                  <DeliverableStatsCard deliverableId={d.id} />
                )}
              </div>
            ));
          })()}
        </div>
      )}

      {/* ── ANALYTICS TAB — Drill-Down ────────────────────────────────── */}
      {tab === 'analytics' && (
        <div>
          {!engagement ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading analytics...</div>
          ) : (
            <div className="space-y-4">
              {/* Campaign-level summary */}
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

              {/* Daily reach chart */}
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

              {/* Per-set breakdown cards */}
              {(engagement.by_set || sets).map(set => {
                const setData = engagement.by_set ? set : { ...set, reach: 0, impressions: 0, engagement_rate: 0 };
                const setKey = `aset-${set.id || set.set_id}`;
                const isOpen = expandedAnalyticsSets[setKey];
                const setInfluencers = engagement.by_influencer?.filter(inf => inf.set_id === (set.id || set.set_id)) || [];
                // If by_set is not available, group by_influencer by set
                const infList = setInfluencers.length > 0 ? setInfluencers : (engagement.by_influencer || []);
                return (
                  <div key={set.id || set.set_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button onClick={() => setExpandedAnalyticsSets(prev => ({ ...prev, [setKey]: !prev[setKey] }))}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left">
                      <div className="flex items-center gap-2">
                        <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                        <span className="font-bold text-sm text-gray-800">{set.name || set.set_name || 'Set'}</span>
                        <GoalBadge goal={set.goal} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        {setData.reach != null && <span>Reach: <strong className="text-gray-700">{fmtNum(setData.reach)}</strong></span>}
                        {setData.impressions != null && <span>Impr: <strong className="text-gray-700">{fmtNum(setData.impressions)}</strong></span>}
                        {setData.engagement_rate != null && <span>ER: <strong className="text-gray-700">{setData.engagement_rate}%</strong></span>}
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
                                  <span>Reach: <strong className="text-gray-800">{fmtNum(inf.reach)}</strong></span>
                                  <span>ER: <strong className="text-gray-800">{inf.engagement_rate || 0}%</strong></span>
                                  <span>Likes: <strong className="text-gray-800">{fmtNum(inf.likes)}</strong></span>
                                </div>
                              </button>
                              {isInfOpen && deliverableStats.length > 0 && (
                                <div className="px-6 pb-3">
                                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-6 gap-2 px-3 py-2 text-[9px] font-bold text-gray-400 uppercase border-b border-gray-100">
                                      <span>Type</span><span>Status</span><span>Reach</span><span>Likes</span><span>Comments</span><span>ER</span>
                                    </div>
                                    {deliverableStats.map((d, di) => (
                                      <div key={di} className="grid grid-cols-6 gap-2 px-3 py-2 text-xs text-gray-600 border-b border-gray-50 last:border-0">
                                        <span className="font-semibold uppercase text-navy">{d.type}</span>
                                        <span><StatusBadge status={d.status} /></span>
                                        <span>{fmtNum(d.reach)}</span>
                                        <span>{fmtNum(d.likes)}</span>
                                        <span>{fmtNum(d.comments)}</span>
                                        <span>{d.engagement_rate || '--'}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {isInfOpen && deliverableStats.length === 0 && (
                                <div className="px-6 pb-3 text-xs text-gray-400">No per-deliverable data available</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Fallback: flat influencer list if no per-set data */}
              {!engagement.by_set && engagement.by_influencer?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-600 uppercase tracking-wider">Per Influencer (All Sets)</div>
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
        goal={contractModal.goal}
        loading={contractLoading}
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
