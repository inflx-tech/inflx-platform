'use client';
import { useEffect, useState, useCallback } from 'react';
import { sectionApi, adminApi, pageApi, uploadAdminStockImage } from '../../../lib/api';

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

// NOTE: the follower HOME screen is hardcoded (world tabs + "What's on your mind?"
// rail) and managed in Home Builder — it does NOT read section_config['home'].
// So the Home tab is intentionally removed here to avoid placing shelves that
// never render. Per-screen shelves below DO render: Category = the page after
// tapping a world (scope it per-world); Offers/Creator = those screens.
// The App Builder's three scopes (founder's model). Each maps to the underlying
// engine `screen`, and all three are per-WORLD (scope_type='vertical').
//   Home          → the world page (HomeScreen renders screen='category' per world)
//   Creator Store → a creator's world (screen='creator_category')
//   Business page → an individual business page (screen='business', Phase 1)
const SCOPES = [
  { key: 'category',         label: 'Home' },
  { key: 'creator_category', label: 'Creator Store' },
  { key: 'business',         label: 'Business page' },
  // Custom page (App Builder E) — a GLOBAL admin-created page. Its "world" picker
  // is a dropdown of pages instead of the fixed verticals; scope_value = page key.
  { key: 'page',             label: 'Custom page' },
];

// Per-world scope values = the live follower worlds (follower_categories keys).
// getCategorySections passes scopeType='vertical', scopeValue=<world>, so a
// Category shelf scoped to 'food' shows ONLY on the food page.
const CATEGORIES = ['food', 'fashion', 'furniture', 'beauty', 'car_rental'];

// ＋ Add Section presets → valid {shelf_type, rule, item_type?} (rules exist in
// sectionRules.service.js). Listing-driven rules populate without offers.
// kind: 'data' = no rule (fills from context) · 'frame' = image/banner, rule per
// banner · 'control' = chips bar. `world` limits a preset to one world; `biz`
// limits it to the Business scope of that world.
const ADD_PRESETS = [
  // ── DATA — no rule; the list fills itself from context ──
  { key: 'category_picker', kind: 'data', label: 'Category rail (pick categories)', shelf_type: 'nav_tiles', rule: 'category_nodes', title: 'Shop by category' },
  { key: 'products', kind: 'data', label: 'Products rail', shelf_type: 'products', rule: 'products_in_category', item_type: 'products', title: 'Trending Products' },
  { key: 'brands',   kind: 'data', label: 'Businesses rail', shelf_type: 'brands', rule: 'businesses_in_category', item_type: 'brands', title: 'Top Businesses' },
  { key: 'creators', kind: 'data', label: 'Creators rail', shelf_type: 'creators', rule: 'creators_smart', title: "Creators you'd love" },
  { key: 'offers',   kind: 'data', label: 'Offers rail', shelf_type: 'offers', rule: 'top_by_conversions', item_type: 'offers', title: 'Best Deals' },
  { key: 'restaurant_list', kind: 'data', label: 'Restaurants + dishes', shelf_type: 'restaurant_list', rule: 'restaurants_with_featured', item_type: 'brands', title: 'Famous Restaurants', world: 'food' },
  { key: 'category_rail', kind: 'data', label: 'Food cravings rail', shelf_type: 'category_rail', rule: 'world_categories', title: "What's on your mind?", world: 'food' },
  { key: 'food_menu', kind: 'data', label: 'Menu — collapsible dishes', shelf_type: 'products', rule: 'static', title: 'Menu', config: { kind: 'menu' }, biz: 'food' },
  // ── FRAME — image / banner; admin sets a rule PER banner (style chosen inside) ──
  { key: 'frame', kind: 'frame', label: 'Image / banner frame', shelf_type: 'tiles', rule: 'static', title: 'Spotlight', config: { style: 'carousel' } },
  // ── CONTROLS ──
  { key: 'controls', kind: 'control', label: 'Chips / filter bar', shelf_type: 'controls', rule: 'static', title: 'Filters' },
];

// A section's kind (for the no-rule / needs-rule tag) — derived from shelf_type so
// it works for already-saved rows too. Only the image/banner Frame needs a rule.
function sectionKind(s) {
  if (s.shelf_type === 'tiles') return 'frame';
  if (s.shelf_type === 'controls') return 'control';
  return 'data';
}
const KIND_GROUPS = [
  { k: 'data', label: 'Data sections — no rule (fills from context)' },
  { k: 'frame', label: 'Frame — image / banner (set a rule)' },
  { k: 'control', label: 'Controls' },
];

// Friendly template name for a section row (replaces the raw shelf_type·rule).
const TEMPLATE_NAMES = {
  products: 'Product rail', creators: 'Creator rail', brands: 'Business rail',
  tiles: 'Image tiles', category_rail: 'Category rail', restaurant_list: 'Restaurant list',
  banner_gateway: 'Hero banner', offers: 'Offers rail', mixed: 'Mixed rail',
  nav_tiles: 'Nav tiles', controls: 'Filter chips',
};
function templateLabel(s) {
  if ((s.config_json || {}).kind === 'menu') return 'Menu (food)';
  if (s.rule === 'category_nodes') return 'Category rail (catalogue)';
  return TEMPLATE_NAMES[s.shelf_type] || s.shelf_type;
}

// Flatten the nested /listing/tree into an indented pick list (id + name + depth).
function flattenTree(roots, depth = 0, out = []) {
  for (const n of roots || []) {
    out.push({ id: n.id, name: n.name || n.category || n.segment || 'Category', depth, is_leaf: n.is_leaf });
    if (n.children && n.children.length) flattenTree(n.children, depth + 1, out);
  }
  return out;
}

