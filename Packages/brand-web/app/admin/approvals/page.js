'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Admin → Approvals.
 * Contract: features/admin-creator-review-completeness
 *
 * This is where the decision actually gets made, and it used to be the thinnest of the
 * three admin screens: a handle, a follower count, a date. A creator hands us five facts
 * at signup — her name, her phone, her city, her Instagram, her YouTube — and none of
 * name, city or YouTube reached this page, even though the queue endpoint was already
 * returning phone and name.
 *
 * The row now shows what she gave us, and says plainly when she gave us nothing. A blank
 * "City" is a fact about the application; a missing "City" row is a fact about the screen,
 * and the two must not look the same.
 */

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

/**
 * One fact the applicant supplied. `value` empty renders the `missing` sentence in a
 * lighter weight — the admin can see at a glance which fields were left blank, which is
 * itself part of the review.
 */
function Fact({ label, value, missing = 'Not given', href, mono }) {
  const has = value != null && value !== '';
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-t3 mb-0.5">{label}</div>
      {has ? (
        href ? (
          <a href={href} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={`text-xs font-medium text-navy hover:underline truncate block ${mono ? 'tabular-nums' : ''}`}>
            {value} ↗
          </a>
        ) : (
          <div className={`text-xs font-medium text-t1 truncate ${mono ? 'tabular-nums' : ''}`}>{value}</div>
        )
      ) : (
        <div className="text-xs text-t3 italic truncate">{missing}</div>
      )}
    </div>
  );
}

const fmtNum = (n) => (n == null ? null : Number(n).toLocaleString('en-IN'));

/** Turn whatever the creator typed into a link that opens. Mirrors youtube.service.js. */
function youtubeUrl(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  const m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(.+)$/i);
  if (m) s = m[1];
  s = s.split(/[?#]/)[0].replace(/\/+$/, '');
  const chan = s.match(/^channel\/(UC[\w-]{20,})$/i);
  if (chan) return `https://www.youtube.com/channel/${chan[1]}`;
  if (/^UC[\w-]{20,}$/.test(s)) return `https://www.youtube.com/channel/${s}`;
  const legacy = s.match(/^(?:user|c)\/([^/]+)$/i);
  const handle = (legacy ? legacy[1] : s).replace(/^@+/, '').split('/')[0];
  return handle ? `https://www.youtube.com/@${handle}` : null;
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

  const isBrand = type === 'brand';

  // The heading is who this is, not what platform they use. For a creator the account
  // name is her real name; the handle is a separate fact and gets its own field below.
  const title = isBrand
    ? (item.business_name || item.brand_name || item.name)
    : (item.full_name || item.name || item.instagram_handle);

  const place    = [item.city, item.state].filter(Boolean).join(', ');
  const detailId = item.id || item.brand_id || item.influencer_id;
  const submitted = item.created_at || item.submitted_at;
  const days = submitted
    ? Math.floor((Date.now() - new Date(submitted).getTime()) / 86400000)
    : null;

  return (
    <div className="border-b border-border last:border-0 py-3.5">
      {/* Line 1 — who, how long they have waited, and the decision */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold font-display flex-shrink-0 ${isBrand ? 'bg-navy-pale text-navy' : 'bg-orange-pale text-orange-deep'}`}>
          {(title || '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-t1 truncate">{title || '—'}</div>
          <div className="text-[10px] text-t3">
            {isBrand ? (item.category || 'No category') : `@${item.instagram_handle || '—'}`}
            {' · applied '}
            {submitted ? new Date(submitted).toLocaleDateString('en-IN') : '—'}
            {days != null && days > 0 && ` · waiting ${days} day${days === 1 ? '' : 's'}`}
          </div>
        </div>
        <Badge status={item.user_status || item.status} />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <a href={`/admin/${isBrand ? 'brands' : 'influencers'}/${detailId}`} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface2 text-t2 border border-border2 hover:border-navy hover:text-navy transition-colors">Full record</a>
          <button
            onClick={approve}
            disabled={loading || (item.user_status || item.status) === 'approved'}
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

      {/* Line 2 — everything they actually gave us, which is what a review is */}
      <div className="ml-12 bg-surface2/60 border border-border2/60 rounded-xl px-3.5 py-3">
        {isBrand ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            <Fact label="Contact person" value={item.name} />
            <Fact label="Phone" value={item.phone} missing="No number on file" mono />
            <Fact label="Where" value={place} missing="Not stated" />
            <Fact label="GST number" value={item.gstin} missing="Not supplied" mono />
            <Fact label="Address" value={item.address_line} missing="Not supplied" />
            <Fact label="Pincode" value={item.pincode} missing="Not supplied" mono />
            <Fact label="Category" value={item.category} missing="Not stated" />
            <Fact label="Email" value={item.email} missing="Not supplied" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            <Fact label="Full name" value={item.full_name || item.name} missing="Not given" />
            <Fact label="Phone" value={item.phone} missing="No number on file" mono />
            <Fact label="Where" value={place} missing="Not stated" />
            <Fact label="Niche" value={(item.niche || []).join(', ')} missing="Not stated" />
            <Fact
              label="Instagram"
              value={item.instagram_handle ? `@${item.instagram_handle}` : ''}
              missing="Not given"
              href={item.instagram_handle ? `https://instagram.com/${item.instagram_handle}` : null}
            />
            <Fact
              label="Instagram reach"
              // A never-checked profile is not a zero-follower profile. Saying so is the
              // whole point — this row is the founder's screenshot: 0 followers, 0.00%.
              value={item.scrape_last_run && item.followers_count != null
                ? `${fmtNum(item.followers_count)} followers`
                : ''}
              missing="Never checked"
              mono
            />
            <Fact
              label="YouTube"
              value={item.youtube_handle ? `@${String(item.youtube_handle).replace(/^@+/, '')}` : ''}
              missing="Not given"
              href={youtubeUrl(item.youtube_handle)}
            />
            <Fact
              label="YouTube reach"
              value={
                item.youtube_scrape_last_run
                  ? (item.youtube_subscribers == null
                      ? 'Subscribers hidden'
                      : `${fmtNum(item.youtube_subscribers)} subscribers`)
                  : ''
              }
              missing={item.youtube_handle ? 'Never checked' : '—'}
              mono
            />
          </div>
        )}
      </div>

      {showReject && (
        <div className="ml-12 mt-3">
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
    // Key must be `reason` — that is what admin.controller.js reads for both
    // brands and influencers. Sending `rejection_reason` 422s every reject.
    if (reason) body.reason = reason;
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
    <div className="max-w-5xl">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-t1">Approval Queue</h1>
        <p className="text-xs text-t3 mt-0.5">
          Everything each applicant supplied, so the decision can be made here. Open the full
          record for balances, tax controls and history.
        </p>
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
