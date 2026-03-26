'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../../lib/api';

export default function PaymentConfigPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    adminApi.getStats().then(res => { if (res.success) setStats(res.data); });
  }, []);

  const config = [
    { label: 'Default Platform Fee', value: '8%', note: 'Charged to brand on top of influencer fee' },
    { label: 'Tranche 1', value: '25%', note: 'Released on contract signature (both parties)' },
    { label: 'Tranche 2', value: '25%', note: 'Released when brand confirms content live' },
    { label: 'Tranche 3', value: '50%', note: 'Auto-released 30 days after T2 trigger' },
    { label: 'Minimum Withdrawal', value: '₹100', note: 'Statutory minimum per payment' },
    { label: 'TDS on Withdrawal', value: '10%', note: 'Statutory — deducted at withdrawal time' },
    { label: 'Commission Return Window', value: '30 days', note: 'Commissions held before confirming to wallet' },
    { label: 'Offer Expiry', value: '48 hours', note: 'Offers auto-expire if not accepted within 48h' },
  ];

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-t1">Payment Configuration</h1>
        <p className="text-xs text-t3 mt-0.5">Platform financial settings</p>
      </div>

      <div className="bg-orange-pale border border-orange/20 rounded-xl p-4 mb-4 text-xs text-orange-deep">
        ⚠️ These values are configured in the INFLX Master Spec and are locked for Phase 6. Contact the technical team to update any parameter.
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {config.map((item, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
            <div>
              <div className="text-sm font-semibold text-t1">{item.label}</div>
              <div className="text-[10px] text-t3 mt-0.5">{item.note}</div>
            </div>
            <div className="font-display text-base font-bold text-navy bg-navy-pale px-3 py-1 rounded-lg">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
