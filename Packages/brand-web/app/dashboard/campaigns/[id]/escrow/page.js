'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { brandApi, fmtMoney } from '../../../../../lib/api';

export default function EscrowDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    brandApi.getCampaignEscrow(id).then(res => {
      setLoading(false);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Failed to load escrow data');
      }
    }).catch(() => {
      setLoading(false);
      setError('Failed to load escrow data');
    });
  }, [id]);

  const statusColor = {
    queued: 'text-yellow-600',
    locked: 'text-blue-700',
    released: 'text-emerald-600',
  };
  const statusBg = {
    queued: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    locked: 'bg-blue-50 text-blue-700 border-blue-200',
    released: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  const statusIcon = { queued: '\u23F3', locked: '\uD83D\uDD12', released: '\u2713' };

  const summary = data?.summary;
  const breakdown = data?.influencer_breakdown || [];
  const campaign = data?.campaign;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <a href={`/dashboard/campaigns/${id}`} className="text-t3 hover:text-t2">&larr; Campaign</a>
        <span className="text-t3">/</span>
        <span className="text-t2 font-medium">Escrow</span>
      </div>

      <h1 className="font-display text-xl font-bold text-t1 mb-1">Escrow Breakdown</h1>
      {campaign && (
        <p className="text-sm text-t3 mb-6">{campaign.name}</p>
      )}

      {loading ? (
        <div className="text-center py-12 text-t3 text-sm">Loading...</div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center text-red-600 text-sm">{error}</div>
      ) : campaign?.has_tranches === false ? (
        // Conversion-only campaign — no fee, no escrow tranches.
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💸</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-orange-900 mb-1">No escrow for conversion campaigns</div>
              <p className="text-xs text-orange-800 leading-relaxed mb-2">
                This campaign pays influencers <strong>commission per conversion</strong>, not a fixed fee — so there are no tranches
                to lock up front. Earnings appear in the influencer's pending balance as conversions happen, and roll over to their
                wallet after the 30-day return window.
              </p>
              <a href={`/dashboard/campaigns/${id}?tab=conversions`} className="text-xs font-semibold text-orange-700 hover:underline">
                Open Conversions tab →
              </a>
            </div>
          </div>
        </div>
      ) : (!data?.entries || data.entries.length === 0) ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <div className="text-t3 text-sm mb-2">No escrow entries for this campaign</div>
          <div className="text-t3 text-xs">Escrow entries are created when the campaign is published and influencers are contracted.</div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <SummaryCard label="Total Escrowed" amount={summary.total} />
              <SummaryCard label="Locked" amount={summary.total_locked} color="text-blue-700" />
              <SummaryCard label="Released" amount={summary.total_released} color="text-emerald-600" />
              <SummaryCard label="Queued" amount={summary.total_queued} color="text-yellow-600" />
            </div>
          )}

          {/* Per-influencer breakdown */}
          <div className="space-y-4">
            {breakdown.map(inf => (
              <div key={inf.campaign_influencer_id} className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Influencer header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-border flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-t1">
                      {inf.instagram_handle ? `@${inf.instagram_handle}` : inf.influencer_name}
                    </span>
                    {inf.influencer_name && inf.instagram_handle && (
                      <span className="text-xs text-t3 ml-2">{inf.influencer_name}</span>
                    )}
                  </div>
                  <div className="text-xs text-t3">
                    {inf.tranches.length} tranche{inf.tranches.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Tranches */}
                {inf.tranches.map(t => (
                  <div key={t.id} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
                    <div className={`text-lg ${statusColor[t.status] || 'text-t3'}`}>
                      {statusIcon[t.status] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-t1">
                        Tranche {t.tranche_number}
                      </div>
                      <div className="text-xs text-t3 truncate">
                        {t.trigger_event?.replace(/_/g, ' ')}
                        {t.released_at && (
                          <span> &middot; Released {new Date(t.released_at).toLocaleDateString('en-IN')}</span>
                        )}
                      </div>
                    </div>
                    <div className="font-display font-bold text-t1 text-sm">{fmtMoney(t.amount)}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border ${statusBg[t.status] || 'bg-gray-50 text-t3 border-gray-200'}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, amount, color = 'text-t1' }) {
  return (
    <div className="bg-white rounded-xl border border-border p-3">
      <div className="text-[10px] uppercase tracking-wide text-t3 mb-1">{label}</div>
      <div className={`font-display font-bold text-lg ${color}`}>
        {fmtMoney(amount)}
      </div>
    </div>
  );
}
