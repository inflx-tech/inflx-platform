'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminApi } from '../../../../lib/api';

const CATEGORIES = [
  { key: 'influencer',  label: 'Influencer' },
  { key: 'campaigns',   label: 'Campaigns' },
  { key: 'products',    label: 'Products' },
  { key: 'brand_store', label: 'Brand store' },
  { key: 'support',     label: 'Support' },
];

const AREA_SCOPES = ['city', 'state', 'all_india'];

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-t2">{value || '—'}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = { approved: 'bg-teal-pale text-teal-deep', rejected: 'bg-red-pale text-red', pending: 'bg-gold-pale text-yellow-700', suspended: 'bg-surface2 text-t3' };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold border ${cfg[status] || ''}`}>{status}</span>;
}

// Phase A14 — Feature Overrides card. Embeds on the brand detail page.
// Replicates the tier editor Section C primitives with a per-row
// "Use tier default" toggle. Save reconciles override state into a
// bulk PUT (upsert non-defaults, delete previously-overridden rows
// that are now reset to default).
function FeatureOverridesCard({ brandId, onToast }) {
  const [rows, setRows]       = useState([]);  // per-feature editable state
  const [tierKey, setTierKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await adminApi.listBrandOverrides(brandId);
      if (!res.success) { setErr(res.error?.message || 'Failed to load overrides'); return; }
      const features = res.data?.features || [];
      setTierKey(res.data?.tier_key || '');
      setRows(features.map(f => ({
        feature_key:    f.feature_key,
        label:          f.label,
        category:       f.category,
        feature_type:   f.feature_type,
        unit:           f.unit,
        description:    f.description,
        is_enforced:    f.is_enforced,
        tier_default:   f.tier_default || {},
        was_overridden: !!f.override,
        use_tier_default: !f.override,
        included:       f.override?.included ?? f.tier_default?.included ?? false,
        quota_value:    f.override?.quota_value ?? f.tier_default?.quota_value ?? '',
        config:         f.override?.config       ?? f.tier_default?.config       ?? {},
        notes:          f.override?.notes        ?? '',
      })));
    } catch (e) {
      setErr(e?.message || 'Failed to load overrides');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [brandId]);

  function updateRow(idx, patch) {
    setRows(list => list.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function updateRowConfig(idx, key, value) {
    setRows(list => list.map((r, i) => i === idx ? { ...r, config: { ...r.config, [key]: value } } : r));
  }

  async function save() {
    setSaving(true); setErr('');
    try {
      const items = [];
      for (const r of rows) {
        if (r.use_tier_default) {
          if (r.was_overridden) {
            // Revert: delete the override row.
            items.push({ feature_key: r.feature_key, override: null });
          }
          // Else: row is at tier default + wasn't overridden → no-op.
          continue;
        }
        // Override active — upsert.
        items.push({
          feature_key: r.feature_key,
          override: {
            included:    !!r.included,
            quota_value: r.feature_type === 'quota' && r.quota_value !== '' ? parseFloat(r.quota_value) : null,
            config:      r.feature_type === 'config' ? r.config : {},
            notes:       r.notes || null,
          },
        });
      }
      if (items.length === 0) {
        onToast('No changes to save');
        setSaving(false);
        return;
      }
      const res = await adminApi.upsertBrandOverrides(brandId, items);
      if (!res.success) { setErr(res.error?.message || 'Save failed'); return; }
      const { upserted = 0, deleted = 0 } = res.data || {};
      onToast(`Overrides saved — ${upserted} upserted, ${deleted} reverted`);
      await load();
    } catch (e) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="bg-white rounded-xl border border-border p-5 mb-4">
      <h3 className="font-display text-sm font-bold text-t1 mb-2">Feature Overrides</h3>
      <div className="text-xs text-t3">Loading…</div>
    </div>
  );

  const grouped = CATEGORIES.map(c => ({ ...c, rows: rows.filter(r => r.category === c.key) }));

  return (
    <div className="bg-white rounded-xl border border-border p-5 mb-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-display text-sm font-bold text-t1">Feature Overrides</h3>
        {tierKey && <span className="text-xs text-t3">Brand is on <strong className="text-t2 font-mono">{tierKey}</strong></span>}
      </div>
      <p className="text-xs text-t3 mb-4">
        Per-brand exceptions to tier defaults. Untick "Use tier default" on any feature
        to set a brand-specific value. Empty table = identical entitlements to the tier.
      </p>

      {err && <div className="mb-3 p-2 bg-red-pale text-red rounded-lg text-xs">{err}</div>}

      {grouped.map(cat => (
        <div key={cat.key} className="mb-5">
          <h4 className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">{cat.label}</h4>
          <div className="space-y-2">
            {cat.rows.map((r) => {
              const idx = rows.indexOf(r);
              const overridden = !r.use_tier_default;
              return (
                <div
                  key={r.feature_key}
                  className={`p-3 border rounded-lg ${overridden ? 'border-navy/30 bg-navy-pale/30' : 'border-border2 bg-white'}`}
                >
                  <div className="flex items-start gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer pt-0.5 select-none">
                      <input
                        type="checkbox"
                        checked={r.use_tier_default}
                        onChange={e => updateRow(idx, { use_tier_default: e.target.checked })}
                      />
                      <span className="text-[10px] text-t3 font-medium">Use tier default</span>
                    </label>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{r.label}</span>
                        <span className="text-xs text-t3 font-mono">{r.feature_key}</span>
                        <span className="text-xs text-t3">· {r.feature_type}</span>
                        {r.is_enforced && <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">ENFORCED</span>}
                        {r.was_overridden && <span className="text-[9px] font-bold text-navy bg-navy-pale px-1.5 py-0.5 rounded">OVERRIDE LIVE</span>}
                      </div>
                      {r.description && <div className="text-xs text-t2 mt-0.5">{r.description}</div>}

                      {/* Tier-default summary (always visible) */}
                      <div className="text-[11px] text-t3 mt-1">
                        Tier default:&nbsp;
                        {r.feature_type === 'boolean' || r.feature_type === 'baseline' ? (
                          <span className="font-mono">{r.tier_default.included ? 'included' : 'not included'}</span>
                        ) : r.feature_type === 'quota' ? (
                          <span className="font-mono">
                            {r.tier_default.included ? `${r.tier_default.quota_value ?? '—'} ${r.unit || ''}`.trim() : 'not included'}
                          </span>
                        ) : (
                          <span className="font-mono">{JSON.stringify(r.tier_default.config || {})}</span>
                        )}
                      </div>

                      {/* Override editor (only when override is active) */}
                      {overridden && (
                        <div className="mt-2 space-y-2">
                          {(r.feature_type === 'boolean' || r.feature_type === 'baseline') && (
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" checked={!!r.included} onChange={e => updateRow(idx, { included: e.target.checked })} />
                              <span>Included for this brand</span>
                            </label>
                          )}
                          {r.feature_type === 'quota' && (
                            <div className="flex items-center gap-2 text-xs">
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={!!r.included} onChange={e => updateRow(idx, { included: e.target.checked })} />
                                <span>Included</span>
                              </label>
                              {r.included && (
                                <>
                                  <span className="text-t2">Limit:</span>
                                  <input
                                    type="number"
                                    value={r.quota_value}
                                    onChange={e => updateRow(idx, { quota_value: e.target.value })}
                                    placeholder="-1 = unlimited"
                                    className="w-28 border border-border2 rounded px-2 py-1 text-xs"
                                  />
                                  {r.unit && <span className="text-t3">{r.unit}</span>}
                                </>
                              )}
                            </div>
                          )}
                          {r.feature_type === 'config' && (
                            <>
                              <label className="flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={!!r.included} onChange={e => updateRow(idx, { included: e.target.checked })} />
                                <span>Included</span>
                              </label>
                              {r.included && r.feature_key === 'discover_filter' && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <label className="block">Area scope
                                    <select value={r.config.area_scope || 'city'} onChange={e => updateRowConfig(idx, 'area_scope', e.target.value)} className="w-full mt-0.5 border border-border2 rounded px-2 py-1">
                                      {AREA_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </label>
                                  <label className="block">Niches limit (-1 = unlimited)
                                    <input type="number" value={r.config.niches_limit ?? ''} onChange={e => updateRowConfig(idx, 'niches_limit', parseInt(e.target.value, 10) || 0)} className="w-full mt-0.5 border border-border2 rounded px-2 py-1" />
                                  </label>
                                </div>
                              )}
                              {r.included && r.feature_key === 'open_group_broadcast' && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <label className="block">Area scope
                                    <select value={r.config.area_scope || 'city'} onChange={e => updateRowConfig(idx, 'area_scope', e.target.value)} className="w-full mt-0.5 border border-border2 rounded px-2 py-1">
                                      {AREA_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </label>
                                  <label className="block">Max recipients (-1 = unlimited)
                                    <input type="number" value={r.config.max_recipients ?? ''} onChange={e => updateRowConfig(idx, 'max_recipients', parseInt(e.target.value, 10) || 0)} className="w-full mt-0.5 border border-border2 rounded px-2 py-1" />
                                  </label>
                                </div>
                              )}
                            </>
                          )}
                          <label className="block text-xs">
                            <span className="text-t3">Notes</span>
                            <input type="text" value={r.notes} onChange={e => updateRow(idx, { notes: e.target.value })} placeholder="why this brand has the override (admin-internal)" className="w-full mt-0.5 border border-border2 rounded px-2 py-1" />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {cat.rows.length === 0 && <div className="text-xs text-t3 italic">No features in this category</div>}
          </div>
        </div>
      ))}

      <div className="flex justify-end mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save Overrides'}
        </button>
      </div>
    </div>
  );
}

export default function BrandProfilePage() {
  const { id } = useParams();
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feeInput, setFeeInput] = useState('');
  const [savingFee, setSavingFee] = useState(false);
  // Wave 1 — per-brand L3 commerce-commission override.
  const [commerceInput, setCommerceInput] = useState('');
  const [savingCommerce, setSavingCommerce] = useState(false);
  const [toast, setToast] = useState('');
  // The decision, made here rather than on a different page.
  const [decision, setDecision] = useState(null);   // 'approved' | 'rejected' | 'suspended'
  const [reason, setReason] = useState('');
  const [deciding, setDeciding] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  /**
   * Approve or reject without leaving the page.
   * These buttons used to live only on the Approvals list, so an admin read the account
   * here, navigated away, and found the person again in a list to act on them. That is
   * how the wrong account gets approved.
   */
  async function decide() {
    if (decision === 'rejected' && !reason.trim()) { showToast('A reason is required to reject'); return; }
    setDeciding(true);
    const res = await adminApi.updateBrandStatus(id, {
      status: decision,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
    setDeciding(false);
    if (res.success) {
      setBrand(prev => ({ ...prev, user_status: decision, status: decision }));
      setDecision(null); setReason('');
      showToast(decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Suspended');
    } else {
      showToast(res.error?.message || 'Could not save that');
    }
  }

  async function saveFee() {
    const pct = parseFloat(feeInput);
    if (isNaN(pct) || pct < 0 || pct > 50) { showToast('Enter a valid fee 0–50%'); return; }
    setSavingFee(true);
    const res = await adminApi.setBrandPlatformFee(id, pct);
    setSavingFee(false);
    if (res.success) {
      setBrand(prev => ({ ...prev, platform_fee_pct: res.data.platform_fee_pct }));
      setFeeInput('');
      showToast(`Platform fee updated to ${res.data.platform_fee_pct}%`);
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

  // Wave 1 — save or clear the per-brand L3 commerce-commission override.
  // Pass `clear=true` to set the value to null (revert to category × path lookup).
  async function saveCommerceOverride(clear = false) {
    const value = clear ? null : parseFloat(commerceInput);
    if (!clear && (isNaN(value) || value < 0 || value > 50)) {
      showToast('Enter a valid commission 0–50% (or click Clear to revert to category default)');
      return;
    }
    setSavingCommerce(true);
    const res = await adminApi.setBrandCommerceCommissionOverride(id, value);
    setSavingCommerce(false);
    if (res.success) {
      setBrand(prev => ({ ...prev, commerce_commission_override_pct: res.data.commerce_commission_override_pct }));
      setCommerceInput('');
      showToast(clear
        ? 'Commerce commission override cleared — using category × path defaults'
        : `Commerce commission override set to ${res.data.commerce_commission_override_pct}%`);
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

  useEffect(() => {
    async function load() {
      const res = await adminApi.getBrandById(id);
      setLoading(false);
      if (res.success) setBrand(res.data?.brand || res.data);
      else setError(res.error?.message || 'Failed to load brand');
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-t3 text-sm">Loading...</div>;
  if (error) return <div className="p-4 bg-red-pale rounded-xl text-red text-sm">{error}</div>;
  if (!brand) return null;

  function fmtMoney(p) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p || 0);
  }

  const status     = brand.user_status || brand.status;
  const isApproved = status === 'approved';
  const isPending  = status === 'pending';

  // How long someone has been waiting is the one thing a queue cannot tell you at a
  // glance, and it is the difference between "new" and "forgotten".
  const waitingDays = brand.created_at
    ? Math.floor((Date.now() - new Date(brand.created_at).getTime()) / 86400000)
    : null;

  // What they did not give us. Neither is required to trade — but they are the easiest
  // things to ask for, so the screen should say which are absent rather than leave the
  // admin to notice the gaps.
  /**
   * Does the pin they dropped agree with the address they typed?
   * Contract: features/admin-account-review (item 4)
   *
   * Both values are already stored, so this costs nothing. When a Vijayawada address
   * carries a pin in another state, that is the single most useful thing an approval
   * screen can tell you.
   *
   * Deliberately a SOFT signal. A disagreement is not proof of anything — a pin can
   * legitimately resolve to the larger city that contains a locality, and Indian city
   * names have several accepted spellings. So it says what disagrees and leaves the
   * judgement where it belongs. It never blocks approval.
   */
  const pinCheck = (() => {
    const pin = (brand.formatted_address || '').toLowerCase();
    if (!brand.latitude && !brand.formatted_address) return { kind: 'none' };
    if (!pin) return { kind: 'coords' };

    const typed = [brand.locality, brand.city, brand.state].filter(Boolean);
    if (typed.length === 0) return { kind: 'nothing-typed' };

    const hit = typed.find(t => pin.includes(String(t).toLowerCase()));
    return hit ? { kind: 'agrees', on: hit } : { kind: 'differs', typed: typed.join(', ') };
  })();

  const missing = [
    !brand.gstin && 'GST number',
    !brand.address_line && 'street address',
    !brand.pincode && 'pincode',
    !brand.latitude && 'map pin',
    !brand.logo_url && 'logo',
  ].filter(Boolean);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <a href="/admin/brands" className="text-xs text-t3 hover:text-t2">← Brands</a>
        <span className="text-t3">/</span>
        <span className="text-xs text-t2 font-medium">Brand Profile</span>
      </div>

      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-pale flex items-center justify-center text-sm font-bold text-navy font-display">
              {(brand.business_name || brand.name || '').slice(0, 2).toUpperCase()}
            </div>
            <div>
              {/* The business is what is being reviewed. This read brand_name, which the
                  server does not send, so it fell through to the CONTACT's name — "Fashion
                  hub" displayed as "Kartikeya". Contract: features/admin-account-review */}
              <div className="font-display text-base font-bold text-t1">{brand.business_name || brand.name}</div>
              <div className="text-xs text-t3">{brand.name}{brand.name ? ' · ' : ''}{brand.phone}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPending && waitingDays != null && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-pale text-yellow-700 whitespace-nowrap">
                {waitingDays === 0 ? 'today' : waitingDays === 1 ? 'waiting 1 day' : `waiting ${waitingDays} days`}
              </span>
            )}
            <StatusBadge status={status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" value={brand.category} />
          {/* City lives on the user record. This asked for brand.city, which does not
              exist, so it was always a dash. */}
          <Field label="City" value={[brand.city, brand.state].filter(Boolean).join(', ')} />
          {/* The column is gstin. gst_number was never a field, so a supplied GST number
              still showed as missing. */}
          <Field label="GST Number" value={brand.gstin || 'Not provided'} />
          <Field label="Registered" value={brand.created_at ? new Date(brand.created_at).toLocaleDateString('en-IN') : '—'} />
        </div>

        {/* Where they are — collected at sign-up and never once displayed, which is the
            single most useful thing when deciding whether a business is real. */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">Address</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Street" value={brand.address_line || 'Not provided'} />
            <Field label="Area · Pincode" value={[brand.locality, brand.pincode].filter(Boolean).join(' — ') || 'Not provided'} />
            <Field label="Map pin" value={brand.formatted_address || (brand.latitude ? `${brand.latitude}, ${brand.longitude}` : 'No pin dropped')} />
            <Field label="Wallet Balance" value={fmtMoney(brand.wallet_balance)} />
          </div>

          {pinCheck.kind === 'agrees' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-teal-deep">
              <span className="w-1.5 h-1.5 rounded-full bg-teal flex-shrink-0" />
              The pin agrees with the address they typed ({pinCheck.on}).
            </div>
          )}
          {pinCheck.kind === 'differs' && (
            <div className="mt-3 p-3 bg-gold-pale rounded-lg text-xs text-yellow-700">
              <strong>Worth a look.</strong> They typed <strong>{pinCheck.typed}</strong>, but
              the pin they dropped resolves to <strong>{brand.formatted_address}</strong>.
              Those may still be the same place — a pin often names the larger city, and city
              names have several spellings — but it is worth asking.
            </div>
          )}
          {pinCheck.kind === 'coords' && (
            <div className="mt-3 text-xs text-t3">
              A pin was dropped but never resolved to an address, so it cannot be compared.
            </div>
          )}
          {pinCheck.kind === 'none' && (
            <div className="mt-3 text-xs text-t3">
              No pin was dropped, so there is nothing to check the address against.
            </div>
          )}
        </div>

        {/* What is absent. Said plainly, because an admin should not have to notice
            gaps by scanning for dashes. Contract: features/admin-account-review */}
        {isPending && missing.length > 0 && (
          <div className="mt-4 p-3 bg-surface2 rounded-lg">
            <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">Before you decide</div>
            <div className="text-xs text-t2">
              No {missing.join(', no ')}. None of these are required to trade — they are
              simply the easiest things to ask for if you want more certainty.
            </div>
          </div>
        )}

        {/* The decision, on the page that holds the facts. */}
        {status !== 'rejected' && (
          <div className="mt-4 pt-4 border-t border-border">
            {!decision ? (
              <div className="flex gap-2 flex-wrap">
                {!isApproved && (
                  <button onClick={() => setDecision('approved')}
                    className="px-5 py-2.5 bg-teal text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity">
                    Approve
                  </button>
                )}
                <button onClick={() => setDecision('rejected')}
                  className="px-5 py-2.5 bg-white border-2 border-red/30 text-red font-bold text-xs rounded-xl hover:bg-red-pale transition-colors">
                  Reject…
                </button>
                {isApproved && (
                  <button onClick={() => setDecision('suspended')}
                    className="px-5 py-2.5 bg-white border-2 border-border2 text-t2 font-bold text-xs rounded-xl hover:bg-surface2 transition-colors">
                    Suspend…
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold text-t1 mb-2">
                  {decision === 'approved' ? `Approve ${brand.business_name || 'this brand'}?`
                    : decision === 'rejected' ? 'Reject — tell them why'
                    : 'Suspend — tell them why'}
                </div>
                {decision !== 'approved' && (
                  <textarea
                    value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="They will see this. Be specific enough to act on."
                    rows={3}
                    className="w-full border-2 border-border2 rounded-xl px-3 py-2 text-xs mb-2"
                  />
                )}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={decide} disabled={deciding}
                    className="px-5 py-2.5 bg-navy text-white font-bold text-xs rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity">
                    {deciding ? 'Saving…' : 'Confirm'}
                  </button>
                  <button onClick={() => { setDecision(null); setReason(''); }}
                    className="px-4 py-2.5 bg-white border-2 border-border2 text-t2 font-bold text-xs rounded-xl">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {brand.rejection_reason && (
          <div className="mt-4 p-3 bg-red-pale border border-red/15 rounded-lg">
            <div className="text-xs font-bold text-red mb-1">Rejection Reason</div>
            <div className="text-xs text-t2">{brand.rejection_reason}</div>
          </div>
        )}
      </div>

      {/* Trading settings. Only for a brand that is already IN — you cannot set a
          meaningful fee for someone you have not let in yet, and leading a review with
          fee controls buries the facts the decision actually needs.
          Contract: features/admin-account-review (item 3) */}
      {isApproved && (
      <>
      {/* Per-brand platform fee override */}
      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <h3 className="font-display text-sm font-bold text-t1 mb-1">Override Platform Fee</h3>
        <p className="text-xs text-t3 mb-4">
          Current: <strong>{brand.platform_fee_pct ?? 8}%</strong> (global default is 8%).
          Override this brand's fee here.
        </p>
        <div className="flex gap-2">
          <div className="flex items-center border-2 border-border2 rounded-xl overflow-hidden flex-1">
            <input
              type="number"
              value={feeInput}
              onChange={e => setFeeInput(e.target.value)}
              placeholder={String(brand.platform_fee_pct ?? 8)}
              min="0"
              max="50"
              step="0.5"
              className="flex-1 px-3 py-2.5 text-sm outline-none"
            />
            <span className="px-3 py-2.5 bg-surface2 text-t3 text-sm font-bold border-l border-border2">%</span>
          </div>
          <button
            onClick={saveFee}
            disabled={savingFee || !feeInput}
            className="px-5 py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {savingFee ? 'Saving…' : 'Save Override'}
          </button>
        </div>
      </div>

      {/* Wave 1 — Per-brand L3 commerce-commission override.
          When set, overrides the category × path lookup in pricing.service.computeL3OnFollowerTxn
          (Wave 1 commit 1). Null = brand uses category × path defaults. */}
      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <h3 className="font-display text-sm font-bold text-t1 mb-1">L3 Commerce Commission Override</h3>
        <p className="text-xs text-t3 mb-4">
          Current:{' '}
          <strong>
            {brand.commerce_commission_override_pct != null
              ? `${brand.commerce_commission_override_pct}% (override)`
              : 'using category × path defaults'}
          </strong>
          . Set a per-brand rate to bypass category lookup, or clear to revert.
        </p>
        <div className="flex gap-2">
          <div className="flex items-center border-2 border-border2 rounded-xl overflow-hidden flex-1">
            <input
              type="number"
              value={commerceInput}
              onChange={e => setCommerceInput(e.target.value)}
              placeholder={brand.commerce_commission_override_pct != null
                ? String(brand.commerce_commission_override_pct)
                : 'category default'}
              min="0"
              max="50"
              step="0.1"
              className="flex-1 px-3 py-2.5 text-sm outline-none"
            />
            <span className="px-3 py-2.5 bg-surface2 text-t3 text-sm font-bold border-l border-border2">%</span>
          </div>
          <button
            onClick={() => saveCommerceOverride(false)}
            disabled={savingCommerce || !commerceInput}
            className="px-4 py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {savingCommerce ? 'Saving…' : 'Save Override'}
          </button>
          <button
            onClick={() => saveCommerceOverride(true)}
            disabled={savingCommerce || brand.commerce_commission_override_pct == null}
            className="px-4 py-2.5 bg-white border-2 border-border2 text-t2 font-bold text-xs rounded-xl hover:bg-surface2 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Phase A14 — Feature Overrides */}
      <FeatureOverridesCard brandId={id} onToast={showToast} />
      </>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>}
    </div>
  );
}
