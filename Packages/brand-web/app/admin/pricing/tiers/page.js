'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

// L1 SaaS subscription tiers — admin-editable, runtime-effective.
// Edits take effect at the NEXT renewal cycle for existing subscriptions;
// new subscriptions created after save get the new values immediately.
// Mirrors the /admin/settings/escrow-fees pattern (admin-web M037).

function fmtINR(n) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}
function fmtLimit(n) {
  if (n === -1) return '∞';
  return Number(n).toLocaleString('en-IN');
}

export default function PricingTiersPage() {
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
    const res = await adminApi.listSubscriptionTiers();
    setLoading(false);
    if (res.success) {
      const list = res.data.tiers || [];
      setTiers(list);
      const f = {};
      list.forEach(t => {
        f[t.tier_key] = {
          name:                       t.name,
          monthly_price_inr:          t.monthly_price_inr,
          max_campaigns:              t.max_campaigns,
          max_sets_per_campaign:      t.max_sets_per_campaign,
          max_influencers_per_cycle:  t.max_influencers_per_cycle,
          max_products:               t.max_products,
          active:                     t.active,
          description:                t.description || '',
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
      const price = parseFloat(f.monthly_price_inr);
      if (isNaN(price) || price < 0) errs[`${t.tier_key}.monthly_price_inr`] = 'Must be ≥ 0';
      for (const lf of ['max_campaigns', 'max_sets_per_campaign', 'max_influencers_per_cycle', 'max_products']) {
        const v = parseInt(f[lf], 10);
        if (isNaN(v) || (v !== -1 && v < 0)) errs[`${t.tier_key}.${lf}`] = 'Use -1 for unlimited or a non-negative integer';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    if (!confirm('Update subscription tiers? Existing subscriptions pick up the new values at next renewal; new subscriptions get them immediately.')) return;
    setSaving(true);
    let allOk = true;
    for (const t of tiers) {
      const f = form[t.tier_key];
      const body = {
        name:                       f.name,
        monthly_price_inr:          parseFloat(f.monthly_price_inr),
        max_campaigns:              parseInt(f.max_campaigns, 10),
        max_sets_per_campaign:      parseInt(f.max_sets_per_campaign, 10),
        max_influencers_per_cycle:  parseInt(f.max_influencers_per_cycle, 10),
        max_products:               parseInt(f.max_products, 10),
        active:                     !!f.active,
        description:                f.description || null,
      };
      const res = await adminApi.updateSubscriptionTier(t.tier_key, body);
      if (!res.success) {
        allOk = false;
        showToast(`${t.tier_key}: ${res.error?.message || 'save failed'}`, 'err');
        break;
      }
    }
    setSaving(false);
    if (allOk) {
      showToast('Subscription tiers updated');
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
    <div className="max-w-5xl">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'}`}>
          {toast.type === 'err' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Subscription Tiers (L1)</h1>
          <p className="text-xs text-t3 mt-0.5">
            Monthly SaaS plans. Brand quotas enforced in quotaCheck middleware. Use -1 for unlimited.
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
        💡 Existing subscriptions keep their current cycle's price; new tier values apply at next renewal.
        New upgrades immediately use the updated values.
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-surface2 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-surface2 text-[11px] font-bold text-t3 uppercase tracking-wide">
            <div className="col-span-2">Tier</div>
            <div className="col-span-2">Price/mo</div>
            <div className="col-span-1">Camps</div>
            <div className="col-span-1">Sets</div>
            <div className="col-span-2">Inf/cycle</div>
            <div className="col-span-2">Products</div>
            <div className="col-span-1">Active</div>
            <div className="col-span-1 text-right">Note</div>
          </div>

          {tiers.map((t, i) => {
            const f = form[t.tier_key] || {};
            const err = (field) => errors[`${t.tier_key}.${field}`];
            return (
              <div key={t.tier_key}
                   className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${i < tiers.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="col-span-2">
                  <div className="text-sm font-bold text-t1 capitalize">{t.tier_key}</div>
                  {editing ? (
                    <input
                      value={f.name || ''}
                      onChange={e => setField(t.tier_key, 'name', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-[11px] text-t2 border border-border rounded outline-none focus:border-navy"
                    />
                  ) : (
                    <div className="text-[11px] text-t3">{f.name}</div>
                  )}
                </div>

                <div className="col-span-2">
                  {editing ? (
                    <>
                      <input
                        type="number" min={0} step={1}
                        value={f.monthly_price_inr ?? ''}
                        onChange={e => setField(t.tier_key, 'monthly_price_inr', e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full px-2 py-1.5 text-sm font-semibold text-t1 border-2 rounded-lg outline-none ${err('monthly_price_inr') ? 'border-red-400' : 'border-navy/30 focus:border-navy'}`}
                      />
                      {err('monthly_price_inr') && <div className="text-[10px] text-red-500 mt-0.5">{err('monthly_price_inr')}</div>}
                    </>
                  ) : (
                    <div className="font-display text-base font-bold text-navy bg-navy-pale px-3 py-1 rounded-lg inline-block">
                      {fmtINR(f.monthly_price_inr)}
                    </div>
                  )}
                </div>

                {[
                  { f: 'max_campaigns',             cs: 'col-span-1' },
                  { f: 'max_sets_per_campaign',     cs: 'col-span-1' },
                  { f: 'max_influencers_per_cycle', cs: 'col-span-2' },
                  { f: 'max_products',              cs: 'col-span-2' },
                ].map(({ f: field, cs }) => (
                  <div key={field} className={cs}>
                    {editing ? (
                      <>
                        <input
                          type="number" step={1}
                          placeholder="-1 = ∞"
                          value={f[field] ?? ''}
                          onChange={e => setField(t.tier_key, field, e.target.value === '' ? '' : Number(e.target.value))}
                          className={`w-full px-2 py-1.5 text-sm font-semibold text-t1 border-2 rounded-lg outline-none ${err(field) ? 'border-red-400' : 'border-navy/30 focus:border-navy'}`}
                        />
                        {err(field) && <div className="text-[10px] text-red-500 mt-0.5">{err(field)}</div>}
                      </>
                    ) : (
                      <div className="text-sm font-semibold text-t1">{fmtLimit(f[field])}</div>
                    )}
                  </div>
                ))}

                <div className="col-span-1">
                  {editing ? (
                    <input
                      type="checkbox"
                      checked={!!f.active}
                      onChange={e => setField(t.tier_key, 'active', e.target.checked)}
                      className="w-4 h-4"
                    />
                  ) : (
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${f.active ? 'bg-teal-100 text-teal-700' : 'bg-surface2 text-t3'}`}>
                      {f.active ? 'ON' : 'OFF'}
                    </span>
                  )}
                </div>

                <div className="col-span-1 text-right">
                  <div className="text-[10px] text-t3 leading-tight">{t.description || '—'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
