'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { influencerApi, brandApi, fmtNum, fmtRupees } from '../../../lib/api';

const NICHES    = ['Food','Fashion','Beauty','Lifestyle','Fitness','Travel','Tech','Gaming','Finance','Parenting','Education'];
const TIERS     = ['nano','micro','macro','mega'];
const PLATFORMS = ['Instagram','YouTube','Both'];
const TIER_CFG  = {
  nano:  { label: 'Nano',  color: 'bg-green-100 text-green-700' },
  micro: { label: 'Micro', color: 'bg-blue-100 text-blue-700' },
  macro: { label: 'Macro', color: 'bg-purple-100 text-purple-700' },
  mega:  { label: 'Mega',  color: 'bg-orange-100 text-orange-700' },
};

function ERBadge({ er }) {
  if (er >= 8)  return <span className="text-green-600 font-bold text-xs">🔥 {er}%</span>;
  if (er >= 4)  return <span className="text-blue-600 font-bold text-xs">✅ {er}%</span>;
  return <span className="text-gray-500 font-bold text-xs">{er}%</span>;
}

function InfluencerCard({ inf }) {
  const router = useRouter();
  const tier    = TIER_CFG[inf.tier] || TIER_CFG.micro;
  const niches  = [...(inf.niche || []), ...(inf.secondary_niche || [])].slice(0, 3);
  const brands  = (() => { try { return Array.isArray(inf.past_brands_json) ? inf.past_brands_json : JSON.parse(inf.past_brands_json || '[]'); } catch { return []; } })().slice(0, 3);
  const initials = (inf.instagram_handle || '??').slice(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all flex flex-col overflow-hidden group">
      {/* Card top */}
      <div className="p-4 flex items-start gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-sm font-extrabold text-white font-display flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="font-bold text-sm text-gray-900 truncate">@{inf.instagram_handle}</span>
            {inf.verified && <span className="text-blue-500 text-xs" title="Verified">✓</span>}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tier.color}`}>{tier.label}</span>
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
            {inf.city && <span>📍 {inf.city}</span>}
            <span>{inf.platform === 'YouTube' ? '▶️' : '📸'} {inf.platform}</span>
          </div>
        </div>
      </div>

      {/* Bio snippet */}
      {inf.bio && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{inf.bio}</p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-0 border-t border-gray-100 mx-4 mb-3 pt-3">
        <div className="text-center">
          <div className="font-display text-sm font-extrabold text-gray-900">{fmtNum(inf.followers_count)}</div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Followers</div>
        </div>
        <div className="text-center border-x border-gray-100">
          <div className="font-display text-sm font-extrabold"><ERBadge er={inf.engagement_rate || 0} /></div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Eng. Rate</div>
        </div>
        <div className="text-center">
          <div className="font-display text-sm font-extrabold text-gray-900">{fmtNum(inf.avg_views)}</div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Avg Views</div>
        </div>
      </div>

      {/* Niches */}
      <div className="flex flex-wrap gap-1 px-4 mb-3">
        {niches.map(n => (
          <span key={n} className="px-2 py-0.5 bg-navy-pale text-navy text-[10px] font-semibold rounded-full">{n}</span>
        ))}
        {(inf.language || []).slice(0, 2).map(l => (
          <span key={l} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded-full">{l}</span>
        ))}
      </div>

      {/* Price range */}
      {inf.price_per_post_min && (
        <div className="px-4 mb-3">
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Rate</span>
            <span className="text-xs font-bold text-gray-700">
              {fmtRupees(inf.price_per_post_min)} – {fmtRupees(inf.price_per_post_max)}
            </span>
          </div>
        </div>
      )}

      {/* Past brands mini */}
      {brands.length > 0 && (
        <div className="px-4 mb-3">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Past Brands</div>
          <div className="flex gap-1.5 flex-wrap">
            {brands.map(b => (
              <span key={b} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] font-semibold rounded-full border border-yellow-100">{b}</span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto border-t border-gray-100 grid grid-cols-2">
        <button
          onClick={() => router.push(`/dashboard/influencers/${inf.id}`)}
          className="py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
        >
          View Profile
        </button>
        <button
          onClick={() => router.push(`/dashboard/campaigns`)}
          className="py-2.5 text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors"
        >
          + Invite
        </button>
      </div>
    </div>
  );
}

export default function InfluencersPage() {
  const router = useRouter();
  const [brandStatus, setBrandStatus] = useState(null);
  const [results,      setResults]     = useState([]);
  const [loading,      setLoading]     = useState(false);
  const [searched,     setSearched]    = useState(false);
  const [query,        setQuery]       = useState('');
  const [niche,        setNiche]       = useState('');
  const [city,         setCity]        = useState('');
  const [tier,         setTier]        = useState('');
  const [platform,     setPlatform]    = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [minEr,        setMinEr]       = useState('');

  // Check brand approval
  useEffect(() => {
    brandApi.getMe().then(res => {
      if (res.success) {
        const b = res.data?.brand || res.data;
        setBrandStatus(b?.user_status || b?.status || 'pending');
      } else setBrandStatus('pending');
    });
  }, []);

  // Auto-load all approved influencers on first visit
  useEffect(() => { if (brandStatus === 'approved') doSearch(); }, [brandStatus]);

  // Block unapproved
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
    const params = {};
    if (query)        params.q             = query;
    if (niche)        params.niche         = niche;
    if (city)         params.city          = city;
    if (tier)         params.tier          = tier;
    if (platform)     params.platform      = platform;
    if (minFollowers) params.min_followers = minFollowers;
    if (minEr)        params.min_er        = minEr;
    const res = await influencerApi.search(params);
    setLoading(false);
    if (res.success) setResults(res.data?.influencers || res.data || []);
  }

  const clearFilters = () => {
    setQuery(''); setNiche(''); setCity(''); setTier(''); setPlatform(''); setMinFollowers(''); setMinEr('');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900">Influencer Directory</h1>
          <p className="text-xs text-gray-400 mt-0.5">{results.length > 0 ? `${results.length} influencers` : 'Find the right creator for your campaign'}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
        <form onSubmit={doSearch}>
          {/* Search bar */}
          <div className="flex gap-3 mb-3">
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or @handle…"
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-orange-400 transition-colors"
            />
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl disabled:opacity-50 hover:shadow-md transition-shadow whitespace-nowrap">
              {loading ? '…' : 'Search'}
            </button>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-28">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Niche</label>
              <select value={niche} onChange={e => setNiche(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-orange-400">
                <option value="">All niches</option>
                {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="min-w-24">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tier</label>
              <select value={tier} onChange={e => setTier(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-orange-400 capitalize">
                <option value="">All tiers</option>
                {TIERS.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div className="min-w-28">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Platform</label>
              <select value={platform} onChange={e => setPlatform(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-orange-400">
                <option value="">All platforms</option>
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="min-w-28">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">City</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Mumbai…"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-orange-400" />
            </div>
            <div className="min-w-28">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Min Followers</label>
              <input type="number" value={minFollowers} onChange={e => setMinFollowers(e.target.value)} placeholder="e.g. 10000"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-orange-400" />
            </div>
            <div className="min-w-24">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Min ER %</label>
              <input type="number" step="0.1" value={minEr} onChange={e => setMinEr(e.target.value)} placeholder="e.g. 5"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-orange-400" />
            </div>
            {(niche || tier || platform || city || minFollowers || minEr) && (
              <button type="button" onClick={clearFilters}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors self-end">
                Clear ✕
              </button>
            )}
          </div>
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
                <div className="h-8 bg-gray-100 rounded" />
                <div className="h-8 bg-gray-100 rounded" />
                <div className="h-8 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <div className="font-display font-bold text-gray-800 text-lg mb-2">No influencers found</div>
          <div className="text-sm text-gray-400 mb-5">Try different filters or broaden your search</div>
          <button onClick={clearFilters} className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl">
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(inf => <InfluencerCard key={inf.id} inf={inf} />)}
        </div>
      )}
    </div>
  );
}
