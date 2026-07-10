'use client';

/**
 * Theme Library (Creator Experience Engine Phase 2, features/theme-library/,
 * migrations 129-130).
 *
 * A Theme is a business definition, not a title. Admin authors themes as a
 * curator: start from a Blueprint (pre-fills preset/categories/media/offers/
 * copy), edit the delta, Publish. Publish is validated server-side. Themes
 * become platform masters the creator Experience Studio (Phase 6) will offer.
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

const WORLDS = ['fashion', 'food', 'furniture', 'beauty', 'car_rental'];
const PURPOSES = ['lifestyle', 'travel', 'occasion', 'seasonal', 'budget', 'trend', 'category', 'editorial'];
const AUDIENCES = ['men', 'women', 'unisex', 'kids'];
const OFFER_TYPES = ['discount', 'volume', 'bogo', 'bundle', 'free_gift'];

export default function ThemeLibraryPage() {
  const [world, setWorld] = useState('fashion');
  const [themes, setThemes] = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [presets, setPresets] = useState([]);
  const [view, setView] = useState('list');       // 'list' | 'edit'
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, b, p] = await Promise.all([
      adminApi.listThemes(world),
      adminApi.listThemeBlueprints(world),
      adminApi.listDesignPresets(world),
    ]);
    if (t.success) setThemes(t.data?.themes || []);
    if (b.success) setBlueprints(b.data?.blueprints || []);
    if (p.success) setPresets(p.data?.presets || []);
  }, [world]);
  useEffect(() => { load(); }, [load]);

  const createFrom = async (bpKey) => {
    setBusy(true); setMsg(null);
    const res = await adminApi.createTheme({ world_key: world, from_blueprint_key: bpKey });
    setBusy(false);
    if (res.success) { setEditing(res.data.theme); setPicker(false); setView('edit'); }
    else setMsg({ kind: 'err', text: res.error?.message || 'Create failed' });
  };
  const openEdit = async (id) => {
    const res = await adminApi.getTheme(id);
    if (res.success) { setEditing(res.data.theme); setView('edit'); setMsg(null); }
  };
  const patch = (p) => setEditing((e) => ({ ...e, ...p }));

  const saveDraft = async () => {
    setBusy(true); setMsg(null);
    const res = await adminApi.updateTheme(editing.id, editableOf(editing));
    setBusy(false);
    if (res.success) { setEditing(res.data.theme); setMsg({ kind: 'ok', text: 'Draft saved.' }); }
    else setMsg({ kind: 'err', text: res.error?.message || 'Save failed' });
  };
  const publish = async () => {
    setBusy(true); setMsg(null);
    const up = await adminApi.updateTheme(editing.id, editableOf(editing));
    if (!up.success) { setBusy(false); setMsg({ kind: 'err', text: up.error?.message || 'Save failed' }); return; }
    const res = await adminApi.publishTheme(editing.id);
    setBusy(false);
    if (res.success) { setEditing(res.data.theme); setMsg({ kind: 'ok', text: `Published — "${res.data.theme.name}" is now a platform master.` }); }
    else setMsg({ kind: 'err', text: res.error?.message || 'Publish failed', field: res.error?.field });
  };

  if (view === 'edit' && editing) {
    return (
      <ThemeWizard
        theme={editing} presets={presets} patch={patch} busy={busy} msg={msg}
        onBack={() => { setView('list'); setEditing(null); load(); }}
        onSave={saveDraft} onPublish={publish}
      />
    );
  }

  const byPurpose = groupBy(blueprints, 'purpose');
  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">🎭 Theme Library</h1>
        <div className="flex items-center gap-3">
          <select value={world} onChange={(e) => setWorld(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold bg-white">
            {WORLDS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <button onClick={() => setPicker((v) => !v)}
                  className="bg-gold text-gray-900 rounded-lg px-4 py-2 text-sm font-bold">＋ Create Theme</button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-5">Themes = business definitions. Start from a blueprint, edit the delta.</p>

      {msg && <div className={`mb-4 text-sm rounded-lg px-3 py-2 ${msg.kind === 'ok' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>{msg.text}</div>}

      {picker && (
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-5">
          <div className="font-extrabold text-gray-900">Start from a blueprint</div>
          <p className="text-xs text-gray-500 mb-3">Pre-fills preset, categories, media rules, offers and copy. Change only what's unique.</p>
          {Object.keys(byPurpose).map((pp) => (
            <div key={pp} className="mb-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-2">{pp}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {byPurpose[pp].map((bp) => (
                  <button key={bp.key} disabled={busy} onClick={() => createFrom(bp.key)}
                          className="text-left border border-gray-200 rounded-xl p-3 hover:border-gold disabled:opacity-50">
                    <div className="text-lg">{bp.icon}</div>
                    <div className="font-bold text-[13px] text-gray-900 mt-1">{bp.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{bp.preset_key}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {themes.length === 0 ? (
        <div className="text-sm text-gray-400 py-10">No themes yet — start from a blueprint.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {themes.map((t) => (
            <button key={t.id} onClick={() => openEdit(t.id)}
                    className="text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-gold">
              <div className="text-2xl">{t.icon}</div>
              <div className="font-extrabold text-[15px] mt-1.5">{t.name}</div>
              <div className="text-xs text-gray-500">{t.subtitle}</div>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[11px] rounded-full px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-600">{t.purpose}</span>
                <span className="text-[11px] rounded-full px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-600">{t.preset_key}</span>
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${t.status === 'published' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{t.status}</span>
                <span className="text-[11px] text-gray-400 ml-auto">{t.min_products}–{t.max_products}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeWizard({ theme, presets, patch, busy, msg, onBack, onSave, onPublish }) {
  const t = theme;
  const cats = Array.isArray(t.supported_categories) ? t.supported_categories : [];
  const offers = Array.isArray(t.supported_offer_types) ? t.supported_offer_types : [];
  const media = t.media_rules_json || {};
  const [newCat, setNewCat] = useState('');

  const toggleArr = (key, val, list) => {
    const set = new Set(list); set.has(val) ? set.delete(val) : set.add(val);
    patch({ [key]: Array.from(set) });
  };
  const addCat = () => { const v = newCat.trim(); if (v && !cats.includes(v)) patch({ supported_categories: [...cats, v] }); setNewCat(''); };

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={onBack} className="text-xs text-gray-500 mb-2">← Theme Library</button>
      <h1 className="text-xl font-extrabold text-gray-900">{t.icon} {t.name || 'New theme'}</h1>
      <p className="text-xs text-gray-500 mb-4">
        {t.blueprint_source_key ? <>Started from blueprint <b>{t.blueprint_source_key}</b>. </> : null}
        Edit only what's unique. <span className={`ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${t.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{t.status}</span>
      </p>

      {msg && <div className={`mb-4 text-sm rounded-lg px-3 py-2 ${msg.kind === 'ok' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>{msg.text}</div>}

      <Card n="1" title="Identity">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input value={t.name || ''} onChange={(e) => patch({ name: e.target.value })} className="inp" /></Field>
          <Field label="Icon"><input value={t.icon || ''} onChange={(e) => patch({ icon: e.target.value })} className="inp" /></Field>
        </div>
        <Field label="Short description"><input value={t.description || ''} onChange={(e) => patch({ description: e.target.value })} className="inp" /></Field>
        <Field label="Audience"><Chips opts={AUDIENCES} val={[t.audience]} onToggle={(v) => patch({ audience: v })} single /></Field>
      </Card>

      <Card n="2" title="Purpose">
        <Chips opts={PURPOSES} val={[t.purpose]} onToggle={(v) => patch({ purpose: v })} single />
      </Card>

      <Card n="3" title="Visual — preset (from Design System)">
        <select value={t.preset_key || ''} onChange={(e) => patch({ preset_key: e.target.value })} className="inp">
          <option value="">— pick a preset —</option>
          {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </Card>

      <Card n="4" title="Supported categories *">
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
              {c}<button onClick={() => patch({ supported_categories: cats.filter((x) => x !== c) })} className="text-emerald-500">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} placeholder="Add a category" className="inp" />
          <button onClick={addCat} className="text-sm border border-gray-200 rounded-lg px-3">Add</button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Min products"><input type="number" value={t.min_products ?? 4} onChange={(e) => patch({ min_products: Number(e.target.value) })} className="inp" /></Field>
          <Field label="Max products"><input type="number" value={t.max_products ?? 20} onChange={(e) => patch({ max_products: Number(e.target.value) })} className="inp" /></Field>
        </div>
      </Card>

      <Card n="5" title="Media rules">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Featured"><select value={media.featured || 'required'} onChange={(e) => patch({ media_rules_json: { ...media, featured: e.target.value } })} className="inp"><option>required</option><option>optional</option></select></Field>
          <Field label="Video"><select value={media.video || 'optional'} onChange={(e) => patch({ media_rules_json: { ...media, video: e.target.value } })} className="inp"><option>optional</option><option>required</option><option>none</option></select></Field>
          <Field label="Orientation"><select value={media.orientation || 'portrait'} onChange={(e) => patch({ media_rules_json: { ...media, orientation: e.target.value } })} className="inp"><option>portrait</option><option>landscape</option><option>any</option></select></Field>
        </div>
      </Card>

      <Card n="6" title="Supported offers">
        <Chips opts={OFFER_TYPES} val={offers} onToggle={(v) => toggleArr('supported_offer_types', v, offers)} />
      </Card>

      <Card n="7" title="Default copy">
        <Field label="Title"><input value={t.default_title || ''} onChange={(e) => patch({ default_title: e.target.value })} className="inp" /></Field>
        <Field label="Subtitle"><input value={t.default_subtitle || ''} onChange={(e) => patch({ default_subtitle: e.target.value })} className="inp" /></Field>
        <Field label="CTA"><input value={t.default_cta || ''} onChange={(e) => patch({ default_cta: e.target.value })} className="inp" /></Field>
      </Card>

      <div className="flex items-center justify-between mt-4">
        <button onClick={onBack} className="text-sm border border-gray-200 rounded-lg px-4 py-2">Cancel</button>
        <div className="flex gap-2">
          <button onClick={onSave} disabled={busy} className="bg-gold text-gray-900 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50">Save draft</button>
          <button onClick={onPublish} disabled={busy} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50">Publish ✓</button>
        </div>
      </div>

      <style jsx>{`
        .inp{ width:100%; border:1px solid #e5e7eb; border-radius:8px; padding:8px 10px; font-size:13px; background:#fff; }
      `}</style>
    </div>
  );
}

function Card({ n, title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-3">
        <span className="inline-flex w-[18px] h-[18px] rounded-full bg-gray-900 text-white text-[10px] items-center justify-center mr-2 align-middle">{n}</span>{title}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return <div className="mt-2 first:mt-0"><label className="block text-[11px] text-gray-400 font-semibold mb-1">{label}</label>{children}</div>;
}
function Chips({ opts, val, onToggle, single }) {
  const on = (o) => (val || []).includes(o);
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => (
        <button key={o} onClick={() => onToggle(o)}
                className={`text-xs rounded-full px-3 py-1.5 border ${on(o) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{o}</button>
      ))}
    </div>
  );
}

function groupBy(arr, key) {
  return (arr || []).reduce((acc, x) => { const k = x[key] || 'other'; (acc[k] = acc[k] || []).push(x); return acc; }, {});
}
function editableOf(t) {
  return {
    name: t.name, subtitle: t.subtitle, icon: t.icon, description: t.description,
    purpose: t.purpose, audience: t.audience, preset_key: t.preset_key,
    supported_categories: t.supported_categories, min_products: t.min_products,
    max_products: t.max_products, media_rules_json: t.media_rules_json,
    supported_offer_types: t.supported_offer_types, default_title: t.default_title,
    default_subtitle: t.default_subtitle, default_cta: t.default_cta,
    applicable_worlds: t.applicable_worlds,
  };
}
