'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { campaignApi, fmtRupees } from '../../../../../lib/api';

const GOAL_BADGE = {
  engagement: { bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]', label: 'Engagement' },
  conversion: { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', label: 'Conversion' },
  hybrid:     { bg: 'bg-[#FFE4B5]', text: 'text-[#6B5A00]', label: 'Hybrid' },
};

const STATUS_DOT = {
  invited:     'bg-[#A1A1AA]',
  applied:     'bg-[#FFC107]',
  accepted:    'bg-[#10B981]',
  negotiating: 'bg-[#E0A800]',
  contracted:  'bg-[#10B981]',
  active:      'bg-[#10B981]',
  live:        'bg-[#10B981]',
  declined:    'bg-[#E8401A]',
  expired:     'bg-[#A1A1AA]',
  completed:   'bg-[#71717A]',
};

function GoalBadge({ goal }) {
  const cfg = GOAL_BADGE[(goal || '').toLowerCase()];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.3px] ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatStatusLabel(s) {
  return (s || '').replace(/_/g, ' ');
}

export default function CampaignSetsListPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    campaignApi.get(id).then(res => {
      if (cancelled) return;
      setLoading(false);
      if (res.success) setCampaign(res.data?.campaign || res.data);
      else setError(res.error?.message || 'Failed to load campaign');
    }).catch(err => {
      if (cancelled) return;
      setLoading(false);
      setError(err.message || 'Network error');
    });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center text-[#71717A] font-body">
        Loading sets…
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
  const totalInfluencers = sets.reduce((sum, s) => sum + (s.influencers?.length || 0), 0);

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
        <span className="text-[#0A0A0A] font-bold">sets</span>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-[26px] font-bold text-[#0A0A0A] -tracking-[0.5px]">Campaign sets</h1>
          <div className="w-11 h-1 bg-[#FFC107] rounded-full mt-1.5 mb-2.5"></div>
          <div className="text-[12.5px] text-[#52525B]">
            <span className="font-mono font-semibold text-[#0A0A0A]">{sets.length}</span> set{sets.length !== 1 ? 's' : ''}
            <span className="text-[#D4D4D8] mx-2">·</span>
            <span className="font-mono font-semibold text-[#0A0A0A]">{totalInfluencers}</span> total influencer{totalInfluencers !== 1 ? 's' : ''}
            <span className="text-[#D4D4D8] mx-2">·</span>
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

      {/* Sets list */}
      {sets.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E4E4E7] rounded-[16px] py-16 text-center">
          <div className="font-display font-bold text-[#0A0A0A] mb-1">No sets yet</div>
          <div className="text-xs text-[#71717A]">Sets define goal, influencers and content.</div>
          <Link
            href={`/dashboard/campaigns/new?id=${id}`}
            className="inline-block mt-4 px-4 py-2 bg-[#FFC107] text-[#0A0A0A] font-bold text-[12.5px] rounded-[10px] no-underline hover:bg-[#E0A800]"
          >
            Add sets
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {sets.map(s => {
            const allRows     = s.influencers || [];
            const isOpenGroup = s.influencer_mode === 'open_group';
            const broadcast   = allRows.length;
            const applied     = allRows.filter(r => r.status === 'applied').length;
            const approved    = allRows.filter(r => ['accepted','contracted','active','live','completed'].includes(r.status)).length;

            const OPEN_GROUP_HIDDEN = ['invited','applied','declined','rejected_by_brand','slots_filled','expired'];
            const rosterRows = isOpenGroup
              ? allRows.filter(r => !OPEN_GROUP_HIDDEN.includes(r.status))
              : allRows;
            const top5    = rosterRows.slice(0, 5);
            const remain  = Math.max(0, rosterRows.length - top5.length);

            return (
              <article key={s.id} className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:border-[#D4D4D8] transition-colors">
                {/* Set header */}
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-display font-bold text-[15px] text-[#0A0A0A]">{s.name}</span>
                      <GoalBadge goal={s.goal} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.3px] px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B]">
                        {isOpenGroup ? 'Open call' : 'Handpick'}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-[#71717A]">
                      {s.window_start && (
                        <>
                          <span className="font-mono font-semibold text-[#0A0A0A]">{formatDate(s.window_start)}</span>
                          {' → '}
                          <span className="font-mono font-semibold text-[#0A0A0A]">{s.window_end ? formatDate(s.window_end) : '?'}</span>
                        </>
                      )}
                      {Number(s.set_budget) > 0 && (
                        <>
                          {s.window_start && <span className="text-[#D4D4D8] mx-1.5">·</span>}
                          <span className="font-mono font-semibold text-[#0A0A0A]">{fmtRupees(s.set_budget)}</span> budget
                        </>
                      )}
                      {s.coupon_prefix && (
                        <>
                          <span className="text-[#D4D4D8] mx-1.5">·</span>
                          prefix <span className="font-mono font-semibold text-[#0A0A0A]">{s.coupon_prefix}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-[26px] text-[#0A0A0A] -tracking-[0.4px] leading-none">
                    {allRows.length}
                    <span className="block text-[10px] font-bold uppercase tracking-[0.4px] text-[#71717A] text-right -mt-0.5">infs</span>
                  </div>
                </div>

                {/* Open-group funnel */}
                {isOpenGroup && (
                  <div className="grid grid-cols-3 gap-2 mb-3 p-3 rounded-[12px] bg-[#FFFDEB] border border-[#FFC107]/30">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#6B5A00] mb-0.5">Broadcast</div>
                      <div className="font-mono font-bold text-lg text-[#0A0A0A]">{broadcast}</div>
                    </div>
                    <div className="border-l border-[#FFC107]/40 pl-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#6B5A00] mb-0.5">Applied</div>
                      <div className="font-mono font-bold text-lg text-[#0A0A0A]">{applied}</div>
                    </div>
                    <div className="border-l border-[#FFC107]/40 pl-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#6B5A00] mb-0.5">Approved</div>
                      <div className="font-mono font-bold text-lg text-[#0A0A0A]">{approved}{s.max_cap ? <span className="text-[#71717A] text-sm"> / {s.max_cap}</span> : null}</div>
                    </div>
                  </div>
                )}

                {/* Brief */}
                {s.brief && (
                  <div className="text-[12px] text-[#52525B] mb-3 leading-relaxed">
                    {s.brief}
                  </div>
                )}

                {/* Mini-roster */}
                {top5.length > 0 ? (
                  <div className="border-t border-[#F4F4F5] pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#71717A] mb-2">Top {top5.length}{remain > 0 ? ` of ${rosterRows.length}` : ''}</div>
                    <ul className="space-y-1.5">
                      {top5.map(ci => (
                        <li key={ci.id} className="flex items-center gap-2.5 text-[12.5px]">
                          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[ci.status] || 'bg-[#A1A1AA]'} flex-shrink-0`} />
                          <span className="font-semibold text-[#0A0A0A] truncate">
                            {ci.influencer_name || ci.instagram_handle || 'Influencer'}
                          </span>
                          {ci.instagram_handle && (
                            <span className="font-mono text-[11px] text-[#71717A] truncate">@{ci.instagram_handle}</span>
                          )}
                          <span className="ml-auto text-[10.5px] font-bold uppercase tracking-[0.3px] text-[#52525B]">
                            {formatStatusLabel(ci.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {remain > 0 && (
                      <Link
                        href={`/dashboard/campaigns/${id}/influencers?setId=${s.id}`}
                        className="block mt-2 text-[11.5px] font-semibold text-[#0A0A0A] hover:underline no-underline"
                      >
                        + {remain} more influencer{remain !== 1 ? 's' : ''} →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-[#F4F4F5] pt-3 text-[11.5px] text-[#71717A] italic">
                    {isOpenGroup
                      ? (applied > 0 ? 'Applications pending review — see Influencers.' : 'Broadcasting to matched influencers.')
                      : 'No influencers assigned yet.'}
                  </div>
                )}

                {/* CTA */}
                <div className="mt-4 pt-3 border-t border-[#F4F4F5] flex items-center justify-between">
                  <Link
                    href={`/dashboard/campaigns/${id}/influencers?setId=${s.id}`}
                    className="text-[12px] font-bold text-[#0A0A0A] hover:underline no-underline"
                  >
                    View all influencers in this set →
                  </Link>
                  {applied > 0 && (
                    <Link
                      href={`/dashboard/campaigns/${id}/influencers?setId=${s.id}&status=applied`}
                      className="text-[11.5px] font-bold text-[#6B5A00] bg-[#FFF7CC] px-2.5 py-1 rounded-full no-underline hover:bg-[#FFE48F]"
                    >
                      Review {applied} application{applied !== 1 ? 's' : ''}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
