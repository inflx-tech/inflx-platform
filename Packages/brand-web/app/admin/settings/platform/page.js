'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

/**
 * Admin · Platform settings — item 6, N22. The three numbers the rules depend on: negotiation
 * rounds, pool entry lifetime, minimum shoppable posts. Each says what it does in plain words,
 * changes apply only to what starts afterwards (they are copied onto the thing they govern when it
 * is created), and every edit is logged. Modelled on settings/payments.
 * Contract: features/item6-negotiation · rules v1.18 §7B
 */
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
      if (form[s.key] === '' || !Number.isInteger(v) || v < s.min || v > s.max) errs[s.key] = RANGE_MESSAGE(s.min, s.max);
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const patch = {}; settings.forEach(s => { patch[s.key] = Number(form[s.key]); });
    const res = await adminApi.updatePlatformSettings(patch);
    setSaving(false);
    if (res.success) {
      showToast(res.data.changed && res.data.changed.length ? 'Platform settings saved. Only things created from now on use the new numbers.' : 'Nothing changed.');
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Platform settings</h1>
          <p className="text-xs text-t3 mt-0.5">The numbers the collaboration rules depend on. A change applies only to what starts afterwards.</p>
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
                  {editing ? (
                    <input type="number" min={s.min} max={s.max} step={1} value={form[s.key] ?? ''} data-testid={`setting-${s.key}`}
                      onChange={e => { setForm(f => ({ ...f, [s.key]: e.target.value })); setErrors(er => { const n = { ...er }; delete n[s.key]; return n; }); }}
                      className={`w-24 px-3 py-2 text-sm text-right rounded-lg border ${errors[s.key] ? 'border-red-500' : 'border-border'} focus:outline-none focus:border-navy`} />
                  ) : (
                    <span className="text-lg font-bold text-t1 tabular-nums">{s.value}</span>
                  )}
                  <span className="text-xs text-t3 w-12">{s.unit}</span>
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

      {/* The audit line at the foot (N22) */}
      <div className="text-xs text-t3 bg-surface2 rounded-lg px-3 py-2 mt-5" data-testid="audit-line">
        {lastChange
          ? <>Last changed by {lastChange.changedBy || 'an admin'} on {fmtWhen(lastChange.changedAt)} · {lastChange.label.toLowerCase()} {lastChange.oldValue ?? '—'} → {lastChange.newValue}. Every change is recorded.</>
          : <>No changes yet. Every change is recorded.</>}
      </div>
    </div>
  );
}
