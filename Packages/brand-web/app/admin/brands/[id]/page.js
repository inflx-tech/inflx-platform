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

/** "2h ago" — for the "Pending · submitted 2h ago" pill. Null when there is no timestamp. */
function relTime(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

/** The three pills of the review table: ok (teal), miss (red), new (gold). Dark text on a pale ground, always. */
function Tag({ kind = 'ok', children }) {
  const cls = kind === 'miss' ? 'bg-red-pale text-red' : kind === 'new' ? 'bg-gold-pale text-yellow-700' : 'bg-teal-pale text-teal-deep';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap align-middle ${cls}`}>{children}</span>;
}

/**
 * One row of the review table (mockup A1). `missing` is the server's verdict from the one
 * completeness rule — when set, the cell shows the Missing tag whatever the value.
 */
function Row({ label, missing, mono, children }) {
  const kids  = Array.isArray(children) ? children : [children];
  const empty = kids.every(c => c == null || c === '' || c === false);
  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-3 text-xs text-t3 w-[40%] align-top">{label}</td>
      <td className={`py-2 text-sm text-t2 ${mono ? 'font-mono tabular-nums' : ''}`}>
        {missing ? <Tag kind="miss">Missing</Tag> : (empty ? <span className="text-t3">—</span> : children)}
      </td>
    </tr>
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
  // registration-and-profile §9A.1 — the siblings GET /brands/:id sends beside `brand`:
  // the one completeness rule (§6.2), its labels, the branches (city/state live on the main
  // branch) and when the brand pressed Submit for review.
  const [review, setReview] = useState({ completeness: null, missing_fields: [], branches: [], submitted_for_review_at: null });

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

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
      if (res.success) {
        setBrand(res.data?.brand || res.data);
        setReview({
          completeness:            res.data?.completeness || null,
          missing_fields:          res.data?.missing_fields || res.data?.completeness?.missing_labels || [],
          branches:                res.data?.branches || [],
          submitted_for_review_at: res.data?.submitted_for_review_at || null,
        });
      }
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

  // registration-and-profile §9A.1 — the missing list is the server's one rule (§6.2: contact
  // name · business name · what you sell · street · pincode · state · city · logo · about ·
  // contact person), never recomputed here. GST is Wallet, not approval; the map pin and its
  // coordinates are gone from the model altogether.
  const completeness  = review.completeness;
  const missingKeys   = new Set((completeness && completeness.missing) || []);
  const missingLabels = review.missing_fields || [];
  const isMissing     = (key) => missingKeys.has(key);
  // City and state live on the MAIN branch, resolved to reference rows (§7). The users-row
  // copy is only a fallback for a brand that predates the branch model.
  const branches      = review.branches || [];
  const mainBranch    = branches.find(b => b.isMain) || branches[0] || null;
  const cityName      = (mainBranch && mainBranch.cityName) || brand.city || '';
  const stateName     = (mainBranch && mainBranch.stateName) || brand.state || '';
  const cityOnList    = !!(mainBranch && mainBranch.cityId);
  const street        = (mainBranch && mainBranch.formattedAddress) || brand.address_line || '';
  const pincode       = (mainBranch && mainBranch.pincode) || brand.pincode || '';
  const sells         = Array.isArray(brand.sub_categories) ? brand.sub_categories.filter(Boolean).join(', ') : '';
  const submittedRel  = relTime(review.submitted_for_review_at);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <a href="/admin/brands?tab=live" className="text-xs text-t3 hover:text-t2">← Brands</a>
        <span className="text-t3">/</span>
        <span className="text-xs text-t2 font-medium">Brand Profile</span>
        <span className="text-t3">·</span>
        <a href="/admin/brands?tab=pending" className="text-xs text-t3 hover:text-t2">Pending Verification</a>
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
            {/* A pending brand reads as "Pending · submitted 2h ago" — when it pressed Submit
                is the thing the queue cannot tell you at a glance. Not yet submitted means
                it registered and stopped; it is not in the queue at all. */}
            {isPending
              ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold-pale text-yellow-700 whitespace-nowrap">
                  Pending · {submittedRel ? `submitted ${submittedRel}` : 'not yet submitted'}
                </span>
              )
              : <StatusBadge status={status} />}
          </div>
        </div>

        {/* §9A.1 — the roll-up. Counted by the server against the §6.2 brand checklist, so a
            rejection can name exactly what is missing. */}
        {missingLabels.length > 0 ? (
          <div className="mb-4 p-3 bg-red-pale border border-red/30 rounded-lg">
            <div className="text-xs font-bold text-red">{missingLabels.length} {missingLabels.length === 1 ? 'thing' : 'things'} missing</div>
            <div className="text-xs text-red mt-0.5">{missingLabels.join(' · ')}</div>
          </div>
        ) : completeness ? (
          <div className="mb-4 p-3 bg-teal-pale border border-teal/30 rounded-lg text-xs font-bold text-teal-deep">
            Profile complete · {completeness.done} of {completeness.total}
          </div>
        ) : null}

        {/* The §6.2 checklist, one row each, in the order the brand was asked. Items that
            are not required for approval say so rather than reading as gaps. */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              <Row label="Business name" missing={isMissing('business_name')}>
                {brand.business_name ? <b className="text-t1">{brand.business_name}</b> : ''}
              </Row>
              <Row label="Contact name" missing={isMissing('contact_name')}>{brand.name}</Row>
              <Row label="Contact person" missing={isMissing('contact_person')}>{brand.contact_person}</Row>
              <Row label="Phone" mono>{brand.phone}</Row>
              <Row label="Sells" missing={isMissing('sub_categories')}>{sells}</Row>
              <Row label="Street" missing={isMissing('address_line')}>{street}</Row>
              <Row label="City / state" missing={isMissing('city') || isMissing('state')}>
                {[cityName, stateName].filter(Boolean).join(', ') || ''}
                {cityOnList && <> <Tag>on list</Tag></>}
              </Row>
              <Row label="Pincode" mono missing={isMissing('pincode')}>{pincode}</Row>
              <Row label="About" missing={isMissing('about')}>{brand.about}</Row>
              <Row label="Logo" missing={isMissing('logo')}>
                {brand.logo_url
                  ? <img src={brand.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-border" />
                  : ''}
              </Row>
              <Row label="GST number" mono>
                {brand.gstin || <span className="font-body">Not supplied <Tag>not required</Tag></span>}
              </Row>
              <Row label="Registered">{brand.created_at ? new Date(brand.created_at).toLocaleDateString('en-IN') : ''}</Row>
              <Row label="Wallet balance" mono>{fmtMoney(brand.wallet_balance)}</Row>
            </tbody>
          </table>
        </div>

        {/* Status is read-only here — decided exclusively on Brands → Pending
            Verification (features/admin-people-pipeline). This page and the Brands
            list used to each carry their own approve/reject/suspend control; they
            didn't always agree — a suspended or rejected brand had no button,
            anywhere, that put them back to approved. */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-t3">Account status</span>
            <StatusBadge status={status} />
          </div>
          <p className="text-[11px] text-t3 mt-1.5">
            Read-only. To approve, reject, or change this brand's status, go to{' '}
            <a href="/admin/brands?tab=pending" className="text-navy font-semibold hover:underline">
              Brands → Pending Verification →
            </a>
          </p>
        </div>

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
