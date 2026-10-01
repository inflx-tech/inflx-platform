'use client';
/**
 * Admin · Money · All movements (AM10) — every rupee that moved, for anyone, newest first, in
 * plain words. Search by a brand's or creator's name (or a reference in the note), narrow by kind,
 * and download what is shown.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 */
import { useEffect, useState } from 'react';
import { moneyApi } from '../../../../lib/api';
import { useLoad, inr, dayTime, Head, Tabs, Table, Who, Btn, LoadFailed, inputCls } from '../ui';

const GROUPS = [['all', 'All'], ['added', 'Added'], ['collaborations', 'Collaborations'], ['sales', 'Sales'], ['commission', 'Commission'], ['withdrawals', 'Withdrawals'], ['courier', 'Courier'], ['corrections', 'Corrections']];
const csvCell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

export default function MoneyMovementsPage() {
  const [group, setGroup] = useState('all');
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim()), 300); return () => clearTimeout(t); }, [typed]);
  const { data, loading, error, reload } = useLoad(() => moneyApi.movements(q, group), [q, group]);
  const list = data?.rows || [];

  function download() {
    const lines = [['When', 'Who', 'Brand or creator', 'What', 'Detail', 'Amount'].map(csvCell).join(',')];
    for (const m of list) {
      lines.push([dayTime(m.at), m.ownerName, m.ownerKind === 'brand' ? 'Brand' : 'Creator', m.label, m.note || '', `${m.sign === '−' ? '-' : m.sign === '+' ? '+' : ''}${m.amount}`].map(csvCell).join(','));
    }
    const url = URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `inflx-money-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const rows = list.map((m) => ({ key: `${m.ownerKind}-${m.id}`, cells: [
    dayTime(m.at), <Who key="w" name={m.ownerName} kind={m.ownerKind === 'brand' ? 'Brand' : 'Creator'} />,
    <div key="x"><b>{m.label}</b>{m.note ? <div className="text-[10.5px] text-t3">{m.note}</div> : null}</div>,
    <span key="a" className={m.sign === '+' ? 'text-teal-deep font-bold' : ''}>{m.sign ? `${m.sign} ` : ''}{inr(m.amount)}</span>,
  ] }));

  return (
    <div className="max-w-5xl">
      <Head title="All movements" sub="Everything that moved, newest first."
        right={<Btn kind="sec" onClick={download} disabled={!list.length}>Download this list</Btn>} />
      <input className={`${inputCls} mb-3`} placeholder="Brand, creator, or a reference" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <Tabs value={group} onChange={setGroup} options={GROUPS} />
      {error ? <LoadFailed onRetry={reload} what="the movements" /> : (
        <Table loading={loading} empty={q || group !== 'all' ? 'Nothing matches.' : 'Nothing has moved yet.'} heads={[['When'], ['Who'], ['What'], ['Amount', 1]]} rows={rows} />
      )}
      {data?.more ? <div className="text-[11px] text-t3 mt-2">Showing the newest {list.length}. Search a name or choose a kind to see older ones.</div> : null}
    </div>
  );
}
