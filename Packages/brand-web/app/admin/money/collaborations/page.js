'use client';
/**
 * Admin · Money · Collaboration money (AM8) — what is locked, collaboration by collaboration, and
 * what falls due. Replaces the old Escrow page. Final payments carry their date; the ones waiting
 * on a brand's confirmation say so, and for how long she has been posted. The campaign fee is
 * INFLX's from the lock and is shown as earned. Read only — the by-hand tools are in
 * Disputes & corrections.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 */
import { useEffect, useState } from 'react';
import { moneyApi } from '../../../../lib/api';
import { useLoad, inr, dayMon, Head, Tiles, Tile, Tabs, Table, LoadFailed } from '../ui';

const PAY = { 1: 'First 25%', 2: 'Second 25%', 3: 'Final 50%' };
function next(c) {
  if (!c.next) return c.refunded > 0 ? 'Locked money was returned to the brand' : 'Paid in full';
  const n = c.next;
  if (n.dueAt) return <span>{PAY[n.n]} · <b>{dayMon(n.dueAt)}</b></span>;
  if (n.kind === 'confirm_live') {
    if (c.postedAt) {
      const days = Math.max(0, Math.floor((Date.now() - new Date(c.postedAt).getTime()) / 86400000));
      return `${PAY[n.n]} · she posted ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`} · waiting for the brand to confirm`;
    }
    return `${PAY[n.n]} · waits for the brand to confirm it's live`;
  }
  return `${PAY[n.n]} · after it is confirmed live`;
}

export default function MoneyCollaborationsPage() {
  const [tab, setTab] = useState('locked');
  useEffect(() => {
    const t = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    if (['locked', 'due', 'waiting', 'paid'].includes(t)) setTab(t);
  }, []);
  const { data, loading, error, reload } = useLoad(() => moneyApi.collaborations(tab), [tab]);
  const t = data?.totals;

  const rows = (data?.rows || []).map((c) => ({ key: c.ciId, cells: [
    <div key="n"><b>{c.brandName} → {c.creatorName}</b><div className="text-[10.5px] text-t3">{[c.campaignName, c.setName].filter(Boolean).join(' · ')}</div></div>,
    c.aimLabel, inr(c.amount), inr(c.paid), inr(c.locked), <div key="x" className="max-w-xs">{next(c)}</div>,
  ] }));

  return (
    <div className="max-w-6xl">
      <Head title="Collaboration money" sub="Pay for Content and Hybrid" />
      {t ? (
        <Tiles>
          <Tile label="Locked now" value={inr(t.lockedNow)} note={`${t.lockedCount} collaboration${t.lockedCount === 1 ? '' : 's'}`} />
          <Tile label="Paid to creators" value={inr(t.paidToCreators)} />
          <Tile label="Final payments due · 7 days" value={inr(t.due7Days)} note={`${t.due7DaysCount} payment${t.due7DaysCount === 1 ? '' : 's'}`} />
          <Tile label="Campaign fees earned" value={inr(t.campaignFeesThisMonth)} note="this month" />
        </Tiles>
      ) : null}
      <Tabs value={tab} onChange={setTab} options={[['locked', 'Locked'], ['due', 'Due soon'], ['waiting', 'Waiting on a brand'], ['paid', 'Paid in full']]} />
      {error ? <LoadFailed onRetry={reload} what="the collaboration money" /> : (
        <Table loading={loading} empty="Nothing here."
          heads={[['Collaboration'], ['Aim'], ['Amount', 1], ['Paid', 1], ['Locked', 1], ['Next']]} rows={rows} />
      )}
    </div>
  );
}