// Worlds that have a drill-down catalogue tree (category_nodes).
const CAT_TREE_WORLDS = new Set(['fashion', 'furniture']);

// template → which RULES it can use (the explicit "what fills it" step). Templates
// with a single fixed rule (category_rail / restaurant_list / tiles per-tile / menu)
// don't show a picker.
const RULES_BY_SHELF = {
  creators: [
    { v: 'creators_smart', l: 'Smart creators (promote · near · famous · followed)' },
    { v: 'creators_listing', l: 'Top creators' },
    { v: 'creators_in_category', l: 'Creators in this world' },
  ],
  products: [
    { v: 'library_products', l: 'A Section Library group' },
    { v: 'products_in_category', l: 'Products in this world' },
  ],
  brands: [
    { v: 'businesses_in_category', l: 'Businesses in this world' },
  ],
};

// A light wireframe of how a template renders — the "see it" step (shape only;
// real-data preview is a later upgrade).
function TemplatePreview({ s }) {
  const cfg = s.config_json || {};
  const g = 'bg-gray-100 rounded';
  let inner;
  if (cfg.kind === 'menu') inner = <div className="space-y-1"><div className={`${g} h-2.5 w-1/3`} /><div className={`${g} h-5`} /><div className={`${g} h-5`} /></div>;
  else if (s.shelf_type === 'creators' || s.shelf_type === 'category_rail') inner = <div className="flex gap-2">{[0,1,2,3].map(i => <span key={i} className="w-7 h-7 rounded-full bg-gray-200" />)}</div>;
  else if (s.shelf_type === 'tiles' && cfg.style === 'mosaic') inner = <div className="space-y-1.5"><div className={`${g} h-10`} /><div className="flex gap-1.5"><span className={`${g} h-8 flex-1`} /><span className={`${g} h-8 flex-1`} /></div></div>;
  else if (s.shelf_type === 'tiles' && cfg.style === 'banner') inner = <div className={`${g} h-12`} />;
  else if (s.shelf_type === 'tiles' || s.shelf_type === 'nav_tiles') inner = <div className="flex gap-1.5">{[0,1,2,3].map(i => <span key={i} className="w-9 h-9 rounded-lg bg-gray-200" />)}</div>;
  else if (s.shelf_type === 'banner_gateway') inner = <div className={`${g} h-12`} />;
  else if (s.shelf_type === 'restaurant_list') inner = <div className="space-y-1"><div className={`${g} h-2.5 w-1/2`} /><div className="flex gap-1.5">{[0,1,2].map(i => <span key={i} className="w-12 h-9 rounded bg-gray-200" />)}</div></div>;
  else inner = <div className="flex gap-1.5">{[0,1,2].map(i => <span key={i} className="w-12 h-14 rounded bg-gray-200" />)}</div>;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2">
      <div className="text-[10px] text-gray-400 mb-1.5">PREVIEW · {templateLabel(s)}</div>
      {inner}
    </div>
  );
}

function slug(t) {
  return String(t || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36) || 'section';
}

const PREVIEW_TINTS = ['#FBEAF0', '#EEEDFE', '#E6F1FB', '#EAF3DE', '#FAEEDA', '#FAECE7'];

function PreviewBanner({ t, h }) {
  return (
    <div className="rounded-lg overflow-hidden relative" style={{ height: h, background: '#2C2C2A' }}>
      {t.image_url ? <img src={t.image_url} alt="" className="w-full h-full object-cover" /> : null}
      {t.label ? <div className="absolute bottom-1 left-1.5 text-[8px] font-bold text-white">{t.label}</div> : null}
    </div>
  );
}

