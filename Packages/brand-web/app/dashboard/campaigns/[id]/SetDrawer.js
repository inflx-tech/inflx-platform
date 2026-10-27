'use client';
import { useEffect, useState } from 'react';
import { campaignApi, fmtRupees, fmtNum } from '../../../../lib/api';
import { StateChip, Tag, aimWord, modeWord, fmtDay, PhonePath } from '../campaignBits';

/* The set drawer (features/web-campaigns-monitor, board W4–W5). Slides over the dimmed hub when
   a set row is tapped. Creators = the phone's nine groups in its order, from
   GET /campaigns/:id/sets/:sid/summary (item 5 invitationRows). Posts = GET .../posts (post
   links), hidden for Pay for Content sets (BrandSetDetailScreen.js:311). No row has an action. */

function initials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '·';
}

function CreatorRow({ r, setName }) {
  const yourMove = r.group === 'yourMove';
  const signAgreement = !!r.actions?.signAgreement;
  const shootMove = !!r.shoot?.yourMove;
  return (
    <div className="flex gap-3 py-3 border-b border-[#F4F4F5] last:border-b-0">
      {r.avatarUrl
        ? <img src={r.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-[#F4F4F5]" />
        : <div className="w-9 h-9 rounded-full bg-[#F4F4F5] flex items-center justify-center font-mono text-[11px] font-bold text-[#71717A] flex-shrink-0">{initials(r.name)}</div>}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-bold text-[#0A0A0A]">{r.name || 'Creator'}</span>
          {yourMove && <Tag tone="move">Your move</Tag>}
          {r.status === 'declined' && <Tag tone="no">Declined</Tag>}
        </div>
        {r.instagramHandle && <span className="font-mono text-[11px] text-[#71717A]">@{r.instagramHandle}</span>}
        {r.termsLine && <span className="text-[12px] text-[#52525B]">{r.termsLine}</span>}
        {r.agreement?.line && <span className="text-[12px] text-[#0A0A0A]">{r.agreement.line}{r.agreement.reference ? ` · ref ${r.agreement.reference}` : ''}</span>}
        {r.shoot?.line && <span className="text-[12px] text-[#52525B]">Store visit: {r.shoot.line}</span>}
        {r.remote?.line && <span className="text-[12px] text-[#52525B]">Remote: {r.remote.line}</span>}
        {r.status === 'declined' && (r.declineReasonLabel || r.declineNote) && (
          <span className="text-[12px] text-[#52525B]">
            {r.declineReasonLabel}{r.declineNote ? ` · “${r.declineNote}”` : ''}
          </span>
        )}
        {r.status === 'invited' && !r.answeredAt && r.sentAt && (
          <span className="text-[12px] text-[#52525B]">Sent {fmtDay(r.sentAt)} · no answer yet</span>
        )}
        {(signAgreement || yourMove || shootMove) && (
          <PhonePath>
            {signAgreement ? 'Sign on the phone' : shootMove ? 'Plan the visit on the phone' : 'Reply on the phone'}: Campaigns › {setName} › {r.name?.split(' ')[0] || 'creator'}
          </PhonePath>
        )}
      </div>
    </div>
  );
}

function Creators({ creators, setName }) {
  if (!creators || !creators.total) {
    return <div className="py-10 text-center text-[13px] text-[#52525B]">No creators invited yet. Add creators on the phone.</div>;
  }
  const order = creators.order || Object.keys(creators.groups || {});
  return (
    <div>
      {order.map(key => {
        const g = creators.groups?.[key];
        if (!g || !g.count) return null;
        return (
          <div key={key} className="mt-4 first:mt-1">
            <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#71717A] mb-1">
              <span>{g.title}</span><span className="font-mono">{g.count}</span>
            </div>
            {(g.rows || []).map(r => <CreatorRow key={r.id} r={r} setName={setName} />)}
            {g.more > 0 && <div className="text-[11.5px] text-[#71717A] py-2">and {g.more} more · see them all on the phone</div>}
          </div>
        );
      })}
    </div>
  );
}

function Posts({ campaignId, setId }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    let on = true;
    campaignApi.setPosts(campaignId, setId).then(res => {
      if (!on) return;
      if (res.success) { setData(res.data); setState('ok'); } else setState('error');
    }).catch(() => { if (on) setState('error'); });
    return () => { on = false; };
  }, [campaignId, setId]);

  if (state === 'loading') return <div className="py-10 text-center text-[13px] text-[#71717A]">Loading posts…</div>;
  if (state === 'error' || !data) return <div className="py-10 text-center text-[13px] text-[#52525B]">Not available right now.</div>;
  const t = data.totals || {};
  const posts = data.posts || [];
  return (
    <div>
      <div className="text-[12px] text-[#52525B] mb-3">
        <b className="font-mono font-semibold text-[#0A0A0A]">{data.creators || 0}</b> creator{data.creators === 1 ? '' : 's'} ·{' '}
        <b className="font-mono font-semibold text-[#0A0A0A]">{data.live || 0}</b> post{data.live === 1 ? '' : 's'} live ·{' '}
        <b className="font-mono font-semibold text-[#0A0A0A]">{fmtNum(data.social?.views || 0)}</b> social views
      </div>
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {[
          ['Orders', fmtNum(t.orders || 0)],
          ['Sales', fmtRupees(t.sales || 0)],
          ['Commission', fmtRupees(t.commission || 0)],
          ['INFLX fee', fmtRupees(t.inflx_fee || 0)],
          ['You receive', fmtRupees(t.you_receive || 0)],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#FAFAFA] rounded-[10px] px-2.5 py-2">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.3px] text-[#71717A]">{k}</div>
            <div className="font-mono text-[13px] font-bold text-[#0A0A0A] mt-0.5 truncate">{v}</div>
          </div>
        ))}
      </div>
      {posts.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-[#52525B]">No posts yet.</div>
      ) : posts.map(p => (
        <div key={p.id} className="grid grid-cols-[auto_1fr_auto] gap-3 py-2.5 border-b border-[#F4F4F5] last:border-b-0 items-center">
          <span className="font-mono text-[11.5px] font-bold bg-[#F4F4F5] px-2 py-1 rounded-[7px]">{p.code}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[#0A0A0A] truncate">{p.title || 'Post'}</div>
            <div className="text-[11.5px] text-[#52525B]">
              {p.creator_name}{p.state === 'live' ? ' · live' : p.goes_live_on ? ` · goes live ${fmtDay(p.goes_live_on)}` : p.state ? ` · ${p.state}` : ''}
            </div>
          </div>
          <div className="font-mono text-[11px] text-[#52525B] text-right leading-[1.5]">
            {p.social
              ? <>{fmtNum(p.social.views)} views · {fmtNum(p.social.likes)} likes · {fmtNum(p.social.comments)} comments</>
              : <>Social links not added yet</>}
            <br />in INFLX {fmtNum(p.inflx?.views || 0)} · {fmtNum(p.inflx?.likes || 0)} · {fmtNum(p.inflx?.comments || 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SetDrawer({ campaignId, set, detail, onClose }) {
  const [tab, setTab] = useState('creators');
  const showPosts = set && set.goal !== 'engagement';

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!set) return null;
  const d = detail; // { state: 'loading' | 'ok' | 'error' | 'gone', creators }
  const creatorsCount = d?.creators?.total ?? set.counts?.invited ?? 0;

  const metaBits = [
    aimWord(set.goal), modeWord(set.shootMode),
    set.branch?.name ? `${set.branch.name}${set.branch.cityName ? ', ' + set.branch.cityName : ''}` : null,
    set.postingDate ? `Posting ${fmtDay(set.postingDate)}` : 'no posting date',
    set.cutoff && !set.isPast ? `Invitations close ${fmtDay(set.cutoff)}` : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/35" onClick={onClose} />
      <div className="w-[460px] max-w-full bg-white border-l border-[#E4E4E7] h-full flex flex-col shadow-2xl">
        <div className="px-5 pt-4 pb-3 border-b border-[#E4E4E7]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-[17px] font-bold text-[#0A0A0A]">{set.name}</h3>
                <StateChip state={set.state} />
              </div>
              <div className="text-[12px] text-[#52525B] mt-1">{metaBits.join(' · ')}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="text-[#71717A] hover:text-[#0A0A0A] text-[18px] leading-none px-1">✕</button>
          </div>
        </div>
        <div className="flex border-b border-[#E4E4E7] px-5">
          <button type="button" onClick={() => setTab('creators')}
            className={`px-3 py-2.5 text-[12.5px] font-semibold border-b-2 -mb-px ${tab === 'creators' ? 'text-[#0A0A0A] border-[#0A0A0A]' : 'text-[#52525B] border-transparent'}`}>
            Creators · {creatorsCount}
          </button>
          {showPosts && (
            <button type="button" onClick={() => setTab('posts')}
              className={`px-3 py-2.5 text-[12.5px] font-semibold border-b-2 -mb-px ${tab === 'posts' ? 'text-[#0A0A0A] border-[#0A0A0A]' : 'text-[#52525B] border-transparent'}`}>
              Posts
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto px-5 py-3">
          {tab === 'creators' ? (
            !d || d.state === 'loading' ? <div className="py-10 text-center text-[13px] text-[#71717A]">Loading creators…</div>
            : d.state === 'gone' ? <div className="py-10 text-center text-[13px] text-[#52525B]">This set is gone.</div>
            : d.state === 'error' ? <div className="py-10 text-center text-[13px] text-[#52525B]">Not available right now.</div>
            : <Creators creators={d.creators} setName={set.name} />
          ) : (
            <Posts campaignId={campaignId} setId={set.id} />
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#E4E4E7] bg-[#FAFAFA] text-[12px] text-[#52525B]">
          Add creators, change terms, sign, plan the shoot or review content: <b className="text-[#0A0A0A]">INFLX brand app › Campaigns › {set.name}</b>
        </div>
      </div>
    </div>
  );
}
