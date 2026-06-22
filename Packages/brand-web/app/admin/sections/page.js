'use client';
import { useEffect, useState, useCallback } from 'react';
import { sectionApi, adminApi } from '../../../lib/api';

/**
 * App Sections — Admin Section Manager v2 (Creator Vibe).
 *
 * Curate the follower section engine (section_config). Per screen + scope:
 *   • rename the shelf title (v2)
 *   • edit caption / chip+filter labels / nav-vertical labels+icons / raw config (v2)
 *   • add a new shelf from a preset (v2)
 *   • pick city / per-vertical scope (v2)
 *   • reorder, show/hide, set count, category + item-type, delete
 * Publish writes PUT /admin/sections/:screen — live in the follower app within ~60s
 * (engine cache TTL). Contracts: features/admin-section-manager + …-v2.
 */

const SCREENS = [
  { key: 'home', label: 'Home' },
  { key: 'category', label: 'Category' },
  { key: 'offers', label: 'Offers' },
  { key: 'creator_store', label: 'Creator Store' },
  { key: 'creator_category', label: "Creator's Category" },
];

const CATEGORIES = ['dining', 'shopping', 'groom', 'stay_fit', 'travel', 'home', 'events'];
const ITEM_TYPES = ['brands', 'products', 'offers'];
const RULE_FOR_TYPE = { brands: 'top_by_engagement', products: 'top_by_sales', offers: 'top_by_conversions' };

// ＋ Add Section presets → valid {shelf_type, rule, item_type?} (rules exist in
// sectionRules.service.js). Listing-driven rules populate without offers.
const ADD_PRESETS = [
  { key: 'brands',   label: 'Businesses rail', shelf_type: 'brands',   rule: 'businesses_in_category', item_type: 'brands',   title: 'Top Businesses' },
  { key: 'products', label: 'Products rail',   shelf_type: 'products', rule: 'products_in_category',   item_type: 'products', title: 'Trending Products' },
  { key: 'offers',   label: 'Offers rail',     shelf_type: 'offers',   rule: 'top_by_conversions',     item_type: 'offers',   title: 'Best Deals' },
  { key: 'creators', label: 'Creators rail',   shelf_type: 'creators', rule: 'creators_listing',       title: 'Top Creators' },
  { key: 'controls', label: 'Chips / controls bar', shelf_type: 'controls', rule: 'static',            title: 'Filters' },
  // Food World 3C-1 — Type B: one card per restaurant + a nested carousel of its
  // featured dishes (is_featured/featured_sort, fallback first N in-stock).
  { key: 'restaurant_list', label: 'Restaurants + dishes (food)', shelf_type: 'restaurant_list', rule: 'restaurants_with_featured', item_type: 'brands', title: 'Famous Restaurants' },
  // Phase 3c — place a reusable Section Library section (data-driven). Pick which
  // section in the row editor; the engine fills it from that section's rule.
  { key: 'library',  label: 'Library Section',  shelf_type: 'products', rule: 'library_products',       item_type: 'products', title: 'New section' },
  // Phase 4b — place a Collection (group of sections). Pick which in the row editor.
  { key: 'collection', label: 'Collection',     shelf_type: 'products', rule: 'collection',            item_type: 'products', title: 'New collection' },
];

function hasTypeControls(s) {
  return s.shelf_key === 'top_in' || s.item_type != null;
}
function slug(t) {
  return String(t || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36) || 'section';
}

