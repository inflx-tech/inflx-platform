'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { marketingApi } from '../../../../lib/api';

export default function MarketingInboxPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await marketingApi.getInbox();
      setLoading(false);
      if (res.success) setItems(res.data || []);
    })();
  }, []);

  const overdue = items.filter(i => i.next_action_due && new Date(i.next_action_due) < new Date());
  const today   = items.filter(i => i.next_action_due && new Date(i.next_action_due) >= new Date());

  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">📥 Inbox — Today's Follow-ups</h1>
        <p className="text-xs text-t3">Activities with a next-action due ≤ 24h from now. Acted ones drop off the list.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Pending" value={items.length} />
        <Stat label="Overdue" value={overdue.length} highlight={overdue.length > 0 ? 'red' : 'teal'} />
        <Stat label="Due Today" value={today.length} highlight="orange" />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-t3 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-sm font-semibold text-t1">Inbox zero</div>
          <div className="text-xs text-t3 mt-1">No follow-ups due. Go to <Link href="/admin/marketing/leads" className="text-orange font-semibold">Triage</Link> for the next move.</div>
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <div className="bg-white rounded-xl border border-red/30 overflow-hidden">
              <div className="bg-red/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red">⚠ Overdue ({overdue.length})</div>
              <List items={overdue} />
            </div>
          )}
          {today.length > 0 && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="bg-gold-pale px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-700">Due Today ({today.length})</div>
              <List items={today} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  const colors = { red: 'text-red', orange: 'text-orange', teal: 'text-teal-deep' };
  return (
    <div className="bg-white rounded-xl border border-border p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colors[highlight] || 'text-t1'}`}>{value}</div>
    </div>
  );
}

function List({ items }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-surface2 text-t3">
        <tr>
          <th className="text-left px-3 py-2 font-bold">Lead</th>
          <th className="text-left px-3 py-2 font-bold">Channel</th>
          <th className="text-left px-3 py-2 font-bold">Next Action</th>
          <th className="text-left px-3 py-2 font-bold">Due</th>
          <th className="text-left px-3 py-2 font-bold">Current Status</th>
          <th className="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {items.map(a => (
          <tr key={a.id} className="border-t border-border hover:bg-surface2/50">
            <td className="px-3 py-2">
              <div className="font-mono text-[11px]">@{a.ig_handle}</div>
              <div className="text-[10px] text-t3">{a.target_name || ''} {a.target_city ? `· ${a.target_city}` : ''}</div>
            </td>
            <td className="px-3 py-2 text-t2">{a.channel}</td>
            <td className="px-3 py-2 text-t2">{a.next_action || '—'}</td>
            <td className="px-3 py-2 text-t3 text-[10px]">{a.next_action_due ? new Date(a.next_action_due).toLocaleString() : '—'}</td>
            <td className="px-3 py-2 text-t2">{a.current_status}</td>
            <td className="px-3 py-2 text-right">
              <Link href={`/admin/marketing/leads/${a.target_type}/${a.target_id}`}
                className="text-orange font-semibold text-[11px] hover:underline">Open →</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
