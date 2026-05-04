'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { influencerApi, fmtNum, fmtRupees } from '../../../../lib/api';

const TIER_COLORS = {
  nano:      'bg-green-500',
  micro:     'bg-blue-500',
  mid:       'bg-cyan-500',
  macro:     'bg-purple-500',
  mega:      'bg-orange-500',
  celebrity: 'bg-pink-500',
  unknown:   'bg-gray-400',
};

// ─── Atomic chart components ────────────────────────────────────────────────

function BarRow({ label, value, max, fmt = (v) => fmtNum(v), colorClass = 'bg-orange-500', prefix }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-32 text-gray-700 font-semibold truncate flex-shrink-0">
        {prefix}{label}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
          style={{ width: `${pct}%` }}
        >
          {pct > 25 && <span className="text-white text-[10px] font-bold">{fmt(value)}</span>}
        </div>
      </div>
      {pct <= 25 && <div className="w-16 text-right text-gray-600 font-bold">{fmt(value)}</div>}
    </div>
  );
}

function Donut({ segments, total, label }) {
  // segments = [{ key, label, n, color }]
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="14" />
          {segments.map(s => {
            const len = total > 0 ? (s.n / total) * circumference : 0;
            const dash = `${len} ${circumference - len}`;
            const el = (
              <circle key={s.key} cx="60" cy="60" r={radius} fill="none"
                stroke={s.color} strokeWidth="14"
                strokeDasharray={dash}
                strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-2xl font-extrabold text-gray-900">{total}</div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <div className="flex-1 text-gray-700 font-semibold capitalize">{s.label}</div>
            <div className="text-gray-500 font-bold">{s.n}</div>
            <div className="text-gray-400 w-10 text-right">{total > 0 ? Math.round((s.n / total) * 100) : 0}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, subtitle, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-sm text-gray-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, accent = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={`font-display text-2xl font-extrabold mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function LeaderRow({ rank, c, metric, metricLabel, metricColor = 'text-orange-600', router }) {
  const initials = (c.ig_handle || '??').slice(0, 2).toUpperCase();
  return (
    <button
      onClick={() => router.push(`/dashboard/influencers/${c.linked_influencer_id || c.row_id || ''}?handle=${c.ig_handle}`)}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
    >
      <div className="w-6 text-center text-xs font-bold text-gray-400">{rank}</div>
      {c.profile_pic_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.profile_pic_url} alt={c.ig_handle}
          className="w-8 h-8 rounded-lg object-cover bg-gray-100"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-[10px] font-extrabold text-white">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs text-gray-900 truncate">@{c.ig_handle}</span>
          {c.is_inflx_verified && <span className="text-blue-500 text-[10px]">✓</span>}
        </div>
        <div className="text-[10px] text-gray-500 truncate">
          {[c.tier && c.tier, c.city, c.niche].filter(Boolean).join(' • ')}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-xs font-extrabold ${metricColor}`}>{metric}</div>
        <div className="text-[9px] text-gray-400 uppercase tracking-wide">{metricLabel}</div>
      </div>
    </button>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CreatorAnalyticsPage() {
  const router = useRouter();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [city,    setCity]    = useState('');
  const [niche,   setNiche]   = useState('');
  const [tier,    setTier]    = useState('');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true);
    const params = {};
    if (city)  params.city  = city;
    if (niche) params.niche = niche;
    if (tier)  params.tier  = tier;
    const res = await influencerApi.analytics(params);
    setLoading(false);
    if (res.success) setData(res.data);
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto py-10 text-center">
        <div className="text-5xl mb-3">📉</div>
        <p className="text-gray-500 text-sm">Could not load analytics. Try refreshing.</p>
      </div>
    );
  }

  const ov = data.overview;

  // Tier donut segments
  const tierSegments = (data.tier_distribution || []).map(t => ({
    key: t.tier,
    label: t.tier,
    n: t.n,
    color: ({
      nano: '#22c55e', micro: '#3b82f6', mid: '#06b6d4',
      macro: '#a855f7', mega: '#f97316', celebrity: '#ec4899',
      unknown: '#9ca3af',
    })[t.tier] || '#9ca3af',
  }));
  const verSegs = [
    { key: 'verified',   label: 'Verified',     n: data.verification_breakdown?.verified || 0,   color: '#3b82f6' },
    { key: 'unverified', label: 'Not verified', n: data.verification_breakdown?.unverified || 0, color: '#e5e7eb' },
  ];

  const cityMax  = Math.max(1, ...(data.city_distribution     || []).map(r => r.n));
  const nicheMax = Math.max(1, ...(data.niche_distribution    || []).map(r => r.n));
  const langMax  = Math.max(1, ...(data.language_distribution || []).map(r => r.n));
  const erMax    = Math.max(1, ...(data.er_distribution?.buckets || []).map(r => r.n));
  const brandsMax = Math.max(1, ...(data.trending_brands || []).map(r => r.creator_count));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <button onClick={() => router.push('/dashboard/influencers')} className="text-xs text-gray-400 hover:text-gray-600 mb-1">← Back to search</button>
          <h1 className="font-display text-xl font-bold text-gray-900">Creator Market Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">Aggregate stats across {ov.total} searchable creators</p>
        </div>
      </div>

      {/* Scope filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 mb-5 shadow-sm flex flex-wrap items-end gap-2">
        <div className="text-[11px] text-gray-500 font-bold mr-2 self-center">SCOPE:</div>
        <input value={city}  onChange={e => setCity(e.target.value)}  placeholder="City (e.g. Vijayawada)"
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-navy w-44" />
        <input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Niche (e.g. food_blogger)"
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-navy w-44" />
        <select value={tier} onChange={e => setTier(e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-navy capitalize">
          <option value="">All tiers</option>
          {Object.keys(TIER_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={load} className="px-4 py-1.5 bg-navy text-white text-xs font-bold rounded-lg">Apply</button>
        {(city || niche || tier) && (
          <button onClick={() => { setCity(''); setNiche(''); setTier(''); setTimeout(load, 0); }}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            Clear
          </button>
        )}
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total creators"   value={ov.total}    sub={`${ov.verified} verified · ${ov.scraped} scraped · ${ov.onboarded} onboarded`} />
        <Stat label="Avg engagement"   value={`${(ov.avg_view_er ?? 0)}%`} sub="View-based ER across pool" accent="text-orange-600" />
        <Stat label="Distinct cities"  value={ov.distinct_cities} sub={`${ov.distinct_niches} niches`} />
        <Stat label="Rate range (min–max)"
              value={ov.min_rate ? `${fmtRupees(ov.min_rate)}–${fmtRupees(ov.max_rate)}` : '—'}
              sub="Per post, est." accent="text-green-600" />
      </div>

      {/* Row 1: Tier donut + Verification donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card title="Tier distribution" subtitle="Creators by follower tier">
          <Donut segments={tierSegments} total={tierSegments.reduce((s, t) => s + t.n, 0)} label="creators" />
        </Card>
        <Card title="Verification" subtitle="Verified by Inflx vs unverified">
          <Donut segments={verSegs} total={verSegs.reduce((s, t) => s + t.n, 0)} label="creators" />
        </Card>
      </div>

      {/* Row 2: City + Niche bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card title="Top cities" subtitle="Where creators are based">
          {(data.city_distribution || []).length === 0 ? (
            <div className="text-xs text-gray-400 py-4 text-center">No city data yet</div>
          ) : (
            <div className="space-y-2">
              {data.city_distribution.map(r => (
                <BarRow key={r.city} label={r.city} value={r.n} max={cityMax} colorClass="bg-blue-500" prefix="📍 " />
              ))}
            </div>
          )}
        </Card>
        <Card title="Top niches" subtitle="What creators make">
          {(data.niche_distribution || []).length === 0 ? (
            <div className="text-xs text-gray-400 py-4 text-center">No niche data yet</div>
          ) : (
            <div className="space-y-2">
              {data.niche_distribution.map(r => (
                <BarRow key={r.niche} label={r.niche} value={r.n} max={nicheMax} colorClass="bg-purple-500" prefix="🎨 " />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: ER buckets + Languages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card title="Engagement rate distribution" subtitle="How creators are spread by view-based ER">
          <div className="space-y-2">
            {(data.er_distribution?.buckets || []).map(b => (
              <BarRow key={b.label} label={b.label} value={b.n} max={erMax} colorClass="bg-orange-500" />
            ))}
          </div>
        </Card>
        <Card title="Languages" subtitle="Audience reach by language">
          {(data.language_distribution || []).length === 0 ? (
            <div className="text-xs text-gray-400 py-4 text-center">No language data yet</div>
          ) : (
            <div className="space-y-2">
              {data.language_distribution.map(r => (
                <BarRow key={r.lang} label={r.lang} value={r.n} max={langMax} colorClass="bg-green-500" />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Row 4: Rate by tier table */}
      <Card title="Pricing benchmarks by tier" subtitle="Use this to set realistic budgets" >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-gray-200">
                <th className="px-2 py-2 text-left">Tier</th>
                <th className="px-2 py-2 text-right">Creators</th>
                <th className="px-2 py-2 text-right">Avg min ₹</th>
                <th className="px-2 py-2 text-right">Avg max ₹</th>
                <th className="px-2 py-2 text-right">Median min</th>
                <th className="px-2 py-2 text-right">Median max</th>
              </tr>
            </thead>
            <tbody>
              {(data.rate_by_tier || []).map(r => (
                <tr key={r.tier} className="border-b border-gray-50">
                  <td className="px-2 py-2 font-semibold text-gray-700 capitalize">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${TIER_COLORS[r.tier] || 'bg-gray-400'}`} />
                    {r.tier}
                  </td>
                  <td className="px-2 py-2 text-right font-bold text-gray-700">{r.n}</td>
                  <td className="px-2 py-2 text-right">{r.avg_min ? fmtRupees(r.avg_min) : '—'}</td>
                  <td className="px-2 py-2 text-right">{r.avg_max ? fmtRupees(r.avg_max) : '—'}</td>
                  <td className="px-2 py-2 text-right text-gray-500">{r.median_min ? fmtRupees(r.median_min) : '—'}</td>
                  <td className="px-2 py-2 text-right text-gray-500">{r.median_max ? fmtRupees(r.median_max) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="h-5" />

      {/* Row 5: Three leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card
          title="🏆 Top by rank score"
          subtitle="Composite quality ranking — Inflx default sort"
          action={<button onClick={() => router.push('/dashboard/influencers?sort=rank')} className="text-[10px] font-bold text-orange-600 hover:underline">View all →</button>}
        >
          <div className="space-y-1">
            {(data.top_rank || []).map((c, i) => (
              <LeaderRow key={c.ig_handle} rank={i + 1} c={c} metric={(Number(c.rank_score) || 0).toFixed(1)} metricLabel="rank"
                metricColor="text-orange-600" router={router} />
            ))}
            {!(data.top_rank || []).length && <div className="text-xs text-gray-400 py-2 text-center">No rank data yet</div>}
          </div>
        </Card>

        <Card
          title="🚀 Top by growth potential"
          subtitle="Creators worth investing in early"
          action={<button onClick={() => router.push('/dashboard/influencers?sort=growth')} className="text-[10px] font-bold text-green-600 hover:underline">View all →</button>}
        >
          <div className="space-y-1">
            {(data.top_growth || []).map((c, i) => (
              <LeaderRow key={c.ig_handle} rank={i + 1} c={c} metric={c.growth_potential_score} metricLabel="/100"
                metricColor="text-green-600" router={router} />
            ))}
            {!(data.top_growth || []).length && <div className="text-xs text-gray-400 py-2 text-center">No growth data yet</div>}
          </div>
        </Card>
      </div>

      {/* Row 6: Cost-efficient + Cheapest */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card
          title="💎 Best cost-efficiency"
          subtitle="Most views per ₹1,000 spent"
          action={<button onClick={() => router.push('/dashboard/influencers?sort=cheapest')} className="text-[10px] font-bold text-cyan-600 hover:underline">View all →</button>}
        >
          <div className="space-y-1">
            {(data.cost_efficient || []).map((c, i) => (
              <LeaderRow key={c.ig_handle} rank={i + 1} c={c}
                metric={fmtNum(c.views_per_1k_inr)}
                metricLabel="views/₹1k"
                metricColor="text-cyan-600" router={router} />
            ))}
            {!(data.cost_efficient || []).length && <div className="text-xs text-gray-400 py-2 text-center">No rate data yet</div>}
          </div>
        </Card>

        <Card
          title="💰 Cheapest creators"
          subtitle="Lowest est. min rate"
          action={<button onClick={() => router.push('/dashboard/influencers?sort=cheapest')} className="text-[10px] font-bold text-emerald-600 hover:underline">View all →</button>}
        >
          <div className="space-y-1">
            {(data.cheapest || []).map((c, i) => (
              <LeaderRow key={c.ig_handle} rank={i + 1} c={c}
                metric={fmtRupees(c.estimated_min_rate)}
                metricLabel="min rate"
                metricColor="text-emerald-600" router={router} />
            ))}
            {!(data.cheapest || []).length && <div className="text-xs text-gray-400 py-2 text-center">No rate data yet</div>}
          </div>
        </Card>
      </div>

      {/* Row 7: Trending brands */}
      <Card title="🔗 Trending brands" subtitle="Brands most-collabbed across this creator pool">
        {(data.trending_brands || []).length === 0 ? (
          <div className="text-xs text-gray-400 py-4 text-center">No collab data yet</div>
        ) : (
          <div className="space-y-2">
            {data.trending_brands.map(b => (
              <BarRow
                key={b.brand_handle}
                label={`@${b.brand_handle}`}
                value={b.creator_count}
                max={brandsMax}
                colorClass="bg-yellow-500"
                fmt={(v) => `${v} creator${v === 1 ? '' : 's'}`}
              />
            ))}
          </div>
        )}
      </Card>

      <div className="h-10" />
    </div>
  );
}
