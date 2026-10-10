'use client';
/**
 * Admin · Money · Sales (AM7) — every item sold and its three shares, and whether they are still
 * inside the return window or have been added to the wallets. The three shares always add up to
 * what the shopper paid. Cash on delivery counts once delivered. Read only.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 */
import { useState } from 'react';
import { moneyApi } from '../../../../lib/api';
import { useLoad, inr, dayMon, Head, Tiles, Tile, Tabs, Table, Chip, LoadFailed } from '../ui';

const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
function state(s) {
  if (s.state === 'cancelled') return ['ended', 'Cancelled'];
  if (s.state === 'returned') return ['ended', 'Returned'];
  if (s.state === 'added') return ['ok', `Added ${dayMon(s.at)}`];
  if (s.state === 'cod_waiting') return ['wait', 'Cash on delivery · not delivered yet'];
  if (s.state === 'not_shipped') return ['move', 'Not shipped yet'];
  if (s.state === 'waiting_delivery') return ['wait', 'On its way · not delivered yet'];
  // The return window runs from the delivery for every order (cash or online).
  return ['wait', `Delivered ${dayMon(s.deliveredAt)} · until ${dayMon(s.windowUntil)}`];
}

export default function MoneySalesPage() {
  const [filter, setFilter] = useState('all');
  const { data, loading, error, reload } = useLoad(() => moneyApi.sales(filter), [filter]);
  const m = data?.month;
  const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const rows = (data?.sales || []).map((s) => {
    const [tone, word] = state(s);
    const gone = s.state === 'cancelled';
    return { key: s.id, cells: [
      <div key="i"><b>{s.item}</b><div className="text-[10.5px] text-t3">{dayMon(s.soldAt)} · {s.cashOnDelivery ? 'cash on delivery' : 'paid online'}</div></div>,
      <div key="b">{s.brandName}<div className="text-[10.5px] text-t3">{first(s.creatorName)} · {s.post?.code}{s.ownBrand ? ' · own post' : ''}</div></div>,
      inr(s.paid), gone ? '—' : inr(s.brandShare), gone ? '—' : inr(s.creatorShare), gone ? '—' : inr(s.inflxShare),
      <Chip key="c" tone={tone}>{word}</Chip>,
    ] };
  });

  return (
    <div className="max-w-6xl">
      <Head title="Sales" sub={month} />
      {m ? (
        <Tiles>
          <Tile label="Shoppers paid" value={inr(m.shoppersPaid)} note={`${m.items} item${m.items === 1 ? '' : 's'}`} />
          <Tile label="To brands" value={inr(m.toBrands)} />
          <Tile label="To creators" value={inr(m.toCreators)} />
          <Tile label="To INFLX" value={inr(m.toInflx)} />
        </Tiles>
      ) : null}
      <Tabs value={filter} onChange={setFilter} options={[['all', 'All'], ['coming', 'Not added yet'], ['added', 'Added to wallets'], ['cancelled', 'Cancelled'], ['cod', 'Cash on delivery']]} />
      {error ? <LoadFailed onRetry={reload} what="the sales" /> : (
        <Table loading={loading} empty={filter === 'all' ? 'No sales yet.' : 'No sales match this filter.'}
          heads={[['Item'], ['Brand · creator'], ['Paid', 1], ['Brand', 1], ['Creator', 1], ['INFLX', 1], ['State']]} rows={rows} />
      )}
    </div>
  );
}
