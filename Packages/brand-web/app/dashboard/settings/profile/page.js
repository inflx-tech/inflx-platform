'use client';
import { useEffect, useState, useRef } from 'react';
import { api, brandApi } from '../../../../lib/api';
import { streetError, STREET_MAX, STORE_COPY } from '../../../../lib/storeAddress';
import useEntitlements from '../../../../lib/useEntitlements';

// ─── Constants ──────────────────────────────────────────────────────────────

// Docs/NEXT_ROUND_2026-09-19.md item 5: the main-branch address is the same four-part
// address the phones take — street typed, 6-digit pincode, state picked, nearest major
// city picked from that state (ids from GET /reference/states?offered=1). No Google.
const EMPTY_ADDRESS = { address: '', pincode: '', stateId: null, cityId: null };

// ─── Helpers ────────────────────────────────────────────────────────────────

function toId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function initials(name) {
  const src = (name || '').trim();
  if (!src) return '';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function fmtDateTime(iso) {
  if (!iso) return 'Never';
  try { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return 'Never'; }
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function truncId(id) {
  if (!id) return '—';
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 12)}…` : s;
}

const STATUS_DOT = {
  approved:  { color: 'var(--success-text)', label: 'approved' },
  pending:   { color: 'var(--yellow-text)',  label: 'pending' },
  rejected:  { color: 'var(--danger-text)',  label: 'rejected' },
  suspended: { color: 'var(--muted)',        label: 'suspended' },
};

// ─── Locked palette CSS scoped under .prf — day-1 discipline ────────────────
const CSS = `
.prf *{box-sizing:border-box}
.prf{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --info:#1D4ED8; --info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;
  color:var(--ink); font-size:13px; line-height:1.45;
  padding:28px 36px; max-width:920px; margin:0 auto;
}
.prf .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

/* Status banner */
.prf .prf-status{border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.5}
.prf .prf-status.pending{background:var(--yellow-pale);color:var(--yellow-text);border:1px solid var(--yellow)}
.prf .prf-status.rejected{background:var(--danger-pale);color:var(--danger-text);border:1px solid var(--danger)}
.prf .prf-status .em{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Outfit',sans-serif;font-weight:800;font-size:14px}
.prf .prf-status.pending .em{background:var(--yellow);color:var(--ink)}
.prf .prf-status.rejected .em{background:var(--danger);color:var(--white)}
.prf .prf-status b{font-weight:800;text-transform:uppercase;letter-spacing:.3px}
.prf .prf-status .reason{display:block;margin-top:4px;font-size:11px;color:var(--muted);font-family:inherit}

/* Card */
.prf .prf-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:14px}
.prf .prf-card-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:14px;flex-wrap:wrap}
.prf .prf-card-t{font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:8px}
.prf .prf-card-t .em{font-size:16px}

/* Logo section */
.prf .prf-logo-row{display:flex;align-items:flex-start;gap:18px}
.prf .prf-logo-thumb{width:80px;height:80px;border-radius:14px;border:2px dashed var(--border);background:var(--bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.prf .prf-logo-thumb.has{border-style:solid;border-color:var(--yellow-pale);background:var(--yellow-pale)}
.prf .prf-logo-thumb img{width:100%;height:100%;object-fit:cover}
.prf .prf-logo-thumb .em{font-family:'Outfit',sans-serif;font-size:18px;font-weight:800;color:var(--ink)}
.prf .prf-logo-thumb .none{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;text-align:center;padding:0 4px}
.prf .prf-logo-info{flex:1;min-width:0}

/* Field */
.prf .field{margin-bottom:14px}
.prf .field:last-child{margin-bottom:0}
.prf .field-l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;display:flex;align-items:center;gap:5px}
.prf .field-l .req{color:var(--danger);font-weight:800}
.prf .field-l .lock{font-size:10px;color:var(--muted-3)}
.prf .field input,.prf .field select,.prf .field textarea{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;color:var(--ink);background:var(--white);resize:vertical}
.prf .field input:focus,.prf .field select:focus,.prf .field textarea:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.prf .field input.mono,.prf .field textarea.mono{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600}
.prf .field input[readonly],.prf .field input.locked,.prf .field select[disabled]{background:var(--bg2);color:var(--muted);cursor:not-allowed;border-color:var(--border)}
.prf .field input[readonly]:focus,.prf .field input.locked:focus{border-color:var(--border);box-shadow:none}
.prf .field-help{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted-2);margin-top:4px}
.prf .field-help .tip{display:inline-block;margin-left:6px;font-size:10px;font-weight:700;color:var(--muted-2);border:1px solid var(--border);border-radius:6px;padding:2px 7px;cursor:pointer;background:var(--white);font-family:inherit}
.prf .field-help .tip:hover{border-color:var(--ink);color:var(--ink);background:var(--white)}
.prf .field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width: 640px){.prf .field-row{grid-template-columns:1fr}}

