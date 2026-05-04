'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { influencerApi, brandApi, creatorInvitationApi, fmtNum, fmtRupees } from '../../../lib/api';

const TIER_CFG = {
  nano:      { label: 'Nano',      color: 'bg-green-100 text-green-700' },
  micro:     { label: 'Micro',     color: 'bg-blue-100 text-blue-700' },
  mid:       { label: 'Mid',       color: 'bg-cyan-100 text-cyan-700' },
  macro:     { label: 'Macro',     color: 'bg-purple-100 text-purple-700' },
  mega:      { label: 'Mega',      color: 'bg-orange-100 text-orange-700' },
  celebrity: { label: 'Celebrity', color: 'bg-pink-100 text-pink-700' },
};

const SORTS = [
  { key: 'rank',         label: 'Best fit (rank)' },
  { key: 'view_er',      label: 'Best engagement' },
  { key: 'followers',    label: 'Most followers' },
  { key: 'active',       label: 'Most active' },
  { key: 'growth',       label: 'Highest growth potential' },
  { key: 'cheapest',     label: 'Lowest est. rate' },
  { key: 'most_collabs', label: 'Most brand collabs' },
];

function ERBadge({ er }) {
  const v = Number(er || 0);
  if (v >= 5)   return <span className="text-green-600 font-bold text-xs">🔥 {v.toFixed(2)}%</span>;
  if (v >= 2)   return <span className="text-blue-600 font-bold text-xs">✅ {v.toFixed(2)}%</span>;
  return <span className="text-gray-500 font-bold text-xs">{v.toFixed(2)}%</span>;
}

