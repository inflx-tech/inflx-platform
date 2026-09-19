'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

/**
 * Admin → "Other" niche queue.
 * Contract: features/registration-and-profile (spec §3.3, §9A.3 · mockup A3)
 *
 * A creator who could not find her niche on the list chose Other and typed what she makes.
 * This is where that text turns into a niche: either she is mapped to one we already have,
 * or a new niche is added to the reference list and she is mapped to it. That is the only
 * way the list grows. Until she is mapped, a creator on Other is found by every rule that
 * does not filter on niche and by none that do — so the queue is worth clearing.
 *
 * Reads GET /admin/niches/other → { items, niches }. Writes POST /admin/niches/other/:id/map
 * and POST /admin/niches. Capability: approvals.
 */

const EMPTY_NEW = { label: '', code: '' };

/** What the server will derive when the code is left blank — shown so admin is not surprised. */
function deriveCode(label) {
  return String(label || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

export default function OtherNichesPage() {
  const [items, setItems] = useState([]);
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [choice, setChoice] = useState({});     // influencer_id → niche code picked in "Map to…"
  const [busyId, setBusyId] = useState('');     // influencer_id currently being mapped

  const [adding, setAdding] = useState(null);   // null | the queue row we are adding a niche for
  const [form, setForm] = useState(EMPTY_NEW);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [toast, setToast] = useState('');
  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 3000); }

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    const res = await adminApi.listOtherNiches();
    setLoading(false);
    if (res.success) {
      setItems(res.data?.items || []);
      setNiches((res.data?.niches || []).filter(n => n.code !== 'other'));
    } else {
      setLoadError(res.error?.message || 'Could not load the queue.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function applyMap(row) {
    const code = choice[row.influencer_id];
    if (!code) return;
    setBusyId(row.influencer_id);
    const res = await adminApi.mapOtherNiche(row.influencer_id, { code });
    setBusyId('');
    if (res.success) {
      const label = (niches.find(n => n.code === code) || {}).label || code;
      showToast(`${row.full_name || 'Creator'} → ${label}`);
      load();
    } else {
      showToast(res.error?.message || 'Could not map her.');
    }
  }

  function openAdd(row) {
    setForm({ label: row.niche_other || '', code: '' });
    setFormError('');
    setAdding(row);
  }

  async function handleCreate() {
    if (!adding) return;
    const label = form.label.trim();
    if (!label) { setFormError('Give the new niche a name.'); return; }
    const body = { label, influencer_id: adding.influencer_id };
    if (form.code.trim()) body.code = form.code.trim().toLowerCase();
    setSaving(true); setFormError('');
    const res = await adminApi.createNiche(body);
    setSaving(false);
    if (res.success) {
      setAdding(null);
      showToast(`Added “${res.data?.niche?.label || label}” and mapped ${adding.full_name || 'the creator'} to it.`);
      load();
    } else {
      setFormError(res.error?.message || 'Could not add the niche.');
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">“Other” niche queue</h1>
          <p className="text-xs text-t3 mt-0.5">
            Each creator typed what she makes. Map her to a niche we already have, or add a new one to the list.
          </p>
        </div>
        {!loading && !loadError && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold-pale text-yellow-700 whitespace-nowrap">
            {items.length === 0 ? 'nobody waiting' : items.length === 1 ? '1 waiting' : `${items.length} waiting`}
          </span>
        )}
      </div>

      {loadError && <div className="p-4 bg-red-pale rounded-xl text-red text-sm mb-4">{loadError}</div>}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-sm text-t3">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">
                  <th className="text-left px-5 py-2.5 w-[28%]">Creator</th>
                  <th className="text-left px-3 py-2.5 w-[30%]">She typed</th>
                  <th className="text-left px-3 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => {
                  const busy = busyId === row.influencer_id;
                  const picked = choice[row.influencer_id] || '';
                  const place = [row.city_name, row.state_name].filter(Boolean).join(', ');
                  return (
                    <tr key={row.influencer_id} className="border-t border-border align-top">
                      <td className="px-5 py-3">
                        <a href={`/admin/influencers/${row.influencer_id}`} className="text-sm font-bold text-t1 hover:text-navy hover:underline">
                          {row.full_name || row.instagram_handle || row.youtube_handle || 'Unnamed creator'}
                        </a>
                        <div className="text-[11px] text-t3">
                          {place || 'City not stated'}
                          {row.instagram_handle ? ` · @${row.instagram_handle}` : ''}
                          {row.user_status && row.user_status !== 'approved' ? ` · ${row.user_status}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-t2">{row.niche_other || <span className="text-t3 italic">(nothing typed)</span>}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={picked}
                            disabled={busy}
                            onChange={e => setChoice(c => ({ ...c, [row.influencer_id]: e.target.value }))}
                            className="border border-border rounded-lg px-2 py-1.5 text-xs text-t2 bg-white max-w-[180px]">
                            <option value="">Map to…</option>
                            {niches.map(n => <option key={n.code} value={n.code}>{n.label}</option>)}
                          </select>
                          <button
                            onClick={() => applyMap(row)}
                            disabled={busy || !picked}
                            className="px-3 py-1.5 bg-navy text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap">
                            {busy ? 'Mapping…' : 'Apply'}
                          </button>
                          <button
                            onClick={() => openAdd(row)}
                            disabled={busy}
                            className="px-3 py-1.5 bg-white border border-navy/30 text-navy text-xs font-bold rounded-lg hover:bg-navy-pale disabled:opacity-40 whitespace-nowrap">
                            Add as new niche
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-t3">No one is on Other right now.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-gold-pale text-[11px] text-yellow-700">
            Until she&rsquo;s mapped, a creator on &ldquo;Other&rdquo; is found by every rule that doesn&rsquo;t filter on niche &mdash; and by none that do.
          </div>
        </div>
      )}

      {/* Add-as-new-niche modal */}
      {adding && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setAdding(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base font-bold text-t1">Add a niche</div>
              <button onClick={() => !saving && setAdding(null)} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {formError && <div className="bg-red-pale border border-red/20 text-red text-xs rounded-lg px-3 py-2">{formError}</div>}
              <p className="text-xs text-t2">
                <strong className="text-t1">{adding.full_name || 'This creator'}</strong> typed{' '}
                <em>&ldquo;{adding.niche_other}&rdquo;</em>. The new niche joins the reference list every creator picks from, and she is mapped to it.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-t2 mb-1">Label <span className="text-red">*</span></label>
                <input
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  placeholder="e.g. Pet care"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold text-t1" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-t2 mb-1">Code <span className="text-t3 font-normal">(optional)</span></label>
                <input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder={deriveCode(form.label) || 'derived from the label'}
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs font-mono text-t2" />
                <p className="text-[10px] text-t3 mt-1 italic">Letters, digits and underscores, starting with a letter. Left blank, the server derives it from the label.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => !saving && setAdding(null)} disabled={saving}
                className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl hover:bg-navy-pale disabled:opacity-40">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.label.trim()}
                className="px-5 py-2 bg-navy text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {saving ? 'Adding…' : 'Add & map her'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 max-w-sm">{toast}</div>
      )}
    </div>
  );
}
