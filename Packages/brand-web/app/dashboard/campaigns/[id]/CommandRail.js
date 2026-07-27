import Link from 'next/link';

/* Campaign Command Center — stage rail + primary action bar.
   Contract features/brand-cc-shell (A1). The seed of the brand-web IG-clean kit;
   reused by A2–A5 as review/contracts/sets/escrow/production fold into the stages. */

const STAGES = [
  { key: 'fund',       label: 'Fund & Publish' },
  { key: 'roster',     label: 'Roster' },
  { key: 'contracts',  label: 'Contracts' },
  { key: 'production', label: 'Production' },
  { key: 'review',     label: 'Review' },
  { key: 'payout',     label: 'Payout' },
];

const idxOf = (k) => STAGES.findIndex((s) => s.key === k);

/** Pure: campaign status + derived counts → { stageKey, prime:{label,kind,...} }. */
export function deriveCampaignStage(status, c = {}) {
  const { appliedCount = 0, pendingCount = 0, reviewQueue = 0, liveConfirmQueue = 0, id } = c;

  if (status === 'draft' || status === 'pending_wallet') {
    return { stageKey: 'fund', prime: { label: 'Fund wallet & publish', kind: 'publish' } };
  }
  if (status === 'completed') {
    return { stageKey: 'payout', prime: { label: 'View payouts', kind: 'href', href: `/dashboard/campaigns/${id}/escrow` } };
  }
  if (pendingCount > 0) {
    return { stageKey: 'contracts', prime: { label: `Sign ${pendingCount} contract${pendingCount !== 1 ? 's' : ''}`, kind: 'tab', tab: 'contracts' } };
  }
  if (appliedCount > 0) {
    return { stageKey: 'roster', prime: { label: `Review ${appliedCount} application${appliedCount !== 1 ? 's' : ''}`, kind: 'href', href: `/dashboard/campaigns/${id}/influencers?status=applied` } };
  }
  if (reviewQueue > 0) {
    return { stageKey: 'review', prime: { label: `Review ${reviewQueue} deliverable${reviewQueue !== 1 ? 's' : ''}`, kind: 'tab', tab: 'hier' } };
  }
  if (liveConfirmQueue > 0) {
    return { stageKey: 'review', prime: { label: `Confirm ${liveConfirmQueue} live URL${liveConfirmQueue !== 1 ? 's' : ''}`, kind: 'tab', tab: 'hier' } };
  }
  const base = status === 'published' ? 'roster' : status === 'live' ? 'review' : 'production';
  return { stageKey: base, prime: { label: 'All caught up', kind: 'none' } };
}

export function StageRail({ current }) {
  const ci = idxOf(current);
  return (
    <div className="flex items-stretch gap-1 bg-white border border-[#E4E4E7] rounded-[12px] p-1.5 mb-3 overflow-x-auto">
      {STAGES.map((s, i) => {
        const done = ci >= 0 && i < ci;
        const cur = i === ci;
        return (
          <div key={s.key} className={`flex-1 min-w-[104px] text-center rounded-[8px] px-2 py-2 ${cur ? 'bg-[#0A0A0A]' : ''}`}>
            <div className={`text-[11px] font-bold ${cur ? 'text-white' : done ? 'text-[#0A0A0A]' : 'text-[#A1A1AA]'}`}>{s.label}</div>
            <div className={`text-[9px] mt-0.5 font-bold ${cur ? 'text-[#FFC107]' : done ? 'text-[#047857]' : 'text-[#A1A1AA]'}`}>
              {done ? '✓ done' : cur ? 'now' : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PrimeBar({ prime, onPublish, onTab }) {
  const { label, kind, href, tab } = prime || {};
  const btn = 'bg-[#FFC107] text-[#0A0A0A] rounded-[8px] px-4 py-2 text-[12px] font-extrabold no-underline hover:opacity-90 whitespace-nowrap';
  return (
    <div className="flex items-center gap-3 flex-wrap bg-[#0A0A0A] rounded-[12px] px-4 py-3 mb-4">
      <span className="text-[13px] font-bold text-white flex-1 min-w-[160px]">
        {kind === 'none' ? "You're all caught up" : 'Next step for this campaign'}
      </span>
      {kind === 'publish' && <button type="button" onClick={onPublish} className={btn}>{label} →</button>}
      {kind === 'href' && <Link href={href} className={btn}>{label} →</Link>}
      {kind === 'tab' && <button type="button" onClick={() => onTab && onTab(tab)} className={btn}>{label} →</button>}
      {kind === 'none' && <span className="text-[12px] text-[rgba(255,255,255,0.6)]">Nothing needs you right now.</span>}
    </div>
  );
}
