'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { brandApi, fmtMoney } from '../../../../../lib/api';

export default function EscrowDetailPage() {
  const { id } = useParams();
  const [escrow, setEscrow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    brandApi.getEscrow().then(res => {
      setLoading(false);
      if (res.success) {
        const entries = res.data?.escrow_entries || res.data || [];
        const filtered = entries.filter(e => e.campaign_id === id);
        setEscrow(filtered);
      }
    });
  }, [id]);

  const statusColor = { queued: 'text-gold', locked: 'text-navy', released: 'text-teal' };
  const statusIcon = { queued: '⏳', locked: '🔒', released: '✓' };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4 text-xs">
        <a href={`/dashboard/campaigns/${id}`} className="text-t3 hover:text-t2">← Campaign</a>
        <span className="text-t3">/</span>
        <span className="text-t2 font-medium">Escrow</span>
      </div>
      <h1 className="font-display text-xl font-bold text-t1 mb-4">Escrow Breakdown</h1>
      {loading ? (
        <div className="text-center py-12 text-t3 text-sm">Loading...</div>
      ) : !escrow || escrow.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-t3 text-sm">No escrow entries for this campaign</div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {escrow.map(entry => (
            <div key={entry.id} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
              <div className={`text-lg ${statusColor[entry.status]}`}>{statusIcon[entry.status]}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-t1">T{entry.tranche_number} — {entry.trigger_event?.replace(/_/g,' ')}</div>
                <div className="text-xs text-t3">
                  {entry.instagram_handle ? `@${entry.instagram_handle}` : entry.influencer_name}
                  {entry.released_at && ` · Released ${new Date(entry.released_at).toLocaleDateString('en-IN')}`}
                </div>
              </div>
              <div className="font-display font-bold text-t1">{fmtMoney(entry.amount)}</div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${entry.status === 'released' ? 'bg-teal-pale text-teal-deep' : entry.status === 'locked' ? 'bg-navy-pale text-navy' : 'bg-gold-pale text-yellow-700'}`}>{entry.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
