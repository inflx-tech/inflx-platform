'use client';

import { useEffect, useState } from 'react';
import { referralApi } from '../../../../lib/api';

const SOURCE_FILTERS = [
  { key: '', label: 'All sources', kind: 'source' },
  { key: 'subscription', label: 'Subscription', kind: 'source' },
  { key: 'protection_fee', label: 'Protection fee', kind: 'source' },
  { key: 'commission', label: 'Commission', kind: 'source' },
  { key: 'paid', label: 'Paid', kind: 'payout' },
  { key: 'pending', label: 'Pending', kind: 'payout' },
];

const SOURCE_TAG = {
  subscription: 'bg-sky-100 text-sky-800',
  protection_fee: 'bg-green-100 text-green-800',
  commission: 'bg-amber-100 text-amber-800',
};
const SOURCE_LABEL = { subscription: 'subscription', protection_fee: 'protection fee', commission: 'commission' };
const TYPE_TAG = { agency: 'bg-violet-100 text-violet-700', influencer: 'bg-teal-pale text-teal-deep', brand: 'bg-gold-pale text-yellow-700' };

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

export default function ReferralEarningsPage() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('');

  async function load(filter) {
    setLoading(true);
    const params = {};
    const f = SOURCE_FILTERS.find(x => x.key === filter);
    if (f && f.key) { if (f.kind === 'source') params.source = f.key; else params.payout_status = f.key; }
    const [s, l] = await Promise.all([referralApi.getSummary(), referralApi.listLedger(params)]);
    setLoading(false);
    if (s.success) setSummary(s.data);
    if (l.success) setRows(l.data);
  }
  useEffect(() => { load(active); /* eslint-disable-next-line */ }, [active]);

  const totals = summary?.totals || { earned: 0, paid: 0, pending: 0, rows: 0 };

  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">💰 Referral Earnings</h1>
        <p className="text-xs text-t3">Read-only audit of every accrued referral rupee. The engine writes these on confirmed revenue only.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat k="Total accrued" v={inr(totals.earned)} />
        <Stat k="Paid (influencer wallets)" v={inr(totals.paid)} cls="text-teal-deep" />
        <Stat k="Pending (agency — awaits C3)" v={inr(totals.pending)} cls="text-orange" />
      </div>

      <div className="bg-white rounded-xl border border-border p-4 overflow-x-auto">
        <div className="flex gap-2 mb-3 flex-wrap">
          {SOURCE_FILTERS.map(f => (
            <button key={f.label} onClick={() => setActive(f.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${active === f.key ? 'bg-navy-deep text-white border-navy-deep' : 'bg-white text-t2 border-border'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-t3 text-sm p-6 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center text-t3">
            <div className="text-3xl">💸</div>
            <div className="mt-1.5 font-semibold text-t2">No referral earnings yet</div>
            <div className="text-[11px] mt-0.5">Accruals appear here once referred entities generate confirmed revenue.</div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-t3 bg-surface2">
                <th className="text-left p-2">Date</th><th className="text-left p-2">Referrer</th><th className="text-left p-2">Referred</th>
                <th className="text-left p-2">Source</th><th className="text-right p-2">Base</th><th className="text-right p-2">%</th>
                <th className="text-right p-2">Amount</th><th className="text-left p-2">Payout</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-surface2/50 text-xs">
                  <td className="p-2">{fmtDate(r.created_at)}</td>
                  <td className="p-2 font-bold">{r.referrer_name}<span className={`ml-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${TYPE_TAG[r.referrer_type]}`}>{r.referrer_type}</span></td>
                  <td className="p-2">{r.referred_name}</td>
                  <td className="p-2"><span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${SOURCE_TAG[r.source]}`}>{SOURCE_LABEL[r.source]}</span></td>
                  <td className="p-2 text-right tabular-nums">{inr(r.base_amount)}</td>
                  <td className="p-2 text-right tabular-nums">{Number(r.pct).toFixed(2)}</td>
                  <td className="p-2 text-right font-extrabold tabular-nums">{inr(r.amount)}</td>
                  <td className="p-2">
                    {r.payout_status === 'paid'
                      ? <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-deep text-white">paid</span>
                      : <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-orange text-orange">pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length > 0 && (
          <p className="text-[11px] text-t2 mt-2.5">Influencer-referrer rows are auto-credited to their wallet by the engine (paid). Agency rows stay <b>pending</b> until Contract 3 adds the agency wallet + settlement.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ k, v, cls = 'text-t1' }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3">{k}</div>
      <div className={`text-xl font-extrabold mt-1 tabular-nums ${cls}`}>{v}</div>
    </div>
  );
}
