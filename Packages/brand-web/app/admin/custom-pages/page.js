'use client';
import { useEffect, useState, useCallback } from 'react';
import { pageApi } from '../../../lib/api';

/**
 * Custom Pages — admin registry of GLOBAL themed pages (App Builder E).
 *
 * A page here is metadata only (label · key · title · subtitle · enabled). Its
 * section stack is composed in the App Builder (/admin/sections → "Custom page"
 * scope → pick this page). A page is then used as a section's tap-destination ③
 * via the App Builder's "On tap, go to… → A page" control.
 *
 * Contract: features/follower-page-builder/.
 */

function deriveKey(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
}

export default function CustomPagesPage() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ label: '', key: '', title: '', subtitle: '' });
  const [keyEdited, setKeyEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await pageApi.list();
    if (res.success) setPages(res.data?.pages || []);
    else setMsg({ kind: 'err', text: res.error?.message || 'Failed to load' });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ label: '', key: '', title: '', subtitle: '' }); setKeyEdited(false); setShowNew(true); setMsg(null); };

  const onLabel = (v) => setForm(f => ({ ...f, label: v, key: keyEdited ? f.key : deriveKey(v) }));

  const create = async () => {
    if (!form.label.trim()) { setMsg({ kind: 'err', text: 'Enter a label.' }); return; }
    setSaving(true);
    const res = await pageApi.create({ label: form.label.trim(), key: form.key || undefined, title: form.title || undefined, subtitle: form.subtitle || undefined });
    setSaving(false);
    if (res.success) { setShowNew(false); setMsg({ kind: 'ok', text: `Page "${res.data.page.label}" created — compose it in the App Builder.` }); load(); }
    else setMsg({ kind: 'err', text: res.error?.message || 'Create failed' });
  };

  const toggle = async (p) => { const res = await pageApi.update(p.id, { enabled: !p.enabled }); if (res.success) load(); else setMsg({ kind: 'err', text: res.error?.message || 'Update failed' }); };
  const rename = async (p) => { const n = prompt('Page label', p.label); if (n && n.trim() && n.trim() !== p.label) { const res = await pageApi.update(p.id, { label: n.trim() }); if (res.success) load(); else setMsg({ kind: 'err', text: res.error?.message || 'Rename failed' }); } };
  const remove = async (p) => { if (!confirm(`Delete "${p.label}"? Its sections become unreachable; any section pointing here shows an empty page.`)) return; const res = await pageApi.remove(p.id); if (res.success) load(); else setMsg({ kind: 'err', text: res.error?.message || 'Delete failed' }); };
  const compose = (p) => { window.location.href = `/admin/sections?scope=page&page=${encodeURIComponent(p.key)}`; };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">📄 Custom Pages</h1>
        <button onClick={openNew} className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold">＋ New page</button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Global themed pages (e.g. “Summer Sale”). Create one here, <b>Compose</b> its sections in the App Builder,
        then point any section’s tap at it (App Builder → “On tap, go to… → A page”).
      </p>

      {msg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-semibold ${msg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      {showNew && (
        <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50/40">
          <div className="text-sm font-bold text-gray-800 mb-3">Create a page</div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase mb-2">Label
            <input value={form.label} onChange={e => onLabel(e.target.value)} placeholder="Summer Sale"
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2.5 py-1.5" />
          </label>
          <label className="block text-[11px] font-bold text-gray-600 uppercase mb-2">Key
            <input value={form.key} onChange={e => { setKeyEdited(true); setForm(f => ({ ...f, key: deriveKey(e.target.value) })); }} placeholder="summer_sale"
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 font-mono" />
            <span className="text-[10px] text-gray-400">Auto-derived from label; editable; must be unique.</span>
          </label>
          <label className="block text-[11px] font-bold text-gray-600 uppercase mb-2">Hero title (shown to followers)
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="☀️ Summer Sale — up to 60% off"
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2.5 py-1.5" />
          </label>
          <label className="block text-[11px] font-bold text-gray-600 uppercase mb-3">Subtitle (optional)
            <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="Hand-picked deals from your creators"
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2.5 py-1.5" />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold">Cancel</button>
            <button onClick={create} disabled={saving} className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-bold disabled:opacity-50">{saving ? 'Creating…' : 'Create page'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-10 text-center">Loading…</div>
      ) : pages.length === 0 ? (
        <div className="text-sm text-gray-500 py-10 text-center">No pages yet — create one above.</div>
      ) : (
        <div className="border rounded-xl bg-white overflow-hidden">
          {pages.map(p => (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 ${p.enabled === false ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">{p.label}</div>
                <div className="text-[11px] text-gray-400 font-mono truncate">{p.key}</div>
              </div>
              <button onClick={() => toggle(p)} title="Show/hide"
                className={`w-10 h-6 rounded-full relative transition-colors ${p.enabled !== false ? 'bg-amber-700' : 'bg-gray-300'}`} aria-label="toggle enabled">
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${p.enabled !== false ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              <button onClick={() => compose(p)} className="text-xs font-bold text-amber-700">Compose →</button>
              <button onClick={() => rename(p)} className="text-xs font-semibold text-gray-500">Rename</button>
              <button onClick={() => remove(p)} className="text-xs font-semibold text-red-600">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
