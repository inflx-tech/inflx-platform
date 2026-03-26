'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

const REJECTION_REASONS = [
  'Incomplete business information',
  'Invalid or unverifiable GST number',
  'Blurry or invalid ID documents',
  'Business category not supported',
  'Duplicate account',
  'Instagram account not found',
  'Follower count below minimum',
  'Niche not supported',
  'Other',
];

function Badge({ status }) {
  const cfg = {
    pending:  'bg-gold-pale text-yellow-700 border-gold/20',
    approved: 'bg-teal-pale text-teal-deep border-teal/20',
    rejected: 'bg-red-pale text-red border-red/20',
    resubmitted: 'bg-orange-pale text-orange-deep border-orange/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg[status] || 'bg-surface2 text-t3'}`}>
      {status}
    </span>
  );
}

function ApprovalRow({ item, type, onAction }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function approve() {
    setLoading(true);
    await onAction(item.id, 'approved', null);
    setLoading(false);
  }

  async function reject() {
    const finalReason = reason === 'Other' ? customReason : reason;
    if (!finalReason) return;
    setLoading(true);
    await onAction(item.id, 'rejected', finalReason);
    setLoading(false);
    setShowReject(false);
  }

  const name = type === 'brand' ? (item.brand_name || item.name) : (item.instagram_handle || item.name);
  const sub = type === 'brand' ? (item.category || '') : (`${(item.followers_count || 0).toLocaleString('en-IN')} followers`);

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-3 py-3 px-1">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold font-display flex-shrink-0 ${type === 'brand' ? 'bg-navy-pale text-navy' : 'bg-orange-pale text-orange-deep'}`}>
          {(name || '').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-t1 truncate">{name}</div>
          <div className="text-[10px] text-t3">{sub} · submitted {new Date(item.created_at || item.submitted_at).toLocaleDateString('en-IN')}</div>
        </div>
        <Badge status={item.status} />
        <div className="flex items-center gap-1.5">
          <a href={`/dashboard/${type === 'brand' ? 'brands' : 'influencers'}/${item.id || item.brand_id || item.influencer_id}`} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface2 text-t2 border border-border2 hover:border-navy hover:text-navy transition-colors">View</a>
          <button
            onClick={approve}
            disabled={loading || item.status === 'approved'}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-pale text-teal-deep border border-teal/25 hover:bg-teal hover:text-white transition-colors disabled:opacity-40"
          >
            {loading ? '...' : 'Approve'}
          </button>
          <button
            onClick={() => setShowReject(!showReject)}
            disabled={loading}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-pale text-red border border-red/25 hover:bg-red hover:text-white transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
      {showReject && (
        <div className="px-10 pb-3">
          <div className="bg-red-pale/50 border border-red/10 rounded-xl p-3">
            <div className="text-xs font-bold text-t2 mb-2">Select rejection reason</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REJECTION_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-colors ${reason === r ? 'bg-red text-white border-red' : 'bg-white text-t2 border-border2 hover:border-red hover:text-red'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Other' && (
              <textarea
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Enter custom reason..."
                className="w-full border border-border2 rounded-lg p-2 text-xs text-t1 outline-none focus:border-red resize-none"
                rows={2}
              />
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={reject} disabled={!reason || (reason === 'Other' && !customReason)} className="px-3 py-1.5 bg-red text-white text-xs font-bold rounded-lg disabled:opacity-40">Confirm Reject</button>
              <button onClick={() => setShowReject(false)} className="px-3 py-1.5 bg-surface2 text-t2 text-xs font-bold rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState('brands');
  const [brands, setBrands] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  async function load() {
    setLoading(true);
    const [br, ir] = await Promise.all([adminApi.getBrandQueue(), adminApi.getInfluencerQueue()]);
    if (br.success) setBrands(br.data?.brands || br.data || []);
    if (ir.success) setInfluencers(ir.data?.influencers || ir.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAction(id, status, reason) {
    const fn = activeTab === 'brands' ? adminApi.updateBrandStatus : adminApi.updateInfluencerStatus;
    const body = { status };
    if (reason) body.rejection_reason = reason;
    const res = await fn(id, body);
    if (res.success) {
      showToast(`${activeTab === 'brands' ? 'Brand' : 'Influencer'} ${status} successfully`);
      load();
    } else {
      showToast(res.error?.message || 'Action failed', true);
    }
  }

  function showToast(msg, isError = false) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  }

  const list = activeTab === 'brands' ? brands : influencers;

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-t1">Approval Queue</h1>
        <p className="text-xs text-t3 mt-0.5">Review and approve new brand and influencer applications</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {[
          { id: 'brands', label: 'Brands', count: brands.length },
          { id: 'influencers', label: 'Influencers', count: influencers.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${activeTab === tab.id ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}
          >
            {tab.label}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-gold-pale text-yellow-700' : 'bg-surface2 text-t3'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-3xl mb-3">✅</div>
            <div className="text-sm font-bold text-t1">Queue is empty</div>
            <div className="text-xs text-t3 mt-1">No pending {activeTab} applications</div>
          </div>
        ) : (
          <div className="px-3">
            {list.map(item => (
              <ApprovalRow
                key={item.id || item.brand_id || item.influencer_id}
                item={item}
                type={activeTab === 'brands' ? 'brand' : 'influencer'}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
