'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { campaignApi, fmtRupees, fmtNum } from '../../../../lib/api';
import { StateChip, aimWord, modeWord, fmtDay, fmtStamp, PhonePath } from '../campaignBits';
import PayoutSection from './PayoutSection';
import SetDrawer from './SetDrawer';

/* ════════════════════════════════════════════════════════════════════════════
   Campaign hub — a monitor of what the phone built.
   Contract: features/web-campaigns-monitor (board v1, W3–W5, locked 27 Oct 2026).

   Sets, counts and states come from GET /campaigns/:id/summary — the door the phone's campaign
   screen reads (item 4). Each set's creators come from GET .../sets/:sid/summary (item 5), the
   same rows the phone lists, in the same groups. The numbers (engagement, clicks, conversions,
   payout) keep their existing doors. The only write on this page is "Update now" (D4).
   Everything a brand can DO about a campaign is done on the phone; this page says where.
   ══════════════════════════════════════════════════════════════════════════ */

function Block({ title, right, children, tone = 'yellow' }) {
  const bar = tone === 'blue' ? 'bg-[#1D5FBF]' : 'bg-[#FFC107]';
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-[14px] mb-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E4E4E7]">
        <h3 className="font-display text-[14px] font-bold text-[#0A0A0A] flex items-center gap-2">
          <span className={`w-1 h-4 rounded-sm ${bar}`} />{title}
        </h3>
        {right && <div className="text-[11.5px] text-[#71717A] flex items-center gap-2">{right}</div>}
      </div>
      {children}
    </div>
  );
}

function Num({ k, v, s }) {
  return (
    <div className="px-4 py-3.5 border-r border-[#E4E4E7] last:border-r-0">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#71717A]">{k}</div>
      <div className="font-mono text-[20px] font-bold text-[#0A0A0A] mt-0.5">{v}</div>
      {s && <div className="text-[11px] text-[#71717A]">{s}</div>}
    </div>
  );
}

function Rows({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="px-4 pb-2.5 pt-1">
      {rows.map(([l, r], i) => (
        <div key={i} className="flex justify-between gap-4 text-[12.5px] py-1.5 border-b border-dashed border-[#E4E4E7] last:border-b-0">
          <span className="text-[#52525B] truncate">{l}</span>
          <b className="font-mono font-semibold text-[#0A0A0A] whitespace-nowrap">{r}</b>
        </div>
      ))}
    </div>
  );
}

function Unavailable() {
  return <div className="px-4 py-6 text-center text-[12.5px] text-[#52525B]">Not available right now.</div>;
}

