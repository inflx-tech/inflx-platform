'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, fmtNum, fmtRupees } from '../../../../lib/api';

const TIER_CFG = {
  nano:      { label: 'Nano',      color: 'bg-green-100 text-green-700',  range: '1K–10K'  },
  micro:     { label: 'Micro',     color: 'bg-blue-100 text-blue-700',    range: '10K–100K' },
  mid:       { label: 'Mid',       color: 'bg-cyan-100 text-cyan-700',    range: '100K–500K' },
  macro:     { label: 'Macro',     color: 'bg-purple-100 text-purple-700', range: '100K–1M'  },
  mega:      { label: 'Mega',      color: 'bg-orange-100 text-orange-700', range: '1M+'      },
  celebrity: { label: 'Celebrity', color: 'bg-pink-100 text-pink-700',    range: '1M+'      },
};

const PLATFORM_ICON = { Instagram: '📸', YouTube: '▶️', Both: '📸▶️' };

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <div className="font-display text-2xl font-extrabold text-gray-900">{value}</div>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Tag({ children, color = 'bg-gray-100 text-gray-600' }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>{children}</span>;
}

export default function InfluencerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [inf, setInf]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    api.get(`/influencers/${id}`).then(res => {
      setLoading(false);
      if (res.success) setInf(res.data?.influencer || res.data);
    });
  }, [id]);

  if (loading) return <div className="text-center py-20 text-gray-400 text-sm">Loading profile…</div>;
  if (!inf)    return <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm">Influencer not found</div>;

  const tier    = TIER_CFG[inf.tier] || TIER_CFG.micro;
  const niches  = [...(inf.niche || []), ...(inf.secondary_niche || [])].filter(Boolean);
  const brands  = (() => { try { return Array.isArray(inf.past_brands_json) ? inf.past_brands_json : JSON.parse(inf.past_brands_json || '[]'); } catch { return []; } })();
  const collabs = (() => { try { return Array.isArray(inf.collaboration_types_json) ? inf.collaboration_types_json : JSON.parse(inf.collaboration_types_json || '[]'); } catch { return []; } })();
  const initials = (inf.instagram_handle || '??').slice(0, 2).toUpperCase();

  const erColor = inf.engagement_rate >= 8 ? 'text-green-600' : inf.engagement_rate >= 4 ? 'text-blue-600' : 'text-gray-600';
  const erLabel = inf.engagement_rate >= 8 ? '🔥 Excellent' : inf.engagement_rate >= 4 ? '✅ Good' : 'Average';

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
        ← Back to Influencers
      </button>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5 shadow-sm">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-2xl font-extrabold text-white font-display flex-shrink-0">
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-display text-2xl font-bold text-gray-900">{inf.full_name || inf.name}</h1>
              {inf.is_inflx_verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wide" title="Verified by Inflx">
                  ✓ Verified
                </span>
              )}
              {inf.verified && !inf.is_inflx_verified && (
                <span className="text-blue-500 text-lg" title="Verified on Instagram">✓</span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${tier.color}`}>{tier.label}</span>
              {inf.source === 'scraped' && (
                <span className="text-[10px] text-gray-400 italic">Profile data via Inflx market scan</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500 mb-2 flex-wrap">
              <span className="font-mono text-gray-700">@{inf.instagram_handle}</span>
              {inf.youtube_handle && <span className="font-mono text-gray-500">▶ {inf.youtube_handle}</span>}
              <span>{PLATFORM_ICON[inf.platform] || '📸'} {inf.platform}</span>
              {inf.city && <span>📍 {inf.city}{inf.state ? `, ${inf.state}` : ''}</span>}
              {inf.age && <span>🎂 {inf.age} yrs</span>}
              {inf.gender && <span className="capitalize">⚤ {inf.gender}</span>}
            </div>

            {inf.bio && <p className="text-sm text-gray-600 leading-relaxed mb-3">{inf.bio}</p>}

            <div className="flex flex-wrap gap-1.5">
              {niches.map(n => <Tag key={n} color="bg-navy-pale text-navy">{n}</Tag>)}
              {(inf.language || []).map(l => <Tag key={l} color="bg-gray-100 text-gray-600">{l}</Tag>)}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => setShowInvite(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl hover:shadow-lg transition-shadow whitespace-nowrap"
            >
              + Invite to Campaign
            </button>
            {inf.website && (
              <a href={`https://${inf.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer"
                className="px-5 py-2.5 bg-gray-50 border border-gray-200 text-gray-600 font-semibold text-xs rounded-xl text-center hover:border-gray-300 transition-colors">
                View Profile ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Followers" value={fmtNum(inf.followers_count)} sub={tier.range} />
        <StatCard label="Engagement Rate" value={<span className={erColor}>{inf.engagement_rate || 0}%</span>} sub={erLabel} />
        <StatCard label="Avg Views" value={fmtNum(inf.avg_views)} sub="per post" />
        <StatCard label="Total Posts" value={fmtNum(inf.total_posts)} sub="published" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Avg engagement breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-sm text-gray-700 mb-4">📊 Avg Engagement per Post</h3>
            <div className="space-y-3">
              {[
                { label: 'Likes',    value: inf.avg_likes,    icon: '❤️',  color: 'bg-red-400' },
                { label: 'Comments', value: inf.avg_comments, icon: '💬',  color: 'bg-blue-400' },
                { label: 'Shares',   value: inf.avg_shares,   icon: '🔁',  color: 'bg-green-400' },
                { label: 'Saves',    value: inf.avg_saves,    icon: '🔖',  color: 'bg-purple-400' },
              ].filter(s => s.value > 0).map(s => {
                const maxVal = Math.max(inf.avg_likes || 0, 1);
                const pct = Math.min(100, ((s.value || 0) / maxVal) * 100);
                return (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{s.icon} {s.label}</span>
                      <span className="font-semibold text-gray-800">{fmtNum(s.value)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${s.color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-sm text-gray-700 mb-4">💰 Pricing (per post)</h3>
            {inf.price_per_post_min && inf.price_per_post_max ? (
              <div>
                <div className="text-2xl font-extrabold font-display text-gray-900 mb-1">
                  {fmtRupees(inf.price_per_post_min)} – {fmtRupees(inf.price_per_post_max)}
                </div>
                <div className="text-xs text-gray-400">Indicative rate · final fee via negotiation</div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-300 to-orange-500 rounded-full" style={{ width: '60%' }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{tier.label} avg</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">Pricing not disclosed</div>
            )}
          </div>

          {/* Collaboration types */}
          {collabs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-sm text-gray-700 mb-3">🎬 Collaboration Types</h3>
              <div className="flex flex-wrap gap-2">
                {collabs.map(c => (
                  <span key={c} className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full capitalize">
                    {c.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Past brands */}
          {brands.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-sm text-gray-700 mb-3">🏆 Past Brand Collaborations</h3>
              <div className="grid grid-cols-2 gap-2">
                {brands.map(b => (
                  <div key={b} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-navy-pale to-blue-100 flex items-center justify-center text-[10px] font-extrabold text-navy flex-shrink-0">
                      {b.slice(0, 1)}
                    </div>
                    <span className="text-xs font-semibold text-gray-700 truncate">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audience insights */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-sm text-gray-700 mb-4">👥 Audience Insights</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-500">Platform</span>
                <span className="font-semibold text-gray-800">{PLATFORM_ICON[inf.platform]} {inf.platform}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-500">Primary Location</span>
                <span className="font-semibold text-gray-800">{inf.city || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-500">Languages</span>
                <span className="font-semibold text-gray-800">{(inf.language || []).join(', ') || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-500">Gender</span>
                <span className="font-semibold text-gray-800 capitalize">{inf.gender || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Content Niches</span>
                <span className="font-semibold text-gray-800">{niches.slice(0, 3).join(', ') || '—'}</span>
              </div>
            </div>
          </div>

          {/* Quick action */}
          <div className="bg-gradient-to-br from-navy to-blue-900 rounded-2xl p-5 text-white">
            <div className="text-sm font-bold mb-1">Ready to collaborate?</div>
            <div className="text-xs text-blue-200 mb-4">Send a campaign invite — {inf.full_name || inf.name} will see it in their offer inbox.</div>
            <button
              onClick={() => setShowInvite(true)}
              className="w-full py-2.5 bg-white text-navy font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors"
            >
              + Invite to Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Invite Modal placeholder */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="font-bold text-lg text-gray-900 mb-2">Invite @{inf.instagram_handle}</div>
            <div className="text-sm text-gray-500 mb-5">To invite this influencer to a campaign, go to your campaign wizard and use the influencer search in handpick mode.</div>
            <div className="flex gap-3">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold text-sm rounded-xl hover:bg-gray-50">
                Close
              </button>
              <a href="/dashboard/campaigns" className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl text-center hover:shadow-lg">
                Go to Campaigns
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
