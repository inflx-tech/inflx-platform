'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { marketingApi } from '../../../../../../lib/api';

const QUICK_STATUS_BUTTONS = [
  { key: 'contacted',   label: 'Contacted',   color: 'bg-gold-pale text-yellow-700' },
  { key: 'replied',     label: 'Replied',     color: 'bg-teal-pale text-teal-deep' },
  { key: 'interested',  label: 'Interested',  color: 'bg-teal-pale text-teal-deep' },
  { key: 'negotiating', label: 'Negotiating', color: 'bg-orange/15 text-orange' },
  { key: 'registered',  label: 'Registered',  color: 'bg-teal-deep/20 text-teal-deep' },
  { key: 'dead',        label: 'Dead',        color: 'bg-red-pale text-red' },
  { key: 'paused',      label: 'Pause',       color: 'bg-surface2 text-t3' },
];

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
}

function ChannelPill({ icon, value }) {
  if (!value) return (
    <span className="px-2 py-1 rounded-full text-[10px] bg-surface2 text-t3/50">
      {icon} —
    </span>
  );
  return (
    <button onClick={() => copyToClipboard(value)}
      className="px-2 py-1 rounded-full text-[10px] bg-teal-pale text-teal-deep font-semibold hover:bg-teal-pale/80 cursor-pointer" title="Click to copy">
      {icon} {value}
    </button>
  );
}

