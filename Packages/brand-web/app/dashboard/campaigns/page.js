'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { campaignApi, fmtMoney, fmtNum } from '../../../lib/api';

const STATUS_CFG = {
  draft:          { bg: 'bg-surface2 text-t3', dot: 'bg-border2' },
  pending_wallet: { bg: 'bg-gold-pale text-yellow-700', dot: 'bg-gold' },
  published:      { bg: 'bg-navy-pale text-navy', dot: 'bg-navy' },
  active:         { bg: 'bg-teal-pale text-teal-deep', dot: 'bg-teal' },
  live:           { bg: 'bg-teal-pale text-teal-deep', dot: 'bg-teal' },
  completed:      { bg: 'bg-navy-pale text-navy', dot: 'bg-navy-light' },
  cancelled:      { bg: 'bg-red-pale text-red', dot: 'bg-red' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function CampaignCard({ campaign }) {
  const budget = campaign.total_budget || 0;
  const spent = campaign.spent_budget || 0;
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const influencerCount = campaign.influencer_count || 0;

  return (
    <Link href={`/dashboard/campaigns/${campaign.id}`} className="bg-white rounded-xl border border-border p-4 hover:shadow-md hover:border-navy/20 transition-all block">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-t1 text-sm truncate">{campaign.name}</div>
          <div className="text-[10px] text-t3 mt-0.5">
            {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('en-IN') : '—'} –{' '}
            {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('en-IN') : '—'}
          </div>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {/* Budget bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-t3 mb-1">
          <span>Budget used</span>
          <span className="font-semibold">{fmtMoney(spent)} / {fmtMoney(budget)}</span>
        </div>
        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange to-gold rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-t3">
        <span>👤 {influencerCount} influencer{influencerCount !== 1 ? 's' : ''}</span>
        <span className="text-navy font-semibold">View details →</span>
      </div>
    </Link>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campaignApi.list().then(res => {
      setLoading(false);
      if (res.success) setCampaigns(res.data?.campaigns || res.data || []);
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Campaigns</h1>
          <p className="text-xs text-t3 mt-0.5">{campaigns.length} total campaigns</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="px-4 py-2 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-xl hover:shadow-lg transition-shadow">
          + New Campaign
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-t3 text-sm">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📣</div>
          <div className="font-display text-lg font-bold text-t1 mb-2">No campaigns yet</div>
          <div className="text-sm text-t3 mb-5">Create your first campaign to start working with influencers</div>
          <Link href="/dashboard/campaigns/new" className="px-6 py-3 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-xl">Create Campaign</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  );
}
