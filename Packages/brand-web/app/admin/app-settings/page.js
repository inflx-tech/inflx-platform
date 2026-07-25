'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Follower App settings (Post/Concept P3 globals, mig 141).
 * Contract: features/concept-p3-post-globals/.
 *
 * ONE admin-editable object the follower app fetches at launch — global
 * behaviour knobs change here without an OTA. First knobs: video autoplay
 * and the default sound state (founder pick 2026-07-23: sound OFF).
 */

const KNOBS = [
  { key: 'video_autoplay', label: 'Auto-play videos while scrolling', sub: 'Videos start (muted) when ~60% visible, pause when scrolled past.' },
  { key: 'video_sound_default', label: 'Sound ON by default', sub: 'OFF = videos autoplay muted; the follower taps for sound (recommended).' },
  { key: 'show_product_ratings', label: 'Show product ratings', sub: 'Ratings render only when real review data exists AND this is on — never fake.' },
];

// Stage C3 — checkout knobs (contract: features/concept-stagec3-checkout/).
const CHECKOUT_KNOBS = [
  { key: 'cod_enabled', label: 'Cash on Delivery', sub: 'Show COD as a payment option at checkout. Enforced server-side, not just hidden.' },
];

export default function AppSettingsPage() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [feeDraft, setFeeDraft] = useState('');

  useEffect(() => {
    adminApi.getFollowerAppConfig().then(res => {
      if (res.success) {
        const cfg = res.data?.config || {};
        setConfig(cfg);
        setFeeDraft(cfg.cod_fee != null ? String(cfg.cod_fee) : '0');
      }
    });
  }, []);

  async function saveFee() {
    const fee = Math.max(0, parseFloat(feeDraft) || 0);
    setFeeDraft(String(fee)); setSaving(true);
    const res = await adminApi.updateFollowerAppConfig({ cod_fee: fee });
    setSaving(false);
    if (res.success) {
      setConfig(res.data.config);
      setToast('Saved — live on next app launch.');
      setTimeout(() => setToast(''), 2500);
    } else {
      alert(res.error?.message || 'Save failed.');
    }
  }

  async function toggle(key) {
    const next = { ...config, [key]: !config[key] };
    setConfig(next); setSaving(true);
    const res = await adminApi.updateFollowerAppConfig({ [key]: next[key] });
    setSaving(false);
    if (res.success) {
      setConfig(res.data.config);
      setToast('Saved — live on next app launch.');
      setTimeout(() => setToast(''), 2500);
    } else {
      setConfig(config);
      alert(res.error?.message || 'Save failed.');
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Follower App</h1>
        <p className="text-xs text-t3 mt-0.5">
          Global behaviour knobs the follower app reads at launch — changes apply without an app update.
        </p>
      </div>
      {!config ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {KNOBS.map(k => (
            <div key={k.key} className="flex items-center justify-between px-5 py-4 border-t border-border first:border-t-0">
              <div className="pr-4">
                <div className="text-sm font-bold text-t1">{k.label}</div>
                <div className="text-[11px] text-t3 mt-0.5">{k.sub}</div>
              </div>
              <button onClick={() => toggle(k.key)} disabled={saving}
                className={`w-12 h-7 rounded-full transition-colors shrink-0 ${config[k.key] ? 'bg-navy' : 'bg-surface2 border border-border'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-1 ${config[k.key] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
          <div className="px-5 py-3 border-t border-border text-[11px] text-t3 italic">
            Video knobs take effect when the video phase ships; stored now so the app is born reading them.
          </div>
        </div>
      )}

      {/* ── Checkout (Stage C3) ── */}
      {config && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-t1 mb-2">Checkout</h2>
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            {CHECKOUT_KNOBS.map(k => (
              <div key={k.key} className="flex items-center justify-between px-5 py-4">
                <div className="pr-4">
                  <div className="text-sm font-bold text-t1">{k.label}</div>
                  <div className="text-[11px] text-t3 mt-0.5">{k.sub}</div>
                </div>
                <button onClick={() => toggle(k.key)} disabled={saving}
                  className={`w-12 h-7 rounded-full transition-colors shrink-0 ${config[k.key] ? 'bg-navy' : 'bg-surface2 border border-border'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-1 ${config[k.key] ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-4 border-t border-border">
              <div className="pr-4">
                <div className="text-sm font-bold text-t1">COD fee (₹)</div>
                <div className="text-[11px] text-t3 mt-0.5">Added to the bill on COD orders · 0 = free. Applied once per order.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input value={feeDraft} onChange={e => setFeeDraft(e.target.value)} inputMode="decimal"
                  className="w-24 text-right text-sm font-bold text-t1 border border-border rounded-lg px-3 py-1.5" />
                <button onClick={saveFee} disabled={saving}
                  className="text-xs font-bold text-white bg-navy rounded-lg px-3 py-2">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
