'use client';

import { useEffect, useState } from 'react';
import { referralApi, getStoredUser } from '../../../../lib/api';

export default function ReferralSettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [err, setErr] = useState('');

  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const isSuper = user?.admin_role === 'superadmin';

  async function load() {
    setLoading(true);
    const res = await referralApi.getSettings();
    setLoading(false);
    if (res.success) { setData(res.data); setPct(Number(res.data.default_pct).toFixed(2)); }
    else setErr(res.error?.message || 'Failed to load settings.');
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setErr(''); setToast(''); setSaving(true);
    const res = await referralApi.updateSettings({ default_pct: parseFloat(pct) });
    setSaving(false);
    if (res.success) {
      setData(res.data);
      setPct(Number(res.data.default_pct).toFixed(2));
      setToast(`Default updated to ${Number(res.data.default_pct).toFixed(2)}% — applies to new referrals.`);
    } else {
      setErr(res.error?.message || 'Could not save.');
    }
  }

  if (loading) return <div className="text-t3 text-sm p-8 text-center">Loading…</div>;
  if (!data) return <div className="text-t3 text-sm p-8 text-center">{err || 'Failed to load.'}</div>;

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">🛠️ Referral Settings</h1>
        <p className="text-xs text-t3">The default commission a referrer earns on the platform&apos;s revenue from anyone they refer.</p>
      </div>

      <div className="bg-white rounded-xl border border-border p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">Default referral %</p>
        <div className="flex items-center gap-3">
          <input
            type="number" step="0.01" min="0" max="100"
            value={pct}
            disabled={!isSuper}
            onChange={(e) => setPct(e.target.value)}
            className="w-32 border-[1.5px] border-gold rounded-lg px-3 py-2.5 text-lg font-extrabold text-t1 text-center tabular-nums disabled:border-border disabled:bg-surface2 disabled:text-t2"
          />
          <span className="text-base font-bold text-t2">%</span>
        </div>
        <p className="text-xs text-t2 mt-2">
          New referrals start at this %. You can still override it per relationship on the <b>Relationships</b> page (e.g. a specific agency at 30%).
        </p>

        <div className="flex gap-4 mt-4">
          <div className="flex-1 bg-surface2 border border-border rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3">Earning window</div>
            <div className="text-sm font-extrabold text-t1 mt-0.5">{data.window_months} months</div>
            <div className="text-[10px] text-t3 mt-0.5">🔒 fixed — from the referral date</div>
          </div>
          <div className="flex-1 bg-surface2 border border-border rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3">Carved from</div>
            <div className="text-sm font-extrabold text-t1 mt-0.5">Platform slice only</div>
            <div className="text-[10px] text-t3 mt-0.5">never reduces influencer / brand</div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
          <span className="text-[11px] text-t3">
            {data.updated_at ? `Last changed ${new Date(data.updated_at).toLocaleDateString()}` : 'Never changed'}
          </span>
          {isSuper && (
            <button onClick={save} disabled={saving}
              className="bg-gold text-yellow-900 rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {toast && <div className="bg-teal-pale border border-teal-deep/30 text-teal-deep rounded-lg px-3 py-2.5 text-xs font-semibold">✓ {toast}</div>}
      {err && <div className="bg-red-pale border border-red/30 text-red rounded-lg px-3 py-2.5 text-xs font-semibold">⚠ {err}</div>}

      {!isSuper && (
        <div className="text-[11px] text-t2 bg-white border border-dashed border-border rounded-lg px-3.5 py-2.5">
          Only a <b>superadmin</b> can change the default. You can view it here; the value applies to new referrals platform-wide.
        </div>
      )}
    </div>
  );
}
