'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

// L2 Campaign Protection Fee tiers — admin-editable, runtime-effective.
// Lookup at campaign publish: sum of engagement+hybrid set_budgets falls in
// one tier band; that tier's fee_pct is locked on the campaigns row.

function fmtINR(n) {
  if (n == null) return '∞';
  return '₹' + Number(n).toLocaleString('en-IN');
}

export default function EscrowFeesPage() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function load() {
    setLoading(true);
    const res = await adminApi.listEscrowFeeTiers();
    setLoading(false);
    if (res.success) {
      const list = res.data.tiers || [];
      setTiers(list);
      const f = {};
      list.forEach(t => {
        f[t.tier_key] = {
          min_amount_inr: t.min_amount_inr,
          max_amount_inr: t.max_amount_inr,
          fee_pct:        t.fee_pct,
          description:    t.description || '',
        };
      });
      setForm(f);
    } else {
      showToast(res.error?.message || 'Failed to load tiers', 'err');
    }
  }

  useEffect(() => { load(); }, []);

  function setField(tierKey, field, value) {
    setForm(prev => ({ ...prev, [tierKey]: { ...prev[tierKey], [field]: value } }));
    setErrors(prev => {
      const n = { ...prev };
      delete n[`${tierKey}.${field}`];
      return n;
    });
  }

  function validate() {
    const errs = {};
    tiers.forEach(t => {
      const f = form[t.tier_key];
      if (!f) return;
      const minN = parseFloat(f.min_amount_inr);
      const fee  = parseFloat(f.fee_pct);
      if (isNaN(minN) || minN < 0) errs[`${t.tier_key}.min_amount_inr`] = 'Must be ≥ 0';
      if (f.max_amount_inr !== '' && f.max_amount_inr !== null) {
        const maxN = parseFloat(f.max_amount_inr);
        if (isNaN(maxN) || maxN < 0) errs[`${t.tier_key}.max_amount_inr`] = 'Must be ≥ 0 or empty';
        else if (!isNaN(minN) && maxN < minN) errs[`${t.tier_key}.max_amount_inr`] = 'Must be ≥ min';
      }
      if (isNaN(fee) || fee < 0 || fee > 50) errs[`${t.tier_key}.fee_pct`] = '0–50';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    if (!confirm('Update escrow fee tiers? Affects all campaigns published after this point — locked rates on existing campaigns are unchanged.')) return;
    setSaving(true);
    let allOk = true;
    for (const t of tiers) {
      const f = form[t.tier_key];
      const body = {
        min_amount_inr: parseFloat(f.min_amount_inr),
        max_amount_inr: (f.max_amount_inr === '' || f.max_amount_inr == null) ? null : parseFloat(f.max_amount_inr),
        fee_pct:        parseFloat(f.fee_pct),
        description:    f.description || null,
      };
      const res = await adminApi.updateEscrowFeeTier(t.tier_key, body);
      if (!res.success) {
        allOk = false;
        showToast(`${t.tier_key}: ${res.error?.message || 'save failed'}`, 'err');
        break;
      }
    }
    setSaving(false);
    if (allOk) {
      showToast('Escrow fee tiers updated');
      setEditing(false);
      load();
    }
  }

  function handleCancel() {
    setEditing(false);
    setErrors({});
    load();
  }

  return (
    <div className="max-w-3xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'}`}>
          {toast.type === 'err' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Campaign Protection Fee (L2)</h1>
          <p className="text-xs text-t3 mt-0.5">
            Tiered escrow fee charged to brand on engagement+hybrid campaigns. Looked up by campaign budget at publish; locked thereafter.
          </p>
        </div>
        {!editing && !loading && (
          <button onClick={() => setEditing(true)}
            className="px-4 py-2 bg-navy text-white font-semibold text-sm rounded-lg hover:bg-navy-mid transition-colors">
            Edit Tiers
          </button>
        )}
      </div>

      <div className="text-xs text-t3 bg-surface2 rounded-lg px-3 py-2 mb-5">
        💡 Brand-wallet hold at publish includes the L2 fee. Per-brand overrides (set on a brand's profile) bypass these tiers entirely.
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-surface2 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-surface2 text-[11px] font-bold text-t3 uppercase tracking-wide">
            <div className="col-span-2">Tier</div>
            <div className="col-span-3">Min (₹)</div>
            <div className="col-span-3">Max (₹)</div>
            <div className="col-span-2">Fee %</div>
            <div className="col-span-2 text-right">Note</div>
          </div>

          {tiers.map((t, i) => {
            const f = form[t.tier_key] || {};
            const errMin = errors[`${t.tier_key}.min_amount_inr`];
            const errMax = errors[`${t.tier_key}.max_amount_inr`];
            const errFee = errors[`${t.tier_key}.fee_pct`];
            return (
              <div key={t.tier_key} className={`grid grid-cols-12 gap-3 px-5 py-4 items-center ${i < tiers.length - 1 ? 'border-b border-border' : ''}`}>
                {/* Tier name */}
                <div className="col-span-2">
                  <div className="text-sm font-bold text-t1 capitalize">{t.tier_key}</div>
                </div>

                {/* Min */}
                <div className="col-span-3">
                  {editing ? (
                    <input
                      type="number" min={0} step={1}
                      value={f.min_amount_inr ?? ''}
                      onChange={e => setField(t.tier_key, 'min_amount_inr', e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full px-3 py-1.5 text-sm font-semibold text-t1 border-2 rounded-lg outline-none ${errMin ? 'border-red-400' : 'border-navy/30 focus:border-navy'}`}
                    />
                  ) : (
                    <div className="text-sm font-semibold text-t1">{fmtINR(f.min_amount_inr)}</div>
                  )}
                  {errMin && <div className="text-[10px] text-red-500 mt-0.5">{errMin}</div>}
                </div>

                {/* Max */}
                <div className="col-span-3">
                  {editing ? (
                    <input
                      type="number" min={0} step={1}
                      placeholder="(empty = ∞)"
                      value={f.max_amount_inr ?? ''}
                      onChange={e => setField(t.tier_key, 'max_amount_inr', e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full px-3 py-1.5 text-sm font-semibold text-t1 border-2 rounded-lg outline-none ${errMax ? 'border-red-400' : 'border-navy/30 focus:border-navy'}`}
                    />
                  ) : (
                    <div className="text-sm font-semibold text-t1">{fmtINR(f.max_amount_inr)}</div>
                  )}
                  {errMax && <div className="text-[10px] text-red-500 mt-0.5">{errMax}</div>}
                </div>

                {/* Fee % */}
                <div className="col-span-2">
                  {editing ? (
                    <div className={`flex items-center gap-1 border-2 rounded-lg overflow-hidden ${errFee ? 'border-red-400' : 'border-navy/30 focus-within:border-navy'}`}>
                      <input
                        type="number" min={0} max={50} step={0.1}
                        value={f.fee_pct ?? ''}
                        onChange={e => setField(t.tier_key, 'fee_pct', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-sm font-bold text-t1 outline-none"
                      />
                      <span className="px-2 text-xs text-t3 bg-surface2 h-full flex items-center font-semibold border-l border-border">%</span>
                    </div>
                  ) : (
                    <div className="font-display text-base font-bold text-navy bg-navy-pale px-3 py-1 rounded-lg inline-block">
                      {f.fee_pct}%
                    </div>
                  )}
                  {errFee && <div className="text-[10px] text-red-500 mt-0.5">{errFee}</div>}
                </div>

                {/* Description */}
                <div className="col-span-2 text-right">
                  <div className="text-[11px] text-t3 leading-tight">{t.description}</div>
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
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-navy text-white font-bold text-sm rounded-xl disabled:opacity-50 hover:bg-navy-mid transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