/* Save row */
.prf .prf-save{display:flex;align-items:center;justify-content:space-between;margin-top:18px;padding-top:14px;border-top:1px solid var(--border-soft);gap:14px;flex-wrap:wrap}
.prf .prf-save .ts{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted-2)}
.prf .btn-ink{padding:10px 18px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.prf .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.prf .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.prf .btn-yel-ghost{padding:7px 13px;background:transparent;border:1.5px solid var(--yellow);color:var(--yellow-text);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.prf .btn-yel-ghost:hover:not(:disabled){background:var(--yellow-pale);color:var(--yellow-text);border-color:var(--yellow)}

/* Branch card */
.prf .br-card{border:1.5px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px}
.prf .br-card:last-child{margin-bottom:0}
.prf .br-card.main{border-color:var(--success);background:linear-gradient(180deg,var(--success-pale) 0%,var(--white) 30%)}
.prf .br-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.prf .br-tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.prf .br-pill{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;padding:2px 7px;border-radius:99px;background:var(--success);color:var(--white);text-transform:uppercase;letter-spacing:.3px;margin-left:8px}
.prf .br-remove{font-family:inherit;font-size:11px;font-weight:700;color:var(--danger-text);background:transparent;border:0;cursor:pointer;padding:0}
.prf .br-remove:hover{text-decoration:underline;color:var(--danger-text);background:transparent}
.prf .br-empty{text-align:center;font-size:11.5px;color:var(--muted-2);padding:14px 0 0;font-family:'JetBrains Mono',monospace}

/* Account details */
.prf .kv-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 24px}
@media (max-width: 640px){.prf .kv-grid{grid-template-columns:1fr}}
.prf .kv{display:flex;flex-direction:column;gap:3px}
.prf .kv-k{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.prf .kv-v{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--ink)}

/* Spinner */
.prf .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:prf-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes prf-spin{to{transform:rotate(360deg)}}

/* Not-found */
.prf .nf{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:36px;text-align:center;max-width:480px;margin:60px auto}
.prf .nf .em{font-size:36px;margin-bottom:10px}
.prf .nf .h{font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px}
.prf .nf .t{font-size:12px;color:var(--muted);line-height:1.55}

/* Toast */
.prf .toast{position:fixed;bottom:24px;right:24px;background:var(--ink);color:var(--white);padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:50;box-shadow:0 10px 25px rgba(0,0,0,.15);display:flex;align-items:center;gap:8px}
.prf .toast.err{background:var(--danger);color:var(--white)}
.prf .toast .em{font-size:14px}
`;

// ─── Status Banner ──────────────────────────────────────────────────────────

function StatusBanner({ status, reason }) {
  if (status !== 'pending' && status !== 'rejected') return null;
  if (status === 'pending') {
    return (
      <div className="prf-status pending">
        <div className="em">!</div>
        <div>
          <b>Pending</b> — Your account is under review. You'll be notified once approved (usually within 24 hours). You can fill your profile in the meantime.
        </div>
      </div>
    );
  }
  return (
    <div className="prf-status rejected">
      <div className="em">✕</div>
      <div>
        <b>Rejected</b> — Your account was not approved.
        {reason && <span className="reason">Reason: {reason}</span>}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [brand, setBrand]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [fileTooltip, setFileTooltip] = useState(false);
  const fileInputRef              = useRef(null);

  // Post-A14 UI polish: proactively gate the + Add Branch button on
  // the brand's multi_branch_support entitlement so Free/Growth tiers
  // see the upgrade prompt instead of submitting and being told no.
  // Backend A12.6 gate is still the safety net.
  const ent = useEntitlements();
  const canAddBranch  = ent.loading ? true : ent.has('multi_branch_support');

  // Form state
  const [form, setForm] = useState({
    business_name: '', category: '', gstin: '', logo_url: '',
  });
  // Item 2 (rules v1.10 §8A) — the eight fashion sub-categories, editable here so brands
  // registered before item 2 can set theirs. At least one is required to save a change.
  const [subCategories, setSubCategories] = useState([]);
  const [subCategoryOptions, setSubCategoryOptions] = useState([]);
  useEffect(() => {
    api.get('/reference/brand-categories').then(r => {
      if (r?.success && Array.isArray(r.data?.items)) setSubCategoryOptions(r.data.items);
    }).catch(() => {});
  }, []);
  function toggleSubCategory(code) {
    setSubCategories(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }

  // Contact person
  const [contactName, setContactName] = useState('');

  // Main branch address (item 5 — the four-part address). `savedAddress` is what the
  // server last told us, so save only sends the address when something in it changed.
  const [mainBranch, setMainBranch]     = useState(EMPTY_ADDRESS);
  const [savedAddress, setSavedAddress] = useState(EMPTY_ADDRESS);
  const [states, setStates]             = useState([]);   // [{ id, name, cities:[{ id, name }] }]
  useEffect(() => {
    api.get('/reference/states?offered=1').then(r => {
      if (r?.success && Array.isArray(r.data?.items)) setStates(r.data.items);
    }).catch(() => {});
  }, []);
  const selectedState = states.find(s => s.id === mainBranch.stateId) || null;
  const cityOptions = selectedState?.cities || [];

  // GET /brands/me returns { brand, branches:[{ isMain, formattedAddress, pincode, stateId,
  // cityId, ... }], ... }; the main branch is the address this page edits.
  function addressFromMe(data, b) {
    const branches = Array.isArray(data?.branches) ? data.branches : [];
    const main = branches.find(br => br.isMain) || branches[0] || null;
    return {
      address: (main?.formattedAddress ?? b?.address_line) || '',
      pincode: (main?.pincode ?? b?.pincode) || '',
      stateId: toId(main?.stateId),
      cityId:  toId(main?.cityId),
    };
  }

  useEffect(() => {
    async function load() {
      const res = await brandApi.getMe();
      setLoading(false);
      if (res.success) {
        const b = res.data?.brand || res.data;
        setBrand(b);
        setForm({
          business_name: b.business_name || '',
          category:      b.category || '',
          gstin:         b.gstin || '',
          logo_url:      b.logo_url || '',
        });
        setSubCategories(Array.isArray(b.sub_categories) ? b.sub_categories : []);
        const ld = b.listing_data || {};
        setContactName(ld.contact_person_name || b.name || '');

        const addr = addressFromMe(res.data, b);
        setMainBranch(addr);
        setSavedAddress(addr);
      }
    }
    load();
  }, []);

  function showToast(msg, type = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleMainBranchChange(field, value) {
    setMainBranch(prev => ({ ...prev, [field]: value }));
  }
  function pickState(v) {
    const id = toId(v);
    // The city belongs to the state; changing one clears the other.
    setMainBranch(prev => ({ ...prev, stateId: id, cityId: null }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.business_name.trim()) {
      showToast('Business name is required', 'err');
      return;
    }

    setSaving(true);
    const payload = {};

    // Top-level changed fields
    if (form.business_name !== (brand?.business_name || '')) payload.business_name = form.business_name.trim();
    if (form.gstin !== (brand?.gstin || ''))                 payload.gstin = form.gstin.trim();
    if (form.logo_url !== (brand?.logo_url || ''))           payload.logo_url = form.logo_url.trim();

    // Main branch address — any of the four rewrites the MAIN branch on the server
    // (PATCH /brands/me: address_line, pincode, state_id, city_id), so when one part
    // changed all four are sent together, and all four must be complete.
    const mainAddr = mainBranch.address.trim();
    const mainPin  = mainBranch.pincode.trim();
    const addressChanged =
      mainAddr !== (savedAddress.address || '').trim() ||
      mainPin  !== (savedAddress.pincode || '').trim() ||
      mainBranch.stateId !== savedAddress.stateId ||
      mainBranch.cityId  !== savedAddress.cityId;
    if (addressChanged) {
      if (!mainAddr) { showToast('Business address is required', 'err'); setSaving(false); return; }
      // features/courier-ready-addresses — a courier has to find the store: a shop or door number.
      if (streetError(mainAddr)) { showToast(streetError(mainAddr), 'err'); setSaving(false); return; }
      if (!/^[0-9]{6}$/.test(mainPin)) { showToast('Pincode must be 6 digits', 'err'); setSaving(false); return; }
      if (!mainBranch.stateId) { showToast('Select your state', 'err'); setSaving(false); return; }
      if (!mainBranch.cityId) { showToast(STORE_COPY.cityRequired, 'err'); setSaving(false); return; }
      payload.address_line = mainAddr;
      payload.pincode      = mainPin;
      payload.state_id     = mainBranch.stateId;
      payload.city_id      = mainBranch.cityId;
    }

    // Item 2 — sub-categories; sent only when changed, and never as an empty list.
    const existingSubs = Array.isArray(brand?.sub_categories) ? brand.sub_categories : [];
    if (JSON.stringify([...subCategories].sort()) !== JSON.stringify([...existingSubs].sort())) {
      if (subCategories.length === 0) { showToast('Pick at least one category you sell', 'err'); setSaving(false); return; }
      payload.sub_categories = subCategories;
    }

    // listing_data — Item 4: branches are no longer written from the website (APPROVAL.md
    // §2.3); whatever `listing_data.branches` holds is left exactly as it is.
    const existingLd = brand?.listing_data || {};
    const newLd = {
      ...existingLd,
      contact_person_name: contactName.trim(),
    };
    const ldChanged = JSON.stringify(newLd) !== JSON.stringify(existingLd);
    if (ldChanged) payload.listing_data = newLd;

    if (Object.keys(payload).length === 0) {
      showToast('No changes to save', 'err');
      setSaving(false);
      return;
    }

    const res = await brandApi.updateMe(payload);
    setSaving(false);

    if (res.success) {
      const updated = res.data?.brand || res.data;
      setBrand(updated);
      if (addressChanged) {
        // PATCH answers { brand, completeness } without branches; what we sent is what
        // the main branch now holds.
        setSavedAddress({ address: mainAddr, pincode: mainPin, stateId: mainBranch.stateId, cityId: mainBranch.cityId });
      }
      showToast('Profile updated successfully');
    } else {
      showToast(res.error?.message || 'Failed to update profile', 'err');
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="prf">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="spinner" />
      </div>
    );
  }
  if (!brand) {
    return (
      <div className="prf">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="nf">
          <div className="em">🙈</div>
          <div className="h">Brand profile not found</div>
          <div className="t">Please complete registration first.</div>
        </div>
      </div>
    );
  }

  const userStatus = brand.user_status || brand.status || 'pending';
  const logoInitials = initials(form.business_name || brand.business_name);
  const statusInfo = STATUS_DOT[userStatus] || { color: 'var(--muted)', label: userStatus };

  return (
    <div className="prf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <StatusBanner status={userStatus} reason={brand.rejection_reason} />

      {/* LOGO CARD */}
      <div className="prf-card">
        <div className="prf-card-h">
          <div className="prf-card-t"><span className="em">🏷</span>Brand Logo</div>
        </div>
        <div className="prf-logo-row">
          <div className={`prf-logo-thumb${form.logo_url ? ' has' : ''}`}>
            {form.logo_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.logo_url}
                  alt="Logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const nextSib = e.currentTarget.nextSibling;
                    if (nextSib) nextSib.style.display = 'block';
                  }}
                />
                <span className="em" style={{ display: 'none' }}>{logoInitials || '🏢'}</span>
              </>
            ) : (
              <span className="none">No logo</span>
            )}
          </div>
          <div className="prf-logo-info">
            <div className="field">
              <label className="field-l">Logo URL</label>
              <input
                type="url"
                value={form.logo_url}
                onChange={(e) => handleChange('logo_url', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <div className="field-help">
                Direct image URL for your business logo
                <button
                  type="button"
                  className="tip"
                  onMouseEnter={() => setFileTooltip(true)}
                  onMouseLeave={() => setFileTooltip(false)}
                  onClick={() => setFileTooltip(prev => !prev)}
                  title="File upload coming soon — use URL for now"
                >
                  {fileTooltip ? 'Coming soon · use URL' : 'Upload File'}
                </button>
              </div>
              {/* Hidden file input for future R2 integration */}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      </div>

      {/* BUSINESS INFO CARD */}
      <form onSubmit={handleSave}>
        <div className="prf-card">
          <div className="prf-card-h">
            <div className="prf-card-t"><span className="em">🏢</span>Business Information</div>
          </div>

          <div className="field">
            <label className="field-l">Business Name<span className="req">*</span></label>
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => handleChange('business_name', e.target.value)}
              placeholder="Your business name"
            />
          </div>

          <div className="field">
            <label className="field-l">Contact Person</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact person name"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-l">Phone <span className="lock">🔒 locked</span></label>
              <input type="text" value={brand.phone || ''} readOnly className="mono" />
              <div className="field-help">Linked to your login · cannot be changed</div>
            </div>
            <div className="field">
              <label className="field-l">Category <span className="lock">🔒 locked</span></label>
              <input type="text" value={form.category} readOnly />
              <div className="field-help">Cannot be changed after registration</div>
            </div>
          </div>

          {/* Item 2 — what the brand sells. Creators filter the brands that may invite them by these. */}
          <div className="field">
            <label className="field-l">What you sell</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {subCategoryOptions.map(opt => {
                const on = subCategories.includes(opt.code);
                return (
                  <button type="button" key={opt.code} onClick={() => toggleSubCategory(opt.code)}
                    style={{
                      borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      border: on ? '1px solid #0A0A0A' : '1px solid #D4D4D8',
                      background: on ? '#0A0A0A' : '#FFFFFF', color: on ? '#FFFFFF' : '#52525B',
                    }}>
                    {on ? '✓ ' : ''}{opt.label}
                  </button>
                );
              })}
            </div>
            <div className="field-help">
              {subCategories.length === 0
                ? 'Not set yet — pick at least one. Until you do, creators who filter by category will not see you as a match.'
                : 'Pick every category you sell.'}
            </div>
          </div>

          <div className="field">
            <label className="field-l">GSTIN</label>
            <input
              type="text"
              value={form.gstin}
              onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
              maxLength={15}
              className="mono"
              placeholder="22AAAAA0000A1Z5"
            />
          </div>

          {/* Item 5 — main branch address: the same four parts the phones take. */}
          <div className="field">
            <label className="field-l">Business address<span className="req">*</span></label>
            <input
              type="text"
              value={mainBranch.address}
              onChange={(e) => handleMainBranchChange('address', e.target.value)}
              placeholder={STORE_COPY.streetPlaceholder}
              maxLength={STREET_MAX}
            />
            <div className="field-help">{STORE_COPY.streetHint} This is your main branch; a landmark, the store phone and other branches are managed in the INFLX Brand app.</div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-l">Pincode<span className="req">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={mainBranch.pincode}
                onChange={(e) => handleMainBranchChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mono"
                placeholder="6-digit"
              />
            </div>
            <div className="field">
              <label className="field-l">State<span className="req">*</span></label>
              <select value={mainBranch.stateId ?? ''} onChange={(e) => pickState(e.target.value)}>
                <option value="">Select your state</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-l">{STORE_COPY.city}<span className="req">*</span></label>
            <select
              value={mainBranch.cityId ?? ''}
              onChange={(e) => handleMainBranchChange('cityId', toId(e.target.value))}
              disabled={!selectedState}
            >
              <option value="">{selectedState ? STORE_COPY.cityPick : 'Pick a state first'}</option>
              {cityOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="field-help">{STORE_COPY.cityHint}</div>
          </div>

          <div className="prf-save">
            <div className="ts">Last updated · {fmtDateTime(brand.updated_at)}</div>
            <button type="submit" className="btn-ink" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>

        {/* BRANCHES — Item 4 (APPROVAL.md §2.3): this editor wrote branches into brands.listing_data,
            which item 3 stopped reading (migration 172). A branch added here never reached the app and
            could not be used for a Store Visit set, so the editor is switched off. Nothing is migrated
            or deleted; the phone owns branches now, exactly as pitch settings. */}
        <div className="prf-card">
          <div className="prf-card-h">
            <div className="prf-card-t"><span className="em">📍</span>Branches &amp; Outlets</div>
          </div>
          <div style={{ fontSize: 13.5, color: '#3F3F46', lineHeight: 1.55 }}>
            <b>Branches are managed in the INFLX Brand app.</b> Open Profile → Branches on your phone to add a branch,
            change an address or choose the main branch. A Store Visit set names one of those branches.
          </div>
        </div>

        {/* Item 20 (D5): who is linked to this brand is seen and removed on the phone, like branches. */}
        <div className="prf-card">
          <div className="prf-card-h">
            <div className="prf-card-t"><span className="em">🔗</span>Linked creators</div>
          </div>
          <div style={{ fontSize: 13.5, color: '#3F3F46', lineHeight: 1.55 }}>
            <b>Linked creators are managed in the INFLX Brand app.</b> A person who runs this brand can link their creator
            account with a code sent to your number, and then post for the brand with no campaign. Open Profile → Linked
            creators on your phone to see who is linked or to remove someone.
          </div>
        </div>

      </form>

      {/* ACCOUNT DETAILS CARD */}
      <div className="prf-card">
        <div className="prf-card-h">
          <div className="prf-card-t"><span className="em">📋</span>Account Details</div>
        </div>
        <div className="kv-grid">
          <div className="kv">
            <span className="kv-k">Registered</span>
            <span className="kv-v">{fmtDate(brand.created_at)}</span>
          </div>
          {brand.approved_at && (
            <div className="kv">
              <span className="kv-k">Approved On</span>
              <span className="kv-v">{fmtDate(brand.approved_at)}</span>
            </div>
          )}
          {brand.id && (
            <div className="kv">
              <span className="kv-k">Brand ID</span>
              <span className="kv-v">{truncId(brand.id)}</span>
            </div>
          )}
          <div className="kv">
            <span className="kv-k">Status</span>
            <span className="kv-v" style={{ color: statusInfo.color }}>● {statusInfo.label}</span>
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`toast${toast.type === 'err' ? ' err' : ''}`}>
          <span className="em">{toast.type === 'err' ? '✗' : '✓'}</span>{toast.msg}
        </div>
      )}
    </div>
  );
}
