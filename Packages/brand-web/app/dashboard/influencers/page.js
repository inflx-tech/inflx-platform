'use client';
import { useState } from 'react';
import { influencerApi, fmtNum } from '../../../lib/api';

const NICHES = ['food', 'fashion', 'beauty', 'lifestyle', 'fitness', 'travel', 'tech', 'education'];

export default function InfluencersPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [query, setQuery] = useState('');
  const [niche, setNiche] = useState('');
  const [city, setCity] = useState('');
  const [minFollowers, setMinFollowers] = useState('');

  async function search(e) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    const params = {};
    if (query) params.q = query;
    if (niche) params.niche = niche;
    if (city) params.city = city;
    if (minFollowers) params.min_followers = minFollowers;
    const res = await influencerApi.search(params);
    setLoading(false);
    if (res.success) setResults(res.data?.influencers || res.data || []);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Browse Influencers</h1>
        <p className="text-xs text-t3 mt-0.5">Search and invite influencers to your campaigns</p>
      </div>

      {/* Search form */}
      <div className="bg-white rounded-xl border border-border p-4 mb-5">
        <form onSubmit={search} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">Search</label>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name or @handle..." className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-gold" />
          </div>
          <div className="min-w-32">
            <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">Niche</label>
            <select value={niche} onChange={e=>setNiche(e.target.value)} className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none">
              <option value="">All niches</option>
              {NICHES.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="min-w-28">
            <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">City</label>
            <input value={city} onChange={e=>setCity(e.target.value)} placeholder="Mumbai..." className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-gold" />
          </div>
          <div className="min-w-28">
            <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">Min Followers</label>
            <input type="number" value={minFollowers} onChange={e=>setMinFollowers(e.target.value)} placeholder="1000" className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-gold" />
          </div>
          <button type="submit" disabled={loading} className="px-5 py-2 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-lg disabled:opacity-50 whitespace-nowrap">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-t3 text-sm">Searching...</div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-bold text-t1 mb-1">No results found</div>
          <div className="text-xs text-t3">Try adjusting your search filters</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(inf => (
            <div key={inf.id || inf.influencer_id} className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-orange-pale flex items-center justify-center text-sm font-bold text-orange-deep font-display">
                  {(inf.instagram_handle || '').slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-t1 truncate">@{inf.instagram_handle}</div>
                  <div className="text-[10px] text-t3">{inf.city}</div>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-t3 mb-3">
                <span>👤 {fmtNum(inf.followers_count)}</span>
                <span>📊 {inf.engagement_rate || 0}% ER</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {(inf.niche || []).slice(0, 3).map(n => (
                  <span key={n} className="px-2 py-0.5 bg-navy-pale text-navy text-[10px] font-semibold rounded-full">{n}</span>
                ))}
              </div>
              <button className="w-full py-2 bg-navy-pale text-navy font-bold text-xs rounded-lg hover:bg-navy hover:text-white transition-colors">
                Invite to Campaign
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
