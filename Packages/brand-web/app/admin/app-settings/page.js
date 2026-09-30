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

// Checkout (shopper-ordering, rules 6.8 and 6.10). Cash on delivery is ON unless switched off here,
// which is how the server reads it, so the switch shows it the same way.
const CHECKOUT_KNOBS = [
  { key: 'cod_enabled', label: 'Cash on Delivery', sub: 'Offer cash on delivery at checkout, up to the limit below. Enforced by the server.', defaultOn: true },
];
const CHECKOUT_NUMBERS = [
  { key: 'cod_max_amount', label: 'Cash on delivery limit (₹)', sub: 'Cash on delivery is offered only up to this total per checkout.', fallback: 5000 },
  { key: 'cod_fee', label: 'COD fee (₹)', sub: 'Added once per checkout when she pays on delivery · 0 = free. Goes to the brand.', fallback: 0 },
  { key: 'delivery_fee', label: 'Delivery fee per parcel (₹)', sub: '0 = free delivery (launch). Goes to the brand, which ships.', fallback: 0 },
  { key: 'delivery_free_above', label: 'Free delivery above (₹)', sub: 'A parcel at or above this is delivered free · 0 = the fee always applies.', fallback: 0 },
];
const isOn = (config, k) => (k.defaultOn ? config[k.key] !== false : !!config[k.key]);

export default function AppSettingsPage() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    adminApi.getFollowerAppConfig().then(res => {
      if (res.success) {
        const cfg = res.data?.config || {};
        setConfig(cfg);
        setDrafts(Object.fromEntries(CHECKOUT_NUMBERS.map((n) => [n.key, String(cfg[n.key] != null ? cfg[n.key] : n.fallback)])));
      }
    });
  }, []);

  async function saveNumber(key) {
    const val = Math.max(0, parseFloat(drafts[key]) || 0);
    setDrafts((d) => ({ ...d, [key]: String(val) })); setSaving(true);
    const res = await adminApi.updateFollowerAppConfig({ [key]: val });
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
    const k = [...KNOBS, ...CHECKOUT_KNOBS].find((x) => x.key === key) || { key };
    const next = { ...config, [key]: !isOn(config, k) };
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
                  className={`w-12 h-7 rounded-full transition-colors shrink-0 ${isOn(config, k) ? 'bg-navy' : 'bg-surface2 border border-border'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-1 ${isOn(config, k) ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            ))}
            {CHECKOUT_NUMBERS.map((n) => (
              <div key={n.key} className="flex items-center justify-between px-5 py-4 border-t border-border">
                <div className="pr-4">
                  <div className="text-sm font-bold text-t1">{n.label}</div>
                  <div className="text-[11px] text-t3 mt-0.5">{n.sub}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input value={drafts[n.key] ?? ''} onChange={e => setDrafts((d) => ({ ...d, [n.key]: e.target.value }))} inputMode="decimal"
                    className="w-24 text-right text-sm font-bold text-t1 border border-border rounded-lg px-3 py-1.5" />
                  <button onClick={() => saveNumber(n.key)} disabled={saving}
                    className="text-xs font-bold text-white bg-navy rounded-lg px-3 py-2">Save</button>
                </div>
              </div>
            ))}
            <div className="px-5 py-3 border-t border-border text-[11px] text-t3">
              How every rupee of a sale splits (creator&apos;s share at her collaboration %, INFLX&apos;s share at the Path B rate in Pricing → Categories, the brand the rest) is set elsewhere; these are only the checkout charges.
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
