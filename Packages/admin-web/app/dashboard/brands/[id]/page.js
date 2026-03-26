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

function StatusBadge({ status }) {
  const cfg = { approved: 'bg-teal-pale text-teal-deep', rejected: 'bg-red-pale text-red', pending: 'bg-gold-pale text-yellow-700', suspended: 'bg-surface2 text-t3' };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold border ${cfg[status] || ''}`}>{status}</span>;
}

export default function BrandProfilePage() {
  const { id } = useParams();
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const res = await adminApi.getBrandById(id);
      setLoading(false);
      if (res.success) setBrand(res.data?.brand || res.data);
      else setError(res.error?.message || 'Failed to load brand');
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-t3 text-sm">Loading...</div>;
  if (error) return <div className="p-4 bg-red-pale rounded-xl text-red text-sm">{error}</div>;
  if (!brand) return null;

  function fmtMoney(p) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((p || 0) / 100);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <a href="/dashboard/approvals" className="text-xs text-t3 hover:text-t2">← Approvals</a>
        <span className="text-t3">/</span>
        <span className="text-xs text-t2 font-medium">Brand Profile</span>
      </div>

      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-pale flex items-center justify-center text-sm font-bold text-navy font-display">
              {(brand.brand_name || brand.name || '').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-display text-base font-bold text-t1">{brand.brand_name || brand.name}</div>
              <div className="text-xs text-t3">{brand.phone}</div>
            </div>
          </div>
          <StatusBadge status={brand.status} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" value={brand.category} />
          <Field label="City" value={brand.city} />
          <Field label="GST Number" value={brand.gst_number} />
          <Field label="Platform Fee" value={brand.platform_fee_pct ? `${brand.platform_fee_pct}%` : '8% (default)'} />
          <Field label="Wallet Balance" value={fmtMoney(brand.wallet_balance)} />
          <Field label="Registered" value={brand.created_at ? new Date(brand.created_at).toLocaleDateString('en-IN') : '—'} />
        </div>

        {brand.rejection_reason && (
          <div className="mt-4 p-3 bg-red-pale border border-red/15 rounded-lg">
            <div className="text-xs font-bold text-red mb-1">Rejection Reason</div>
            <div className="text-xs text-t2">{brand.rejection_reason}</div>
          </div>
        )}
      </div>
    </div>
  );
}
