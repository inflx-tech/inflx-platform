'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

const MODE_LABEL = { visit: '🏬 Visit', shipment: '📦 Shipment', remote: '💻 Remote' };
const STATUS_PILL = {
  proposed:    'bg-amber-100 text-amber-800',
  confirmed:   'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ProductionQueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await adminApi.getProductionQueue();
    setLoading(false);
    if (res.success) setItems(res.data?.items || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-lg font-bold text-t1">Production Queue</h1>
          <p className="text-xs text-t3">Production events that need admin attention — stale, stuck, or rescheduled too many times.</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg">Refresh</button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-t3 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-border">
          <div className="text-4xl mb-2">🌴</div>
          <div className="font-bold text-t1 mb-1">All clear</div>
          <div className="text-xs text-t3">No production events flagged. Brands and influencers are coordinating fine on their own.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface2">
              <tr className="text-left text-[11px] text-t3 uppercase">
                <th className="px-3 py-2 font-semibold">Brand</th>
                <th className="px-3 py-2 font-semibold">Influencer</th>
                <th className="px-3 py-2 font-semibold">Mode</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Reasons</th>
                <th className="px-3 py-2 font-semibold">Last activity</th>
                <th className="px-3 py-2 font-semibold">Reschedules</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-t1">{i.brand_name}</div>
                    <div className="text-[10px] text-t3 truncate">{i.campaign_name}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-t1">{i.influencer_name}</div>
                    {i.influencer_handle && <div className="text-[10px] text-t3">@{i.influencer_handle}</div>}
                  </td>
                  <td className="px-3 py-3 text-xs text-t1">{MODE_LABEL[i.mode] || i.mode}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${STATUS_PILL[i.status] || 'bg-gray-100 text-gray-700'}`}>
                      {String(i.status || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <ul className="text-[11px] text-red-700 space-y-0.5">
                      {(i.reasons || []).map((r, k) => <li key={k}>· {r}</li>)}
                    </ul>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-t3">
                    {i.shipment_dispatched_at ? `Dispatched ${fmtDate(i.shipment_dispatched_at)}` :
                     i.visit_scheduled_at ? `Visit ${fmtDate(i.visit_scheduled_at)}` :
                     `Created ${fmtDate(i.created_at)}`}
                    {i.shipment_courier && <div className="text-[10px]">{i.shipment_courier} · {i.shipment_awb}</div>}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-t2">
                    Brand {i.reschedule_count_brand} / 2<br/>
                    Inf&nbsp;&nbsp;&nbsp;&nbsp;{i.reschedule_count_influencer} / 2
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