export default function LeadDetailPage() {
  const { type, id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);

  // Activity form
  const [channel, setChannel] = useState('whatsapp');
  const [direction, setDirection] = useState('outbound');
  const [messageBody, setMessageBody] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [logging, setLogging] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketingApi.getLeadDetail(type, id);
    setLoading(false);
    if (res.success) setData(res.data);
  }, [type, id]);

  useEffect(() => { load(); }, [load]);

  async function quickStatus(newStatus) {
    if (!confirm(`Change status to "${newStatus}"?`)) return;
    const res = await marketingApi.updateStatus(type, id, { new_status: newStatus });
    if (res.success) {
      setToast(`Status → ${newStatus}`);
      load();
    } else if (res.error?.code === 'INVALID_TRANSITION') {
      if (confirm(`${res.error.message}\n\nForce the transition anyway?`)) {
        const forced = await marketingApi.updateStatus(type, id, { new_status: newStatus, force: true });
        if (forced.success) { setToast(`Status forced → ${newStatus}`); load(); }
        else setToast(forced.error?.message || 'Failed');
      }
    } else {
      setToast(res.error?.message || 'Failed');
    }
    setTimeout(() => setToast(''), 3000);
  }

  async function submitActivity(e) {
    e.preventDefault();
    setLogging(true);
    const payload = {
      channel, direction,
      message_body: messageBody || null,
      sentiment: sentiment || null,
      internal_notes: internalNotes || null,
      next_action: nextAction || null,
      next_action_due: nextActionDue || null,
    };
    const res = await marketingApi.logActivity(type, id, payload);
    setLogging(false);
    if (res.success) {
      setToast(res.data.status_changed
        ? `Logged · status ${res.data.previous_status} → ${res.data.new_status}`
        : 'Activity logged');
      setMessageBody(''); setInternalNotes(''); setSentiment(''); setNextAction(''); setNextActionDue('');
      setShowLogForm(false);
      load();
    } else {
      setToast(res.error?.message || 'Failed');
    }
    setTimeout(() => setToast(''), 3000);
  }

  if (loading) return <div className="text-t3 text-sm p-8 text-center">Loading…</div>;
  if (!data) return <div className="text-t3 text-sm p-8 text-center">Lead not found. <Link href="/dashboard/marketing/leads" className="text-orange font-semibold">Back to triage →</Link></div>;

  const p = data.profile;
  const handle = type === 'brand' ? p.instagram_handle : p.ig_handle;
  const name = type === 'brand' ? p.business_name : p.full_name;
  const city = p.city || p.inferred_city || '—';
  const category = type === 'brand' ? (p.industry || p.inferred_industry) : (p.niche || p.inferred_niche);
  const subcategory = type === 'brand' ? (p.sub_industry || p.inferred_sub_industry) : (p.sub_niche || p.inferred_sub_niche);
  const phone = p.manual_phone || p.bio_phone;
  const email = p.manual_email || p.bio_email;
  const whatsapp = p.manual_whatsapp || p.bio_whatsapp;

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-xs">
        <Link href="/dashboard/marketing/leads" className="text-orange hover:underline">← Triage</Link>
        <span className="text-t3">/</span>
        <span className="text-t2">{type}</span>
        <span className="text-t3">/</span>
        <span className="text-t1 font-mono">@{handle}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-start gap-4">
          {p.profile_pic_url && (
            <img src={p.profile_pic_url} alt="" className="w-16 h-16 rounded-full object-cover border border-border" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-lg font-bold text-t1">{name || `@${handle}`}</h1>
              {p.is_verified && <span className="text-blue-500" title="Verified">✓</span>}
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${type === 'brand' ? 'bg-navy/10 text-navy' : 'bg-orange/10 text-orange'}`}>
                {type}
              </span>
              {p.tier || p.follower_tier ? (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gold/10 text-yellow-700 border border-gold/30">
                  {p.tier || p.follower_tier}
                </span>
              ) : null}
            </div>
            <div className="text-xs text-t3 font-mono mb-1">@{handle}</div>
            <div className="text-xs text-t2 flex items-center gap-3 flex-wrap">
              <span>📍 {city}</span>
              <span>📁 {category || '—'}{subcategory ? ` / ${subcategory}` : ''}</span>
              <span>👥 {(p.followers_count || 0).toLocaleString()} followers</span>
              {p.last_scraped_at ? (
                <span>🕒 scraped {new Date(p.last_scraped_at).toLocaleString()}</span>
              ) : (
                <span className="text-orange font-bold">Scraping in progress…</span>
              )}
            </div>
            {p.bio && <div className="text-xs text-t2 mt-2 italic">"{p.bio.slice(0, 200)}{p.bio.length > 200 ? '…' : ''}"</div>}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">Priority Score</div>
            <div className="font-display text-3xl font-extrabold text-orange">{Number(p.priority_score || 0).toFixed(0)}</div>
            <div className="text-[10px] text-t3">/ 100</div>
          </div>
        </div>

        {/* Channel pills */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <ChannelPill icon="📞" value={phone} />
          <ChannelPill icon="✉️" value={email} />
          <ChannelPill icon="💬" value={whatsapp} />
          {p.website || p.external_url ? (
            <a href={p.website || p.external_url} target="_blank" rel="noreferrer" className="px-2 py-1 rounded-full text-[10px] bg-navy/10 text-navy font-semibold hover:bg-navy/20">
              🌐 Website
            </a>
          ) : null}
          <a href={`https://instagram.com/${handle}`} target="_blank" rel="noreferrer" className="px-2 py-1 rounded-full text-[10px] bg-orange/10 text-orange font-semibold hover:bg-orange/20">
            📷 Open IG
          </a>
        </div>

        {/* Quick status buttons */}
        <div className="flex gap-1.5 mt-3 flex-wrap pt-3 border-t border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-t3 self-center mr-1">Status: <span className="text-t1">{p.outreach_status}</span></span>
          {QUICK_STATUS_BUTTONS.filter(b => b.key !== p.outreach_status).map(b => (
            <button key={b.key} onClick={() => quickStatus(b.key)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold hover:opacity-80 ${b.color}`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Left: scoring + metrics */}
        <div className="col-span-1 space-y-3">
          {p.scoring_summary && (
            <div className="bg-white rounded-xl border border-border p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">AI Score Rationale</div>
              <div className="text-xs text-t2 leading-relaxed">{p.scoring_summary}</div>
              {Array.isArray(p.scoring_strengths) && p.scoring_strengths.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold text-teal-deep mb-0.5">Strengths</div>
                  <ul className="text-[11px] text-t2 list-disc pl-4">
                    {p.scoring_strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(p.scoring_concerns) && p.scoring_concerns.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold text-red mb-0.5">Concerns</div>
                  <ul className="text-[11px] text-t2 list-disc pl-4">
                    {p.scoring_concerns.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {type === 'influencer' && (
            <div className="bg-white rounded-xl border border-border p-3 space-y-1.5 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">Metrics (90d)</div>
              <Row label="Engagement (view-based)" value={`${p.view_based_er || 0}%`} />
              <Row label="Engagement (follower-based)" value={`${p.follower_based_er || 0}%`} />
              <Row label="Avg likes" value={(p.avg_likes || 0).toLocaleString()} />
              <Row label="Avg views" value={(p.avg_views || 0).toLocaleString()} />
              <Row label="Posts (90d)" value={p.total_posts_90d || 0} />
              <Row label="Posting cadence" value={`${p.posting_frequency_per_week || 0}/week`} />
              <Row label="Brand collabs" value={p.total_brand_collaborations || 0} />
              <Row label="Unique brands" value={p.unique_brands_count || 0} />
              <Row label="Activity status" value={p.activity_status || '—'} />
              {(p.estimated_min_rate || p.estimated_max_rate) && (
                <Row label="Rate range" value={`₹${(p.estimated_min_rate || 0).toLocaleString()} – ₹${(p.estimated_max_rate || 0).toLocaleString()}`} />
              )}
            </div>
          )}

          {type === 'brand' && (
            <div className="bg-white rounded-xl border border-border p-3 space-y-1.5 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">Brand Signals</div>
              <Row label="Followers" value={(p.followers_count || 0).toLocaleString()} />
              <Row label="Influencer collabs (90d)" value={p.influencer_collab_count || 0} />
              <Row label="Unique influencer partners" value={p.unique_influencer_partners || 0} />
              <Row label="Marketing intensity" value={p.marketing_intensity || '—'} />
              <Row label="Reachability" value={p.reachability_score != null ? `${p.reachability_score}/100` : '—'} />
            </div>
          )}
        </div>

        {/* Middle: Activity timeline + log form */}
        <div className="col-span-2 space-y-3">
          <div className="bg-white rounded-xl border border-border p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3">Activity Timeline</div>
              <button onClick={() => setShowLogForm(s => !s)}
                className="text-xs bg-orange text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-orange/90">
                {showLogForm ? 'Close' : '+ Log activity'}
              </button>
            </div>

            {showLogForm && (
              <form onSubmit={submitActivity} className="bg-surface2 rounded-lg p-3 mb-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Channel</label>
                    <select value={channel} onChange={e => setChannel(e.target.value)}
                      className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-white">
                      <option value="dm">Instagram DM</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                      <option value="call">Call</option>
                      <option value="in_person">In person</option>
                      <option value="sms">SMS</option>
                      <option value="other">Other</option>
                      <option value="internal">Internal note</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Direction</label>
                    <select value={direction} onChange={e => setDirection(e.target.value)}
                      className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-white">
                      <option value="outbound">Outbound (I reached out)</option>
                      <option value="inbound">Inbound (they replied)</option>
                      <option value="internal_note">Internal note</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Sentiment</label>
                    <select value={sentiment} onChange={e => setSentiment(e.target.value)}
                      className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-white">
                      <option value="">—</option>
                      <option value="positive">Positive</option>
                      <option value="neutral">Neutral</option>
                      <option value="negative">Negative</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Message / Reply text</label>
                  <textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={3}
                    placeholder="Paste what you sent or what they said"
                    className="w-full text-xs border border-border rounded-md px-2 py-1.5"></textarea>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Internal notes</label>
                  <input type="text" value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                    placeholder="Anything you don't want them to see" className="w-full text-xs border border-border rounded-md px-2 py-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Next action</label>
                    <input type="text" value={nextAction} onChange={e => setNextAction(e.target.value)}
                      placeholder="Follow up / send proposal / call" className="w-full text-xs border border-border rounded-md px-2 py-1.5" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Due date</label>
                    <input type="date" value={nextActionDue} onChange={e => setNextActionDue(e.target.value)}
                      className="w-full text-xs border border-border rounded-md px-2 py-1.5" />
                  </div>
                </div>
                <button disabled={logging} type="submit"
                  className="bg-orange text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-orange/90 disabled:opacity-40">
                  {logging ? 'Saving…' : 'Save activity'}
                </button>
              </form>
            )}

            {data.activity_timeline.length === 0 ? (
              <div className="text-t3 text-xs italic">No activity yet. Log your first outreach above.</div>
            ) : (
              <ul className="space-y-2.5">
                {data.activity_timeline.map(a => (
                  <li key={a.id} className="border-l-2 border-border pl-3 py-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        a.direction === 'outbound' ? 'bg-orange/15 text-orange' :
                        a.direction === 'inbound' ? 'bg-teal-pale text-teal-deep' :
                        'bg-surface2 text-t3'
                      }`}>{a.direction}</span>
                      <span className="font-mono text-t3">{a.channel}</span>
                      {a.sentiment && <span className="text-[10px]">{a.sentiment === 'positive' ? '😊' : a.sentiment === 'negative' ? '😞' : '😐'}</span>}
                      <span className="text-t3 text-[10px] ml-auto">{new Date(a.logged_at).toLocaleString()}</span>
                    </div>
                    {a.message_body && <div className="text-xs text-t2 mt-1 whitespace-pre-wrap">{a.message_body}</div>}
                    {a.internal_notes && <div className="text-[11px] text-t3 italic mt-1">📝 {a.internal_notes}</div>}
                    {a.next_action && (
                      <div className="text-[11px] text-orange mt-1 font-semibold">
                        Next: {a.next_action} {a.next_action_due && `· due ${new Date(a.next_action_due).toLocaleDateString()}`}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {type === 'influencer' && data.collabs?.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">Brand Collaborations (Detected)</div>
              <div className="flex flex-wrap gap-1.5">
                {data.collabs.slice(0, 20).map(c => (
                  <span key={c.id} className="px-2 py-1 rounded-full text-[10px] bg-navy/10 text-navy">
                    @{c.brand_instagram || c.brand_name} <span className="text-t3">· {c.collab_type || c.confidence}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {type === 'brand' && Array.isArray(p.influencer_collabs_90d) && p.influencer_collabs_90d.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">
                Influencer Partnerships ({p.influencer_collab_count || 0} collabs · {p.unique_influencer_partners || 0} unique partners)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.influencer_collabs_90d.slice(0, 30).map((c, i) => (
                  <span key={i} className="px-2 py-1 rounded-full text-[10px] bg-orange/10 text-orange">
                    @{c.influencer_handle} <span className="text-t3">· {c.collab_type || c.confidence}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-teal-deep text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-t3">{label}</span>
      <span className="font-semibold tabular-nums text-t1">{value}</span>
    </div>
  );
}