// One section rendered the way the follower app shows it — faithful for the
// config-driven sections (categories + image/banner frames), representative
// placeholders for the auto data rails.
function PreviewSection({ s }) {
  const cfg = s.config_json || {};
  const Title = s.title ? <div className="text-[11px] font-bold text-gray-900 px-3 pt-3 pb-1.5">{s.title}</div> : null;

  if (s.shelf_type === 'tiles') {
    const tiles = (cfg.tiles || []).filter(t => t && (t.image_url || t.label));
    const list = tiles.length ? tiles : [{}, {}];
    if ((cfg.style || 'carousel') === 'grid') {
      return <div>{Title}<div className="grid grid-cols-3 gap-1.5 px-3 pb-2">{(tiles.length ? tiles : [{}, {}, {}]).slice(0, 6).map((t, i) => <PreviewBanner key={i} t={t} h={54} />)}</div></div>;
    }
    const w = (cfg.style === 'carousel') ? 150 : 110;
    return <div>{Title}<div className="flex gap-2 px-3 pb-2 overflow-hidden">{list.slice(0, 4).map((t, i) => <div key={i} className="shrink-0" style={{ width: w }}><PreviewBanner t={t} h={84} /></div>)}</div></div>;
  }
  if (s.shelf_type === 'nav_tiles' && s.rule === 'category_nodes') {
    const labels = [...(cfg.nodes || []).map(n => n.label || 'Category'), 'All'];
    return <div>{Title}<div className="flex gap-2 px-3 pb-2 overflow-hidden">{(labels.length ? labels : ['Category', 'All']).slice(0, 6).map((lbl, i) => (
      <div key={i} className="shrink-0 text-center" style={{ width: 46 }}>
        <div className="w-10 h-10 mx-auto rounded-xl" style={{ background: lbl === 'All' ? '#FEF4D6' : PREVIEW_TINTS[i % PREVIEW_TINTS.length] }} />
        <div className="text-[8px] text-gray-600 mt-1 truncate">{lbl}</div>
      </div>
    ))}</div></div>;
  }
  if (s.shelf_type === 'category_rail') {
    return <div>{Title}<div className="flex gap-1.5 px-3 pb-2">{['Biryani', 'Pizza', 'Dosa', 'Cakes'].map((c, i) => <div key={i} className="text-[8px] text-gray-600 border border-gray-200 rounded-full px-2 py-1">{c}</div>)}</div></div>;
  }
  if (s.shelf_type === 'creators') {
    return <div>{Title}<div className="flex gap-3 px-3 pb-2">{[0, 1, 2, 3].map(i => <div key={i} className="text-center"><div className="w-11 h-11 rounded-full bg-gray-200" /><div className="text-[8px] text-gray-400 mt-1">@creator</div></div>)}</div></div>;
  }
  if (s.shelf_type === 'products') {
    if (cfg.kind === 'menu') return <div>{Title}<div className="px-3 pb-2 space-y-1.5">{[0, 1].map(i => <div key={i} className="h-8 rounded bg-gray-100" />)}</div></div>;
    return <div>{Title}<div className="flex gap-2 px-3 pb-2">{[0, 1, 2].map(i => <div key={i} className="shrink-0" style={{ width: 78 }}><div className="rounded-lg bg-gray-100" style={{ height: 78 }} /><div className="h-2 w-12 bg-gray-100 rounded mt-1.5" /><div className="h-2 w-8 bg-gray-100 rounded mt-1" /></div>)}</div></div>;
  }
  if (s.shelf_type === 'brands' || s.shelf_type === 'restaurant_list') {
    return <div>{Title}<div className="flex gap-2 px-3 pb-2">{[0, 1].map(i => <div key={i} className="shrink-0 rounded-lg bg-gray-100" style={{ width: 120, height: 64 }} />)}</div></div>;
  }
  if (s.shelf_type === 'offers' || s.shelf_type === 'mixed') {
    return <div>{Title}<div className="flex gap-2 px-3 pb-2">{[0, 1].map(i => <div key={i} className="shrink-0 rounded-lg bg-pink-50 border border-pink-100" style={{ width: 140, height: 70 }} />)}</div></div>;
  }
  if (s.shelf_type === 'controls') {
    const chips = Array.isArray(cfg.filters) && cfg.filters.length ? cfg.filters : ['Nearest', 'Offers', 'Top rated'];
    return <div className="flex gap-1.5 px-3 py-2">{chips.map((c, i) => <div key={i} className="text-[8px] text-gray-600 border border-gray-200 rounded-full px-2 py-1">{String(c)}</div>)}</div>;
  }
  return <div className="px-3 py-2 text-[9px] text-gray-300">{s.title}</div>;
}

// The phone-frame live preview pane (sticky beside the builder).
function MobilePreview({ shelves, scopeValue }) {
  const visible = (shelves || []).filter(s => s.enabled !== false);
  return (
    <div className="hidden xl:block shrink-0 w-[300px] sticky top-4">
      <div className="text-[10.5px] text-gray-400 text-center mb-1.5">Live preview · {scopeValue || 'world'}</div>
      <div className="rounded-[26px] border-[7px] border-gray-900 bg-white overflow-hidden" style={{ height: 600 }}>
        <div className="h-4 bg-gray-100" />
        <div className="mx-2 my-2 h-6 rounded-full bg-gray-100 flex items-center px-3 text-[9px] text-gray-400">Search products, brands…</div>
        <div className="overflow-y-auto" style={{ height: 540 }}>
          {visible.length === 0
            ? <div className="text-center text-[11px] text-gray-300 mt-10">Add sections to preview</div>
            : visible.map((s, i) => <PreviewSection key={s.id || s._tmp || i} s={s} />)}
        </div>
      </div>
    </div>
  );
}

