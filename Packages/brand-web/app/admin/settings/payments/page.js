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
  // Wave 1 — GST rate (centralized from previously hardcoded 18% in 2 sites)
  {
    key: 'gst_pct', label: 'GST (%)',
    note: 'Applied on subscription invoices + (Wave 2) protection fee + commerce commission. Default 18%.',
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
    note: 'Auto-released N days after content live (configurable below).',
    type: 'number', min: 1, max: 98, step: 1, suffix: '%',
  },
  // Wave 1 — T3 timing (was hardcoded 30 days)
  {
    key: 'tranche_3_release_after_days', label: 'T3 Release After (days)',
    note: 'Number of days after content_live before T3 releases. Default 30.',
    type: 'number', min: 0, max: 90, step: 1, suffix: 'd',
  },
  {
    key: 'tds_pct', label: 'TDS on Withdrawal (%)',
    note: 'Statutory — deducted at influencer withdrawal time (Section 194M). Per-influencer overrides apply.',
    type: 'number', min: 0, max: 30, step: 0.5, suffix: '%',
  },
  // Wave 1 — TCS rate (Sec 52 CGST). Toggle is below in the Tax & Identity section.
  {
    key: 'tcs_pct', label: 'TCS (%)',
    note: 'Sec 52 CGST: deducted from brand portion on commerce purchases when active. Default 1%.',
    type: 'number', min: 0, max: 5, step: 0.1, suffix: '%',
  },
  {
    key: 'offer_expiry_hours', label: 'Offer Expiry (hours)',
    note: 'Offers auto-expire after this many hours if influencer does not respond.',
    type: 'number', min: 12, max: 168, step: 1, suffix: 'h',
  },
  {
    key: 'return_window_days', label: 'Default Commission Return Window (days)',
    note: 'Global fallback when no per-category window is set. Edit per-category at /admin/pricing/categories.',
    type: 'number', min: 0, max: 90, step: 1, suffix: 'd',
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
    allow_commission_negotiation: cfg.allowCommissionNegotiation !== false,
    // Wave 1 — tax + identity + T3 timing
    gst_pct:                     cfg.gstPct,
    tcs_pct:                     cfg.tcsPct,
    tcs_active:                  cfg.tcsActive === true,
    tcs_active_from_date:        cfg.tcsActiveFromDate || '',
    platform_gstin:              cfg.platformGstin || '',
    platform_business_name:      cfg.platformBusinessName || '',
    platform_business_address:   cfg.platformBusinessAddress || '',
    platform_state_code:         cfg.platformStateCode || '',
    invoice_prefix_subscription: cfg.invoicePrefixSubscription || 'INF-SUB',
    invoice_prefix_commerce:     cfg.invoicePrefixCommerce || 'INF-COM',
    tranche_3_release_after_days: cfg.tranche3ReleaseAfterDays,
    tranche_3_release_time_ist:   cfg.tranche3ReleaseTimeIst || '03:00:00',
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

      {/* ── Negotiation policy ─────────────────────────────────────────── */}
      {!loading && (
        <div className="mt-5 bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-t1">Allow Commission Negotiation</span>
                <div className="text-[11px] text-t3 mt-0.5">
                  When enabled, influencers can counter-propose the commission % (not just the fee) on
                  conversion / hybrid campaigns. When disabled, commission is fixed by the brand.
                </div>
              </div>
              {editing ? (
                <button
                  type="button"
                  onClick={() => setField('allow_commission_negotiation', !form.allow_commission_negotiation)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${form.allow_commission_negotiation ? 'bg-teal-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.allow_commission_negotiation ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <div className={`font-display text-xs font-bold px-3 py-1 rounded-lg flex-shrink-0 ${form.allow_commission_negotiation ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>
                  {form.allow_commission_negotiation ? 'ENABLED' : 'DISABLED'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tranche sum indicator */}
      {editing && (
        <div className={`mt-3 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${trancheOk ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'}`}>
          <span>{trancheOk ? '✓' : '✗'}</span>
          <span>Tranche sum: {trancheSum.toFixed(1)}% {trancheOk ? '(valid)' : '— must equal 100%'}</span>
        </div>
      )}

      {/* TDS note */}
      {editing && (
        <div className="mt-2 text-[11px] text-t3 px-1">
          ⚠️ TDS % is a statutory rate (Indian Income Tax Act, Section 194M). Confirm with your CA before changing the global rate. Per-influencer overrides + exemption available on each influencer&apos;s admin page.
        </div>
      )}

      {/* ── Wave 1: Tax & Identity (TCS toggle, platform GSTIN, invoice prefixes, T3 release time) ── */}
      {!loading && (
        <div className="mt-5 bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 bg-surface2 border-b border-border">
            <h2 className="text-sm font-bold text-t1">Tax & Identity</h2>
            <p className="text-[11px] text-t3 mt-0.5">
              Platform-level tax + invoice identity. Wave 2/3 will use these on Protection Fee invoices, Commerce
              settlement, and TCS deduction.
            </p>
          </div>

          {/* TCS toggle + active-from date */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-t1">TCS Active</span>
                <div className="text-[11px] text-t3 mt-0.5">
                  Enable once you cross the ₹50L ecommerce-operator turnover threshold (Sec 52 CGST). When active, TCS
                  is deducted from the brand&apos;s portion of every follower purchase. Default off until you&apos;re ready.
                </div>
              </div>
              {editing ? (
                <button
                  type="button"
                  onClick={() => setField('tcs_active', !form.tcs_active)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${form.tcs_active ? 'bg-teal-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.tcs_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <div className={`font-display text-xs font-bold px-3 py-1 rounded-lg flex-shrink-0 ${form.tcs_active ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>
                  {form.tcs_active ? 'ENABLED' : 'DISABLED'}
                </div>
              )}
            </div>

            {form.tcs_active && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-t3">Active from:</span>
                {editing ? (
                  <input type="date"
                    value={form.tcs_active_from_date || ''}
                    onChange={e => setField('tcs_active_from_date', e.target.value)}
                    className="px-2 py-1 text-xs border-2 border-navy/30 rounded-lg outline-none focus:border-navy" />
                ) : (
                  <span className="text-xs font-semibold text-t1">{form.tcs_active_from_date || 'now'}</span>
                )}
              </div>
            )}
          </div>

          {/* T3 release time-of-day */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-t1">T3 Release Time (IST)</span>
                <div className="text-[11px] text-t3 mt-0.5">
                  The clock time at which T3 tranches fire on the day-N boundary (cron runs hourly). Default 03:00 IST — off-hours.
                </div>
              </div>
              {editing ? (
                <input type="time" step="60"
                  value={(form.tranche_3_release_time_ist || '03:00:00').slice(0, 5)}
                  onChange={e => setField('tranche_3_release_time_ist', e.target.value + ':00')}
                  className="px-3 py-1.5 text-sm font-bold text-t1 border-2 border-navy/30 rounded-lg outline-none focus:border-navy" />
              ) : (
                <div className="font-display text-base font-bold text-navy bg-navy-pale px-3 py-1 rounded-lg">
                  {(form.tranche_3_release_time_ist || '03:00:00').slice(0, 5)}
                </div>
              )}
            </div>
          </div>

          {/* Platform identity fields */}
          {['platform_gstin', 'platform_business_name', 'platform_business_address', 'platform_state_code',
            'invoice_prefix_subscription', 'invoice_prefix_commerce'].map((key, idx, arr) => {
            const labels = {
              platform_gstin:              'Platform GSTIN',
              platform_business_name:      'Platform Business Name',
              platform_business_address:   'Platform Business Address',
              platform_state_code:         'Platform State Code',
              invoice_prefix_subscription: 'Subscription Invoice Prefix',
              invoice_prefix_commerce:     'Commerce Invoice Prefix',
            };
            const notes = {
              platform_gstin:              '15-character GSTIN (e.g. 29ABCDE1234F1Z5). Appears on every subscription invoice.',
              platform_business_name:      'Legal entity name as registered with GST.',
              platform_business_address:   'Registered business address — appears on invoices.',
              platform_state_code:         '2-character state code (e.g. KA, MH). Used for IGST vs CGST/SGST split.',
              invoice_prefix_subscription: 'Prefix for subscription invoice numbers. Default INF-SUB.',
              invoice_prefix_commerce:     'Prefix for commerce invoice numbers. Default INF-COM.',
            };
            const isLast = idx === arr.length - 1;
            const isMultiline = key === 'platform_business_address';
            const maxLen      = key === 'platform_gstin' ? 15
                              : key === 'platform_state_code' ? 2
                              : 255;
            return (
              <div key={key} className={`px-5 py-4 ${isLast ? '' : 'border-b border-border'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-t1">{labels[key]}</span>
                    <div className="text-[11px] text-t3 mt-0.5">{notes[key]}</div>
                  </div>
                  {editing ? (
                    isMultiline ? (
                      <textarea
                        value={form[key] || ''}
                        onChange={e => setField(key, e.target.value)}
                        rows={2}
                        className="w-72 px-3 py-1.5 text-xs border-2 border-navy/30 rounded-lg outline-none focus:border-navy" />
                    ) : (
                      <input type="text"
                        value={form[key] || ''}
                        maxLength={maxLen}
                        onChange={e => setField(key, e.target.value)}
                        className="w-56 px-3 py-1.5 text-sm font-mono text-t1 border-2 border-navy/30 rounded-lg outline-none focus:border-navy" />
                    )
                  ) : (
                    <div className="font-mono text-xs text-t2 bg-surface2 px-3 py-1 rounded-lg max-w-[280px] truncate">
                      {form[key] || '—'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
