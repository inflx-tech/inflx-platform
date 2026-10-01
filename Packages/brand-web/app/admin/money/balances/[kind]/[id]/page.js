'use client';
/**
 * Admin · Money · one person's money (AM6) — their figures, their history, their withdrawals,
 * their collaborations and their sales: what support needs when they call. Read only.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 */
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { moneyApi } from '../../../../../../lib/api';
import { useLoad, inr, dayMon, dayTime, Head, Tiles, Tile, Tabs, Table, Chip, LoadFailed } from '../../../ui';

const W_CHIP = { requested: ['wait', 'Waiting'], processed: ['ok', 'Processed'], could_not_process: ['no', 'Could not process'] };
const SALE_STATE = (s) => (s.state === 'cancelled' ? ['ended', 'Cancelled'] : s.state === 'added' ? ['ok', `Added ${dayMon(s.at)}`]
  : s.state === 'cod_waiting' ? ['wait', 'Cash · not delivered yet'] : s.state === 'not_shipped' ? ['move', 'Not shipped yet'] : ['wait', `Window until ${dayMon(s.windowUntil)}`]);

export default function MoneyPersonPage() {
  const { kind, id } = useParams();
  const [tab, setTab] = useState('history');
  const { data: p, loading, error, reload } = useLoad(() => moneyApi.person(kind, id, tab), [kind, id, tab]);
  const brand = kind === 'brand';

  const back = <Link href={`/admin/money/balances${brand ? '' : '?kind=creators'}`} className="text-xs font-bold text-t2 underline">‹ Balances</Link>;
  if (error) return <div className="max-w-5xl">{back}<div className="mt-3"><LoadFailed onRetry={reload} what="this person's money" /></div></div>;
  if (!p) return <div className="max-w-5xl">{back}<div className="p-8 text-center text-t3 text-sm">Loading…</div></div>;

  const f = p.figures;
  const sub = [brand ? 'Brand' : 'Creator', p.city, brand ? (p.hasBank ? 'bank account added' : 'no bank account') : [p.hasUpi ? 'UPI added' : null, p.hasBank ? 'bank added' : null].filter(Boolean).join(' · ') || 'no payment details',
    p.joinedAt ? `joined ${dayMon(p.joinedAt)}` : null].filter(Boolean).join(' · ');

  let table = null;
  if (tab === 'history') {
    table = <Table loading={loading} heads={[['When'], ['What'], ['Amount', 1], ['Available after', 1]]} empty="Nothing has moved yet."
      rows={(p.history || []).map((r) => ({ key: r.id, cells: [dayTime(r.at), <div key="w"><b>{r.label}</b>{r.sub ? <div className="text-[10.5px] text-t3">{r.sub}</div> : null}</div>,
        <span key="a" className={r.moneyIn ? 'text-teal-deep font-bold' : ''}>{r.sign ? `${r.sign} ` : ''}{inr(r.amount)}</span>, r.availableAfter == null ? '—' : inr(r.availableAfter)] }))} />;
  } else if (tab === 'withdrawals') {
    table = <Table loading={loading} heads={[['Requested'], ['Amount', 1], ['Send to'], ['State'], ['']]} empty="No withdrawals yet."
      rows={(p.withdrawals || []).map((w) => { const [tone, word] = W_CHIP[w.status] || W_CHIP.requested; return { key: w.id, cells: [dayTime(w.requestedAt), <b key="a">{inr(w.amount)}</b>, w.sendTo, <Chip key="c" tone={tone}>{word}</Chip>,
        w.status === 'processed' ? `Paid ${dayMon(w.paidOn || w.processedAt)} · ref ${w.reference}` : w.status === 'could_not_process' ? w.reason : `within ${w.processHours} hours`] }; })} />;
  } else if (tab === 'collaborations') {
    const list = brand ? [...(p.collaborations?.collaborations || []), ...(p.collaborations?.paidInFull || [])] : (p.collaborations?.collaborations || []);
    table = <Table loading={loading} heads={[['Collaboration'], ['Aim'], ['Amount', 1], ['Paid', 1], ['Locked', 1]]} empty="No Pay for Content or Hybrid collaborations."
      rows={list.map((c) => ({ key: c.ciId, cells: [<div key="n"><b>{brand ? c.creatorName : c.brandName}</b><div className="text-[10.5px] text-t3">{[c.campaignName, c.setName].filter(Boolean).join(' · ')}</div></div>, c.aimLabel, inr(c.amount), inr(c.paid), inr(c.locked)] }))} />;
  } else {
    const list = p.sales?.sales || [];
    table = <Table loading={loading} heads={brand ? [['Item'], ['Paid', 1], ['Brand', 1], ['Creator', 1], ['INFLX', 1], ['State']] : [['Item'], ['Commission', 1], ['State']]} empty="No sales yet."
      rows={list.map((s) => { const [tone, word] = SALE_STATE(s); const item = <div key="i"><b>{s.item}</b><div className="text-[10.5px] text-t3">{dayMon(s.soldAt)} · post {s.post?.code}</div></div>;
        return { key: s.id, cells: brand ? [item, inr(s.paid), inr(s.brandShare), inr(s.creatorShare), inr(s.inflxShare), <Chip key="c" tone={tone}>{word}</Chip>] : [item, inr(s.commission), <Chip key="c" tone={tone}>{word}</Chip>] }; })} />;
  }

  return (
    <div className="max-w-5xl">
      {back}
      <div className="mt-2"><Head title={p.name || '—'} sub={sub} /></div>
      {brand ? (
        <Tiles>
          <Tile label="Available" value={inr(f.available)} />
          <Tile label="On hold" value={inr(f.onHold)} note={f.onHold > 0 ? 'a withdrawal is waiting' : null} />
          <Tile label="Locked in collaborations" value={inr(f.locked)} note={`${f.lockedCount} collaboration${f.lockedCount === 1 ? '' : 's'}`} />
          <Tile label="Sales coming" value={inr(f.salesComing)} note={`${f.salesComingCount} sale${f.salesComingCount === 1 ? '' : 's'}`} />
        </Tiles>
      ) : (
        <Tiles>
          <Tile label="Available" value={inr(f.available)} />
          <Tile label="On hold" value={inr(f.onHold)} note={f.onHold > 0 ? 'a withdrawal is waiting' : null} />
          <Tile label="Collaboration payments to come" value={inr(f.payments)} note={`${f.paymentsCount} collaboration${f.paymentsCount === 1 ? '' : 's'}`} />
          <Tile label="Commission in return window" value={inr(f.commission)} note={`${f.commissionCount} sale${f.commissionCount === 1 ? '' : 's'}`} />
        </Tiles>
      )}
      <Tabs value={tab} onChange={setTab} options={[['history', 'History'], ['withdrawals', 'Withdrawals'], ['collaborations', 'Collaborations'], ['sales', 'Sales']]} />
      {table}
    </div>
  );
}
