'use client';
import { useEffect, useState } from 'react';
import { brandApi } from '../../../lib/api';

const STATUS_STYLES = {
  approved:  'bg-teal-100 text-teal-700',
  pending:   'bg-yellow-100 text-yellow-700',
  rejected:  'bg-red-100 text-red-600',
  suspended: 'bg-gray-200 text-gray-600',
};

const EMPTY_BRANCH = { name: '', address: '', phone: '', city: '' };

export default function ProfilePage() {
  const [brand, setBrand]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState('');
  const [toastType, setToastType] = useState('success');

  // Editable contact person
  const [editingName, setEditingName] = useState(false);
  const [contactName, setContactName] = useState('');

  // Form state
  const [form, setForm] = useState({
    business_name: '',
    category: '',
    gstin: '',
    address_line: '',
    pincode: '',
    logo_url: '',
  });

  // Branches state
  const [branches, setBranches] = useState([]);

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
          address_line:  b.address_line || '',
          pincode:       b.pincode || '',
          logo_url:      b.logo_url || '',
        });
        const ld = b.listing_data || {};
        setContactName(ld.contact_person_name || b.name || '');
        setBranches(ld.branches || []);
      }
    }
    load();
  }, []);

  function showToast(msg, type = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3500);
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // Branch helpers
  function addBranch() {
    setBranches(prev => [...prev, { ...EMPTY_BRANCH }]);
  }

  function updateBranch(index, field, value) {
    setBranches(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  }

  function removeBranch(index) {
    setBranches(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.business_name.trim()) {
      showToast('Business name is required', 'error');
      return;
    }

    setSaving(true);
    const payload = {};
    // Only send fields that changed
    if (form.business_name !== (brand?.business_name || '')) payload.business_name = form.business_name.trim();
    if (form.category !== (brand?.category || ''))           payload.category = form.category.trim();
    if (form.gstin !== (brand?.gstin || ''))                 payload.gstin = form.gstin.trim();
    if (form.address_line !== (brand?.address_line || ''))   payload.address_line = form.address_line.trim();
    if (form.pincode !== (brand?.pincode || ''))             payload.pincode = form.pincode.trim();
    if (form.logo_url !== (brand?.logo_url || ''))           payload.logo_url = form.logo_url.trim();

    // Build listing_data with contact_person_name and branches
    const existingLd = brand?.listing_data || {};
    const newLd = {
      ...existingLd,
      contact_person_name: contactName.trim(),
      branches: branches.filter(b => b.name.trim() || b.address.trim()),
    };

    // Check if listing_data actually changed
    const ldChanged = JSON.stringify(newLd) !== JSON.stringify(existingLd);
    if (ldChanged) payload.listing_data = newLd;

    if (Object.keys(payload).length === 0) {
      showToast('No changes to save', 'error');
      setSaving(false);
      return;
    }

    const res = await brandApi.updateMe(payload);
    setSaving(false);

    if (res.success) {
      const updated = res.data?.brand || res.data;
      setBrand(updated);
      setEditingName(false);
      showToast('Profile updated successfully');
    } else {
      showToast(res.error?.message || 'Failed to update profile', 'error');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-t3 text-sm">Loading profile...</div>;
  }

  if (!brand) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-3xl mb-3">:(</div>
        <div className="text-sm text-t2">Brand profile not found. Please complete registration first.</div>
      </div>
    );
  }

  const userStatus = brand.user_status || brand.status || 'pending';

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-xl font-bold text-t1 mb-5">Profile & Settings</h1>

      {/* Status banner — only shown for pending / rejected */}
      {(userStatus === 'pending' || userStatus === 'rejected') && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium ${STATUS_STYLES[userStatus] || STATUS_STYLES.pending}`}>
          <span className="font-bold capitalize">{userStatus}</span>
          {userStatus === 'pending' && ' — Your account is under review. You will be notified once approved.'}
          {userStatus === 'rejected' && (
            <>
              {' — Your account was not approved.'}
              {brand.rejection_reason && (
                <span className="block mt-1 text-xs">Reason: {brand.rejection_reason}</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Logo preview hero */}
      <div className="bg-white rounded-xl border border-border p-5 mb-5 flex items-center gap-5">
        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border2 overflow-hidden flex-shrink-0 bg-surface2 flex items-center justify-center">
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt="Logo"
              className="w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'block'); }}
            />
          ) : null}
          <span className={`text-xs text-t3 ${form.logo_url ? 'hidden' : ''}`}>No logo</span>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-t2 mb-1">Logo URL</label>
          <input
            type="url"
            value={form.logo_url}
            onChange={e => handleChange('logo_url', e.target.value)}
            className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors"
            placeholder="https://example.com/logo.png"
          />
          <p className="text-[10px] text-t3 mt-1">Direct image URL for your business logo</p>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-border p-5 mb-5">
        <h2 className="font-display text-sm font-bold text-t1 mb-4">Business Information</h2>

        <div className="space-y-4">
          {/* Business name */}
          <div>
            <label className="block text-xs font-semibold text-t2 mb-1">Business Name <span className="text-red">*</span></label>
            <input
              type="text"
              value={form.business_name}
              onChange={e => handleChange('business_name', e.target.value)}
              className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors"
              placeholder="Your business name"
            />
          </div>

          {/* Contact person name — editable */}
          <div>
            <label className="block text-xs font-semibold text-t2 mb-1">Contact Person</label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="flex-1 border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors"
                  placeholder="Contact person name"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="px-3 py-2 text-xs font-semibold text-t3 hover:text-t1 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={contactName}
                  readOnly
                  className="flex-1 border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t3 bg-surface2 outline-none cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="px-3 py-2 text-xs font-semibold text-gold hover:text-orange transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Phone (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-t2 mb-1">Phone</label>
            <input
              type="text"
              value={brand.phone || ''}
              readOnly
              className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t3 bg-surface2 outline-none cursor-not-allowed"
            />
            <p className="text-[10px] text-t3 mt-0.5">Cannot be changed (linked to your login)</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-t2 mb-1">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={e => handleChange('category', e.target.value)}
              className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors"
              placeholder="e.g. restaurant, salon, fashion_walkin"
            />
            <p className="text-[10px] text-t3 mt-0.5">Changing category may affect your product schema</p>
          </div>

          {/* Two-column: Address + Pincode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-t2 mb-1">Address</label>
              <textarea
                value={form.address_line}
                onChange={e => handleChange('address_line', e.target.value)}
                rows={3}
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors resize-none"
                placeholder="Full business address"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-t2 mb-1">Pincode</label>
              <input
                type="text"
                value={form.pincode}
                onChange={e => handleChange('pincode', e.target.value)}
                maxLength={6}
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors"
                placeholder="560001"
              />
            </div>
          </div>

          {/* GST Number */}
          <div>
            <label className="block text-xs font-semibold text-t2 mb-1">GSTIN</label>
            <input
              type="text"
              value={form.gstin}
              onChange={e => handleChange('gstin', e.target.value.toUpperCase())}
              maxLength={15}
              className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors font-mono"
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-[10px] text-t3">
            Last updated: {brand.updated_at ? new Date(brand.updated_at).toLocaleString('en-IN') : 'Never'}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-xl disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Branches / Outlets */}
      <div className="bg-white rounded-xl border border-border p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm font-bold text-t1">Branches / Outlets</h2>
          <button
            type="button"
            onClick={addBranch}
            className="px-3 py-1.5 text-xs font-bold text-gold border border-gold rounded-lg hover:bg-gold hover:text-white transition-colors"
          >
            + Add Branch
          </button>
        </div>

        {/* Main branch (from profile address) */}
        <div className="p-3 bg-surface2 rounded-xl mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-t3">Main Branch</span>
            <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-semibold">Primary</span>
          </div>
          <div className="text-sm text-t1">{form.business_name || 'Business name'}</div>
          <div className="text-xs text-t2 mt-0.5">{form.address_line || 'Address not set'}{form.pincode ? ` - ${form.pincode}` : ''}</div>
          <div className="text-xs text-t3 mt-0.5">{brand.phone || ''}</div>
        </div>

        {/* Additional branches */}
        {branches.length === 0 && (
          <p className="text-xs text-t3 text-center py-3">No additional branches. Click &quot;+ Add Branch&quot; to add one.</p>
        )}

        {branches.map((branch, idx) => (
          <div key={idx} className="border border-border2 rounded-xl p-4 mb-3 last:mb-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-t3">Branch {idx + 1}</span>
              <button
                type="button"
                onClick={() => removeBranch(idx)}
                className="text-xs text-red hover:text-red/80 font-semibold transition-colors"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-t3 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={branch.name}
                  onChange={e => updateBranch(idx, 'name', e.target.value)}
                  className="w-full border-2 border-border2 rounded-xl px-3 py-2 text-sm text-t1 outline-none focus:border-gold transition-colors"
                  placeholder="e.g. Indiranagar Branch"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-t3 mb-1">City</label>
                <input
                  type="text"
                  value={branch.city}
                  onChange={e => updateBranch(idx, 'city', e.target.value)}
                  className="w-full border-2 border-border2 rounded-xl px-3 py-2 text-sm text-t1 outline-none focus:border-gold transition-colors"
                  placeholder="e.g. Bangalore"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-t3 mb-1">Address</label>
                <input
                  type="text"
                  value={branch.address}
                  onChange={e => updateBranch(idx, 'address', e.target.value)}
                  className="w-full border-2 border-border2 rounded-xl px-3 py-2 text-sm text-t1 outline-none focus:border-gold transition-colors"
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-t3 mb-1">Phone</label>
                <input
                  type="text"
                  value={branch.phone}
                  onChange={e => updateBranch(idx, 'phone', e.target.value)}
                  className="w-full border-2 border-border2 rounded-xl px-3 py-2 text-sm text-t1 outline-none focus:border-gold transition-colors"
                  placeholder="+91 9876543210"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Account details (read-only info) */}
      <div className="bg-white rounded-xl border border-border p-5 mb-5">
        <h2 className="font-display text-sm font-bold text-t1 mb-3">Account Details</h2>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
          <div>
            <span className="text-t3 font-semibold">Registered</span>
            <div className="text-t2 mt-0.5">{brand.created_at ? new Date(brand.created_at).toLocaleDateString('en-IN') : '---'}</div>
          </div>
          {brand.approved_at && (
            <div>
              <span className="text-t3 font-semibold">Approved On</span>
              <div className="text-t2 mt-0.5">{new Date(brand.approved_at).toLocaleDateString('en-IN')}</div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 ${toastType === 'error' ? 'bg-red text-white' : 'bg-t1 text-white'}`}>
          {toast}
        </div>
      )}
    </div>
  );
}
