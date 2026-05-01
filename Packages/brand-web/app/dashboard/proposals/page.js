'use client';
import { useEffect, useState } from 'react';
import { proposalApi } from '../../../lib/api';

const NICHE_OPTIONS = ['food', 'fashion', 'fitness', 'travel', 'lifestyle', 'beauty', 'tech', 'gaming', 'finance', 'parenting'];
const TIER_OPTIONS  = ['nano', 'micro', 'macro', 'mega'];

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'sent',      label: 'New' },
  { key: 'viewed',    label: 'Viewed' },
  { key: 'countered', label: 'Countered' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'rejected',  label: 'Rejected' },
];

const STATUS_PILL = {
  sent:      'bg-amber-100 text-amber-800',
  viewed:    'bg-blue-100 text-blue-800',
  countered: 'bg-purple-100 text-purple-800',
  accepted:  'bg-teal-100 text-teal-800',
  rejected:  'bg-red-100 text-red-700',
  expired:   'bg-gray-100 text-gray-600',
  withdrawn: 'bg-gray-100 text-gray-600',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tierFromFollowers(n) {
  const v = Number(n || 0);
  if (v < 10000)   return 'nano';
  if (v < 100000)  return 'micro';
  if (v < 1000000) return 'macro';
  return 'mega';
}

export default function ProposalsPage() {
  const [tab, setTab] = useState('');
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [settings, setSettings]   = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeProposal, setActiveProposal] = useState(null);

  async function load() {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      proposalApi.list(tab || null),
      proposalApi.getSettings(),
    ]);
    setLoading(false);
    if (pRes.success) setProposals(pRes.data?.proposals || []);
    if (sRes.success) setSettings(sRes.data);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-lg font-bold text-t1">Influencer Proposals</h1>
          <p className="text-xs text-t3">Pitches sent to you by influencers. Toggle below to start receiving them.</p>
        </div>
        <button onClick={() => setShowSettings(s => !s)} className="px-3 py-1.5 bg-surface2 text-t2 text-xs font-semibold rounded-lg hover:bg-navy-pale">
          {showSettings ? 'Hide' : 'Settings'}
        </button>
      </div>

      {showSettings && settings && (
        <SettingsCard settings={settings} onSaved={() => { setShowSettings(false); load(); }} />
      )}

      {!settings?.accepts_proposals && !showSettings && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
          <span>You're not accepting proposals yet. Influencers can't pitch you until you turn this on.</span>
          <button onClick={() => setShowSettings(true)} className="px-2 py-1 bg-amber-600 text-white text-[11px] font-semibold rounded">Open settings</button>
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-t3 text-sm">Loading…</div>
      ) : proposals.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-border">
          <div className="text-4xl mb-2">📨</div>
          <div className="font-bold text-t1 mb-1">No proposals here</div>
          <div className="text-xs text-t3">Influencers can pitch you once you've enabled proposals and they meet your criteria.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface2">
              <tr className="text-left text-[11px] text-t3 uppercase">
                <th className="px-3 py-2 font-semibold">Influencer</th>
                <th className="px-3 py-2 font-semibold">Pitch</th>
                <th className="px-3 py-2 font-semibold">Ask</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Sent</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-surface1/50 cursor-pointer" onClick={() => setActiveProposal(p)}>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-t1">{p.influencer_name}</div>
                    <div className="text-[10px] text-t3">@{p.influencer_handle} · {tierFromFollowers(p.followers_count)} · {p.influencer_city || '—'}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-t1 truncate max-w-md">{p.pitch_title}</div>
                    <div className="text-[10px] text-t3 truncate max-w-md">{p.pitch_message}</div>
                  </td>
                  <td className="px-3 py-3 text-t1 font-semibold">
                    {p.proposed_fee ? `₹${Number(p.proposed_fee).toLocaleString('en-IN')}` : ''}
                    {p.proposed_commission_pct ? ` ${p.proposed_commission_pct}%` : ''}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${STATUS_PILL[p.status] || 'bg-gray-100 text-gray-700'}`}>
                      {(p.status || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-t3">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeProposal && (
        <ProposalDetailModal
          proposal={activeProposal}
          onClose={() => setActiveProposal(null)}
          onChanged={() => { setActiveProposal(null); load(); }}
        />
      )}
    </div>
  );
}

function SettingsCard({ settings, onSaved }) {
  const [acceptsProposals, setAcceptsProposals] = useState(!!settings.accepts_proposals);
  const filters = settings.proposal_filters || {};
  const [minTier, setMinTier]                 = useState(filters.min_tier || '');
  const [allowedNiches, setAllowedNiches]     = useState(new Set(filters.allowed_niches || []));
  const [cityMatch, setCityMatch]             = useState(!!filters.city_match_required);
  const [minER, setMinER]                     = useState(filters.min_engagement_rate ?? '');
  const [onlyPastCollabs, setOnlyPastCollabs] = useState(!!filters.only_past_collabs);
  const [saving, setSaving] = useState(false);

  function toggleNiche(n) {
    setAllowedNiches(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const res = await proposalApi.updateSettings({
      accepts_proposals: acceptsProposals,
      proposal_filters: {
        min_tier: minTier || null,
        allowed_niches: Array.from(allowedNiches),
        city_match_required: cityMatch,
        min_engagement_rate: minER === '' ? null : Number(minER),
        only_past_collabs: onlyPastCollabs,
      },
    });
    setSaving(false);
    if (res.success) onSaved();
  }

  return (
    <div className="mb-4 p-4 bg-white rounded-xl border border-border space-y-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={acceptsProposals} onChange={e => setAcceptsProposals(e.target.checked)} />
        <span className="text-sm font-bold text-t1">Accept proposals from influencers</span>
      </label>

      {acceptsProposals && (
        <>
          <div>
            <div className="text-xs font-semibold text-t2 mb-1.5">Minimum tier</div>
            <div className="flex gap-1 flex-wrap">
              {[{ v: '', label: 'Any' }, ...TIER_OPTIONS.map(t => ({ v: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))].map(opt => (
                <button key={opt.v} type="button" onClick={() => setMinTier(opt.v)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold ${minTier === opt.v ? 'bg-navy text-white' : 'bg-surface2 text-t2 hover:bg-navy-pale'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-t2 mb-1.5">Allowed niches (empty = any)</div>
            <div className="flex gap-1 flex-wrap">
              {NICHE_OPTIONS.map(n => (
                <button key={n} type="button" onClick={() => toggleNiche(n)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold capitalize ${allowedNiches.has(n) ? 'bg-navy text-white' : 'bg-surface2 text-t2 hover:bg-navy-pale'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-t1">
              <input type="checkbox" checked={cityMatch} onChange={e => setCityMatch(e.target.checked)} />
              City match required
            </label>
            <label className="flex items-center gap-2 text-xs text-t1">
              <input type="checkbox" checked={onlyPastCollabs} onChange={e => setOnlyPastCollabs(e.target.checked)} />
              Only influencers I've worked with before
            </label>
            <label className="flex items-center gap-2 text-xs text-t1">
              Min engagement %
              <input type="number" step="0.1" value={minER} onChange={e => setMinER(e.target.value)}
                className="w-16 border border-border rounded px-2 py-1 text-xs" placeholder="0" />
            </label>
          </div>
        </>
      )}

      <button onClick={save} disabled={saving} className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg disabled:opacity-50">
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}

function ProposalDetailModal({ proposal, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [counterMode, setCounterMode] = useState(false);
  const [counterFee, setCounterFee] = useState(String(proposal.proposed_fee || ''));
  const [counterCommission, setCounterCommission] = useState(String(proposal.proposed_commission_pct || ''));
  const [counterMessage, setCounterMessage] = useState('');
  const [rejectMessage, setRejectMessage] = useState('');
  const [rejectMode, setRejectMode] = useState(false);

  async function handleAccept() {
    if (!confirm('Accept this proposal? A draft contract will be created and you can finalise terms before sending.')) return;
    setBusy(true);
    const res = await proposalApi.accept(proposal.id);
    setBusy(false);
    if (res.success) onChanged();
    else alert(res.error?.message || 'Accept failed');
  }
  async function handleReject() {
    setBusy(true);
    const res = await proposalApi.reject(proposal.id, rejectMessage || null);
    setBusy(false);
    if (res.success) onChanged();
    else alert(res.error?.message || 'Reject failed');
  }
  async function handleCounter() {
    setBusy(true);
    const res = await proposalApi.counter(proposal.id, {
      proposed_fee:            counterFee === '' ? null : Number(counterFee),
      proposed_commission_pct: counterCommission === '' ? null : Number(counterCommission),
    }, counterMessage || null);
    setBusy(false);
    if (res.success) onChanged();
    else alert(res.error?.message || 'Counter failed');
  }

  const canDecide = ['sent', 'viewed'].includes(proposal.status);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="font-display text-base font-bold text-t1">{proposal.pitch_title}</div>
            <div className="text-[11px] text-t3">{proposal.influencer_name} · @{proposal.influencer_handle}</div>
          </div>
          <button onClick={onClose} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Stat label="Followers" value={Number(proposal.followers_count || 0).toLocaleString('en-IN')} />
            <Stat label="Engagement" value={`${proposal.engagement_rate || 0}%`} />
            <Stat label="Tier" value={tierFromFollowers(proposal.followers_count)} />
          </div>

          <Section title="Pitch">
            <p className="text-xs text-t1 leading-relaxed whitespace-pre-wrap">{proposal.pitch_message}</p>
          </Section>

          <Section title="Proposed terms">
            <Row label="Goal" value={proposal.goal || '—'} />
            {proposal.proposed_fee && <Row label="Fee" value={`₹${Number(proposal.proposed_fee).toLocaleString('en-IN')}`} />}
            {proposal.proposed_commission_pct && <Row label="Commission" value={`${proposal.proposed_commission_pct}% per conversion`} />}
            {proposal.proposed_deliverables && (
              <Row label="Deliverables" value={
                (Array.isArray(proposal.proposed_deliverables) ? proposal.proposed_deliverables : []).map(d => `${d.count || 1} × ${d.type}`).join(', ')
              } />
            )}
            {(proposal.proposed_posting_window_start || proposal.proposed_posting_window_end) && (
              <Row label="Posting window"
                value={`${fmtDate(proposal.proposed_posting_window_start)} → ${fmtDate(proposal.proposed_posting_window_end)}`} />
            )}
          </Section>

          {(proposal.portfolio_links || []).length > 0 && (
            <Section title="Portfolio samples">
              {proposal.portfolio_links.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="block text-xs text-navy hover:underline truncate">
                  {url}
                </a>
              ))}
            </Section>
          )}

          {proposal.status === 'rejected' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs">
              <div className="font-semibold text-red-700">Rejected</div>
              {proposal.brand_response_message && <div className="text-red-600 mt-1">{proposal.brand_response_message}</div>}
            </div>
          )}
          {proposal.status === 'accepted' && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs">
              <div className="font-semibold text-teal-700">Accepted — draft contract created</div>
              <div className="text-teal-600 mt-1">Find it on the campaigns page to review and approve.</div>
            </div>
          )}
        </div>

        {canDecide && !rejectMode && !counterMode && (
          <div className="border-t border-border px-5 py-3 flex gap-2 justify-end">
            <button disabled={busy} onClick={() => setRejectMode(true)} className="px-3 py-2 bg-surface2 text-t2 text-xs font-bold rounded-lg">Decline</button>
            <button disabled={busy} onClick={() => setCounterMode(true)} className="px-3 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg">Counter</button>
            <button disabled={busy} onClick={handleAccept} className="px-3 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg">Accept</button>
          </div>
        )}

        {rejectMode && (
          <div className="border-t border-border px-5 py-3 space-y-2">
            <textarea value={rejectMessage} onChange={e => setRejectMessage(e.target.value)} rows={2}
              placeholder="Optional message to the influencer (visible to them)"
              className="w-full border border-border rounded-lg p-2 text-xs" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectMode(false)} className="px-3 py-2 bg-surface2 text-t2 text-xs font-bold rounded-lg">Cancel</button>
              <button disabled={busy} onClick={handleReject} className="px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg">{busy ? 'Rejecting…' : 'Confirm reject'}</button>
            </div>
          </div>
        )}

        {counterMode && (
          <div className="border-t border-border px-5 py-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-t2">
                Counter fee (₹)
                <input type="number" value={counterFee} onChange={e => setCounterFee(e.target.value)} className="w-full border border-border rounded p-1.5 text-xs mt-1" />
              </label>
              <label className="text-[11px] font-semibold text-t2">
                Counter commission %
                <input type="number" step="0.1" value={counterCommission} onChange={e => setCounterCommission(e.target.value)} className="w-full border border-border rounded p-1.5 text-xs mt-1" />
              </label>
            </div>
            <textarea value={counterMessage} onChange={e => setCounterMessage(e.target.value)} rows={2}
              placeholder="Why this counter? (visible to influencer)"
              className="w-full border border-border rounded-lg p-2 text-xs" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCounterMode(false)} className="px-3 py-2 bg-surface2 text-t2 text-xs font-bold rounded-lg">Cancel</button>
              <button disabled={busy} onClick={handleCounter} className="px-3 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg">{busy ? 'Sending…' : 'Send counter'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-surface2 rounded-lg p-2 text-center">
      <div className="text-base font-bold text-t1">{value}</div>
      <div className="text-[10px] text-t3 uppercase">{label}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-t3 uppercase mb-1.5">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-t3">{label}</span>
      <span className="text-xs font-semibold text-t1">{value}</span>
    </div>
  );
}
