'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

// Fields the superadmin can edit, with labels, notes and validation
const FIELDS = [
  {
    key: 'platform_fee_pct', label: 'Default Platform Fee (%)',
    note: 'Charged to brand on top of influencer fee. Per-brand overrides apply.',
    type: 'number', min: 0, max: 30, step: 0.5, suffix: '%',
  },
  {
    key: 'tranche_1_pct', label: 'Tranche 1 (%)',
    note: 'Released on contract signature (both parties). T1 + T2 + T3 must equal 100.',
    type: 'number', min: 1, max: 98, step: 1, suffix: '%',
  },
  {
    key: 'tranche_2_pct', label: 'Tranche 2 (%)',
    note: 'Released when brand confirms content live.',
    type: 'number', min: 1, max: 98, step: 1, suffix: '%',
  },
  {
    key: 'tranche_3_pct', label: 'Tranche 3 (%)',
    note: 'Auto-released 30 days after Tranche 2 trigger.',
    type: 'number', min: 1, max: 98, step: 1, suffix: '%',
  },
  {
    key: 'tds_pct', label: 'TDS on Withdrawal (%)',
    note: 'Statutory — deducted at influencer withdrawal time (Section 194M).',
    type: 'number', min: 0, max: 30, step: 0.5, suffix: '%', locked: true,
  },
  {
    key: 'offer_expiry_hours', label: 'Offer Expiry (hours)',
    note: 'Offers auto-expire after this many hours if influencer does not respond.',
    type: 'number', min: 12, max: 168, step: 1, suffix: 'h',
  },
  {
    key: 'return_window_days', label: 'Commission Return Window (days)',
    note: 'Commissions held in pending_balance for this many days before confirming.',
    type: 'number', min: 7, max: 90, step: 1, suffix: 'd',
  },
  {
    key: 'min_withdrawal_inr', label: 'Minimum Withdrawal (₹)',
    note: 'Minimum amount influencer can withdraw per request.',
    type: 'number', min: 50, max: 10000, step: 50, suffix: '₹',
  },
];

function cfgToForm(cfg) {
  if (!cfg) return {};
  return {
    platform_fee_pct:   cfg.platformFeePct,
    tranche_1_pct:      cfg.tranche1Pct,
    tranche_2_pct:      cfg.tranche2Pct,
    tranche_3_pct:      cfg.tranche3Pct,
    tds_pct:            cfg.tdsPct,
    offer_expiry_hours: cfg.offerExpiryHours,
    return_window_days: cfg.returnWindowDays,
    min_withdrawal_inr: cfg.minWithdrawalInr,
  };
}