export default function SectionsPage() {
  const [screen, setScreen] = useState('home');
  const [scopeType, setScopeType] = useState('global');
  const [scopeValue, setScopeValue] = useState('');   // committed
  const [cityDraft, setCityDraft] = useState('');
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [expanded, setExpanded] = useState(null);     // shelf id/key being config-edited
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonErr, setJsonErr] = useState(null);
  const [addPreset, setAddPreset] = useState('brands');
  const [librarySections, setLibrarySections] = useState([]);
  const [collections, setCollections] = useState([]);

  // Section Library (3c) + Collection Library (4b) options for the placement pickers.
  useEffect(() => {
    adminApi.listSectionLibrary().then(res => {
      if (res.success) setLibrarySections((res.data?.sections || []).filter(s => s.status === 'active'));
    });
    adminApi.listCollectionLibrary().then(res => {
      if (res.success) setCollections((res.data?.collections || []).filter(c => c.status === 'active'));
    });
  }, []);

  const load = useCallback(async (scr, sType, sVal) => {
    setLoading(true); setMsg(null); setExpanded(null);
    const res = await sectionApi.getSections(scr, sType, sVal || '');
    if (res.success) setShelves(res.data.shelves || []);
    else setMsg({ kind: 'err', text: res.error?.message || 'Failed to load' });
    setLoading(false);
  }, []);

  useEffect(() => { load(screen, scopeType, scopeValue); }, [screen, scopeType, scopeValue, load]);

  const rowId = (s) => s.id || s._tmp;
  const update = (id, patch) =>
    setShelves(prev => prev.map(s => (rowId(s) === id ? { ...s, ...patch } : s)));

  const setConfig = (id, nextConfig) => update(id, { config_json: nextConfig });
  const patchConfig = (id, key, value) =>
    setShelves(prev => prev.map(s => (rowId(s) === id ? { ...s, config_json: { ...(s.config_json || {}), [key]: value } } : s)));
  // Phase 6 — patch a nested config object (config_json.banner.*, config_json.hero.*).
  const patchNested = (id, parent, key, value) =>
    setShelves(prev => prev.map(s => (rowId(s) === id
      ? { ...s, config_json: { ...(s.config_json || {}), [parent]: { ...((s.config_json || {})[parent] || {}), [key]: value } } }
      : s)));

  const move = (idx, dir) => {
    setShelves(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((s, i) => ({ ...s, position: i }));
    });
  };
  const changeCount = (id, delta) =>
    setShelves(prev => prev.map(s =>
      rowId(s) === id ? { ...s, item_limit: Math.max(0, Math.min(50, (s.item_limit || 0) + delta)) } : s));
  const changeType = (id, item_type) =>
    update(id, { item_type, rule: RULE_FOR_TYPE[item_type] || undefined });

  const toggleExpand = (s) => {
    const id = rowId(s);
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setJsonDraft(JSON.stringify(s.config_json || {}, null, 2));
    setJsonErr(null);
  };
  const onJsonChange = (id, v) => {
    setJsonDraft(v);
    try { const parsed = v.trim() ? JSON.parse(v) : {}; setConfig(id, parsed); setJsonErr(null); }
    catch { setJsonErr('Invalid JSON — not applied'); }
  };

  const addSection = () => {
    const p = ADD_PRESETS.find(x => x.key === addPreset) || ADD_PRESETS[0];
    const tmp = `tmp_${Math.random().toString(36).slice(2, 8)}`;
    const shelf = {
      _tmp: tmp, id: null,
      shelf_key: `${slug(p.title)}_${Date.now().toString(36).slice(-4)}`,
      title: p.title, shelf_type: p.shelf_type, rule: p.rule,
      item_type: p.item_type || null, category_key: null,
      item_limit: 8, position: shelves.length, enabled: true,
      config_json: { sub: '' },
    };
    setShelves(prev => [...prev, shelf]);
    setExpanded(tmp); setJsonDraft(JSON.stringify(shelf.config_json, null, 2)); setJsonErr(null);
  };

  const removeShelf = async (s) => {
    if (!s.id) { setShelves(prev => prev.filter(x => rowId(x) !== rowId(s))); return; } // unsaved draft
    if (!confirm(`Remove "${s.title}"? This hides it from the app.`)) return;
    const res = await sectionApi.deleteSection(s.id);
    if (res.success) setShelves(prev => prev.filter(x => x.id !== s.id));
    else setMsg({ kind: 'err', text: res.error?.message || 'Delete failed' });
  };

  const publish = async () => {
    // Phase 3c — a Library Section placement must reference a section.
    const unset = shelves.find(s => s.rule === 'library_products' && !(s.config_json || {}).library_section_id);
    if (unset) { setMsg({ kind: 'err', text: `"${unset.title || 'Library Section'}" — pick a library section before publishing.` }); return; }
    // Phase 4b — a Collection placement must reference a collection.
    const unsetColl = shelves.find(s => s.rule === 'collection' && !(s.config_json || {}).collection_id);
    if (unsetColl) { setMsg({ kind: 'err', text: `"${unsetColl.title || 'Collection'}" — pick a collection before publishing.` }); return; }
    // Phase 6 — a Banner-Gateway placement needs a headline.
    const unsetBanner = shelves.find(s => (s.config_json || {}).presentation_type === 'banner' && !((s.config_json || {}).banner || {}).headline);
    if (unsetBanner) { setMsg({ kind: 'err', text: `"${unsetBanner.title || 'Banner'}" — add a banner headline before publishing.` }); return; }
    setSaving(true); setMsg(null);
    const payload = {
      scope_type: scopeType,
      scope_value: scopeType === 'global' ? null : (scopeValue || null),
      shelves: shelves.map((s, i) => ({
        id: s.id || undefined, shelf_key: s.shelf_key, title: s.title, shelf_type: s.shelf_type,
        rule: s.rule, item_type: s.item_type, category_key: s.category_key,
        item_limit: Number(s.item_limit), position: i, enabled: s.enabled !== false,
        pinned_ref: s.pinned_ref, config_json: s.config_json,
      })),
    };
    const res = await sectionApi.saveSections(screen, payload);
    if (res.success) {
      setShelves(res.data.shelves || []);
      setMsg({ kind: 'ok', text: `Published — ${res.data.saved_count} shelves saved. Live within ~60s.` });
    } else {
      setMsg({ kind: 'err', text: res.error?.message || 'Publish failed' });
    }
    setSaving(false);
  };

  const scopeNeedsValue = scopeType !== 'global';

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">🎛️ App Sections</h1>
        <button onClick={publish} disabled={saving || loading}
          className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold disabled:opacity-50">
          {saving ? 'Publishing…' : 'Publish'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Rename, edit captions/labels, add sections, reorder, show/hide, set count, and pick
        category + item-type per shelf. Scope to a city or vertical for overrides. Changes go
        live in the follower app within ~60s — no app update.
      </p>

      {/* Screen tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SCREENS.map(s => (
          <button key={s.key} onClick={() => setScreen(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              screen === s.key ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Scope selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-2 rounded-lg bg-gray-50 border border-gray-200">
        <span className="text-[11px] font-bold text-gray-500 uppercase">Scope</span>
        <select value={scopeType}
          onChange={e => { setScopeType(e.target.value); setScopeValue(''); setCityDraft(''); }}
          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
          <option value="global">Global (all)</option>
          <option value="city">City</option>
          <option value="vertical">Vertical</option>
        </select>
        {scopeType === 'city' && (
          <>
            <input value={cityDraft} onChange={e => setCityDraft(e.target.value)} placeholder="e.g. Vijayawada"
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white" />
            <button onClick={() => setScopeValue(cityDraft.trim())}
              className="text-xs font-semibold px-2.5 py-1 rounded bg-gray-800 text-white">Load city</button>
          </>
        )}
        {scopeType === 'vertical' && (
          <select value={scopeValue} onChange={e => setScopeValue(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
            <option value="">(pick vertical)</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {scopeNeedsValue && scopeValue
          ? <span className="text-[11px] text-green-700 font-semibold">editing {scopeType}: {scopeValue}</span>
          : scopeNeedsValue
            ? <span className="text-[11px] text-gray-400">pick a {scopeType} to edit its overrides</span>
            : null}
      </div>

      {msg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-semibold ${
          msg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-10 text-center">Loading…</div>
      ) : (scopeNeedsValue && !scopeValue) ? (
        <div className="text-sm text-gray-500 py-10 text-center">Pick a {scopeType} above to edit its shelves.</div>
      ) : shelves.length === 0 ? (
        <div className="text-sm text-gray-500 py-10 text-center">No shelves for this scope yet — add one below.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {shelves.map((s, idx) => {
            const id = rowId(s);
            const cfg = s.config_json || {};
            const labelsKey = Array.isArray(cfg.filters) ? 'filters' : (Array.isArray(cfg.chips) ? 'chips' : (s.shelf_type === 'controls' ? 'chips' : null));
            const isOpen = expanded === id;
            return (
              <div key={id} className={`border rounded-xl bg-white ${s.enabled === false ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex flex-col">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-gray-400 disabled:opacity-30 leading-none">▲</button>
                    <button onClick={() => move(idx, 1)} disabled={idx === shelves.length - 1} className="text-gray-400 disabled:opacity-30 leading-none">▼</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Title — inline editable (v2) */}
                    <input value={s.title || ''} onChange={e => update(id, { title: e.target.value })}
                      className="w-full text-sm font-bold text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-amber-500 focus:outline-none bg-transparent" />
                    <div className="text-[11px] text-gray-500 truncate">
                      {s.shelf_type} · {s.rule}{s.id ? '' : ' · NEW'}
                    </div>
                    {hasTypeControls(s) && (
                      <div className="flex gap-2 mt-1.5">
                        <select value={s.category_key || ''} onChange={e => update(id, { category_key: e.target.value || null })}
                          className="text-[11px] border border-gray-300 rounded px-1.5 py-0.5 bg-gray-50">
                          <option value="">(no category)</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={s.item_type || ''} onChange={e => changeType(id, e.target.value || null)}
                          className="text-[11px] border border-gray-300 rounded px-1.5 py-0.5 bg-gray-50">
                          <option value="">(type)</option>
                          {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <button onClick={() => toggleExpand(s)} title="Edit details"
                    className={`text-xs px-2 py-1 rounded border ${isOpen ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-500'}`}>⚙</button>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button onClick={() => changeCount(id, -1)} className="w-7 h-7 bg-gray-50 text-amber-700 font-bold">−</button>
                    <span className="w-8 text-center text-xs font-bold">{s.item_limit}</span>
                    <button onClick={() => changeCount(id, 1)} className="w-7 h-7 bg-gray-50 text-amber-700 font-bold">+</button>
                  </div>
                  <button onClick={() => update(id, { enabled: !(s.enabled !== false) })}
                    className={`w-10 h-6 rounded-full relative transition-colors ${s.enabled !== false ? 'bg-amber-700' : 'bg-gray-300'}`} aria-label="toggle enabled">
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${s.enabled !== false ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <button onClick={() => removeShelf(s)} className="text-gray-300 hover:text-red-500 text-sm" aria-label="remove">✕</button>
                </div>

                {/* Config editor (v2) */}
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100 flex flex-col gap-2">
                    {/* Library Section placement (Phase 3c) — pick which reusable section fills this shelf. */}
                    {s.rule === 'library_products' && (
                      <label className="text-[11px] font-semibold text-gray-600">Library section
                        <select value={cfg.library_section_id || ''}
                          onChange={e => {
                            const secId = e.target.value;
                            const sec = librarySections.find(x => x.id === secId);
                            update(id, {
                              config_json: { ...(s.config_json || {}), library_section_id: secId },
                              ...((!s.title || s.title === 'New section') && sec ? { title: sec.name } : {}),
                            });
                          }}
                          className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                          <option value="">(pick a section)</option>
                          {librarySections.map(sec => (
                            <option key={sec.id} value={sec.id}>{sec.name} · {sec.business_type}</option>
                          ))}
                        </select>
                        {!cfg.library_section_id && <span className="block mt-0.5 text-[11px] text-red-600 font-semibold">Pick a section — required before publishing.</span>}
                        {librarySections.length === 0 && <span className="block mt-0.5 text-[11px] text-gray-400">No sections yet — create them in Section Library.</span>}
                      </label>
                    )}
                    {/* Collection placement (Phase 4b) — pick which collection fills this shelf. */}
                    {s.rule === 'collection' && (
                      <label className="text-[11px] font-semibold text-gray-600">Collection
                        <select value={cfg.collection_id || ''}
                          onChange={e => {
                            const cid = e.target.value;
                            const coll = collections.find(x => x.id === cid);
                            update(id, {
                              config_json: { ...(s.config_json || {}), collection_id: cid },
                              ...((!s.title || s.title === 'New collection') && coll ? { title: coll.name } : {}),
                            });
                          }}
                          className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                          <option value="">(pick a collection)</option>
                          {collections.map(coll => (
                            <option key={coll.id} value={coll.id}>{coll.name} · {(coll.section_ids || []).length} sections</option>
                          ))}
                        </select>
                        {!cfg.collection_id && <span className="block mt-0.5 text-[11px] text-red-600 font-semibold">Pick a collection — required before publishing.</span>}
                        {collections.length === 0 && <span className="block mt-0.5 text-[11px] text-gray-400">No collections yet — create them in Collection Library.</span>}
                      </label>
                    )}
                    {/* Presentation (Phase 6) — how this placement is shown.
                        library_products → Row | Banner-Gateway; collection → Row | Hero+Tiles. */}
                    {(s.rule === 'library_products' || s.rule === 'collection') && (
                      <div className="text-[11px] font-semibold text-gray-600">
                        Presentation
                        <div className="flex gap-1.5 mt-1">
                          {(s.rule === 'library_products' ? ['row', 'banner'] : ['row', 'hero_tiles']).map(pt => {
                            const active = (cfg.presentation_type || 'row') === pt;
                            const lbl = pt === 'row' ? 'Row' : pt === 'banner' ? 'Banner' : 'Hero + Tiles';
                            return (
                              <button key={pt} type="button"
                                onClick={() => update(id, { config_json: { ...(s.config_json || {}), presentation_type: pt } })}
                                className={`flex-1 text-[11px] font-bold rounded px-2 py-1.5 border ${active ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'}`}>
                                {lbl}
                              </button>
                            );
                          })}
                        </div>
                        {/* Banner fields */}
                        {s.rule === 'library_products' && cfg.presentation_type === 'banner' && (
                          <div className="mt-2 flex flex-col gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <input value={cfg.banner?.eyebrow || ''} onChange={e => patchNested(id, 'banner', 'eyebrow', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="Eyebrow — e.g. SUMMER SALE" />
                            <input value={cfg.banner?.headline || ''} onChange={e => patchNested(id, 'banner', 'headline', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="Headline — e.g. FLAT 20% OFF (required)" />
                            <input value={cfg.banner?.cta_label || ''} onChange={e => patchNested(id, 'banner', 'cta_label', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="CTA label — default SHOP NOW" />
                            <input value={cfg.banner?.image_url || ''} onChange={e => patchNested(id, 'banner', 'image_url', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="Banner image URL (optional)" />
                            {!cfg.banner?.headline && <span className="text-[11px] text-red-600 font-semibold">Headline required before publishing.</span>}
                          </div>
                        )}
                        {/* Hero+Tiles fields (tiles come from the collection's member sections) */}
                        {s.rule === 'collection' && cfg.presentation_type === 'hero_tiles' && (
                          <div className="mt-2 flex flex-col gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <input value={cfg.hero?.eyebrow || ''} onChange={e => patchNested(id, 'hero', 'eyebrow', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="Hero eyebrow — e.g. CURATED FOR YOU" />
                            <input value={cfg.hero?.title || ''} onChange={e => patchNested(id, 'hero', 'title', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="Hero title — defaults to collection name" />
                            <input value={cfg.hero?.image_url || ''} onChange={e => patchNested(id, 'hero', 'image_url', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="Hero image URL (optional)" />
                            <span className="text-[11px] text-gray-500">Tiles = this collection&apos;s member sections (each taps to its own results).</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Greeting/tagline — the home 'header' shelf (admin-editable greeting). */}
                    {(s.shelf_key === 'header' || cfg.greeting != null || cfg.tagline != null) && (
                      <>
                        <label className="text-[11px] font-semibold text-gray-600">Greeting (Home header)
                          <input value={cfg.greeting || ''} onChange={e => patchConfig(id, 'greeting', e.target.value)}
                            className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="Hey, what's good today?" />
                        </label>
                        <label className="text-[11px] font-semibold text-gray-600">Tagline
                          <input value={cfg.tagline || ''} onChange={e => patchConfig(id, 'tagline', e.target.value)}
                            className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="Shop · Support · Stay Inspired" />
                        </label>
                      </>
                    )}
                    <label className="text-[11px] font-semibold text-gray-600">Caption (sub)
                      <input value={cfg.sub || ''} onChange={e => patchConfig(id, 'sub', e.target.value)}
                        className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="small grey line under the title" />
                    </label>

                    {labelsKey && (
                      <label className="text-[11px] font-semibold text-gray-600">{labelsKey === 'filters' ? 'Filter' : 'Chip'} labels (comma-separated)
                        <input value={(cfg[labelsKey] || []).join(', ')}
                          onChange={e => patchConfig(id, labelsKey, e.target.value.split(',').map(x => x.trim()).filter(Boolean))}
                          className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="e.g. Offers, Nearest, Top Rated" />
                      </label>
                    )}

                    {Array.isArray(cfg.verticals) && (
                      <div className="text-[11px] font-semibold text-gray-600">
                        Category tiles (label + icon)
                        <div className="flex flex-col gap-1 mt-1">
                          {cfg.verticals.map((v, vi) => (
                            <div key={v.key || vi} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-20 truncate">{v.key}</span>
                              <input value={v.label || ''} onChange={e => {
                                const next = cfg.verticals.map((x, i) => i === vi ? { ...x, label: e.target.value } : x);
                                patchConfig(id, 'verticals', next);
                              }} className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" placeholder="label" />
                              <input value={v.icon || ''} onChange={e => {
                                const next = cfg.verticals.map((x, i) => i === vi ? { ...x, icon: e.target.value } : x);
                                patchConfig(id, 'verticals', next);
                              }} className="w-14 text-xs border border-gray-300 rounded px-2 py-1 text-center" placeholder="icon" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <details>
                      <summary className="text-[11px] font-semibold text-gray-500 cursor-pointer">Advanced — raw config JSON</summary>
                      <textarea value={isOpen ? jsonDraft : ''} onChange={e => onJsonChange(id, e.target.value)}
                        rows={6} className="mt-1 w-full text-[11px] font-mono border border-gray-300 rounded px-2 py-1" />
                      {jsonErr && <div className="text-[11px] text-red-600 font-semibold">{jsonErr}</div>}
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ＋ Add Section */}
      {!loading && !(scopeNeedsValue && !scopeValue) && (
        <div className="flex items-center gap-2 mt-4">
          <select value={addPreset} onChange={e => setAddPreset(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white">
            {ADD_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button onClick={addSection}
            className="px-3 py-1.5 rounded-lg border-2 border-dashed border-amber-600 text-amber-700 text-xs font-bold">
            ＋ Add Section
          </button>
          <span className="text-[11px] text-gray-400">added shelves save on Publish</span>
        </div>
      )}
    </div>
  );
}
