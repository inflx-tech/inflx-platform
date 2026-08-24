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
  const [rescraping, setRescraping] = useState(false);
  const [toast, setToast] = useState('');
  // Wave 1 — per-influencer TDS controls (override + exempt).
  const [tdsInput, setTdsInput] = useState('');
  const [savingTds, setSavingTds] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  // Wave 1 — save or clear the per-influencer TDS override + exempt flag.
  async function saveTdsControls({ exempt, clear = false }) {
    const overrideValue = clear ? null : (tdsInput === '' ? null : parseFloat(tdsInput));
    if (overrideValue != null && (isNaN(overrideValue) || overrideValue < 0 || overrideValue > 30)) {
      showToast('Enter a valid TDS % 0–30 (or click Clear)');
      return;
    }
    setSavingTds(true);
    const res = await adminApi.setInfluencerTaxControls(id, overrideValue, exempt);
    setSavingTds(false);
    if (res.success) {
      setInfluencer(prev => ({
        ...prev,
        tds_override_pct: res.data.tds_override_pct,
        tds_exempt:       res.data.tds_exempt,
      }));
      if (!clear && !exempt) setTdsInput('');
      showToast(
        exempt ? 'Marked TDS-exempt — 0% deducted on future withdrawals'
        : clear ? 'TDS override cleared — using global rate'
        :         `TDS override set to ${res.data.tds_override_pct}%`
      );
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

  async function rescrape() {
    setRescraping(true);
    const res = await adminApi.rescrapeInfluencer(id);
    setRescraping(false);
    if (res.success) {
      setInfluencer(res.data?.influencer || influencer);
      showToast('Instagram stats refreshed!');
    } else {
      showToast(res.error?.message || 'Rescrape failed');
    }
  }

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
    { label: 'Wallet', value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(influencer.wallet_balance || 0) },
    { label: 'Status', value: influencer.user_status || influencer.status || '—' },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <a href="/admin/approvals" className="text-xs text-t3 hover:text-t2">← Approvals</a>
      </div>

      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-pale flex items-center justify-center text-sm font-bold text-orange-deep font-display">
              {(influencer.instagram_handle || '').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-display text-base font-bold text-t1">@{influencer.instagram_handle}</div>
              <div className="text-xs text-t3">{[influencer.phone, influencer.city, influencer.state].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <button onClick={rescrape} disabled={rescraping}
            className="px-4 py-2 bg-orange-50 border border-orange-200 text-orange-700 font-bold text-xs rounded-xl hover:bg-orange-100 disabled:opacity-50 transition-colors">
            {rescraping ? 'Scraping…' : '↻ Rescrape'}
          </button>
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
          <Field label="Last checked" value={influencer.scrape_last_run ? new Date(influencer.scrape_last_run).toLocaleString('en-IN') : 'Never checked against Instagram'} />
          <Field label="Pending Balance" value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(influencer.pending_balance || 0)} />
          <Field label="TDS Status" value={
            influencer.tds_exempt
              ? 'Exempt (0%)'
              : influencer.tds_override_pct != null
                ? `Override ${influencer.tds_override_pct}%`
                : 'Global default'
          } />
        </div>
      </div>

      {/* Wave 1 — Per-influencer TDS controls.
          By default, withdrawal.service deducts the global payment_config.tds_pct.
          Admin can: (a) set a per-influencer override %, or (b) mark exempt (0%)
          when the influencer has filed a TDS exemption certificate. */}
      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <h3 className="font-display text-sm font-bold text-t1 mb-1">TDS Controls</h3>
        <p className="text-xs text-t3 mb-4">
          {influencer.tds_exempt
            ? '🛡️ Currently exempt — no TDS deducted on withdrawals.'
            : influencer.tds_override_pct != null
              ? `Override rate: ${influencer.tds_override_pct}% (instead of the global TDS).`
              : 'Currently using the global TDS rate set in /admin/settings/payments.'}
        </p>

        {/* Exempt toggle */}
        <label className="flex items-center gap-2 mb-3 text-sm text-t2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!influencer.tds_exempt}
            onChange={e => saveTdsControls({ exempt: e.target.checked, clear: false })}
            disabled={savingTds}
            className="w-4 h-4"
          />
          <span><strong>TDS exempt</strong> — for influencers with a valid TDS exemption certificate on file</span>
        </label>

        {/* Override input (disabled when exempt) */}
        <div className="flex gap-2">
          <div className={`flex items-center border-2 border-border2 rounded-xl overflow-hidden flex-1 ${influencer.tds_exempt ? 'opacity-40' : ''}`}>
            <input
              type="number"
              value={tdsInput}
              onChange={e => setTdsInput(e.target.value)}
              placeholder={influencer.tds_override_pct != null
                ? String(influencer.tds_override_pct)
                : 'global default'}
              min="0"
              max="30"
              step="0.5"
              disabled={influencer.tds_exempt}
              className="flex-1 px-3 py-2.5 text-sm outline-none"
            />
            <span className="px-3 py-2.5 bg-surface2 text-t3 text-sm font-bold border-l border-border2">%</span>
          </div>
          <button
            onClick={() => saveTdsControls({ exempt: false, clear: false })}
            disabled={savingTds || !tdsInput || influencer.tds_exempt}
            className="px-4 py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {savingTds ? 'Saving…' : 'Save Override'}
          </button>
          <button
            onClick={() => saveTdsControls({ exempt: false, clear: true })}
            disabled={savingTds || influencer.tds_override_pct == null}
            className="px-4 py-2.5 bg-white border-2 border-border2 text-t2 font-bold text-xs rounded-xl hover:bg-surface2 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>}
    </div>
  );
}
