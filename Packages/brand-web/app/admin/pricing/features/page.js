'use client';

/**
 * /admin/pricing/features — Phase A10 catalog manager.
 *
 * Master feature catalog. List + edit + soft-delete + add. Per-tier
 * mapping lives on the tier editor page; this is just the catalog.
 *
 * Mutations require superadmin per backend route guards.
 */

import { useEffect, useState } from 'react';
import { adminApi } from '../../../../lib/api';
import PlansOffBanner from '../../../../components/PlansOffBanner';

const CATEGORIES = [
  { key: 'influencer',  label: 'Influencer' },
  { key: 'campaigns',   label: 'Campaigns' },
  { key: 'products',    label: 'Products' },
  { key: 'brand_store', label: 'Brand store' },
  { key: 'support',     label: 'Support' },
];

const TYPES = [
  { key: 'boolean',  label: 'Boolean (on/off)' },
  { key: 'quota',    label: 'Quota (number)' },
  { key: 'config',   label: 'Config (custom JSON)' },
  { key: 'baseline', label: 'Baseline (default everyone)' },
];

export default function FeaturesCatalogPage() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft]       = useState({});
  const [showAdd, setShowAdd]   = useState(false);
  const [newDraft, setNewDraft] = useState({ feature_key: '', label: '', category: 'influencer', feature_type: 'boolean', unit: '', default_quota: '', description: '' });

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await adminApi.listFeatures();
      setFeatures(res.data?.features || []);
    } catch (e) {
      setErr(e?.message || 'Failed to load features');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function startEdit(f) {
    setEditingKey(f.feature_key);
    setDraft({
      label:         f.label,
      description:   f.description || '',
      default_quota: f.default_quota != null ? f.default_quota : '',
      is_enforced:   !!f.is_enforced,
      active:        !!f.active,
      sort_order:    f.sort_order,
    });
  }

  async function saveEdit(featureKey) {
    setErr(null);
    try {
      const body = {
        label:         draft.label,
        description:   draft.description,
        is_enforced:   draft.is_enforced,
        active:        draft.active,
        sort_order:    parseInt(draft.sort_order, 10) || 0,
      };
      if (draft.default_quota !== '' && draft.default_quota != null) body.default_quota = parseFloat(draft.default_quota);
      const res = await adminApi.updateFeature(featureKey, body);
      if (!res.success) { setErr(res.error?.message || 'Update failed'); return; }
      setEditingKey(null);
      await load();
    } catch (e) { setErr(e?.message || 'Update failed'); }
  }

  async function softDelete(featureKey) {
    if (!confirm(`Deactivate feature "${featureKey}"? It stays in the DB but won't appear on tier editors.`)) return;
    setErr(null);
    try {
      const res = await adminApi.deleteFeature(featureKey);
      if (!res.success) { setErr(res.error?.message || 'Delete failed'); return; }
      await load();
    } catch (e) { setErr(e?.message || 'Delete failed'); }
  }

  async function addFeature() {
    if (!newDraft.feature_key || !newDraft.label) { setErr('feature_key + label required'); return; }
    if (!/^[a-z0-9_]+$/.test(newDraft.feature_key)) { setErr('feature_key must be lowercase a-z, 0-9, _'); return; }
    setErr(null);
    try {
      const body = { ...newDraft };
      if (body.default_quota !== '') body.default_quota = parseFloat(body.default_quota); else delete body.default_quota;
      if (!body.unit) delete body.unit;
      const res = await adminApi.createFeature(body);
      if (!res.success) { setErr(res.error?.message || 'Create failed'); return; }
      setShowAdd(false);
      setNewDraft({ feature_key: '', label: '', category: 'influencer', feature_type: 'boolean', unit: '', default_quota: '', description: '' });
      await load();
    } catch (e) { setErr(e?.message || 'Create failed'); }
  }

  const byCategory = CATEGORIES.map(c => ({
    ...c,
    rows: features.filter(f => f.category === c.key).sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <div className="px-6 py-6 max-w-6xl">
      <PlansOffBanner />
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-t1">Features catalog</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-navy text-white rounded-lg text-sm font-bold hover:opacity-90">+ Add feature</button>
      </div>
      <p className="text-sm text-t2 mb-6">Master catalog of gateable capabilities. Per-tier inclusion + quota set on the tier editor. <strong>is_enforced=true</strong> means the backend gate is wired; until then the feature is display-only.</p>

      {err && <div className="mb-4 p-3 bg-red-pale text-red rounded-lg text-sm">{err}</div>}
      {loading && <div className="text-t3 text-sm">Loading…</div>}

      {!loading && byCategory.map(cat => (
        <section key={cat.key} className="mb-6">
          <h2 className="text-xs font-bold text-t2 uppercase tracking-wider mb-2">{cat.label} ({cat.rows.length})</h2>
          <div className="bg-white border border-border2 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg2">
                <tr className="text-left text-xs text-t2 uppercase tracking-wider">
                  <th className="px-3 py-2">Key</th>
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Default quota</th>
                  <th className="px-3 py-2">Enforced</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cat.rows.map(f => {
                  const isEditing = editingKey === f.feature_key;
                  return (
                    <tr key={f.feature_key} className="border-t border-border2">
                      <td className="px-3 py-2 font-mono text-xs text-t2">{f.feature_key}</td>
                      <td className="px-3 py-2">
                        {isEditing
                          ? <input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} className="w-full border border-border2 rounded px-2 py-1 text-sm" />
                          : f.label}
                      </td>
                      <td className="px-3 py-2 text-t2">{f.feature_type}</td>
                      <td className="px-3 py-2">
                        {isEditing && f.feature_type === 'quota'
                          ? <input value={draft.default_quota} onChange={e => setDraft({ ...draft, default_quota: e.target.value })} className="w-24 border border-border2 rounded px-2 py-1 text-sm" placeholder="-1 = unlimited" />
                          : (f.default_quota != null ? f.default_quota : '—')}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing
                          ? <input type="checkbox" checked={!!draft.is_enforced} onChange={e => setDraft({ ...draft, is_enforced: e.target.checked })} />
                          : (f.is_enforced ? <span className="text-green-700 text-xs font-bold">YES</span> : <span className="text-t3 text-xs">no</span>)}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing
                          ? <input type="checkbox" checked={!!draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />
                          : (f.active ? '✓' : '—')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(f.feature_key)} className="px-2 py-1 bg-navy text-white rounded text-xs font-bold mr-1">Save</button>
                            <button onClick={() => setEditingKey(null)} className="px-2 py-1 text-t2 text-xs">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(f)} className="px-2 py-1 text-navy text-xs font-bold mr-1">Edit</button>
                            <button onClick={() => softDelete(f.feature_key)} className="px-2 py-1 text-red text-xs">Deactivate</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {cat.rows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-4 text-center text-t3 text-sm italic">No features in this category</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">New feature</h3>
            <div className="grid gap-3 text-sm">
              <label className="block"><span className="text-xs font-bold text-t2 uppercase">Feature key (slug, immutable)</span>
                <input value={newDraft.feature_key} onChange={e => setNewDraft({ ...newDraft, feature_key: e.target.value })} placeholder="my_new_feature" className="w-full mt-1 border border-border2 rounded px-2 py-1.5 font-mono" /></label>
              <label className="block"><span className="text-xs font-bold text-t2 uppercase">Label</span>
                <input value={newDraft.label} onChange={e => setNewDraft({ ...newDraft, label: e.target.value })} placeholder="My New Feature" className="w-full mt-1 border border-border2 rounded px-2 py-1.5" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-xs font-bold text-t2 uppercase">Category</span>
                  <select value={newDraft.category} onChange={e => setNewDraft({ ...newDraft, category: e.target.value })} className="w-full mt-1 border border-border2 rounded px-2 py-1.5">
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select></label>
                <label className="block"><span className="text-xs font-bold text-t2 uppercase">Type</span>
                  <select value={newDraft.feature_type} onChange={e => setNewDraft({ ...newDraft, feature_type: e.target.value })} className="w-full mt-1 border border-border2 rounded px-2 py-1.5">
                    {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select></label>
              </div>
              {newDraft.feature_type === 'quota' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="text-xs font-bold text-t2 uppercase">Default quota</span>
                    <input value={newDraft.default_quota} onChange={e => setNewDraft({ ...newDraft, default_quota: e.target.value })} placeholder="-1 = unlimited" className="w-full mt-1 border border-border2 rounded px-2 py-1.5" /></label>
                  <label className="block"><span className="text-xs font-bold text-t2 uppercase">Unit</span>
                    <input value={newDraft.unit} onChange={e => setNewDraft({ ...newDraft, unit: e.target.value })} placeholder="count / per_cycle" className="w-full mt-1 border border-border2 rounded px-2 py-1.5" /></label>
                </div>
              )}
              <label className="block"><span className="text-xs font-bold text-t2 uppercase">Description</span>
                <textarea value={newDraft.description} onChange={e => setNewDraft({ ...newDraft, description: e.target.value })} rows={2} className="w-full mt-1 border border-border2 rounded px-2 py-1.5" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="px-3 py-2 text-t2 text-sm">Cancel</button>
              <button onClick={addFeature} className="px-4 py-2 bg-navy text-white rounded-lg text-sm font-bold">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
