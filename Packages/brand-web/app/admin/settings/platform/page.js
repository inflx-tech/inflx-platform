'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

/**
 * Admin · Platform settings — item 6, N22. The three numbers the rules depend on: negotiation
 * rounds, pool entry lifetime, minimum shoppable posts. Each says what it does in plain words,
 * changes apply only to what starts afterwards (they are copied onto the thing they govern when it
 * is created), and every edit is logged. Modelled on settings/payments.
 * Contract: features/item6-negotiation · rules v1.18 §7B
 *
 * Item added 2026-09-16: a 0/1 setting (`kind: 'switch'`) draws as a switch rather than a number
 * box, and `subscriptions_enforced` — the master switch over every plan limit on the platform —
 * asks before it turns off, because it is the only setting here that changes what the product
 * allows rather than by how much. Contract: features/subscriptions-master-switch
 */
const SWITCH_MASTER = 'subscriptions_enforced';
// product-approval-switch: turning THIS one off releases every product still waiting, so it asks too.
const SWITCH_PRODUCTS = 'product_approval_required';
const isSwitch = (s) => s.kind === 'switch' || (s.min === 0 && s.max === 1);
const onOff = (v) => (Number(v) === 0 ? 'off' : 'on');
const RANGE_MESSAGE = (min, max) => `Enter a number between ${min} and ${max}.`;

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [lastChange, setLastChange] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [confirmProductsOff, setConfirmProductsOff] = useState(false);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    const res = await adminApi.getPlatformSettings();
    setLoading(false);
    if (!res.success) { setLoadError(true); return; }
    setSettings(res.data.settings || []);
    setLastChange(res.data.lastChange || null);
    const f = {}; (res.data.settings || []).forEach(s => { f[s.key] = String(s.value); });
    setForm(f);
  }, []);
  useEffect(() => { load(); }, [load]);

  function validate() {
    const errs = {};
    settings.forEach(s => {
      const v = Number(form[s.key]);
      if (form[s.key] === '' || !Number.isInteger(v) || v < s.min || v > s.max) {
        errs[s.key] = isSwitch(s) ? 'This can only be on or off.' : RANGE_MESSAGE(s.min, s.max);
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  /** Turning a switch OFF asks first: plans (everything unlimited) and product approval (waiting products go live). */
  const turningOff = (key) => { const was = settings.find(x => x.key === key); return !!was && Number(was.value) === 1 && Number(form[key]) === 0; };
  function handleSave() {
    if (!validate()) return;
    if (turningOff(SWITCH_MASTER)) { setConfirmOff(true); return; }
    if (turningOff(SWITCH_PRODUCTS)) { setConfirmProductsOff(true); return; }
    return doSave();
  }

  async function doSave() {
    setConfirmOff(false); setConfirmProductsOff(false);
    if (!validate()) return;
    setSaving(true);
    const patch = {}; settings.forEach(s => { patch[s.key] = Number(form[s.key]); });
    const res = await adminApi.updatePlatformSettings(patch);
    setSaving(false);
    if (res.success) {
      const released = Number(res.data.released || 0);
      showToast(released > 0
        ? `Saved. ${released} waiting product${released === 1 ? ' is' : 's are'} now live.`
        : res.data.changed && res.data.changed.length ? 'Platform settings saved. Only things created from now on use the new numbers.' : 'Nothing changed.');
      setEditing(false);
      setSettings(res.data.settings || []); setLastChange(res.data.lastChange || null);
      const f = {}; (res.data.settings || []).forEach(s => { f[s.key] = String(s.value); }); setForm(f);
    } else {
      if (res.error?.field) setErrors({ [res.error.field]: res.error.message });
      showToast(res.error?.message || 'Failed to save', 'err');
    }
  }

  function handleCancel() { setEditing(false); setErrors({}); load(); }

  return (
    <div className="max-w-2xl" data-testid="platform-settings">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'}`}>
          {toast.type === 'err' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      {!loading && settings.some(x => x.key === SWITCH_MASTER && Number(x.value) === 0) && (
        <div className="mb-5 flex gap-3 items-start rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" data-testid="plans-off-banner">
          <span>●</span>
          <span>Plan limits are switched off platform-wide. Every brand is unlimited until you switch them back on. Billing is unaffected — brands on a paid plan are still charged.</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Platform settings</h1>
          <p className="text-xs text-t3 mt-0.5">The switch that decides whether plan limits apply at all, and the numbers the collaboration rules depend on. A change applies only to what starts afterwards.</p>
        </div>
        {!editing && !loading && !loadError && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-navy text-white font-semibold text-sm rounded-lg hover:bg-navy-mid transition-colors">Edit</button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface2 rounded-xl animate-pulse" />)}</div>
      ) : loadError ? (
        <div className="bg-white rounded-xl border border-border p-6 text-sm text-t2">
          Couldn't load the settings. <button onClick={load} className="font-semibold text-navy underline">Try again</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {settings.map((s, i) => (
            <div key={s.key} className={`px-5 py-4 ${i < settings.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-t1">{s.label}</div>
                  <p className="text-xs text-t3 mt-1 leading-relaxed">{s.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSwitch(s) ? (
                    <>
                      <span className="text-xs font-bold text-t2 w-7">{onOff(editing ? form[s.key] : s.value) === 'on' ? 'On' : 'Off'}</span>
                      <button type="button" role="switch" disabled={!editing} data-testid={`setting-${s.key}`}
                        aria-checked={onOff(editing ? form[s.key] : s.value) === 'on'}
                        aria-label={s.label}
                        onClick={() => { if (!editing) return; setForm(f => ({ ...f, [s.key]: Number(f[s.key]) === 1 ? '0' : '1' })); setErrors(er => { const n = { ...er }; delete n[s.key]; return n; }); }}
                        className={`relative w-[50px] h-[29px] rounded-full transition-colors ${onOff(editing ? form[s.key] : s.value) === 'on' ? 'bg-navy' : 'bg-gray-300'} ${editing ? 'cursor-pointer' : 'opacity-70 cursor-default'}`}>
                        <span className={`absolute top-[3px] w-[23px] h-[23px] rounded-full bg-white transition-all ${onOff(editing ? form[s.key] : s.value) === 'on' ? 'left-[24px]' : 'left-[3px]'}`} />
                      </button>
                    </>
                  ) : editing ? (
                    <>
                      <input type="number" min={s.min} max={s.max} step={1} value={form[s.key] ?? ''} data-testid={`setting-${s.key}`}
                        onChange={e => { setForm(f => ({ ...f, [s.key]: e.target.value })); setErrors(er => { const n = { ...er }; delete n[s.key]; return n; }); }}
                        className={`w-24 px-3 py-2 text-sm text-right rounded-lg border ${errors[s.key] ? 'border-red-500' : 'border-border'} focus:outline-none focus:border-navy`} />
                      <span className="text-xs text-t3 w-12">{s.unit}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold text-t1 tabular-nums">{s.value}</span>
                      <span className="text-xs text-t3 w-12">{s.unit}</span>
                    </>
                  )}
                </div>
              </div>
              {errors[s.key] && <p className="text-xs text-red-600 mt-1 text-right">{errors[s.key]}</p>}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={handleCancel} className="px-4 py-2 text-sm font-semibold text-t2 rounded-lg border border-border hover:bg-surface2">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-navy text-white font-semibold text-sm rounded-lg hover:bg-navy-mid disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      )}

      {confirmOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" data-testid="confirm-plans-off">
          <div className="max-w-md w-full bg-white rounded-2xl border border-border p-6">
            <h4 className="font-display text-lg font-bold text-t1 mb-2">Turn subscription plans off?</h4>
            <p className="text-sm text-t2 mb-2">Every brand becomes unlimited until you turn this back on:</p>
            <ul className="text-sm text-t2 list-disc ml-5 mb-3 space-y-1">
              <li>no quota can block anyone — sets, campaigns, invitations, products, media</li>
              <li>every feature is included for everyone</li>
              <li>no “upgrade to continue” message can appear</li>
            </ul>
            <p className="text-sm text-t2 mb-2"><b>Billing is not affected.</b> Brands on a paid plan keep their plan and are still charged on the same date.</p>
            <p className="text-sm text-t2 mb-4">Your tiers, prices and per-brand overrides are kept, and apply again when you switch this back on.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmOff(false)} className="px-4 py-2 text-sm font-semibold text-t2 rounded-lg border border-border hover:bg-surface2">Cancel</button>
              <button onClick={doSave} data-testid="confirm-plans-off-yes" className="px-4 py-2 bg-red-700 text-white font-semibold text-sm rounded-lg hover:bg-red-800">Turn off</button>
            </div>
          </div>
        </div>
      )}

      {confirmProductsOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" data-testid="confirm-products-off">
          <div className="max-w-md w-full bg-white rounded-2xl border border-border p-6">
            <h4 className="font-display text-lg font-bold text-t1 mb-2">Turn product approval off?</h4>
            <p className="text-sm text-t2 mb-2">Every product still waiting for approval goes live in its brand's store right now. From then on a brand's published product is live at once.</p>
            <p className="text-sm text-t2 mb-4">You can switch it back on at any time; nothing already live is touched by that.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmProductsOff(false)} className="px-4 py-2 text-sm font-semibold text-t2 rounded-lg border border-border hover:bg-surface2">Cancel</button>
              <button onClick={doSave} data-testid="confirm-products-off-yes" className="px-4 py-2 bg-red-700 text-white font-semibold text-sm rounded-lg hover:bg-red-800">Turn off</button>
            </div>
          </div>
        </div>
      )}

      {/* The audit line at the foot (N22) */}
      <div className="text-xs text-t3 bg-surface2 rounded-lg px-3 py-2 mt-5" data-testid="audit-line">
        {lastChange
          ? <>Last changed by {lastChange.changedBy || 'an admin'} on {fmtWhen(lastChange.changedAt)} · {lastChange.label.toLowerCase()}{' '}
              {(lastChange.key === SWITCH_MASTER || lastChange.key === SWITCH_PRODUCTS)
                ? <>{lastChange.oldValue == null ? '—' : onOff(lastChange.oldValue)} → {onOff(lastChange.newValue)}</>
                : <>{lastChange.oldValue ?? '—'} → {lastChange.newValue}</>}. Every change is recorded.</>
          : <>No changes yet. Every change is recorded.</>}
      </div>
    </div>
  );
}
