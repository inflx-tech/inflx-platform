'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { campaignApi, deliverableApi, fmtMoney, fmtNum } from '../../../../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function StatusBadge({ status }) {
  const cfg = { draft:'bg-surface2 text-t3', pending_wallet:'bg-gold-pale text-yellow-700', published:'bg-navy-pale text-navy', active:'bg-teal-pale text-teal-deep', live:'bg-teal-pale text-teal-deep', completed:'bg-navy-pale text-navy', cancelled:'bg-red-pale text-red', approved:'bg-teal-pale text-teal-deep', submitted:'bg-navy-pale text-navy', under_review:'bg-orange-pale text-orange-deep', revision_requested:'bg-red-pale text-red' };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${cfg[status]||'bg-surface2 text-t3'}`}>{status?.replace(/_/g,' ')}</span>;
}

function TrancheIcon({ status }) {
  if (status === 'released') return <span className="text-teal text-sm">✓</span>;
  if (status === 'locked') return <span className="text-navy text-sm">🔒</span>;
  if (status === 'queued') return <span className="text-gold text-sm">⏳</span>;
  return <span className="text-border2 text-sm">○</span>;
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [tab, setTab] = useState('overview');
  const [campaign, setCampaign] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [conversions, setConversions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([
      campaignApi.get(id),
      campaignApi.getLive(id),
    ]).then(([cr, lr]) => {
      setLoading(false);
      if (cr.success) setCampaign(cr.data?.campaign || cr.data);
      if (lr.success) setLiveData(lr.data);
    });
  }, [id]);

  useEffect(() => {
    if (tab === 'analytics' && !engagement) {
      campaignApi.getEngagement(id).then(res => { if (res.success) setEngagement(res.data); });
    }
    if (tab === 'conversions' && !conversions) {
      campaignApi.getConversions(id).then(res => { if (res.success) setConversions(res.data); });
    }
  }, [tab]);

  async function handleReview(deliverableId, action, feedback) {
    const res = await deliverableApi.review(deliverableId, { action, feedback });
    if (res.success) {
      showToast(`Content ${action} successfully`);
      campaignApi.getLive(id).then(r => { if (r.success) setLiveData(r.data); });
    } else showToast(res.error?.message || 'Action failed');
  }

  async function handleConfirmLive(deliverableId) {
    const res = await deliverableApi.confirmLive(deliverableId);
    if (res.success) { showToast('Content marked as live!'); campaignApi.getLive(id).then(r => { if (r.success) setLiveData(r.data); }); }
    else showToast(res.error?.message || 'Failed');
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  if (loading) return <div className="text-center py-12 text-t3 text-sm">Loading campaign...</div>;
  if (!campaign) return <div className="p-4 bg-red-pale rounded-xl text-red text-sm">Campaign not found</div>;

  const influencers = liveData?.influencers || [];
  const TABS = ['overview', 'content', 'analytics', 'conversions'];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-4 text-xs">
        <a href="/dashboard/campaigns" className="text-t3 hover:text-t2">← Campaigns</a>
        <span className="text-t3">/</span>
        <span className="text-t2 font-medium truncate">{campaign.name}</span>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={campaign.status} />
            <span className="text-xs text-t3">Budget: {fmtMoney(campaign.total_budget)}</span>
            <span className="text-xs text-t3">·</span>
            <span className="text-xs text-t3">{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('en-IN') : '—'} – {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('en-IN') : '—'}</span>
          </div>
        </div>
        <a href={`/dashboard/campaigns/${id}/escrow`} className="px-4 py-2 bg-white border border-border text-xs font-semibold text-t2 rounded-xl hover:border-navy hover:text-navy transition-colors">Escrow →</a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors capitalize ${tab === t ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div>
          {influencers.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">👤</div>
              <div className="font-bold text-t1 mb-1">No influencers yet</div>
              <div className="text-xs text-t3 mb-4">Invite influencers to your campaign sets</div>
              <a href="/dashboard/influencers" className="px-4 py-2 bg-gradient-to-r from-red to-orange text-white font-bold text-xs rounded-xl">Browse Influencers</a>
            </div>
          ) : (
            <div className="space-y-3">
              {influencers.map(inf => (
                <div key={inf.campaign_influencer_id} className="bg-white rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-pale flex items-center justify-center text-xs font-bold text-orange-deep font-display">
                        {(inf.instagram_handle || '').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-t1">@{inf.instagram_handle}</div>
                        <StatusBadge status={inf.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-t3">
                      <span title="T1"><TrancheIcon status={inf.t1_status} /> T1</span>
                      <span title="T2"><TrancheIcon status={inf.t2_status} /> T2</span>
                      <span title="T3"><TrancheIcon status={inf.t3_status} /> T3</span>
                    </div>
                  </div>
                  {inf.deliverables?.map(d => (
                    <div key={d.id} className="flex items-center justify-between py-2 border-t border-border text-xs">
                      <div className="flex items-center gap-2">
                        <span className="bg-navy-pale text-navy px-2 py-0.5 rounded font-bold">{d.type}</span>
                        <StatusBadge status={d.status} />
                      </div>
                      {d.status === 'under_review' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleReview(d.id, 'approve', '')} className="px-3 py-1 bg-teal text-white font-bold rounded-lg">Approve</button>
                          <button onClick={() => handleReview(d.id, 'revision', 'Please improve the content quality')} className="px-3 py-1 bg-orange-pale text-orange-deep font-bold rounded-lg">Revision</button>
                        </div>
                      )}
                      {d.status === 'approved' && (
                        <button onClick={() => handleConfirmLive(d.id)} className="px-3 py-1 bg-navy text-white font-bold rounded-lg">Confirm Live</button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Tab */}
      {tab === 'content' && (
        <div className="space-y-4">
          {influencers.flatMap(inf => inf.deliverables?.filter(d => ['submitted','under_review','revision_requested','approved'].includes(d.status)).map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-t1">@{inf.instagram_handle}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-navy-pale text-navy text-[10px] font-bold px-2 py-0.5 rounded">{d.type}</span>
                    <StatusBadge status={d.status} />
                  </div>
                </div>
              </div>
              {d.submission_url && (
                <div className="mb-3 bg-surface2 rounded-lg px-3 py-2 text-xs text-t2">
                  <div className="text-[9px] font-bold text-t3 uppercase mb-1">Submitted URL</div>
                  <a href={d.submission_url} target="_blank" className="text-navy underline break-all">{d.submission_url}</a>
                </div>
              )}
              {d.brand_feedback && (
                <div className="mb-3 bg-orange-pale rounded-lg px-3 py-2 text-xs text-orange-deep">
                  <div className="text-[9px] font-bold uppercase mb-1">Your Feedback</div>
                  {d.brand_feedback}
                </div>
              )}
              {d.status === 'under_review' && (
                <div className="flex gap-2">
                  <button onClick={() => handleReview(d.id, 'approve', '')} className="px-4 py-2 bg-teal text-white font-bold text-xs rounded-lg flex-1">✓ Approve</button>
                  <button onClick={() => {const fb = prompt('Enter revision feedback:'); if(fb) handleReview(d.id, 'revision', fb);}} className="px-4 py-2 bg-orange-pale text-orange-deep font-bold text-xs rounded-lg flex-1">↩ Request Revision</button>
                </div>
              )}
            </div>
          )) || [])}
          {influencers.flatMap(inf => inf.deliverables || []).filter(d => ['submitted','under_review','revision_requested','approved'].includes(d.status)).length === 0 && (
            <div className="text-center py-12 text-t3 text-sm">No submitted content yet</div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && (
        <div>
          {!engagement ? (
            <div className="text-center py-12 text-t3 text-sm">Loading analytics...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Reach', value: fmtNum(engagement.totals?.total_reach) },
                  { label: 'Total Impressions', value: fmtNum(engagement.totals?.total_impressions) },
                  { label: 'Blended ER', value: `${engagement.totals?.blended_er || 0}%` },
                  { label: 'Benchmark ER', value: `${engagement.totals?.category_benchmark_er || 3.8}%` },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-border p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{s.label}</div>
                    <div className="font-display text-xl font-extrabold text-t1">{s.value}</div>
                  </div>
                ))}
              </div>
              {engagement.daily_reach?.length > 0 && (
                <div className="bg-white rounded-xl border border-border p-4">
                  <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-4">Daily Reach</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={engagement.daily_reach}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E0E4EF" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8B91AD' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#8B91AD' }} />
                      <Tooltip formatter={v => [fmtNum(v), 'Reach']} />
                      <Line type="monotone" dataKey="reach" stroke="#F47920" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {engagement.by_influencer?.length > 0 && (
                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-surface2 border-b border-border">
                    <div className="text-xs font-bold text-t2 uppercase tracking-wider">Per Influencer Breakdown</div>
                  </div>
                  {engagement.by_influencer.map(inf => (
                    <div key={inf.influencer_id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 text-sm">
                      <div className="font-medium text-t1">@{inf.instagram_handle}</div>
                      <div className="flex items-center gap-4 text-xs text-t3">
                        <span>Reach: <strong className="text-t1">{fmtNum(inf.reach)}</strong></span>
                        <span>ER: <strong className="text-t1">{inf.engagement_rate || 0}%</strong></span>
                        <span>Likes: <strong className="text-t1">{fmtNum(inf.likes)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conversions Tab */}
      {tab === 'conversions' && (
        <div>
          {!conversions ? (
            <div className="text-center py-12 text-t3 text-sm">Loading conversions...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Transactions', value: fmtNum(conversions.total_transactions) },
                  { label: 'Total Revenue', value: fmtMoney(conversions.total_revenue_paise) },
                  { label: 'Commission Paid', value: fmtMoney(conversions.total_commission_paise) },
                  { label: 'Conversion Rate', value: `${conversions.conversion_rate || 0}%` },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-border p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{s.label}</div>
                    <div className="font-display text-xl font-extrabold text-t1">{s.value}</div>
                  </div>
                ))}
              </div>
              {conversions.by_influencer?.length > 0 && (
                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-surface2 border-b border-border text-xs font-bold text-t2 uppercase tracking-wider">Per Influencer Conversions</div>
                  {conversions.by_influencer.map(inf => (
                    <div key={inf.influencer_id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 text-sm">
                      <div className="font-medium text-t1">@{inf.instagram_handle || inf.influencer_id}</div>
                      <div className="flex items-center gap-4 text-xs text-t3">
                        <span>Sales: <strong className="text-t1">{fmtNum(inf.transaction_count)}</strong></span>
                        <span>Revenue: <strong className="text-t1">{fmtMoney(inf.revenue_paise)}</strong></span>
                        <span>Commission: <strong className="text-teal">{fmtMoney(inf.commission_paise)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>}
    </div>
  );
}