function SetRow({ s, onOpen }) {
  const c = s.counts || {};
  const place = [aimWord(s.goal), modeWord(s.shootMode), s.branch?.name ? `${s.branch.name}${s.branch.cityName ? ', ' + s.branch.cityName : ''}` : null].filter(Boolean).join(' · ');
  let dateLine, dateSub;
  if (s.isPast) {
    dateLine = s.postingDate ? `Posted ${fmtDay(s.postingDate)}` : 'No posting date';
    dateSub = s.state === 'expired' ? (s.cutoff ? `Invitations closed ${fmtDay(s.cutoff)}` : 'Expired') : 'Completed';
  } else {
    dateLine = s.postingDate ? `Posting ${fmtDay(s.postingDate)}` : 'No posting date';
    if (s.datePassed) dateSub = 'Date passed';
    else if (s.cutoffPassed || (s.canInvite && !s.canInvite.ok)) dateSub = 'Invitations closed';
    else if (s.cutoff) dateSub = `Invitations close ${fmtDay(s.cutoff)}${s.daysToCutoff != null ? ` · ${s.daysToCutoff} day${s.daysToCutoff === 1 ? '' : 's'}` : ''}`;
    else dateSub = '';
  }
  return (
    <button type="button" onClick={() => onOpen(s)}
      className="w-full text-left grid grid-cols-[1.4fr_1.2fr_1fr_auto] gap-3.5 items-center px-4 py-3 border-b border-[#E4E4E7] last:border-b-0 hover:bg-[#FAFAFA] transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="font-display text-[14px] font-bold text-[#0A0A0A] truncate">{s.name}</span><StateChip state={s.state} /></div>
        <div className="text-[12px] text-[#52525B] mt-0.5 truncate">{place || '—'}</div>
      </div>
      <div className="text-[12.5px]">
        <b className="font-mono font-semibold text-[#0A0A0A]">{dateLine}</b>
        {dateSub && <span className="block text-[11.5px] text-[#71717A]">{dateSub}</span>}
      </div>
      <div className="text-[12px] text-[#52525B]">
        <b className="font-mono text-[#0A0A0A] font-semibold">{c.invited || 0}</b> invited · <b className="font-mono text-[#0A0A0A] font-semibold">{c.signed || 0}</b> signed
        {!s.isPast && <> · <b className="font-mono text-[#0A0A0A] font-semibold">{c.waiting || 0}</b> waiting · <b className="font-mono text-[#0A0A0A] font-semibold">{c.declined || 0}</b> declined</>}
      </div>
      <span className="text-[#A1A1AA] text-[16px]">›</span>
    </button>
  );
}

export default function CampaignHubPage() {
  const { id } = useParams();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [engagement, setEngagement] = useState(null);   // null = loading, false = failed
  const [conversions, setConversions] = useState(null);
  const [clicks, setClicks] = useState(null);
  const [details, setDetails] = useState({});           // sid → { state, creators }
  const [openSet, setOpenSet] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState('');

  const loadSetDetail = useCallback((sid) => {
    setDetails(d => (d[sid] && d[sid].state !== 'error' ? d : { ...d, [sid]: { state: 'loading' } }));
    return campaignApi.setSummary(id, sid).then(res => {
      if (res.success) setDetails(d => ({ ...d, [sid]: { state: 'ok', creators: res.data?.creators || null, set: res.data?.set || null } }));
      else setDetails(d => ({ ...d, [sid]: { state: res.error?.code === 'NOT_FOUND' ? 'gone' : 'error' } }));
    }).catch(() => setDetails(d => ({ ...d, [sid]: { state: 'error' } })));
  }, [id]);

  const loadSummary = useCallback(() => {
    return campaignApi.campaignSummary(id).then(res => {
      if (res.success) {
        setSummary(res.data);
        setError('');
        // The current sets' creators feed the "Needs you" rail; past sets load when opened.
        (res.data?.sets?.current || []).forEach(s => loadSetDetail(s.id));
      } else {
        setError(res.error?.code === 'NOT_FOUND' ? 'not_found' : (res.error?.message || 'Could not load this campaign.'));
      }
    }).catch(() => setError('Could not load this campaign.'));
  }, [id, loadSetDetail]);

  useEffect(() => {
    if (!id) return;
    let on = true;
    setLoading(true);
    loadSummary().finally(() => { if (on) setLoading(false); });
    campaignApi.getEngagement(id).then(r => { if (on) setEngagement(r.success ? r.data : false); }).catch(() => { if (on) setEngagement(false); });
    campaignApi.getConversions(id).then(r => { if (on) setConversions(r.success ? r.data : false); }).catch(() => { if (on) setConversions(false); });
    campaignApi.getClicks(id).then(r => { if (on) setClicks(r.success ? r.data : false); }).catch(() => { if (on) setClicks(false); });
    return () => { on = false; };
  }, [id, loadSummary]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  /* Update now (post-performance-v2 P7; web-campaigns-monitor D4): the one write on this page. */
  async function updateNow() {
    setUpdating(true);
    const res = await campaignApi.refreshEngagement(id).catch(() => ({ success: false }));
    if (res?.success) setEngagement(res.data);
    else {
      showToast(res?.error?.message || 'Could not update the numbers.');
      const eng = await campaignApi.getEngagement(id).catch(() => ({ success: false }));
      if (eng?.success) setEngagement(eng.data);
    }
    setUpdating(false);
  }

  function openSetRow(s) {
    setOpenSet(s);
    if (!details[s.id] || details[s.id].state === 'error' || details[s.id].state === 'gone') loadSetDetail(s.id);
  }
  function closeDrawer() {
    const gone = openSet && details[openSet.id]?.state === 'gone';
    setOpenSet(null);
    if (gone) loadSummary();
  }

  /* "Needs you — on the phone": derived from the creator rows already loaded. */
  const needs = useMemo(() => {
    const sign = [], reply = [], shoot = [];
    const sets = [...(summary?.sets?.current || [])];
    for (const s of sets) {
      const d = details[s.id];
      if (!d || d.state !== 'ok' || !d.creators?.groups) continue;
      for (const key of (d.creators.order || Object.keys(d.creators.groups))) {
        for (const r of (d.creators.groups[key]?.rows || [])) {
          const who = r.instagramHandle ? `@${r.instagramHandle}` : (r.name || 'a creator');
          if (r.actions?.signAgreement) sign.push({ who, set: s.name, when: r.agreement?.creatorSignedAt });
          else if (r.shoot?.yourMove) shoot.push({ who, set: s.name });
          else if (r.group === 'yourMove') reply.push({ who, set: s.name });
        }
      }
    }
    return { sign, reply, shoot };
  }, [summary, details]);

  if (loading) return <div className="py-16 text-center text-[#71717A] font-body">Loading campaign…</div>;
  if (error === 'not_found' || (!summary && error)) {
    return (
      <div className="py-16 text-center">
        <div className="font-display text-lg font-bold text-[#0A0A0A] mb-2">{error === 'not_found' ? 'Not found' : error}</div>
        <Link href="/dashboard/campaigns" className="inline-block px-4 py-2 bg-[#F4F4F5] text-[#0A0A0A] rounded-[10px] font-semibold text-sm no-underline">← All campaigns</Link>
      </div>
    );
  }

  const c = summary.campaign || {};
  const current = summary.sets?.current || [];
  const past = summary.sets?.past || [];
  const counts = c.counts || {};
  const setById = Object.fromEntries([...current, ...past].map(s => [s.id, s]));

  const engT = engagement && engagement.totals ? engagement.totals : null;
  const convT = conversions && conversions.totals ? conversions.totals : null;
  const channels = conversions && conversions.by_channel ? Object.entries(conversions.by_channel) : [];
  const clicksTotal = clicks ? (clicks.total_clicks || 0) : 0;
  const clicksBySet = clicks && Array.isArray(clicks.by_set) ? clicks.by_set : [];

  const needsEmpty = needs.sign.length + needs.reply.length + needs.shoot.length === 0;
  const pendingDetails = current.some(s => !details[s.id] || details[s.id].state === 'loading');

  return (
    <div className="max-w-6xl">
      <div className="font-mono text-[11px] font-medium text-[#71717A] uppercase tracking-[0.3px] mb-1">
        <Link href="/dashboard" className="hover:text-[#0A0A0A] no-underline text-inherit">/dashboard</Link> / <Link href="/dashboard/campaigns" className="hover:text-[#0A0A0A] no-underline text-inherit">campaigns</Link> / <span className="text-[#0A0A0A] font-bold">{c.name}</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-[26px] font-bold text-[#0A0A0A] -tracking-[0.5px]">{c.name}</h1>
        <StateChip state={c.state} />
      </div>
      <div className="text-[12.5px] text-[#52525B] mt-1">
        Negotiation <b className="font-mono font-semibold text-[#0A0A0A]">{c.allowNegotiation ? 'on' : 'off'}</b>
        {c.createdAt && <> · created <b className="font-mono font-semibold text-[#0A0A0A]">{fmtDay(c.createdAt)}</b></>}
        {c.brief && <> · “{c.brief}”</>}
      </div>
      <div className="w-9 h-1 bg-[#FFC107] rounded-full mt-1.5 mb-4"></div>

      {/* Totals strip = campaign.counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        {[
          ['Invited', counts.invited || 0, `across ${current.length + past.length} set${current.length + past.length === 1 ? '' : 's'}`],
          ['Signed', counts.signed || 0, 'agreements signed by both'],
          ['Waiting', counts.waiting || 0, 'yet to answer'],
          ['Declined', counts.declined || 0, ''],
        ].map(([k, v, s]) => (
          <div key={k} className="bg-white border border-[#E4E4E7] rounded-[12px] px-3.5 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#71717A]">{k}</div>
            <div className="font-mono text-[22px] font-bold text-[#0A0A0A] mt-0.5">{v}</div>
            {s && <div className="text-[11px] text-[#71717A]">{s}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        <div>
          {/* Sets */}
          <Block title="Sets" right={<span>tap a set to see its creators and posts</span>}>
            {current.length === 0 && past.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[#52525B]">No sets yet. Add the first one on the phone.</div>
            ) : (
              <>
                {current.map(s => <SetRow key={s.id} s={s} onOpen={openSetRow} />)}
                {past.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#71717A] bg-[#FAFAFA] border-b border-[#E4E4E7]">Past sets</div>
                    {past.map(s => <SetRow key={s.id} s={s} onOpen={openSetRow} />)}
                  </>
                )}
              </>
            )}
            <div className="px-4 py-3 text-[12.5px] text-[#52525B] bg-[#FAFAFA] border-t border-[#E4E4E7]">
              Add a set, add creators, or change a set: <b className="text-[#0A0A0A]">INFLX brand app › Campaigns › {c.name}</b>
            </div>
          </Block>

          {/* Engagement */}
          <Block
            title="Engagement"
            right={engagement ? (
              <>
                {engT?.updatedAt && <span>updated {fmtStamp(engT.updatedAt)}</span>}
                {engagement.canUpdate && (
                  <button type="button" onClick={updateNow} disabled={updating} data-testid="update-now"
                    className={`bg-white border border-[#E4E4E7] rounded-[9px] px-3 py-1.5 text-[12px] font-bold text-[#0A0A0A] ${updating ? 'opacity-60' : 'hover:bg-[#FFF7CC] hover:border-[#FFC107]'}`}>
                    {updating ? 'Updating…' : 'Update now'}
                  </button>
                )}
              </>
            ) : null}
          >
            {engagement === null ? <div className="px-4 py-6 text-center text-[12.5px] text-[#71717A]">Loading…</div>
            : engagement === false || !engT ? <Unavailable />
            : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4">
                  <Num k="Views" v={fmtNum(engT.views)} s={`${fmtNum(engT.linksRead || 0)} of ${fmtNum(engT.links || 0)} links read`} />
                  <Num k="Likes" v={fmtNum(engT.likes)} />
                  <Num k="Comments" v={fmtNum(engT.comments)} />
                  <Num k="Waiting" v={fmtNum(engT.waiting || 0)} s={engT.waiting ? 'link not read yet' : ''} />
                </div>
                <Rows rows={(engagement.bySet || []).map(s => [s.setName, `${fmtNum(s.views)} views · ${fmtNum(s.likes)} likes · ${fmtNum(s.comments)} comments`])} />
                {engagement.lastUpdateNowAt && <div className="px-4 pb-3 text-[11px] text-[#A1A1AA]">Last "Update now" {fmtStamp(engagement.lastUpdateNowAt)}</div>}
              </>
            )}
          </Block>

          {/* Sales and clicks */}
          <Block title="Sales and clicks" right={<Link href={`/dashboard/conversions?campaign=${id}`} className="text-[#6B5A00] font-bold no-underline">full view → Conversions</Link>}>
            {conversions === null && clicks === null ? <div className="px-4 py-6 text-center text-[12.5px] text-[#71717A]">Loading…</div>
            : conversions === false && clicks === false ? <Unavailable />
            : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4">
                  <Num k="Store clicks" v={clicks === false ? '—' : fmtNum(clicksTotal)} s="from creator links" />
                  <Num k="Sales" v={convT ? fmtNum(convT.total_sales) : '—'} />
                  <Num k="Revenue" v={convT ? fmtRupees(convT.total_revenue) : '—'} />
                  <Num k="Commission paid" v={convT ? fmtRupees(convT.total_commission_paid) : '—'} s={convT && convT.blended_roi ? `ROI ${convT.blended_roi}×` : ''} />
                </div>
                <Rows rows={[
                  ...channels.map(([name, ch]) => [name, `${fmtNum(ch.count || 0)} sale${ch.count === 1 ? '' : 's'} · ${ch.pct || 0}%`]),
                  ...clicksBySet.map(b => [`Clicks · ${setById[b.set_id]?.name || 'set'}`, fmtNum(b.clicks)]),
                ]} />
              </>
            )}
          </Block>

          {/* Payout — read-only, its own door (D5) */}
          <Block title="Payout" right={<span>what is locked and what has moved</span>}>
            <div className="p-4"><PayoutSection id={id} /></div>
          </Block>
        </div>

        {/* Right rail */}
        <div className="lg:sticky lg:top-6">
          <Block title="Needs you — on the phone" tone="blue">
            {needsEmpty ? (
              <div className="px-4 py-5 text-[12.5px] text-[#52525B]">{pendingDetails ? 'Checking…' : 'Nothing is waiting on you right now.'}</div>
            ) : (
              <>
                {needs.sign.length > 0 && (
                  <div className="px-4 py-3 border-b border-[#E4E4E7]">
                    <div className="text-[13px] font-bold text-[#0A0A0A]">{needs.sign.length} agreement{needs.sign.length === 1 ? '' : 's'} wait{needs.sign.length === 1 ? 's' : ''} for your signature</div>
                    {needs.sign.slice(0, 3).map((n, i) => <div key={i} className="text-[12px] text-[#52525B]">{n.who}{n.when ? ` signed on ${fmtDay(n.when)}` : ''} · {n.set}</div>)}
                    <PhonePath>INFLX brand app › Campaigns › {needs.sign[0].set}</PhonePath>
                  </div>
                )}
                {needs.reply.length > 0 && (
                  <div className="px-4 py-3 border-b border-[#E4E4E7]">
                    <div className="text-[13px] font-bold text-[#0A0A0A]">{needs.reply.length} creator{needs.reply.length === 1 ? ' is' : 's are'} waiting for your reply</div>
                    {needs.reply.slice(0, 3).map((n, i) => <div key={i} className="text-[12px] text-[#52525B]">{n.who} · {n.set}</div>)}
                    <PhonePath>INFLX brand app › Campaigns › {needs.reply[0].set}</PhonePath>
                  </div>
                )}
                {needs.shoot.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="text-[13px] font-bold text-[#0A0A0A]">{needs.shoot.length} store visit{needs.shoot.length === 1 ? '' : 's'} to plan</div>
                    {needs.shoot.slice(0, 3).map((n, i) => <div key={i} className="text-[12px] text-[#52525B]">{n.who} · {n.set}</div>)}
                    <PhonePath>INFLX brand app › Campaigns › {needs.shoot[0].set}</PhonePath>
                  </div>
                )}
              </>
            )}
          </Block>
          <Block title="About this campaign">
            {c.startedFromGroup?.name && <div className="px-4 py-2.5 border-b border-[#E4E4E7]"><div className="text-[11.5px] text-[#71717A]">Started from group</div><div className="text-[13px] font-bold text-[#0A0A0A]">{c.startedFromGroup.name}</div></div>}
            <div className="px-4 py-2.5 border-b border-[#E4E4E7]"><div className="text-[11.5px] text-[#71717A]">Negotiation</div><div className="text-[13px] font-bold text-[#0A0A0A]">{c.allowNegotiation ? 'On — creators may counter' : 'Off — terms as sent'}</div></div>
            {c.brief && <div className="px-4 py-2.5 border-b border-[#E4E4E7]"><div className="text-[11.5px] text-[#71717A]">Description (only your team sees this)</div><div className="text-[13px] text-[#0A0A0A]">{c.brief}</div></div>}
            <div className="px-4 py-2.5"><div className="text-[11.5px] text-[#71717A]">Campaign id</div><div className="font-mono text-[11px] text-[#52525B] break-all">{c.id}</div></div>
          </Block>
        </div>
      </div>

      {openSet && (
        <SetDrawer campaignId={id} set={openSet} detail={details[openSet.id]} onClose={closeDrawer} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#0A0A0A] text-white text-[12px] font-semibold px-4 py-3 rounded-[12px] shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
