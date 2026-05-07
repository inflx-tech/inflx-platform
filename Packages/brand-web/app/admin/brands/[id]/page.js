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
  const [feeInput, setFeeInput] = useState('');
  const [savingFee, setSavingFee] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function saveFee() {
    const pct = parseFloat(feeInput);
    if (isNaN(pct) || pct < 0 || pct > 50) { showToast('Enter a valid fee 0–50%'); return; }
    setSavingFee(true);
    const res = await adminApi.setBrandPlatformFee(id, pct);
    setSavingFee(false);
    if (res.success) {
      setBrand(prev => ({ ...prev, platform_fee_pct: res.data.platform_fee_pct }));
      setFeeInput('');
      showToast(`Platform fee updated to ${res.data.platform_fee_pct}%`);
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

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
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p || 0);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <a href="/admin/brands" className="text-xs text-t3 hover:text-t2">← Brands</a>
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

      {/* Per-brand platform fee override */}
      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <h3 className="font-display text-sm font-bold text-t1 mb-1">Override Platform Fee</h3>
        <p className="text-xs text-t3 mb-4">
          Current: <strong>{brand.platform_fee_pct ?? 8}%</strong> (global default is 8%).
          Override this brand's fee here.
        </p>
        <div className="flex gap-2">
          <div className="flex items-center border-2 border-border2 rounded-xl overflow-hidden flex-1">
            <input
              type="number"
              value={feeInput}
              onChange={e => setFeeInput(e.target.value)}
              placeholder={String(brand.platform_fee_pct ?? 8)}
              min="0"
              max="50"
              step="0.5"
              className="flex-1 px-3 py-2.5 text-sm outline-none"
            />
            <span className="px-3 py-2.5 bg-surface2 text-t3 text-sm font-bold border-l border-border2">%</span>
          </div>
          <button
            onClick={saveFee}
            disabled={savingFee || !feeInput}
            className="px-5 py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {savingFee ? 'Saving…' : 'Save Override'}
          </button>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>}
    </div>
  );
}
