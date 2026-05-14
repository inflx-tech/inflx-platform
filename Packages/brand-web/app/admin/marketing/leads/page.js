'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { marketingApi } from '../../../../lib/api';

const TYPE_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'influencer', label: 'Influencers' },
  { key: 'brand',      label: 'Brands' },
];

const STATUS_OPTIONS = [
  { key: '',              label: 'All statuses' },
  { key: 'not_contacted', label: 'Not contacted' },
  { key: 'contacted',     label: 'Contacted' },
  { key: 'replied',       label: 'Replied' },
  { key: 'interested',    label: 'Interested' },
  { key: 'negotiating',   label: 'Negotiating' },
  { key: 'registered',    label: 'Registered' },
  { key: 'dead',          label: 'Dead' },
  { key: 'paused',        label: 'Paused' },
];

const MIN_SCORE_OPTIONS = [
  { v: '',   label: 'Any score' },
  { v: '70', label: 'High (70+)' },
  { v: '40', label: 'Mid+ (40+)' },
  { v: '1',  label: 'Scored (1+)' },
];

function StatusBadge({ status }) {
  const cfg = {
    not_contacted: 'bg-surface2 text-t3',
    contacted:     'bg-gold-pale text-yellow-700',
    replied:       'bg-teal-pale text-teal-deep',
    interested:    'bg-teal-pale text-teal-deep',
    negotiating:   'bg-orange/15 text-orange',
    registered:    'bg-teal-pale text-teal-deep',
    dead:          'bg-red-pale text-red',
    paused:        'bg-surface2 text-t3',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg[status] || 'bg-surface2 text-t3'}`}>
      {status || 'unknown'}
    </span>
  );
}

function TierBadge({ tier }) {
  if (!tier) return null;
  return (
    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gold/10 text-yellow-700 border border-gold/30">
      {tier}
    </span>
  );
}

function ChannelDots({ phone, email, whatsapp }) {
  return (
    <div className="flex gap-1 items-center">
      <span className={`text-[10px] ${phone    ? 'opacity-100' : 'opacity-20'}`} title={phone || 'no phone'}>📞</span>
      <span className={`text-[10px] ${email    ? 'opacity-100' : 'opacity-20'}`} title={email || 'no email'}>✉️</span>
      <span className={`text-[10px] ${whatsapp ? 'opacity-100' : 'opacity-20'}`} title={whatsapp || 'no whatsapp'}>💬</span>
    </div>
  );
}

export default function MarketingTriagePage() {
  const [typeTab, setTypeTab] = useState('all');
  const [status, setStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [tier, setTier] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('priority_score_desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter options (cities, niches, tiers, etc.) — loaded once
  const [opts, setOpts] = useState({
    cities: [], niches: [], sub_niches: [],
    industries: [], sub_industries: [],
    creator_tiers: [], brand_tiers: [],
  });

  useEffect(() => {
    (async () => {
      const r = await marketingApi.getFilterOptions();
      if (r.success) setOpts(r.data);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketingApi.listLeads({
      target_type: typeTab,
      status,
      min_score: minScore,
      city,
      category,
      sub_category: subCategory,
      tier,
      search,
      sort,
      page,
      limit,
    });
    setLoading(false);
    if (res.success) {
      setRows(res.data || []);
      setTotal(res.meta?.total || 0);
    }
  }, [typeTab, status, minScore, city, category, subCategory, tier, search, sort, page, limit]);

  useEffect(() => { load(); }, [load]);

  // Reset category/sub_category when type changes (since they have different value lists)
  useEffect(() => {
    setCategory('');
    setSubCategory('');
    setTier('');
  }, [typeTab]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Pick the right option lists based on the active type tab
  const categoryOpts = typeTab === 'brand'
    ? opts.industries
    : typeTab === 'influencer'
      ? opts.niches
      : [...new Set([...opts.niches, ...opts.industries])].sort();
  const subCategoryOpts = typeTab === 'brand'
    ? opts.sub_industries
    : typeTab === 'influencer'
      ? opts.sub_niches
      : [...new Set([...opts.sub_niches, ...opts.sub_industries])].sort();
  const tierOpts = typeTab === 'brand'
    ? opts.brand_tiers
    : typeTab === 'influencer'
      ? opts.creator_tiers
      : [...new Set([...opts.creator_tiers, ...opts.brand_tiers])];

  function clearAll() {
    setStatus(''); setMinScore(''); setCity(''); setCategory(''); setSubCategory(''); setTier(''); setSearch(''); setSearchInput(''); setPage(1);
  }
  const hasFilters = status || minScore || city || category || subCategory || tier || search;

  return (
    <div className="space-y-3">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-border p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">Total Leads</div>
          <div className="font-display text-2xl font-extrabold text-t1">{total}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">Showing</div>
          <div className="font-display text-2xl font-extrabold text-navy">{rows.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">Page</div>
          <div className="font-display text-2xl font-extrabold text-t1">{page}/{totalPages}</div>
        </div>
        <Link href="/admin/marketing/add" className="bg-orange text-white rounded-xl p-3 hover:bg-orange/90 transition flex flex-col justify-center">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-90 mb-1">Quick Add</div>
          <div className="font-display text-base font-bold">➕ Add Lead</div>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex bg-surface2 rounded-lg p-0.5">
            {TYPE_TABS.map(t => (
              <button key={t.key} onClick={() => { setTypeTab(t.key); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${typeTab === t.key ? 'bg-white text-t1 shadow-sm' : 'text-t3 hover:text-t1'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white">
            {STATUS_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>

          <select value={minScore} onChange={e => { setMinScore(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white">
            {MIN_SCORE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>

          <select value={city} onChange={e => { setCity(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white max-w-[140px]">
            <option value="">All cities</option>
            {opts.cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={category} onChange={e => { setCategory(e.target.value); setSubCategory(''); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white max-w-[160px]">
            <option value="">{typeTab === 'brand' ? 'All industries' : typeTab === 'influencer' ? 'All niches' : 'All niche/industry'}</option>
            {categoryOpts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={subCategory} onChange={e => { setSubCategory(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white max-w-[160px]">
            <option value="">{typeTab === 'brand' ? 'All sub-industries' : 'All sub-niches'}</option>
            {subCategoryOpts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={tier} onChange={e => { setTier(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white">
            <option value="">All tiers</option>
            {tierOpts.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex">
            <input type="text" placeholder="Handle or name" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="text-xs border border-border rounded-l-lg px-2 py-1.5 w-44" />
            <button className="text-xs bg-navy text-white px-3 rounded-r-lg">Search</button>
          </form>

          <select value={sort} onChange={e => setSort(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white ml-auto">
            <option value="priority_score_desc">Sort: Score ↓</option>
            <option value="priority_score_asc">Sort: Score ↑</option>
            <option value="created_desc">Sort: Newest</option>
            <option value="last_scraped_desc">Sort: Recently scraped</option>
          </select>

          {hasFilters && (
            <button onClick={clearAll}
              className="text-xs text-orange font-semibold hover:underline">Clear all filters</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-t3 text-sm">
            No leads match these filters. <Link href="/admin/marketing/add" className="text-orange font-semibold">Add your first lead →</Link>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-surface2 text-t3">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Type</th>
                <th className="text-left px-3 py-2 font-bold">Handle</th>
                <th className="text-left px-3 py-2 font-bold">Name</th>
                <th className="text-left px-3 py-2 font-bold">City</th>
                <th className="text-left px-3 py-2 font-bold">Niche/Industry</th>
                <th className="text-left px-3 py-2 font-bold">Tier</th>
                <th className="text-right px-3 py-2 font-bold">Followers</th>
                <th className="text-right px-3 py-2 font-bold">Score</th>
                <th className="text-left px-3 py-2 font-bold">Status</th>
                <th className="text-left px-3 py-2 font-bold">Channels</th>
                <th className="text-left px-3 py-2 font-bold">Last Scraped</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.target_type}-${r.id}`} className="border-t border-border hover:bg-surface2/50">
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${r.target_type === 'brand' ? 'bg-navy/10 text-navy' : 'bg-orange/10 text-orange'}`}>
                      {r.target_type === 'brand' ? 'B' : 'I'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">@{r.handle}</td>
                  <td className="px-3 py-2 truncate max-w-[160px]">{r.name || '—'}</td>
                  <td className="px-3 py-2">{r.city || '—'}</td>
                  <td className="px-3 py-2 text-t2">{r.category || '—'}{r.sub_category ? ' / ' + r.sub_category : ''}</td>
                  <td className="px-3 py-2"><TierBadge tier={r.tier} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{(r.followers_count || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">{Number(r.priority_score || 0).toFixed(0)}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.outreach_status} /></td>
                  <td className="px-3 py-2"><ChannelDots phone={r.phone} email={r.email} whatsapp={r.whatsapp} /></td>
                  <td className="px-3 py-2 text-t3 text-[10px]">
                    {r.last_scraped_at ? new Date(r.last_scraped_at).toLocaleDateString() : 'Never'}
                    {!r.last_scraped_at && <span className="ml-1 text-orange font-bold">Scraping…</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/marketing/leads/${r.target_type}/${r.id}`}
                      className="text-orange font-semibold text-[11px] hover:underline">Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-xs">
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-border bg-white disabled:opacity-40 hover:bg-surface2">‹ Prev</button>
          <span className="px-3 py-1.5 text-t3">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-border bg-white disabled:opacity-40 hover:bg-surface2">Next ›</button>
        </div>
      )}
    </div>
  );
}