export default function PaymentConfigPage() {
  const [raw,     setRaw]     = useState(null);
  const [form,    setForm]    = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);
  const [errors,  setErrors]  = useState({});
  const [editing, setEditing] = useState(false);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function load() {
    setLoading(true);
    const res = await adminApi.getPaymentConfig();
    setLoading(false);
    if (res.success) {
      setRaw(res.data.raw);
      setForm(cfgToForm(res.data.config));
    }
  }

  useEffect(() => { load(); }, []);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  function validate() {
    const errs = {};
    const t1 = parseFloat(form.tranche_1_pct);
    const t2 = parseFloat(form.tranche_2_pct);
    const t3 = parseFloat(form.tranche_3_pct);
    if (!isNaN(t1) && !isNaN(t2) && !isNaN(t3)) {
      const sum = t1 + t2 + t3;
      if (Math.abs(sum - 100) > 0.01) {
        errs.tranche_1_pct = `Tranches must sum to 100 (currently ${sum.toFixed(1)})`;
        errs.tranche_2_pct = ' ';
        errs.tranche_3_pct = ' ';
      }
    }
    FIELDS.forEach(f => {
      const v = parseFloat(form[f.key]);
      if (isNaN(v)) { errs[f.key] = 'Required'; return; }
      if (v < f.min) errs[f.key] = `Min ${f.min}`;
      if (v > f.max) errs[f.key] = `Max ${f.max}`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    if (!confirm('Update payment configuration? This affects all future transactions immediately.')) return;
    setSaving(true);
    const res = await adminApi.updatePaymentConfig(form);
    setSaving(false);
    if (res.success) {
      showToast('Payment config updated successfully');
      setEditing(false);
      load();
    } else {
      showToast(res.error?.message || 'Failed to save', 'err');
    }
  }

  function handleCancel() {
    setEditing(false);
    setErrors({});
    load(); // reset to DB values
  }

  const trancheSum = ['tranche_1_pct','tranche_2_pct','tranche_3_pct']
    .reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
  const trancheOk = Math.abs(trancheSum - 100) < 0.01;

  return (
    <div className="max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'}`}>
          {toast.type === 'err' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Payment Configuration</h1>
          <p className="text-xs text-t3 mt-0.5">
            Runtime-configurable financial parameters — changes apply immediately to all new transactions
          </p>
        </div>
        {!editing && !loading && (
          <button onClick={() => setEditing(true)}
            className="px-4 py-2 bg-navy text-white font-semibold text-sm rounded-lg hover:bg-navy-mid transition-colors">
            Edit Config
          </button>
        )}
      </div>

      {/* Last updated */}
      {raw?.updated_at && (
        <div className="text-xs text-t3 bg-surface2 rounded-lg px-3 py-2 mb-5">
          Last updated {new Date(raw.updated_at).toLocaleString('en-IN')}
          {raw.updated_by_name && ` by ${raw.updated_by_name}`}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-surface2 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {FIELDS.map((field, i) => (
            <div key={field.key} className={`px-5 py-4 ${i < FIELDS.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-t1">{field.label}</span>
                    {field.locked && (
                      <span className="text-[10px] bg-orange-pale text-orange-deep px-2 py-0.5 rounded-full font-bold">STATUTORY</span>
                    )}
                  </div>
                  <div className="text-[11px] text-t3 mt-0.5">{field.note}</div>
                  {errors[field.key] && errors[field.key] !== ' ' && (
                    <div className="text-[11px] text-red-500 mt-1 font-semibold">{errors[field.key]}</div>
                  )}
                </div>

                {editing ? (
                  <div className={`flex items-center gap-1 border-2 rounded-lg overflow-hidden flex-shrink-0 ${errors[field.key] ? 'border-red-400' : 'border-navy/30 focus-within:border-navy'}`}>
                    <input
                      type="number"
                      value={form[field.key] ?? ''}
                      onChange={e => setField(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                      min={field.min} max={field.max} step={field.step}
                      disabled={field.locked}
                      className="w-20 px-3 py-1.5 text-sm font-bold text-t1 outline-none bg-white disabled:bg-surface2 disabled:text-t3"
                    />
                    <span className="px-2 text-xs text-t3 bg-surface2 h-full flex items-center font-semibold border-l border-border">{field.suffix}</span>
                  </div>
                ) : (
                  <div className="font-display text-base font-bold text-navy bg-navy-pale px-3 py-1 rounded-lg flex-shrink-0">
                    {form[field.key]}{field.suffix}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tranche sum indicator */}
      {editing && (
        <div className={`mt-3 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${trancheOk ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'}`}>
          <span>{trancheOk ? '✓' : '✗'}</span>
          <span>Tranche sum: {trancheSum.toFixed(1)}% {trancheOk ? '(valid)' : '— must equal 100%'}</span>
        </div>
      )}

      {/* TDS locked note */}
      {editing && (
        <div className="mt-2 text-[11px] text-t3 px-1">
          ⚠️ TDS % is a statutory rate under Indian Income Tax Act (Section 194M) and cannot be changed via this form. Contact your CA / legal team.
        </div>
      )}

      {/* Save / Cancel */}
      {editing && (
        <div className="flex gap-3 mt-5">
          <button onClick={handleCancel}
            className="flex-1 py-2.5 border-2 border-border text-t2 font-semibold text-sm rounded-xl hover:bg-surface2 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !trancheOk}
            className="flex-1 py-2.5 bg-navy text-white font-bold text-sm rounded-xl disabled:opacity-50 hover:bg-navy-mid transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