function CreatorCard({ c, onInvite }) {
  const router = useRouter();
  const tier = TIER_CFG[c.tier] || { label: c.tier || 'Unknown', color: 'bg-gray-100 text-gray-700' };
  const initials = (c.ig_handle || '??').slice(0, 2).toUpperCase();

  const partners = (() => {
    try {
      const arr = Array.isArray(c.top_brand_partners) ? c.top_brand_partners
        : JSON.parse(c.top_brand_partners || '[]');
      return arr.slice(0, 3).map(p => typeof p === 'string' ? p : (p.handle || ''));
    } catch { return []; }
  })().filter(Boolean);

  const isUnclaimed = c.source === 'scraped' && !c.is_inflx_verified;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all flex flex-col overflow-hidden group">
      <div className="p-4 flex items-start gap-3">
        {c.profile_pic_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.profile_pic_url} alt={c.ig_handle}
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-100"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-sm font-extrabold text-white font-display flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="font-bold text-sm text-gray-900 truncate">@{c.ig_handle}</span>
            {c.is_inflx_verified && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold uppercase tracking-wide" title="Verified by Inflx">
                ✓ Verified
              </span>
            )}
            {c.ig_verified && !c.is_inflx_verified && (
              <span className="text-blue-500 text-xs" title="Verified on Instagram">✓</span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tier.color}`}>{tier.label}</span>
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
            {c.city && <span>📍 {c.city}</span>}
            {c.niche && <span>🎨 {c.niche}</span>}
            {c.full_name && <span className="truncate">{c.full_name}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 border-t border-gray-100 mx-4 mb-3 pt-3">
        <div className="text-center">
          <div className="font-display text-sm font-extrabold text-gray-900">{fmtNum(c.followers_count)}</div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Followers</div>
        </div>
        <div className="text-center border-x border-gray-100">
          <div className="font-display text-sm font-extrabold"><ERBadge er={c.view_based_er} /></div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">View ER</div>
        </div>
        <div className="text-center">
          <div className="font-display text-sm font-extrabold text-gray-900">{fmtNum(c.avg_views)}</div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Avg Views</div>
        </div>
      </div>

      {(c.languages || c.sub_niche) && (
        <div className="flex flex-wrap gap-1 px-4 mb-3">
          {c.sub_niche && (
            <span className="px-2 py-0.5 bg-navy-pale text-navy text-[10px] font-semibold rounded-full">{c.sub_niche}</span>
          )}
          {(c.languages || []).slice(0, 3).map(l => (
            <span key={l} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded-full">{l}</span>
          ))}
        </div>
      )}

      {c.estimated_min_rate && (
        <div className="px-4 mb-3">
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Est. Rate</span>
            <span className="text-xs font-bold text-gray-700">
              {fmtRupees(c.estimated_min_rate)} – {fmtRupees(c.estimated_max_rate)}
            </span>
          </div>
        </div>
      )}

      {partners.length > 0 && (
        <div className="px-4 mb-3">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            Past brands {c.total_brand_collaborations ? `· ${c.total_brand_collaborations} collabs` : ''}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {partners.map(b => (
              <span key={b} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] font-semibold rounded-full border border-yellow-100">{b.replace(/^@/, '')}</span>
            ))}
          </div>
        </div>
      )}

      {/* Footer — different actions for scraped/onboarded vs verified-onboarded */}
      <div className="mt-auto border-t border-gray-100 grid grid-cols-2">
        <button
          onClick={() => router.push(`/dashboard/influencers/${c.linked_influencer_id || c.row_id}?source=${c.source}&handle=${c.ig_handle}`)}
          className="py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
        >
          View Profile
        </button>
        {isUnclaimed ? (
          <button
            onClick={() => onInvite(c)}
            className="py-2.5 text-xs font-bold text-purple-600 hover:bg-purple-50 transition-colors"
            title="This creator isn't on Inflx yet — we'll reach out for you"
          >
            ✉ Invite to Inflx
          </button>
        ) : (
          <button
            onClick={() => router.push(`/dashboard/campaigns`)}
            className="py-2.5 text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors"
          >
            + Add to Campaign
          </button>
        )}
      </div>
    </div>
  );
}

function InviteModal({ creator, onClose, onSubmitted }) {
  const [message, setMessage] = useState('');
  const [proposedFee, setProposedFee] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!creator) return null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const body = {
      ig_handle: creator.ig_handle,
      brand_message: message || undefined,
      proposed_fee: proposedFee ? Number(proposedFee) : undefined,
    };
    const res = await creatorInvitationApi.create(body);
    setBusy(false);
    if (res.success) {
      onSubmitted();
    } else {
      setErr(res?.error?.message || 'Failed to create invitation');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-lg text-gray-900">Invite @{creator.ig_handle}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Inflx admin will run outreach. The creator gets your offer when they sign up.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Message to creator (optional)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={2000}
              placeholder="Hey! We loved your content and would like to collaborate on…"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Proposed fee per post (optional, ₹)</label>
            <input type="number" value={proposedFee} onChange={e => setProposedFee(e.target.value)} min="0" step="500"
              placeholder="e.g. 5000"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400" />
          </div>

          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{err}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
              {busy ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InfluencersPage() {
  const router = useRouter();
  const [brandStatus,  setBrandStatus]  = useState(null);
  const [results,      setResults]      = useState([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [searched,     setSearched]     = useState(false);

  // Filters — full set
  const [query,        setQuery]        = useState('');
  const [city,         setCity]         = useState('');
  const [niche,        setNiche]        = useState('');
  const [tier,         setTier]         = useState('');
  const [language,     setLanguage]     = useState('');
  const [useCase,      setUseCase]      = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [maxFollowers, setMaxFollowers] = useState('');
  const [minViewEr,    setMinViewEr]    = useState('');
  const [minRate,      setMinRate]      = useState('');
  const [maxRate,      setMaxRate]      = useState('');
  const [hasCollabs,   setHasCollabs]   = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [brandHandle,  setBrandHandle]  = useState('');
  const [sort,         setSort]         = useState('rank');
  const [advanced,     setAdvanced]     = useState(false);

  // Invitation modal
  const [inviteTarget, setInviteTarget] = useState(null);
  const [toast,        setToast]        = useState(null);

  // Approval gate
  useEffect(() => {
    brandApi.getMe().then(res => {
      if (res.success) {
        const b = res.data?.brand || res.data;
        setBrandStatus(b?.user_status || b?.status || 'pending');
      } else setBrandStatus('pending');
    });
  }, []);

  // Auto-load on first allowed visit
  useEffect(() => { if (brandStatus === 'approved') doSearch(); /* eslint-disable-next-line */ }, [brandStatus]);

  if (brandStatus === null) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-3 border-orange border-t-transparent rounded-full" /></div>;
  if (brandStatus !== 'approved') return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="text-5xl mb-4">⏳</div>
      <h2 className="text-xl font-bold text-t1 mb-2">Account Under Review</h2>
      <p className="text-sm text-t2 mb-6">Your account is pending admin approval. Influencer browsing will be available once approved — usually within 24 hours.</p>
      <button onClick={() => router.push('/dashboard')} className="px-6 py-2.5 bg-navy text-white text-sm font-bold rounded-xl">← Back to Dashboard</button>
    </div>
  );

  async function doSearch(e) {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);
    const params = { sort };
    if (query)        params.q                  = query;
    if (city)         params.city               = city;
    if (niche)        params.niche              = niche;
    if (tier)         params.tier               = tier;
    if (language)     params.languages          = language;
    if (useCase)      params.use_case           = useCase;
    if (minFollowers) params.min_followers      = minFollowers;
    if (maxFollowers) params.max_followers      = maxFollowers;
    if (minViewEr)    params.min_view_er        = minViewEr;
    if (minRate)      params.min_rate           = minRate;
    if (maxRate)      params.max_rate           = maxRate;
    if (hasCollabs)   params.has_brand_collabs  = 'true';
    if (verifiedOnly) params.is_inflx_verified  = 'true';
    if (brandHandle)  params.brand_handle       = brandHandle.replace(/^@/, '');
    params.limit = 50;

    const res = await influencerApi.search(params);
    setLoading(false);
    if (res.success) {
      setResults(res.data?.creators || []);
      setTotal(res.meta?.total || 0);
    } else {
      setResults([]);
      setTotal(0);
      setToast({ kind: 'err', text: res?.error?.message || 'Search failed' });
    }
  }

  const clearFilters = () => {
    setQuery(''); setCity(''); setNiche(''); setTier(''); setLanguage('');
    setUseCase(''); setMinFollowers(''); setMaxFollowers(''); setMinViewEr('');
    setMinRate(''); setMaxRate(''); setHasCollabs(false); setVerifiedOnly(false);
    setBrandHandle(''); setSort('rank');
  };

  const activeFilterCount = [
    query, city, niche, tier, language, useCase, minFollowers, maxFollowers,
    minViewEr, minRate, maxRate, brandHandle,
  ].filter(Boolean).length + (hasCollabs ? 1 : 0) + (verifiedOnly ? 1 : 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900">Creator Search</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {searched ? `${total} creators` : 'Find the right creator for your campaign'}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/influencers/analytics')}
          className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy-dark whitespace-nowrap"
        >
          📊 Market Analytics
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
        <form onSubmit={doSearch}>
          {/* Search bar */}
          <div className="flex gap-3 mb-3">
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or @handle…"
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400"
            />
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 max-w-48">
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl disabled:opacity-50 whitespace-nowrap">
              {loading ? '…' : 'Search'}
            </button>
          </div>

          {/* Primary filters row */}
          <div className="flex flex-wrap gap-2 items-end mb-2">
            <div className="min-w-32">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">City</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Vijayawada, Mumbai…"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
            </div>
            <div className="min-w-32">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Niche</label>
              <input value={niche} onChange={e => setNiche(e.target.value)} placeholder="food_blogger, fashion…"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
            </div>
            <div className="min-w-24">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tier</label>
              <select value={tier} onChange={e => setTier(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400 capitalize">
                <option value="">All</option>
                {Object.keys(TIER_CFG).map(t => <option key={t} value={t}>{TIER_CFG[t].label}</option>)}
              </select>
            </div>
            <div className="min-w-24">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Min ER %</label>
              <input type="number" step="0.1" value={minViewEr} onChange={e => setMinViewEr(e.target.value)} placeholder="2.0"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
            </div>
            <button type="button" onClick={() => setAdvanced(!advanced)}
              className="px-3 py-1.5 text-xs font-bold text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50">
              {advanced ? 'Hide' : 'More'} filters {advanced ? '▴' : '▾'}
            </button>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 self-end">
                Clear ({activeFilterCount}) ✕
              </button>
            )}
          </div>

          {/* Advanced filters */}
          {advanced && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="min-w-28">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Language</label>
                  <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="english,telugu"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
                </div>
                <div className="min-w-32">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Use case</label>
                  <select value={useCase} onChange={e => setUseCase(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400">
                    <option value="">Any</option>
                    <option value="awareness">Awareness</option>
                    <option value="reach">Reach</option>
                    <option value="conversion">Conversion</option>
                    <option value="engagement">Engagement</option>
                  </select>
                </div>
                <div className="min-w-24">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Min followers</label>
                  <input type="number" value={minFollowers} onChange={e => setMinFollowers(e.target.value)} placeholder="10000"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
                </div>
                <div className="min-w-24">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Max followers</label>
                  <input type="number" value={maxFollowers} onChange={e => setMaxFollowers(e.target.value)} placeholder="500000"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
                </div>
                <div className="min-w-24">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Min rate ₹</label>
                  <input type="number" value={minRate} onChange={e => setMinRate(e.target.value)} placeholder="2000"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
                </div>
                <div className="min-w-24">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Max rate ₹</label>
                  <input type="number" value={maxRate} onChange={e => setMaxRate(e.target.value)} placeholder="50000"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
                </div>
                <div className="min-w-32">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Worked with brand</label>
                  <input value={brandHandle} onChange={e => setBrandHandle(e.target.value)} placeholder="@swiggy"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={hasCollabs} onChange={e => setHasCollabs(e.target.checked)} className="accent-orange-500" />
                  <span className="text-gray-700">Has worked with brands</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="accent-blue-500" />
                  <span className="text-gray-700">Verified by Inflx only</span>
                </label>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Tier summary chips */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {Object.entries(TIER_CFG).map(([key, cfg]) => {
            const count = results.filter(r => r.tier === key).length;
            if (!count) return null;
            return (
              <button key={key} onClick={() => { setTier(tier === key ? '' : key); doSearch(); }}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${tier === key ? cfg.color + ' border-current' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-8 bg-gray-100 rounded mb-3" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-8 bg-gray-100 rounded" /><div className="h-8 bg-gray-100 rounded" /><div className="h-8 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <div className="font-display font-bold text-gray-800 text-lg mb-2">No creators found</div>
          <div className="text-sm text-gray-400 mb-5">Try different filters or broaden your search</div>
          <button onClick={clearFilters} className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl">
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(c => (
            <CreatorCard key={c.row_id} c={c} onInvite={(creator) => setInviteTarget(creator)} />
          ))}
        </div>
      )}

      {/* Invitation modal */}
      <InviteModal
        creator={inviteTarget}
        onClose={() => setInviteTarget(null)}
        onSubmitted={() => {
          setInviteTarget(null);
          setToast({ kind: 'ok', text: '✓ Invitation queued — Inflx admin will reach out to the creator' });
          setTimeout(() => setToast(null), 4000);
        }}
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold ${toast.kind === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
