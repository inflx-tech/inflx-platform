'use client';
/**
 * Admin · Money · Overview (AM1) — where every rupee is, on one page.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * "INFLX is holding" is the sum of the parts under it, always: what brands and creators can use
 * now, what is locked in collaborations, the sales still in their return window, and what is on
 * hold for withdrawals. INFLX's own earnings are its money and are shown apart.
 */
import Link from 'next/link';
import { moneyApi } from '../../../lib/api';
import { useLoad, inr, Head, Tiles, Tile, LoadFailed, TestModeBanner } from './ui';

const PARTS = [
  ['brandAvailable', 'Brand wallets, available', '#1D5FBF'],
  ['creatorAvailable', 'Creator wallets, available', '#0E7490'],
  ['lockedInCollaborations', 'Locked in collaborations', '#6A3FC6'],
  ['salesInReturnWindow', 'Sales not added yet', '#1A7A3D'],
  ['onHoldForWithdrawals', 'On hold for withdrawals', '#B04600'],
];

function LinkTile({ href, ...p }) {
  return <Link href={href} className="block hover:opacity-90"><Tile {...p} /></Link>;
}

export default function MoneyOverviewPage() {
  const { data: o, loading, error, reload } = useLoad(() => moneyApi.overview());
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (error) return <div className="max-w-5xl"><Head title="Money" sub={today} /><LoadFailed onRetry={reload} what="the money overview" /></div>;
  if (loading || !o) return <div className="max-w-5xl"><Head title="Money" sub={today} /><div className="p-8 text-center text-t3 text-sm">Loading…</div></div>;

  const w = o.withdrawalsWaiting;
  const attention = [
    w.count ? `${w.count} withdrawal${w.count > 1 ? 's are' : ' is'} waiting${w.oldestHours != null ? ` · the oldest for ${w.oldestHours} hour${w.oldestHours === 1 ? '' : 's'}` : ''}` : null,
    o.moneyAdded.notCredited ? `${o.moneyAdded.notCredited} add-money payment${o.moneyAdded.notCredited > 1 ? 's were' : ' was'} started and not finished` : null,
  ].filter(Boolean);
  const total = o.holding || 0;

  return (
    <div className="max-w-5xl">
      <Head title="Money" sub={today} />
      <TestModeBanner show={o.testMode} />

      {attention.length ? (
        <div className="border-l-4 border-orange bg-orange-pale text-orange-deep rounded-r-lg px-3 py-2 text-xs font-semibold mb-4">{attention.join(' · ')}</div>
      ) : null}

      <Tiles>
        <Tile dark label="INFLX is holding" value={inr(o.holding)} note="for brands and creators" />
        <LinkTile href="/admin/money/withdrawals" label="Withdrawals waiting" value={inr(w.amount)} note={`${w.count} request${w.count === 1 ? '' : 's'}`} />
        <Tile label="INFLX earned · this month" value={inr(o.earnings.thisMonth)}
          note={`campaign fees ${inr(o.earnings.campaignFeesThisMonth)} · sales ${inr(o.earnings.salesFeesThisMonth)}`} />
        <Tile label="Earnings on sales not added yet" value={inr(o.earnings.inReturnWindow)} note="earned after delivery, as return windows close" />
      </Tiles>

      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <div className="text-sm font-bold text-t1 mb-2">What INFLX is holding · {inr(o.holding)}</div>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-surface2 mb-3">
          {PARTS.map(([k, , c]) => (total > 0 && o.parts[k] > 0 ? <i key={k} style={{ width: `${(o.parts[k] / total) * 100}%`, background: c }} /> : null))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-t2">
          {PARTS.map(([k, l, c]) => (
            <span key={k}><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ background: c }} />{l} <b className="text-t1">{inr(o.parts[k])}</b></span>
          ))}
        </div>
      </div>

      <Tiles>
        <LinkTile href="/admin/money/balances" label="Owed to brands" value={inr(o.owedToBrands)} note="available + on hold + sales coming" />
        <LinkTile href="/admin/money/balances?kind=creators" label="Owed to creators" value={inr(o.owedToCreators)} note="available + on hold + still to come" />
        <LinkTile href="/admin/money/collaborations?tab=due" label="Payments falling due · 7 days" value={inr(o.paymentsDue7Days.amount)}
          note={`${o.paymentsDue7Days.count} final payment${o.paymentsDue7Days.count === 1 ? '' : 's'}`} />
        <LinkTile href="/admin/money/added" label="Money added · today" value={inr(o.moneyAdded.today)}
          note={`${o.moneyAdded.todayCount} payment${o.moneyAdded.todayCount === 1 ? '' : 's'} · ${inr(o.moneyAdded.thisMonth)} this month`} />
      </Tiles>
    </div>
  );
}
