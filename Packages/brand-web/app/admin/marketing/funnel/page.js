'use client';

import { useEffect, useState } from 'react';
import { marketingApi } from '../../../../lib/api';

const STAGE_ORDER = ['not_contacted', 'contacted', 'replied', 'interested', 'negotiating', 'registered', 'dead', 'paused'];

const STAGE_LABEL = {
  not_contacted: 'Not Contacted',
  contacted:     'Contacted',
  replied:       'Replied',
  interested:    'Interested',
  negotiating:   'Negotiating',
  registered:    'Registered',
  dead:          'Dead',
  paused:        'Paused',
};

const STAGE_COLOR = {
  not_contacted: 'bg-surface2 text-t3',
  contacted:     'bg-gold-pale text-yellow-700',
  replied:       'bg-teal-pale text-teal-deep',
  interested:    'bg-teal-pale text-teal-deep',
  negotiating:   'bg-orange/15 text-orange',
  registered:    'bg-teal-deep text-white',
  dead:          'bg-red-pale text-red',
  paused:        'bg-surface2 text-t3',
};

export default function MarketingFunnelPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await marketingApi.getFunnel();
      setLoading(false);
      if (res.success) setData(res.data);
    })();
  }, []);

  if (loading) return <div className="text-t3 text-sm p-8 text-center">Loading…</div>;
  if (!data || !data.totals || !data.influencers || !data.brands) return <div className="text-t3 text-sm p-8 text-center">Failed to load funnel.</div>;

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">📊 Funnel</h1>
        <p className="text-xs text-t3">Where leads are sitting + how many move from one stage to the next.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FunnelCard title="⭐ Influencers" totals={data.totals.influencers} counts={data.influencers.counts} conversions={data.influencers.conversions} />
        <FunnelCard title="🏢 Brands" totals={data.totals.brands} counts={data.brands.counts} conversions={data.brands.conversions} />
      </div>
    </div>
  );
}

function FunnelCard({ title, totals, counts, conversions }) {
  const max = Math.max(...STAGE_ORDER.map(s => counts[s] || 0), 1);
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-base font-bold text-t1">{title}</h2>
        <span className="text-xs text-t3">Total: <span className="font-bold text-t1">{totals}</span></span>
      </div>
      <div className="space-y-2">
        {STAGE_ORDER.map((s, i) => {
          const n = counts[s] || 0;
          const widthPct = max > 0 ? (n / max) * 100 : 0;
          const convKey = `${s}_to_${STAGE_ORDER[i + 1]}`;
          const conv = conversions[convKey];
          return (
            <div key={s}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STAGE_COLOR[s]}`}>
                  {STAGE_LABEL[s]}
                </span>
                <span className="font-bold text-sm text-t1 tabular-nums">{n}</span>
              </div>
              <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${stageBarColor(s)}`} style={{ width: `${widthPct}%` }}></div>
              </div>
              {conv !== undefined && i < STAGE_ORDER.indexOf('registered') && (
                <div className="text-[10px] text-t3 mt-0.5 text-right">
                  → <span className="font-semibold">{conv}%</span> convert to {STAGE_LABEL[STAGE_ORDER[i + 1]]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function stageBarColor(s) {
  if (s === 'registered') return 'bg-teal-deep';
  if (s === 'dead' || s === 'paused') return 'bg-red/40';
  if (s === 'negotiating' || s === 'interested') return 'bg-orange';
  if (s === 'replied') return 'bg-teal';
  if (s === 'contacted') return 'bg-gold';
  return 'bg-t3/30';
}
