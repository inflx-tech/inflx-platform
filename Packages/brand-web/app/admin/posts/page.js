'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Post Moderation Queue (Post/Concept P2, mig 140).
 * Contract: features/concept-p2-posts/.
 *
 * Every creator post lands here as `submitted`; admin (and ONLY admin —
 * founder lock, brands are not in this path) approves or rejects with a
 * reason. Approved posts become visible to follower surfaces in P3/P4;
 * a rejected creator is notified with the reason.
 *
 * shoppable-posts-v2 (Level 3): a new post also shows what it is for — the collaboration, offer post or
 * price post, the offer, and the facets shoppers will filter by. Approving re-checks it on the server
 * (an offer that ended meanwhile is refused with the reason). Videos play here.
 */

const TABS = [
  { key: 'submitted', label: 'Awaiting review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Sent back' },
  { key: 'removed', label: 'Left the shop' },
];

export default function PostQueuePage() {
  const [tab, setTab] = useState('submitted');
  const [posts, setPosts] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);          // post id being decided
  const [rejecting, setRejecting] = useState(null); // { post, reason }
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.listPostQueue(tab);
    setLoading(false);
    if (res.success) { setPosts(res.data?.posts || []); setCounts(res.data?.counts || {}); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  async function approve(post) {
    setBusy(post.id);
    const res = await adminApi.approvePost(post.id);
    setBusy(null);
    if (res.success) { showToast('Approved — the creator has been notified.'); load(); }
    else alert(res.error?.message || 'Approve failed.');
  }

  async function confirmReject() {
    if (!rejecting) return;
    setBusy(rejecting.post.id);
    const res = await adminApi.rejectPost(rejecting.post.id, rejecting.reason);
    setBusy(null);
    if (res.success) { setRejecting(null); showToast('Sent back — the creator has been notified.'); load(); }
    else alert(res.error?.message || 'Reject failed.');
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Post Queue</h1>
        <p className="text-xs text-t3 mt-0.5">
          Creator posts await your approval before any follower sees them. Approval is admin-only — brands are not in this path.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border-2 ${tab === t.key ? 'border-navy bg-navy-pale text-navy' : 'border-border text-t3 hover:border-t3'}`}>
            {t.label} <span className="opacity-60">({counts[t.key] || 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading posts…</div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">
          {tab === 'submitted' ? 'Nothing awaiting review. 🎉' : `No ${tab} posts.`}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-t1">
                    @{p.influencer?.handle || '—'}
                    <span className="font-normal text-t3"> · {p.influencer?.name || ''}</span>
                  </div>
                  {p.v2 ? (
                    <>
                      <div className="text-xs text-navy font-bold mt-0.5">
                        {p.v2.kind === 'offer' && p.v2.offer ? `Offer post · ${p.v2.offer.type} · ${p.v2.offer.deal}` : 'Price post · normal price'}
                      </div>
                      <div className="text-[11px] text-t2 mt-0.5">
                        {/* item 20: a post a creator makes for the brand he runs has no campaign or set */}
                        {p.v2.own_brand
                          ? `For ${p.v2.collaboration.brand_name} · own brand (the creator is linked to this brand)`
                          : <>For {p.v2.collaboration.brand_name} · {p.v2.collaboration.campaign_name} · {p.v2.collaboration.set_name}
                            {p.v2.collaboration.posting_date ? ` · posts on ${p.v2.collaboration.posting_date}` : ''}</>}
                      </div>
                      <div className="text-[10px] text-t3 mt-0.5">
                        {[p.v2.facets.category && p.v2.facets.category.join(', '), p.v2.facets.price_band, p.v2.facets.theme].filter(Boolean).join(' · ')}
                        {p.v2.sent_back && p.v2.sent_back.count ? ` · sent back ${p.v2.sent_back.count}×` : ''}
                        {p.v2.removed ? ` · ${p.v2.removed.why}` : ''}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-navy font-bold mt-0.5">
                        {p.concept ? `${p.concept.name} · family ${p.concept.family}` : `Collection: ${p.collection?.name || '—'}`}
                      </div>
                      <div className="text-[10px] text-t3 mt-0.5">
                        {p.scope} scope · {p.post_type} · tags: {p.tag_style} · {new Date(p.created_at).toLocaleString()}
                      </div>
                    </>
                  )}
                </div>
                {tab === 'submitted' && (
                  <div className="flex gap-2">
                    <button onClick={() => approve(p)} disabled={busy === p.id}
                      className="px-4 py-2 bg-teal text-white text-xs font-bold rounded-xl disabled:opacity-50">
                      {busy === p.id ? '…' : '✓ Approve'}
                    </button>
                    <button onClick={() => setRejecting({ post: p, reason: '' })} disabled={busy === p.id}
                      className="px-4 py-2 bg-white text-red border border-red/30 text-xs font-bold rounded-xl">
                      ✕ Send back
                    </button>
                  </div>
                )}
                {(tab === 'rejected' || tab === 'removed') && p.reject_reason && (
                  <div className="text-[11px] text-red bg-red-pale rounded-lg px-3 py-1.5 max-w-[240px]">{p.reject_reason}</div>
                )}
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1">
                {(p.media || []).map(m => (
                  <div key={m.id} className="relative shrink-0">
                    {p.media_kind === 'video' || (p.v2 && p.v2.media_kind === 'video')
                      ? <video src={m.url} controls className="h-44 rounded-xl" />
                      : <img src={m.url} alt="" className="h-44 rounded-xl object-cover" />}
                    {(p.products || []).filter(t => t.media_id === m.id && t.x_pct != null).map(t => (
                      <div key={t.id}
                        className="absolute w-2.5 h-2.5 bg-white border-2 border-navy rounded-full -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${t.x_pct}%`, top: `${t.y_pct}%` }}
                        title={`${t.name} · ₹${t.price}`} />
                    ))}
                  </div>
                ))}
                <div className="shrink-0 w-56">
                  <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1.5">
                    Tagged products ({(p.products || []).length})
                  </div>
                  <div className="space-y-1.5">
                    {(p.products || []).map(t => (
                      <div key={t.id} className="flex items-center gap-2">
                        {t.image_url
                          ? <img src={t.image_url} alt="" className="w-7 h-7 rounded object-cover" />
                          : <div className="w-7 h-7 rounded bg-surface2" />}
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-t1 truncate">{t.name}</div>
                          <div className="text-[10px] text-t3">₹{t.price} · {t.brand_name}{t.still_listed ? '' : ' · ⚠ delisted'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {p.caption && <div className="text-xs text-t2 mt-2 italic">“{p.caption}”</div>}
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setRejecting(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="border-b border-border px-5 py-3 font-display text-base font-bold text-t1">
              Send back @{rejecting.post.influencer?.handle}’s post
            </div>
            <div className="px-5 py-4">
              <label className="block text-[11px] font-bold text-t2 mb-1">Reason <span className="font-normal text-t3">(sent to the creator)</span></label>
              <textarea value={rejecting.reason} onChange={e => setRejecting({ ...rejecting, reason: e.target.value })}
                rows={3} placeholder="e.g. The video on slide 2 has copyrighted music."
                className="w-full border border-border rounded-lg px-3 py-2 text-xs" autoFocus />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setRejecting(null)} className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl">Cancel</button>
              <button onClick={confirmReject} disabled={busy === rejecting.post.id}
                className="px-5 py-2 bg-red text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {busy === rejecting.post.id ? 'Sending back…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
