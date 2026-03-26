'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminApi } from '../../../../lib/api';

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-t2">{value || '—'}</div>
    </div>
  );
}

export default function InfluencerProfilePage() {
  const { id } = useParams();
  const [influencer, setInfluencer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const res = await adminApi.getInfluencerById(id);
      setLoading(false);
      if (res.success) setInfluencer(res.data?.influencer || res.data);
      else setError(res.error?.message || 'Failed to load influencer');
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-t3 text-sm">Loading...</div>;
  if (error) return <div className="p-4 bg-red-pale rounded-xl text-red text-sm">{error}</div>;
  if (!influencer) return null;

  const statCfg = [
    { label: 'Followers', value: (influencer.followers_count || 0).toLocaleString('en-IN') },
    { label: 'Eng. Rate', value: influencer.engagement_rate ? `${influencer.engagement_rate}%` : '—' },
    { label: 'Wallet', value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((influencer.wallet_balance || 0) / 100) },
    { label: 'Status', value: influencer.status },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <a href="/dashboard/approvals" className="text-xs text-t3 hover:text-t2">← Approvals</a>
      </div>

      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-orange-pale flex items-center justify-center text-sm font-bold text-orange-deep font-display">
            {(influencer.instagram_handle || '').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-display text-base font-bold text-t1">@{influencer.instagram_handle}</div>
            <div className="text-xs text-t3">{influencer.phone} · {influencer.city}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {statCfg.map(s => (
            <div key={s.label} className="bg-surface2 rounded-lg p-2.5 text-center">
              <div className="text-[9px] font-bold text-t3 uppercase tracking-wider mb-0.5">{s.label}</div>
              <div className="font-display text-sm font-bold text-t1">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Niche" value={(influencer.niche || []).join(', ')} />
          <Field label="Language" value={(influencer.language || []).join(', ')} />
          <Field label="Registered" value={influencer.created_at ? new Date(influencer.created_at).toLocaleDateString('en-IN') : '—'} />
          <Field label="Pending Balance" value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((influencer.pending_balance || 0) / 100)} />
        </div>
      </div>
    </div>
  );
}
