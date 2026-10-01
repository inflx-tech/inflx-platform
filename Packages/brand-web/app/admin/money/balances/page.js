'use client';
/**
 * Admin · Money · Balances (AM5) — what INFLX owes each brand and creator, in the same figures
 * the person sees in their own Wallet. A row opens that person's whole money picture (AM6).
 * Contract: features/item17-wallet · master rules v1.31 §17A
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { moneyApi } from '../../../../lib/api';
import { useLoad, inr, dash, Head, Tabs, Table, LoadFailed, inputCls } from '../ui';

export default function MoneyBalancesPage() {
  const router = useRouter();
  const [kind, setKind] = useState('brands');
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  // The overview's "Owed to creators" tile opens this page on its Creators tab.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('kind') === 'creators') setKind('creators');
  }, []);
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim()), 300); return () => clearTimeout(t); }, [typed]);
  const { data, loading, error, reload } = useLoad(() => moneyApi.balances(kind, q), [kind, q]);

  const list = data?.rows || [];
  const brand = kind === 'brands';
  const heads = brand
    ? [['Brand'], ['Available', 1], ['On hold', 1], ['Locked in collaborations', 1], ['Sales coming', 1], ['Total held', 1]]
    : [['Creator'], ['Available', 1], ['On hold', 1], ['Collaboration payments', 1], ['Commission coming', 1], ['Total held', 1]];
  const rows = list.map((x) => ({
    key: x.id, id: x.id,
    cells: [<b key="n">{x.name || '—'}</b>, inr(x.available), dash(x.onHold), dash(brand ? x.locked : x.payments), dash(brand ? x.salesComing : x.commission), <b key="t">{inr(x.total)}</b>],
  }));

  return (
    <div className="max-w-5xl">
      <Head title="Balances" sub="Brands and creators with money in INFLX." />
      <div className="flex flex-wrap items-start gap-3">
        <Tabs value={kind} onChange={setKind} options={[['brands', `Brands${brand && data ? ` · ${list.length}` : ''}`], ['creators', `Creators${!brand && data ? ` · ${list.length}` : ''}`]]} />
        <input className={`${inputCls} flex-1 min-w-[180px] mb-3`} placeholder="Search a name" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      {error ? <LoadFailed onRetry={reload} what="the balances" /> : (
        <Table heads={heads} rows={rows} loading={loading} empty={q ? 'No one by that name.' : 'No one is holding money in INFLX yet.'}
          onRow={(r) => router.push(`/admin/money/balances/${brand ? 'brand' : 'creator'}/${r.id}`)} />
      )}
    </div>
  );
}
