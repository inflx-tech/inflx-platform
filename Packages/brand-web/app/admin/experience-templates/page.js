'use client';

/**
 * Experience Templates (Creator Experience Engine Phase 5, features/experience-templates/,
 * migrations 133-134).
 *
 * Assemble Theme (P2) + Design layout (P3) + Section Style + placement/rules,
 * then Place → writes a section_config row (rule='experience_template'). The row
 * renders empty until creators publish experiences (Phase 6); the live home is
 * unchanged today.
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

const WORLDS = ['fashion', 'food', 'furniture', 'beauty', 'car_rental'];
const TYPES = ['creator', 'automatic', 'mixed'];
const STORE_RULES = ['always', 'if_products', 'manual'];
const CREATOR_STORE_RULES = ['always', 'if_creator_has_experience', 'hidden'];
const PLACEMENTS = ['home', 'men', 'women', 'creator_store', 'business'];

export default function ExperienceTemplatesPage() {
  const [world, setWorld] = useState('fashion');
  const [templates, setTemplates] = useState([]);
  const [themes, setThemes] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [styles, setStyles] = useState([]);
  const [view, setView] = useState('list');
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, th, ly, st] = await Promise.all([
      adminApi.listTemplates(world), adminApi.listThemes(world),
      adminApi.listDesignLayouts(world), adminApi.listSectionStyles(),
    ]);
    if (t.success) setTemplates(t.data?.templates || []);
    if (th.success) setThemes(th.data?.themes || []);
    if (ly.success) setLayouts(ly.data?.layouts || []);
    if (st.success) setStyles((st.data?.section_styles || []).map((s) => s.key));
  }, [world]);
  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing({ template_type: 'creator', section_style: 'hero', store_rule: 'if_products', creator_store_rule: 'if_creator_has_experience', placement_json: { screens: ['home'] } }); setView('edit'); setMsg(null); };
  const openEdit = async (id) => { const r = await adminApi.getTemplate(id); if (r.success) { setEditing(r.data.template); setView('edit'); setMsg(null); } };
  const patch = (p) => setEditing((e) => ({ ...e, ...p }));

  const save = async () => {
    setBusy(true); setMsg(null);
    const payload = { world_key: world, ...pick(editing) };
    const res = editing.id ? await adminApi.updateTemplate(editing.id, payload) : await adminApi.createTemplate(payload);
    setBusy(false);
    if (res.success) { setEditing(res.data.template); setMsg({ kind: 'ok', text: 'Saved.' }); }
    else setMsg({ kind: 'err', text: res.error?.message || 'Save failed' });
  };
  const place = async () => {
    setBusy(true); setMsg(null);
    const payload = { world_key: world, ...pick(editing) };
    const saved = editing.id ? await adminApi.updateTemplate(editing.id, payload) : await adminApi.createTemplate(payload);
    if (!saved.success) { setBusy(false); setMsg({ kind: 'err', text: saved.error?.message || 'Save failed' }); return; }
    const t = saved.data.template;
    const res = await adminApi.placeTemplate(t.id);
    setBusy(false);
    if (res.success) { setEditing({ ...t, status: 'placed' }); setMsg({ kind: 'ok', text: 'Placed — renders empty on the home until creators publish experiences (Phase 6).' }); }
    else setMsg({ kind: 'err', text: res.error?.message || 'Place failed' });
  };
  const unplace = async () => {
    if (!editing.id) return;
    setBusy(true);
    const res = await adminApi.unplaceTemplate(editing.id);
    setBusy(false);
    if (res.success) { setEditing({ ...editing, status: 'draft' }); setMsg({ kind: 'ok', text: 'Unplaced.' }); }
  };

  if (view === 'edit' && editing) {
    return (
      <Builder e={editing} themes={themes} layouts={layouts} styles={styles} patch={patch} busy={busy} msg={msg}
        onBack={() => { setView('list'); setEditing(null); load(); }} onSave={save} onPlace={place} onUnplace={unplace} />
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">🧩 Experience Templates</h1>
        <div className="flex items-center gap-3">
          <select value={world} onChange={(e) => setWorld(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold bg-white">
            {WORLDS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <button onClick={startNew} className="bg-gold text-gray-900 rounded-lg px-4 py-2 text-sm font-bold">＋ Create Template</button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-5">Assemble Theme + Design + Section Style, then place on a screen.</p>
      {msg && <div className={`mb-4 text-sm rounded-lg px-3 py-2 ${msg.kind === 'ok' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>{msg.text}</div>}

      {templates.length === 0 ? (
        <div className="text-sm text-gray-400 py-10">No templates yet — assemble one from a theme + design.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {templates.map((t) => (
            <button key={t.id} onClick={() => openEdit(t.id)} className="text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-gold">
              <div className="font-extrabold text-[15px]">{t.name}</div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200">{t.template_type}</span>
                {t.theme_key ? <Chip>{t.theme_key}</Chip> : null}
                <Chip>{t.design_layout_key}</Chip>
                <Chip>{t.section_style}</Chip>
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ml-auto ${t.status === 'placed' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{t.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Builder({ e, themes, layouts, styles, patch, busy, msg, onBack, onSave, onPlace, onUnplace }) {
  const screens = (e.placement_json && e.placement_json.screens) || ['home'];
  const toggleScreen = (s) => {
    const set = new Set(screens); set.has(s) ? set.delete(s) : set.add(s);
    patch({ placement_json: { ...(e.placement_json || {}), screens: Array.from(set) } });
  };
  return (
    <div className="p-6 max-w-3xl">
      <button onClick={onBack} className="text-xs text-gray-500 mb-2">← Experience Templates</button>
      <h1 className="text-xl font-extrabold text-gray-900">{e.name || 'New template'}</h1>
      <p className="text-xs text-gray-500 mb-4">Assemble the parts, then Place. <span className={`ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${e.status === 'placed' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{e.status || 'draft'}</span></p>
      {msg && <div className={`mb-4 text-sm rounded-lg px-3 py-2 ${msg.kind === 'ok' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>{msg.text}</div>}

      <Card n="1" title="Type"><Chips opts={TYPES} val={[e.template_type]} onToggle={(v) => patch({ template_type: v })} single /></Card>
      <Card n="2" title="Theme">
        <select value={e.theme_key || ''} onChange={(ev) => patch({ theme_key: ev.target.value })} className="inp">
          <option value="">{e.template_type === 'automatic' ? '— none (automatic) —' : '— pick a theme —'}</option>
          {themes.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
      </Card>
      <Card n="3" title="Design layout">
        <select value={e.design_layout_key || ''} onChange={(ev) => patch({ design_layout_key: ev.target.value })} className="inp">
          <option value="">— pick a layout —</option>
          {layouts.map((l) => <option key={l.key} value={l.key}>{l.label} · {l.aspect_hint}</option>)}
        </select>
      </Card>
      <Card n="4" title="Section style"><Chips opts={styles} val={[e.section_style]} onToggle={(v) => patch({ section_style: v })} single /></Card>
      <Card n="5" title="Name"><input value={e.name || ''} onChange={(ev) => patch({ name: ev.target.value })} placeholder="auto from theme + style" className="inp" /></Card>
      <Card n="6" title="Placement">
        <div className="flex flex-wrap gap-1.5">
          {PLACEMENTS.map((p) => (
            <button key={p} onClick={() => toggleScreen(p)} className={`text-xs rounded-full px-3 py-1.5 border ${screens.includes(p) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{p}</button>
          ))}
        </div>
        <div className="text-[11px] text-gray-400 mt-2">v1 places on the world home (category · vertical). Other surfaces are stored for later.</div>
      </Card>
      <Card n="7" title="Store rule"><Chips opts={STORE_RULES} val={[e.store_rule]} onToggle={(v) => patch({ store_rule: v })} single /></Card>
      <Card n="8" title="Creator-store rule"><Chips opts={CREATOR_STORE_RULES} val={[e.creator_store_rule]} onToggle={(v) => patch({ creator_store_rule: v })} single /></Card>

      <div className="flex items-center justify-between mt-4">
        <button onClick={onBack} className="text-sm border border-gray-200 rounded-lg px-4 py-2">Cancel</button>
        <div className="flex gap-2">
          {e.status === 'placed' ? <button onClick={onUnplace} disabled={busy} className="text-sm border border-gray-200 rounded-lg px-4 py-2 disabled:opacity-50">Unplace</button> : null}
          <button onClick={onSave} disabled={busy} className="bg-gold text-gray-900 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50">Save draft</button>
          <button onClick={onPlace} disabled={busy} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50">Place ✓</button>
        </div>
      </div>
      <style jsx>{`.inp{ width:100%; border:1px solid #e5e7eb; border-radius:8px; padding:8px 10px; font-size:13px; background:#fff; }`}</style>
    </div>
  );
}

function Chip({ children }) { return <span className="text-[11px] rounded-full px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-600">{children}</span>; }
function Card({ n, title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-3">
        <span className="inline-flex w-[18px] h-[18px] rounded-full bg-gray-900 text-white text-[10px] items-center justify-center mr-2 align-middle">{n}</span>{title}
      </div>{children}
    </div>
  );
}
function Chips({ opts, val, onToggle }) {
  const on = (o) => (val || []).includes(o);
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => <button key={o} onClick={() => onToggle(o)} className={`text-xs rounded-full px-3 py-1.5 border ${on(o) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{o}</button>)}
    </div>
  );
}
function pick(e) {
  return {
    template_type: e.template_type, theme_key: e.theme_key || null, design_layout_key: e.design_layout_key,
    section_style: e.section_style, name: e.name, placement_json: e.placement_json,
    store_rule: e.store_rule, creator_store_rule: e.creator_store_rule,
  };
}
