'use client';

/**
 * /admin/meals — INFLX Meals platform settings (admin radius + tolerance + lead time).
 *
 * Single global row in platform_meals_settings. The radius applies between
 * each customer's delivery address and each restaurant's fixed registration
 * location; tolerance is the soft margin (e.g. 500 m). Lead minutes is the
 * minimum cutoff before serve time for any new order.
 */

import { useEffect, useState } from 'react';
import { mealsAdminApi } from '../../../lib/api';

export default function AdminMealsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [s, setS] = useState({ radius_km: 5, radius_tolerance_m: 500, min_order_lead_minutes: 120 });

  useEffect(() => {
    mealsAdminApi.getSettings().then((res) => {
      if (res.success) setS(res.data.settings);
      else setError(res.error?.message || 'Could not load settings');
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true); setSaved(false); setError(null);
    const res = await mealsAdminApi.putSettings({
      radius_km: Number(s.radius_km),
      radius_tolerance_m: Number(s.radius_tolerance_m),
      min_order_lead_minutes: Number(s.min_order_lead_minutes),
    });
    setSaving(false);
    if (res.success) { setS(res.data.settings); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else setError(res.error?.message || 'Save failed');
  }

  const effective = (Number(s.radius_km) || 0) + (Number(s.radius_tolerance_m) || 0) / 1000;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-extrabold text-navy-deep mb-1">🍽️ INFLX Meals — platform settings</h1>
      <p className="text-sm text-gray-500 mb-5">Single global row. Applies between each customer&apos;s delivery address and each restaurant&apos;s fixed registration location.</p>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <Field
            label="Delivery radius"
            unit="km"
            value={s.radius_km}
            onChange={(v) => setS({ ...s, radius_km: v })}
            hint="How far from a restaurant we'll route orders. Default 5 km."
          />
          <Field
            label="Tolerance"
            unit="m"
            value={s.radius_tolerance_m}
            onChange={(v) => setS({ ...s, radius_tolerance_m: v })}
            hint='Soft margin added to the radius (e.g. 500 m → "5 km ±500 m").'
          />
          <Field
            label="Minimum order lead time"
            unit="min"
            value={s.min_order_lead_minutes}
            onChange={(v) => setS({ ...s, min_order_lead_minutes: v })}
            hint="No orders within this many minutes of the slot serve time."
          />

          <div className="border-t border-gray-100 pt-4 text-sm text-gray-600">
            <b className="text-navy-deep">Effective routing radius:</b> {effective.toFixed(2)} km
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="bg-orange text-white font-bold rounded-lg px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {saved && <span className="text-green-600 font-bold text-xs">✓ Saved</span>}
            {error && <span className="text-red-600 text-xs">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, unit, value, onChange, hint }) {
  return (
    <div>
      <label className="text-sm font-semibold text-navy-deep">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32"
          step="any"
        />
        <span className="text-gray-500 text-sm">{unit}</span>
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