export default function SectionsPage() {
  const [screen, setScreen] = useState('category');
  // App Builder: all three scopes are per-world → always 'vertical'.
  const [scopeType, setScopeType] = useState('vertical');
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
  // Manage Worlds (absorbed Home Builder) — the follower worlds (tabs).
  const [worlds, setWorlds] = useState([]);
  const [showWorlds, setShowWorlds] = useState(false);
  const [pages, setPages] = useState([]);   // custom pages (App Builder E)
  // Catalogue tree for the current world (fashion/furniture) — feeds the
  // "Category rail (pick from catalogue)" node picker.
  const [catTree, setCatTree] = useState([]);

  const loadWorlds = useCallback(() => {
    adminApi.listHomeVerticals().then(res => {
      if (res.success) setWorlds((res.data?.verticals || []).sort((a, b) => a.sort_order - b.sort_order));
    });
  }, []);

  // Custom pages (App Builder E) — for the "Custom page" scope's page picker +
  // the destination chooser's "A page" dropdown.
  const loadPages = useCallback(() => {
    pageApi.list().then(res => { if (res.success) setPages(res.data?.pages || []); });
  }, []);

  // Section Library (3c) options for the placement picker + the worlds list.
  useEffect(() => {
    adminApi.listSectionLibrary().then(res => {
      if (res.success) setLibrarySections((res.data?.sections || []).filter(s => s.status === 'active'));
    });
    loadWorlds();
    loadPages();
  }, [loadWorlds, loadPages]);

  // Manage Worlds actions (reuse the home-verticals API).
  const worldToggle = async (w) => { await adminApi.updateHomeVertical(w.id, { enabled: !w.enabled }); loadWorlds(); };
  const worldRename = async (w) => { const n = prompt('World name', w.name); if (n && n.trim()) { await adminApi.updateHomeVertical(w.id, { name: n.trim() }); loadWorlds(); } };
  const worldMove = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= worlds.length) return;
    const a = worlds[i], b = worlds[j];
    await adminApi.updateHomeVertical(a.id, { sort_order: b.sort_order });
    await adminApi.updateHomeVertical(b.id, { sort_order: a.sort_order });
    loadWorlds();
  };

  // Deep-link from Custom Pages "Compose →" (?scope=page&page=<key>): pre-select
  // the Custom-page scope + the page. Runs once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('scope') === 'page') {
      setScreen('page');
      const pk = q.get('page');
      if (pk) setScopeValue(pk);
    }
  }, []);

  const load = useCallback(async (scr, sType, sVal) => {
    setLoading(true); setMsg(null); setExpanded(null);
    const res = await sectionApi.getSections(scr, sType, sVal || '');
    if (res.success) setShelves(res.data.shelves || []);
    else setMsg({ kind: 'err', text: res.error?.message || 'Failed to load' });
    setLoading(false);
  }, []);

  useEffect(() => { load(screen, scopeType, scopeValue); }, [screen, scopeType, scopeValue, load]);

  // Load the catalogue tree when the world has one (fashion/furniture).
  useEffect(() => {
    if (CAT_TREE_WORLDS.has(scopeValue)) {
      adminApi.getListingTree(scopeValue).then(res => {
        if (res.success) setCatTree(flattenTree(res.data?.tree || res.data || []));
      });
    } else {
      setCatTree([]);
    }
  }, [scopeValue]);

  const rowId = (s) => s.id || s._tmp;
  const update = (id, patch) =>
    setShelves(prev => prev.map(s => (rowId(s) === id ? { ...s, ...patch } : s)));

  const setConfig = (id, nextConfig) => update(id, { config_json: nextConfig });
  const patchConfig = (id, key, value) =>
    setShelves(prev => prev.map(s => (rowId(s) === id ? { ...s, config_json: { ...(s.config_json || {}), [key]: value } } : s)));

  // Template Catalog #1 — manage config_json.tiles[] (image + label + wired group).
  const addTile = (id) =>
    setShelves(prev => prev.map(s => (rowId(s) === id
      ? { ...s, config_json: { ...(s.config_json || {}), tiles: [...((s.config_json || {}).tiles || []), { image_url: '', label: '', library_section_id: '' }] } }
      : s)));
  const updateTile = (id, idx, patch) =>
    setShelves(prev => prev.map(s => {
      if (rowId(s) !== id) return s;
      const tiles = [...((s.config_json || {}).tiles || [])];
      tiles[idx] = { ...tiles[idx], ...patch };
      return { ...s, config_json: { ...(s.config_json || {}), tiles } };
    }));
  const removeTile = (id, idx) =>
    setShelves(prev => prev.map(s => {
      if (rowId(s) !== id) return s;
      const tiles = ((s.config_json || {}).tiles || []).filter((_, i) => i !== idx);
      return { ...s, config_json: { ...(s.config_json || {}), tiles } };
    }));
  // Inline banner rule (App Builder Frame) — patch tiles[idx].rule_json. Empty
  // clears the condition; any condition present stamps business_type (= the world)
  // so the result list stays scoped to it. Generic — every condition optional.
  const patchTileRule = (id, idx, key, value) =>
    setShelves(prev => prev.map(s => {
      if (rowId(s) !== id) return s;
      const tiles = [...((s.config_json || {}).tiles || [])];
      const rj = { ...(tiles[idx].rule_json || {}) };
      const empty = value === '' || value == null || value === false || (Array.isArray(value) && value.length === 0);
      if (empty) delete rj[key]; else rj[key] = value;
      const conds = Object.keys(rj).filter(k => k !== 'business_type');
      if (conds.length) rj.business_type = scopeValue; else delete rj.business_type;
      tiles[idx] = { ...tiles[idx], rule_json: rj };
      return { ...s, config_json: { ...(s.config_json || {}), tiles } };
    }));

  // Save this banner's inline rule into the Section Library for reuse, then wire
  // the banner to it (folds the old Section Library tab into the Frame editor).
  const saveRuleForReuse = async (id, idx) => {
    const sh = shelves.find(s => rowId(s) === id); if (!sh) return;
    const tile = ((sh.config_json || {}).tiles || [])[idx]; if (!tile) return;
    const rj = { ...(tile.rule_json || {}) }; delete rj.business_type;
    if (!Object.keys(rj).length) { setMsg({ kind: 'err', text: 'Add a condition before saving.' }); return; }
    const name = (tile.__saveName || '').trim() || sh.title || 'Saved rule';
    const res = await adminApi.createSectionLibrary({ business_type: scopeValue || 'ALL', name, image_url: null, rule_json: rj });
    if (!res.success) { setMsg({ kind: 'err', text: res.error?.message || 'Save failed' }); return; }
    const lib = await adminApi.listSectionLibrary();
    if (lib.success) setLibrarySections((lib.data?.sections || []).filter(x => x.status === 'active'));
    const newId = res.data?.section?.id || res.data?.id || '';
    updateTile(id, idx, { library_section_id: newId, rule_mode: 'saved', rule_json: {}, __saveName: '' });
    setMsg({ kind: 'ok', text: `Saved "${name}" — reuse it under "Use a saved rule".` });
  };
  // Category rail (catalogue) — manage config_json.nodes[] (picked tree nodes).
  const hasNode = (s, nodeId) => ((s.config_json || {}).nodes || []).some(n => n.category_node_id === nodeId);
  const toggleNode = (id, node) =>
    setShelves(prev => prev.map(s => {
      if (rowId(s) !== id) return s;
      const nodes = [...((s.config_json || {}).nodes || [])];
      const i = nodes.findIndex(n => n.category_node_id === node.id);
      if (i >= 0) nodes.splice(i, 1);
      else nodes.push({ category_node_id: node.id, vertical: scopeValue, label: node.name, icon: '' });
      return { ...s, config_json: { ...(s.config_json || {}), nodes } };
    }));
  const updateNode = (id, idx, patch) =>
    setShelves(prev => prev.map(s => {
      if (rowId(s) !== id) return s;
      const nodes = [...((s.config_json || {}).nodes || [])];
      nodes[idx] = { ...nodes[idx], ...patch };
      return { ...s, config_json: { ...(s.config_json || {}), nodes } };
    }));
  const removeNode = (id, idx) =>
    setShelves(prev => prev.map(s => {
      if (rowId(s) !== id) return s;
      const nodes = ((s.config_json || {}).nodes || []).filter((_, i) => i !== idx);
      return { ...s, config_json: { ...(s.config_json || {}), nodes } };
    }));

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
  const toggleExpand = (s) => {
    const id = rowId(s);
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setJsonDraft(JSON.stringify(s.config_json || {}, null, 2));
    setJsonErr(null);
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
      config_json: { sub: '', ...(p.config || {}) },
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
  // Only show Section Library groups for the world being edited (+ ALL-world
  // groups). On Home→Food you see food groups, not All Fashion / Men's Jeans.
  const worldSections = librarySections.filter(
    sec => !scopeValue || sec.business_type === scopeValue || sec.business_type === 'ALL'
  );

  return (
    <div className="p-6 flex gap-6 items-start">
      <div className="flex-1 min-w-0 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">🧱 App Builder</h1>
        <button onClick={publish} disabled={saving || loading}
          className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold disabled:opacity-50">
          {saving ? 'Publishing…' : 'Publish'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Pick a <b>scope</b> → a <b>world</b> → arrange <b>sections</b> (each = a template + a rule).
        The account icon + search are fixed. Changes go live in the follower app within ~60s — no app update.
      </p>

      {/* 1 · Scope */}
      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">1 · Scope</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {SCOPES.map(s => (
          <button key={s.key} onClick={() => { setScreen(s.key); setScopeValue(''); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border ${
              screen === s.key ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* 2 · World (or Page, for the Custom-page scope) */}
      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">2 · {screen === 'page' ? 'Page' : 'World'}</div>
      {screen === 'page' ? (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select value={scopeValue} onChange={e => setScopeValue(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold text-gray-700">
            <option value="">— pick a page —</option>
            {pages.map(p => <option key={p.id} value={p.key}>{p.label}{p.enabled === false ? ' (hidden)' : ''}</option>)}
          </select>
          <a href="/admin/custom-pages" className="text-[11px] font-semibold text-amber-700">＋ Manage pages</a>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {CATEGORIES.map(c => {
          const w = worlds.find(x => x.key === c);
          const hidden = w && w.enabled === false;
          return (
            <button key={c} onClick={() => setScopeValue(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                scopeValue === c ? 'bg-amber-700 text-white border-amber-700'
                : hidden ? 'bg-white text-gray-400 border-gray-200 border-dashed'
                : 'bg-white text-gray-600 border-gray-300'}`}>
              {hidden ? '🙈 ' : ''}{c}
            </button>
          );
        })}
        <button onClick={() => setShowWorlds(v => !v)}
          className="ml-1 text-[11px] font-semibold text-amber-700">⚙ Manage worlds</button>
      </div>
      )}

      {/* Manage Worlds (absorbed Home Builder) — order, show/hide, rename */}
      {showWorlds && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 flex flex-col gap-1.5">
          <div className="text-[11px] text-gray-500 mb-1">Worlds are the app's top tabs. Hide one (e.g. car rentals) to remove it from the follower home.</div>
          {worlds.map((w, i) => (
            <div key={w.id} className={`flex items-center gap-2 text-xs ${w.enabled === false ? 'opacity-50' : ''}`}>
              <button onClick={() => worldMove(i, -1)} disabled={i === 0} className="text-gray-400 disabled:opacity-30">▲</button>
              <button onClick={() => worldMove(i, 1)} disabled={i === worlds.length - 1} className="text-gray-400 disabled:opacity-30">▼</button>
              <span className="font-semibold text-gray-800 flex-1">{w.name} <span className="text-gray-400">· {w.key}</span></span>
              <button onClick={() => worldRename(w)} className="text-gray-500">✏️</button>
              <button onClick={() => worldToggle(w)} title="Show/hide">{w.enabled === false ? '👁' : '🙈'}</button>
            </div>
          ))}
        </div>
      )}
      {!showWorlds && (
        scopeValue
          ? <div className="text-[11px] text-green-700 font-semibold mb-3">editing {SCOPES.find(s => s.key === screen)?.label} · {scopeValue}</div>
          : <div className="text-[11px] text-gray-400 mb-3">pick a world above to arrange its sections</div>
      )}

      {msg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-semibold ${
          msg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      {scopeValue && !loading && (
        <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">3 · Sections — top to bottom</div>
      )}
      {loading ? (
        <div className="text-sm text-gray-500 py-10 text-center">Loading…</div>
      ) : (scopeNeedsValue && !scopeValue) ? (
        <div className="text-sm text-gray-500 py-10 text-center">Pick a world above to arrange its sections.</div>
      ) : shelves.length === 0 ? (
        <div className="text-sm text-gray-500 py-10 text-center">No sections here yet — add one below.</div>
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
                    <div className="text-[11px] text-gray-500 truncate flex items-center gap-1.5">
                      <span className="truncate">{templateLabel(s)}{s.id ? '' : ' · NEW'}</span>
                      {sectionKind(s) === 'frame'
                        ? <span className="shrink-0 text-[9px] font-bold rounded px-1.5 py-0.5 bg-pink-50 text-pink-600">NEEDS A RULE</span>
                        : sectionKind(s) === 'data'
                        ? <span className="shrink-0 text-[9px] font-bold rounded px-1.5 py-0.5 bg-green-50 text-green-700">NO RULE</span>
                        : null}
                    </div>
                  </div>
                  <button onClick={() => toggleExpand(s)} title="Edit details"
                    className={`text-xs px-2 py-1 rounded border ${isOpen ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-500'}`}>⚙</button>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button onClick={() => changeCount(id, -1)} className="w-7 h-7 bg-gray-50 text-amber-700 font-bold">−</button>
                    <span className="w-8 text-center text-xs font-bold">{s.item_limit}</span>
                    <button onClick={() => changeCount(id, 1)} className="w-7 h-7 bg-gray-50 text-amber-700 font-bold">+</button>
                  </div>
                  <button onClick={() => patchConfig(id, 'sticky', !cfg.sticky)} title="Sticky on scroll (pins to top)"
                    className={`text-xs px-2 py-1 rounded border ${cfg.sticky ? 'bg-amber-100 border-amber-400 text-amber-800' : 'border-gray-300 text-gray-400'}`}>📌</button>
                  <button onClick={() => update(id, { enabled: !(s.enabled !== false) })}
                    className={`w-10 h-6 rounded-full relative transition-colors ${s.enabled !== false ? 'bg-amber-700' : 'bg-gray-300'}`} aria-label="toggle enabled">
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${s.enabled !== false ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <button onClick={() => removeShelf(s)} title="Delete this section"
                    className="text-xs font-semibold px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50" aria-label="delete section">🗑 Delete</button>
                </div>

                {/* Config editor (v2) — preview → rule → images */}
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100 flex flex-col gap-2">
                    {/* See it */}
                    <TemplatePreview s={s} />
                    {/* What fills it (rule) — only for data-driven templates with a choice */}
                    {RULES_BY_SHELF[s.shelf_type] && (s.config_json || {}).kind !== 'menu' && (
                      <label className="text-[11px] font-semibold text-gray-600">What fills it? (rule)
                        <select value={s.rule} onChange={e => update(id, { rule: e.target.value })}
                          className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                          {RULES_BY_SHELF[s.shelf_type].map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                        </select>
                      </label>
                    )}
                    {/* On tap, go to… (App Builder D — admin-chosen section-level destination) */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2.5">
                      <div className="text-[11px] font-bold text-amber-800 mb-1.5">On tap, go to…</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[{ v: '', l: 'Default' }, { v: 'grid', l: 'Product grid' }, { v: 'category', l: 'Category browser' }, { v: 'page', l: 'A page' }].map(o => {
                          const on = ((cfg.tap_destination || {}).type || '') === o.v;
                          return (
                            <button key={o.v || 'default'} type="button"
                              onClick={() => patchConfig(id, 'tap_destination', o.v ? { ...(cfg.tap_destination || {}), type: o.v } : null)}
                              className={`text-[11px] font-semibold rounded-lg px-2 py-1.5 border text-left ${on ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'}`}>
                              {o.l}
                            </button>
                          );
                        })}
                      </div>
                      {(cfg.tap_destination || {}).type === 'category' && (
                        <label className="block mt-2 text-[11px] font-semibold text-gray-600">Which category?
                          <select value={(cfg.tap_destination || {}).vertical || ''} onChange={e => patchNested(id, 'tap_destination', 'vertical', e.target.value)}
                            className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                            <option value="">— pick a world —</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </label>
                      )}
                      {(cfg.tap_destination || {}).type === 'page' && (
                        <label className="block mt-2 text-[11px] font-semibold text-gray-600">Which page?
                          <select value={(cfg.tap_destination || {}).page_key || ''} onChange={e => patchNested(id, 'tap_destination', 'page_key', e.target.value)}
                            className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                            <option value="">— pick a page —</option>
                            {pages.filter(p => p.enabled !== false).map(p => <option key={p.id} value={p.key}>{p.label}</option>)}
                          </select>
                        </label>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1.5">“Default” keeps today’s behaviour (this shelf’s See-all). Individual cards always open their own detail.</div>
                    </div>

                    {/* Template Catalog #1 — image tiles: per-tile image + label + wired group. */}
                    {s.shelf_type === 'tiles' && (
                      <div className="flex flex-col gap-2">
                        {/* Layout style */}
                        <label className="text-[11px] font-semibold text-gray-600">Layout
                          <select value={cfg.style || 'carousel'} onChange={e => patchConfig(id, 'style', e.target.value)}
                            className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                            <option value="carousel">Image tiles (spotlight)</option>
                            <option value="featured">Featured carousel</option>
                            <option value="grid">Tile grid (shop by concern)</option>
                            <option value="banner">Themed banner + sub-tiles</option>
                            <option value="mosaic">Mosaic (mixed-size tiles)</option>
                          </select>
                        </label>
                        {/* Countdown timer (optional) — works on any Frame style */}
                        <div className="rounded-md border border-pink-200 bg-pink-50/50 p-2 flex flex-col gap-1.5">
                          <div className="text-[11px] font-bold text-pink-700">⏳ Countdown timer (optional)</div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input type="datetime-local" value={(cfg.timer || {}).ends_at || ''}
                              onChange={e => patchNested(id, 'timer', 'ends_at', e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1" />
                            <input value={(cfg.timer || {}).label || ''} onChange={e => patchNested(id, 'timer', 'label', e.target.value)}
                              placeholder="Ends in" className="w-28 text-xs border border-gray-300 rounded px-2 py-1" />
                            {(cfg.timer || {}).ends_at ? <button type="button" onClick={() => patchConfig(id, 'timer', null)} className="text-[11px] font-semibold text-gray-400">clear</button> : null}
                          </div>
                          <div className="text-[10px] text-gray-400">When it hits zero, the frame disappears from the app.</div>
                        </div>
                        {/* Banner background (banner style only) */}
                        {cfg.style === 'banner' && (
                          <label className="text-[11px] font-semibold text-gray-600">Banner background
                            <div className="mt-1 flex items-center gap-2">
                              <label className="w-16 h-10 rounded border bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer shrink-0">
                                {cfg.banner_image_url ? <img src={cfg.banner_image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-300">＋</span>}
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
                                  const res = await uploadAdminStockImage(f);
                                  if (res.error) { setMsg({ kind: 'err', text: res.error.message || 'Upload failed' }); return; }
                                  patchConfig(id, 'banner_image_url', res.public_url);
                                }} />
                              </label>
                              <span className="text-[11px] text-gray-400">Upload the banner background (3 sub-tiles below).</span>
                            </div>
                          </label>
                        )}
                        <div className="text-[11px] font-semibold text-gray-600">Banners — upload an image + set a rule for each</div>
                        {(cfg.tiles || []).map((t, ti) => {
                          const rj = t.rule_json || {};
                          const mode = t.rule_mode || (t.library_section_id ? 'saved' : 'create');
                          return (
                          <div key={ti} className="flex flex-col gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2">
                              <label className="w-12 h-12 rounded-lg border bg-white flex items-center justify-center overflow-hidden cursor-pointer shrink-0" title="Upload banner image">
                                {t.image_url ? <img src={t.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-300 text-lg">＋</span>}
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
                                  const res = await uploadAdminStockImage(f);
                                  if (res.error) { setMsg({ kind: 'err', text: res.error.message || 'Upload failed' }); return; }
                                  updateTile(id, ti, { image_url: res.public_url });
                                }} />
                              </label>
                              <input value={t.label || ''} onChange={e => updateTile(id, ti, { label: e.target.value })} placeholder="Label (optional)"
                                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" />
                              <button onClick={() => removeTile(id, ti)} className="text-gray-300 hover:text-red-500" aria-label="remove banner">✕</button>
                            </div>
                            {/* Tile size — mosaic only (large = full-width hero, small = 2-up) */}
                            {cfg.style === 'mosaic' && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-gray-500">Size</span>
                                {[['small', 'Small'], ['large', 'Large']].map(([v, l]) => (
                                  <button key={v} type="button" onClick={() => updateTile(id, ti, { size: v })}
                                    className={`text-[10px] font-bold rounded px-2.5 py-0.5 border ${(t.size || 'small') === v ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-500 border-gray-300'}`}>{l}</button>
                                ))}
                              </div>
                            )}
                            {/* Rule — create here OR use a saved one (Section Library folded in). */}
                            <div className="flex gap-1.5">
                              {[['create', 'Create a rule'], ['saved', 'Use a saved rule']].map(([m, lbl]) => (
                                <button key={m} type="button" onClick={() => updateTile(id, ti, { rule_mode: m })}
                                  className={`text-[11px] font-semibold rounded px-2.5 py-1 border ${mode === m ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'}`}>{lbl}</button>
                              ))}
                            </div>
                            {mode === 'create' ? (
                              <div className="p-2 rounded-md bg-amber-50 border border-amber-200 flex flex-col gap-1.5">
                                <div className="text-[10px] font-semibold text-amber-800">Show products where… (all optional)</div>
                                <div className="flex gap-1.5 flex-wrap items-center">
                                  <input type="number" value={rj.price_max ?? ''} onChange={e => patchTileRule(id, ti, 'price_max', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Under ₹" className="w-20 text-xs border border-gray-300 rounded px-2 py-1" />
                                  <input type="number" value={rj.min_discount_pct ?? ''} onChange={e => patchTileRule(id, ti, 'min_discount_pct', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Min % off" className="w-20 text-xs border border-gray-300 rounded px-2 py-1" />
                                  <input value={rj.brand ?? ''} onChange={e => patchTileRule(id, ti, 'brand', e.target.value)} placeholder="Brand" className="w-24 text-xs border border-gray-300 rounded px-2 py-1" />
                                  <input value={(rj.tags || []).join(', ')} onChange={e => patchTileRule(id, ti, 'tags', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} placeholder="tags" className="w-24 text-xs border border-gray-300 rounded px-2 py-1" />
                                  <label className="text-[11px] text-gray-600 flex items-center gap-1"><input type="checkbox" checked={!!rj.has_offer} onChange={e => patchTileRule(id, ti, 'has_offer', e.target.checked)} /> has offer</label>
                                </div>
                                <div className="flex items-center gap-1.5 pt-1.5 border-t border-amber-200">
                                  <input value={t.__saveName || ''} onChange={e => updateTile(id, ti, { __saveName: e.target.value })} placeholder="Save as… (e.g. Adidas 40%)" className="flex-1 text-[11px] border border-gray-300 rounded px-2 py-1" />
                                  <button type="button" onClick={() => saveRuleForReuse(id, ti)} className="text-[10px] font-semibold text-amber-700 border border-amber-300 rounded px-2 py-1 whitespace-nowrap">Save for reuse</button>
                                </div>
                              </div>
                            ) : (
                              <select value={t.library_section_id || ''} onChange={e => updateTile(id, ti, { library_section_id: e.target.value, rule_mode: 'saved' })}
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                                <option value="">(pick a saved rule)</option>
                                {worldSections.map(sec => <option key={sec.id} value={sec.id}>{sec.name} · {sec.business_type}</option>)}
                              </select>
                            )}
                          </div>
                          );
                        })}
                        <button onClick={() => addTile(id)} className="self-start text-[11px] font-semibold text-amber-700 border border-amber-300 rounded px-2.5 py-1">+ Add banner</button>
                        {(cfg.tiles || []).length === 0 && <span className="text-[11px] text-gray-400">No banners yet — add one.</span>}
                      </div>
                    )}
                    {/* Category rail (catalogue) — drill the tree + pick nodes (contract: admin-category-rail). */}
                    {s.rule === 'category_nodes' && (
                      <div className="flex flex-col gap-2">
                        {!CAT_TREE_WORLDS.has(scopeValue) ? (
                          <div className="text-[11px] text-gray-400 italic bg-gray-50 rounded-lg px-3 py-2">
                            Category picking is available for the <b>fashion</b> &amp; <b>furniture</b> worlds (they have a catalogue tree).
                          </div>
                        ) : (
                          <>
                            <div className="text-[11px] font-semibold text-gray-600">Pick categories — tap to add (any level; not individual products)</div>
                            <div className="border border-gray-200 rounded-lg p-2 max-h-44 overflow-auto text-xs bg-white">
                              {catTree.map(n => {
                                const on = hasNode(s, n.id);
                                return (
                                  <div key={n.id} onClick={() => toggleNode(id, n)}
                                    style={{ paddingLeft: 6 + n.depth * 14 }}
                                    className={`py-1 rounded cursor-pointer ${on ? 'bg-amber-100 font-bold text-amber-800' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    {n.name}{on ? ' ✓' : ''}
                                  </div>
                                );
                              })}
                              {catTree.length === 0 && <div className="px-2 py-1 text-gray-400 italic">Loading the catalogue…</div>}
                            </div>
                            <div className="text-[11px] font-semibold text-gray-600">Selected tiles — rename / icon optional</div>
                            {(cfg.nodes || []).map((nd, ni) => (
                              <div key={nd.category_node_id || ni} className="flex items-center gap-2">
                                <input value={nd.label || ''} onChange={e => updateNode(id, ni, { label: e.target.value })}
                                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" placeholder="Tile label" />
                                <input value={nd.icon || ''} onChange={e => updateNode(id, ni, { icon: e.target.value })}
                                  className="w-14 text-xs border border-gray-300 rounded px-2 py-1 text-center" placeholder="icon" />
                                <button onClick={() => removeNode(id, ni)} className="text-gray-300 hover:text-red-500" aria-label="remove category">✕</button>
                              </div>
                            ))}
                            {(cfg.nodes || []).length === 0 && <span className="text-[11px] text-gray-400">No categories picked yet — tap nodes above.</span>}
                          </>
                        )}
                      </div>
                    )}
                    {/* Library Section placement (Phase 3c) — pick which reusable section fills this shelf. */}
                    {s.rule === 'library_products' && (
                      <label className="text-[11px] font-semibold text-gray-600">Library section
                        <select value={cfg.library_section_id || ''}
                          onChange={e => {
                            const secId = e.target.value;
                            const sec = worldSections.find(x => x.id === secId);
                            update(id, {
                              config_json: { ...(s.config_json || {}), library_section_id: secId },
                              ...((!s.title || s.title === 'New section') && sec ? { title: sec.name } : {}),
                            });
                          }}
                          className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                          <option value="">(pick a section)</option>
                          {worldSections.map(sec => (
                            <option key={sec.id} value={sec.id}>{sec.name} · {sec.business_type}</option>
                          ))}
                        </select>
                        {!cfg.library_section_id && <span className="block mt-0.5 text-[11px] text-red-600 font-semibold">Pick a section — required before publishing.</span>}
                        {worldSections.length === 0 && <span className="block mt-0.5 text-[11px] text-gray-400">No {scopeValue || ''} groups yet — create them in Section Library.</span>}
                      </label>
                    )}
                    {/* Presentation (Phase 6) — library_products → Row | Banner-Gateway. */}
                    {s.rule === 'library_products' && (
                      <div className="text-[11px] font-semibold text-gray-600">
                        Presentation
                        <div className="flex gap-1.5 mt-1">
                          {['row', 'banner'].map(pt => {
                            const active = (cfg.presentation_type || 'row') === pt;
                            const lbl = pt === 'row' ? 'Row' : 'Banner';
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
                        {cfg.presentation_type === 'banner' && (
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
            {KIND_GROUPS.map(g => {
              const opts = ADD_PRESETS.filter(p => p.kind === g.k
                && (!p.biz || (screen === 'business' && scopeValue === p.biz))
                && (!p.world || scopeValue === p.world));
              if (!opts.length) return null;
              return (
                <optgroup key={g.k} label={g.label}>
                  {opts.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </optgroup>
              );
            })}
          </select>
          <button onClick={addSection}
            className="px-3 py-1.5 rounded-lg border-2 border-dashed border-amber-600 text-amber-700 text-xs font-bold">
            ＋ Add Section
          </button>
          <span className="text-[11px] text-gray-400">added shelves save on Publish</span>
        </div>
      )}
      </div>

      {/* Live mobile preview — how the sections look in the app */}
      <MobilePreview shelves={shelves} scopeValue={scopeValue} />
    </div>
  );
}
