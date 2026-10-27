'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { campaignApi } from '../../../lib/api';
import { StateChip, fmtDay, PhoneNote } from './campaignBits';

/* ════════════════════════════════════════════════════════════════════════════
   Campaigns — a monitor of what the phone built.
   Contract: features/web-campaigns-monitor (board v1, W1–W2, locked 27 Oct 2026).

   Campaigns are built and run in the INFLX brand app on the phone (Docs/THE_CUT.md). This page
   reads the same door the phone's Campaigns tab reads — GET /campaigns/summary?state= — so the
   three lists here are the three lists there, card for card. Nothing on this page writes.
   ══════════════════════════════════════════════════════════════════════════ */

const SEGMENTS = [
  { key: 'live',  label: 'Live' },
  { key: 'draft', label: 'Drafts' },
  { key: 'past',  label: 'Past' },
];

function CampaignCard({ c }) {
  const router = useRouter();
  const invited = c.counts?.invited || 0;
  const signed  = c.counts?.signed || 0;
  const pct = invited > 0 ? Math.round((signed / invited) * 100) : 0;
  const sets = c.setCount || 0;
  const setsWord = `${sets} set${sets === 1 ? '' : 's'}`;

  let line;
  if (c.state === 'draft') line = `${setsWord} · no invitations sent`;
  else if (c.nextPostingDate) line = `${setsWord} · next posting ${fmtDay(c.nextPostingDate)}`;
  else line = `${setsWord} · ${c.state === 'expired' ? 'invitations closed' : 'completed'}`;

  return (
    <button
      type="button"
      onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
      className="text-left bg-white border border-[#E4E4E7] rounded-[14px] p-4 hover:border-[#0A0A0A] hover:shadow-[0_6px_20px_-12px_rgba(0,0,0,0.15)] transition-all flex flex-col gap-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold text-[#0A0A0A] truncate">{c.name}</div>
          <div className="font-mono text-[11.5px] text-[#71717A] mt-0.5">
            {line}
            {c.startedFromGroup?.name && <> · from group <span className="text-[#0A0A0A] font-semibold">{c.startedFromGroup.name}</span></>}
          </div>
        </div>
        <StateChip state={c.state} />
      </div>

      {c.state === 'draft' ? (
        <div className="text-[12px] text-[#52525B]">
          {sets === 0 ? 'Add a set on the phone.' : 'Add creators on the phone to make it live.'}
        </div>
      ) : (
        <>
          <div className="h-1.5 bg-[#F4F4F5] rounded-full overflow-hidden">
            <div className="h-full bg-[#0A0A0A] rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[12px] text-[#52525B] flex gap-3 flex-wrap">
            <span><b className="font-mono font-semibold text-[#0A0A0A]">{invited}</b> invited</span>
            <span><b className="font-mono font-semibold text-[#0A0A0A]">{signed}</b> signed</span>
            <span><b className="font-mono font-semibold text-[#0A0A0A]">{c.counts?.waiting || 0}</b> waiting</span>
            <span><b className="font-mono font-semibold text-[#0A0A0A]">{c.counts?.declined || 0}</b> declined</span>
          </div>
        </>
      )}
    </button>
  );
}

export default function CampaignsPage() {
  const [segment, setSegment] = useState('live');
  const [data, setData] = useState({ campaigns: [], tabs: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let on = true;
    setLoading(true);
    setError('');
    campaignApi.summary(segment).then(res => {
      if (!on) return;
      if (res.success) setData({ campaigns: res.data?.campaigns || [], tabs: res.data?.tabs || null });
      else setError(res.error?.message || 'Could not load campaigns.');
    }).catch(() => { if (on) setError('Could not load campaigns.'); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [segment]);

  const tabs = data.tabs || { live: 0, draft: 0, past: 0 };
  const total = (tabs.live || 0) + (tabs.draft || 0) + (tabs.past || 0);
  const q = filter.trim().toLowerCase();
  const shown = q ? data.campaigns.filter(c => (c.name || '').toLowerCase().includes(q)) : data.campaigns;
  const nothingAtAll = !loading && !error && total === 0;

  return (
    <div className="max-w-6xl">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="mb-5">
        <div className="font-mono text-[11px] font-medium text-[#71717A] uppercase tracking-[0.3px] mb-1">/dashboard / campaigns</div>
        <h1 className="font-display text-[28px] font-bold text-[#0A0A0A] -tracking-[0.6px]">Campaigns</h1>
        <div className="w-9 h-1 bg-[#FFC107] rounded-full mt-1.5"></div>
      </div>

      <PhoneNote>Campaigns are built and run in the INFLX brand app on your phone. This page shows what is happening and the numbers.</PhoneNote>

      {nothingAtAll ? (
        <div className="bg-white border border-[#E4E4E7] rounded-[14px] px-8 py-12 text-center">
          <div className="font-display text-[17px] font-bold text-[#0A0A0A] mb-1.5">No campaigns yet</div>
          <div className="font-body text-[13px] text-[#52525B] max-w-[520px] mx-auto">
            Build your first campaign in the INFLX brand app on your phone: Campaigns › New campaign. It will appear here the moment it is saved.
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <div className="inline-flex bg-white border border-[#E4E4E7] rounded-[12px] p-[3px] gap-0.5">
              {SEGMENTS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSegment(s.key)}
                  className={`px-4 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors ${segment === s.key ? 'bg-[#0A0A0A] text-white' : 'text-[#52525B] hover:text-[#0A0A0A]'}`}
                >
                  {s.label}
                  <span className={`font-mono text-[11px] ml-1.5 ${segment === s.key ? 'text-white/70' : 'text-[#A1A1AA]'}`}>{tabs[s.key] || 0}</span>
                </button>
              ))}
            </div>
            <input
              type="search"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by name"
              className="bg-white border border-[#E4E4E7] rounded-[10px] px-3 py-2 text-[13px] text-[#0A0A0A] placeholder:text-[#A1A1AA] w-[260px] focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-[#71717A] text-sm font-body">Loading campaigns…</div>
          ) : error ? (
            <div className="bg-white border border-[#E4E4E7] rounded-[14px] px-6 py-8 text-center text-[13px] text-[#B91C1C]">{error}</div>
          ) : shown.length === 0 ? (
            <div className="bg-white border border-[#E4E4E7] rounded-[14px] px-6 py-10 text-center text-[13px] text-[#52525B]">
              {q ? 'No campaign matches that name.' : segment === 'live' ? 'Nothing is live right now.' : segment === 'draft' ? 'No drafts.' : 'Nothing has finished yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {shown.map(c => <CampaignCard key={c.id} c={c} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
