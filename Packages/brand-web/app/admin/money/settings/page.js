'use client';
/**
 * Admin · Money · Settings (AM12) — the money numbers, in the Money section.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * These are the same numbers the Payment Config and Platform settings pages hold — shown here
 * together, each saved on its own through the page that owns it. A change applies from now on;
 * it never moves something already promised (each number is stamped on the thing it governs).
 * Tax at withdrawal is OFF: the full amount is paid. It is decided again in the tax round, and
 * cannot be switched on from here.
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../../../lib/api';
import { useToast, Head, Btn, LoadFailed } from '../ui';

// where: 'platform' (platform_settings key) | 'payment' (payment_config field; `read` is its name on GET)
const ROWS = [
  { key: 'min_withdrawal_inr', read: 'minWithdrawalInr', where: 'payment', label: 'Minimum withdrawal', unit: '₹', min: 1, max: 100000,
    desc: 'The least a brand or creator can ask to withdraw.' },
  { key: 'withdrawal_process_hours', where: 'platform', label: 'Withdrawals processed within', unit: 'hours',
    desc: 'What the person is told, and when a waiting request turns amber in Withdrawals.' },
  { key: 'return_window_days', read: 'returnWindowDays', where: 'payment', label: 'Return window', unit: 'days', min: 1, max: 90,
    desc: "How long a sale's shares wait before they are added to the wallets. Also set per category in Pricing." },
  { key: 'campaign_fee_pct', where: 'platform', label: 'INFLX campaign fee', unit: '%',
    desc: 'Pay for Content only; charged to the brand when the money locks at its signature.' },
  { key: 'final_payment_wait_days', where: 'platform', label: 'Final payment waiting period', unit: 'days',
    desc: 'Pay for Content and Hybrid: days between the brand confirming it is live and the final 50%.' },
];

export default function MoneySettingsPage() {
  const [values, setValues] = useState(null);     // key → { value, min, max }
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(null);
  const [loadError, setLoadError] = useState(false);
  // Changing a number needs the Settings permission (the server enforces it); everyone who can open
  // Money can read them. null = not known yet.
  const [canEdit, setCanEdit] = useState(null);
  const { show, node: toast } = useToast();

  const load = useCallback(async () => {
    const [pay, plat] = await Promise.all([adminApi.getPaymentConfig(), adminApi.getPlatformSettings()]);
    if (!pay.success || !plat.success) { setLoadError(true); return; }
    setLoadError(false);
    const byKey = Object.fromEntries((plat.data.settings || []).map((s) => [s.key, s]));
    const v = {};
    for (const r of ROWS) {
      if (r.where === 'platform') { const s = byKey[r.key]; if (s) v[r.key] = { value: Number(s.value), min: s.min, max: s.max }; }
      else v[r.key] = { value: Number(pay.data.config[r.read]), min: r.min, max: r.max };
    }
    setValues(v);
    setForm(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x.value)])));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminApi.getMe().then((res) => {
      if (res.success) setCanEdit(res.data?.admin_role === 'superadmin' || (Array.isArray(res.data?.capabilities) && res.data.capabilities.includes('settings')));
    });
  }, []);

  async function save(r) {
    const cur = values[r.key];
    const n = Number(form[r.key]);
    if (form[r.key] === '' || !Number.isFinite(n) || n < cur.min || n > cur.max || (r.where === 'platform' && !Number.isInteger(n))) {
      setErrors((e) => ({ ...e, [r.key]: `Enter a number between ${cur.min} and ${cur.max}.` }));
      return;
    }
    setErrors((e) => ({ ...e, [r.key]: null }));
    setSaving(r.key);
    const res = r.where === 'platform' ? await adminApi.updatePlatformSettings({ [r.key]: n }) : await adminApi.updatePaymentConfig({ [r.key]: n });
    setSaving(null);
    if (!res.success) { setErrors((e) => ({ ...e, [r.key]: res.error?.message || 'That did not save.' })); return; }
    show(`${r.label} is now ${n} ${r.unit === '₹' ? 'rupees' : r.unit === '%' ? 'per cent' : r.unit}.`);
    load();
  }

  if (loadError) return <div className="max-w-3xl"><Head title="Money settings" /><LoadFailed onRetry={load} what="the settings" /></div>;

  return (
    <div className="max-w-3xl">
      <Head title="Money settings" sub="A change applies from now on; it never moves something already promised." />
      {canEdit === false ? (
        <div className="bg-surface2 rounded-lg p-3 text-xs text-t2 mb-3">You can read these numbers. Changing them needs the Settings permission.</div>
      ) : null}
      <div className="bg-white rounded-xl border border-border">
        {!values ? <div className="p-8 text-center text-t3 text-sm">Loading…</div> : ROWS.filter((r) => values[r.key]).map((r) => {
          const dirty = String(values[r.key].value) !== form[r.key];
          return (
            <div key={r.key} className="px-4 py-3.5 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <b className="text-sm text-t1">{r.label}</b>
                <div className="flex items-center gap-2">
                  <input type="number" className="w-24 border border-border rounded-lg px-2.5 py-1.5 text-sm text-right outline-none focus:border-t1" value={form[r.key]}
                    min={values[r.key].min} max={values[r.key].max} disabled={canEdit === false} onChange={(e) => setForm((f) => ({ ...f, [r.key]: e.target.value }))} />
                  <span className="text-xs text-t3 w-10">{r.unit}</span>
                  <Btn onClick={() => save(r)} disabled={!dirty || saving === r.key || canEdit === false}>{saving === r.key ? 'Saving…' : 'Save'}</Btn>
                </div>
              </div>
              <div className="text-xs text-t3 mt-1">{r.desc}</div>
              {errors[r.key] ? <div className="text-[11px] text-red font-semibold mt-1">{errors[r.key]}</div> : null}
            </div>
          );
        })}
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <b className="text-sm text-t1">Tax deducted at withdrawal (TDS)</b>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-t3">
              <span className="inline-block w-9 h-5 rounded-full bg-surface2 border border-border relative"><i className="absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-t3" /></span>Off
            </span>
          </div>
          <div className="text-xs text-t3 mt-1">Off. The full amount is paid. Decided again in the tax round.</div>
        </div>
      </div>
      {toast}
    </div>
  );
}
