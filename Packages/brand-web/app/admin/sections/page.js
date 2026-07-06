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

// ── Design Catalog v1 (SECTION_SYSTEM_SPEC §3, LOCKED 2026-07-03) ─────────────
// One flat catalog with the founder's business names. `base` maps a design to
// the legacy fields the engine + renderer already understand (aliases — zero
// payload change); config_json.design records the canonical id on new rows.
// fills: which Content kinds the wizard offers. p3: renderer arrives in P3 —
// shown greyed, not creatable. world/biz gates mirror the old preset gating.
const DESIGN_CATALOG = [
  // Shelves — filled by rules, always fresh
  { id: 'product_shelf', name: 'Product shelf', hint: 'product cards', group: 'shelves',
    base: { shelf_type: 'products', rule: 'products_in_category', item_type: 'products', title: 'Trending Products' },
    fills: ['auto', 'rule'], autoRules: [['products_in_category', 'Products in this world — newest first']] },
  { id: 'deals_shelf', name: 'Deals shelf', hint: 'offer cards', group: 'shelves',
    base: { shelf_type: 'offers', rule: 'top_by_conversions', item_type: 'offers', title: 'Best Deals' },
    fills: ['auto', 'rule'],
    autoRules: [['top_by_conversions', 'Best converting offers'], ['top_by_engagement', 'Trending now — clicks + conversions'],
      ['biggest_discounts', 'Biggest discounts live'], ['ending_soon', 'Ending soon'], ['newest', 'New this week'],
      ['follow_graph', 'From creators the follower follows'], ['all_offers', 'All live offers']] },
  { id: 'shops_row', name: 'Shops row', hint: 'shop cards', group: 'shelves',
    base: { shelf_type: 'brands', rule: 'businesses_in_category', item_type: 'brands', title: 'Top Businesses' },
    fills: ['auto'], autoRules: [['businesses_in_category', 'Shops in this world'], ['top_by_engagement', 'Trending shops']] },
  { id: 'shops_list', name: 'Shops list', hint: 'full-width rows', group: 'shelves',
    base: { shelf_type: 'brands', rule: 'businesses_in_category', item_type: 'brands', title: 'All Businesses', config: { main_list: true } },
    fills: ['auto'], autoRules: [['businesses_in_category', 'Shops in this world']] },
  { id: 'creators_row', name: 'Creators row', hint: 'story circles', group: 'shelves',
    base: { shelf_type: 'creators', rule: 'creators_smart', title: "Creators you'd love" },
    fills: ['auto'], autoRules: [['creators_smart', 'Smart mix — promote · near · famous · followed'],
      ['creators_listing', 'Top creators'], ['creators_in_category_listing', 'Creators in this world']] },
  { id: 'restaurants_list', name: 'Restaurants list', hint: 'cards + dishes · Food', group: 'shelves', world: 'food',
    base: { shelf_type: 'restaurant_list', rule: 'restaurants_with_featured', item_type: 'brands', title: 'Famous Restaurants' },
    fills: ['auto'], autoRules: [['restaurants_with_featured', 'Restaurants near the follower + featured dishes']] },
  { id: 'food_menu', name: 'Menu (food)', hint: 'collapsible dishes', group: 'shelves', biz: 'food',
    base: { shelf_type: 'products', rule: 'static', title: 'Menu', config: { kind: 'menu' } },
    fills: ['auto'], autoRules: [['static', "The business's own menu"]] },
  // Banners & frames — your images
  { id: 'full_width_banner', name: 'Full-width banner', hint: 'your image or a rule', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'Spotlight', config: { style: 'fullbleed', tiles: [] } },
    fills: ['images', 'rule'] },
  { id: 'image_cards', name: 'Image cards', hint: 'cards · size S/M', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'Spotlight', config: { style: 'carousel', tiles: [] } }, fills: ['images'] },
  { id: 'image_grid', name: 'Image grid', hint: '4 columns', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'Shop by look', config: { style: 'grid', tiles: [] } }, fills: ['images'] },
  { id: 'banner_with_tiles', name: 'Banner with tiles', hint: 'bg + up to 3 tiles', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'Festive picks', config: { style: 'banner', tiles: [] } }, fills: ['images'] },
  { id: 'collage', name: 'Collage', hint: 'mixed-size tiles', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'The edit', config: { style: 'mosaic', tiles: [] } }, fills: ['images'] },
  { id: 'sale_zone', name: 'Sale zone', hint: 'frame + countdown + tiles', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'Deal zone', config: { style: 'themed_rail', tiles: [], timer: { label: 'Ends in' } } },
    fills: ['images'] },
  { id: 'hero_slider', name: 'Hero slider', hint: 'full-width auto-sliding', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'Hero', config: { style: 'hero_slider', tiles: [], autoplay_ms: 4000 } },
    fills: ['images'] },
  { id: 'announcement_strip', name: 'Announcement strip', hint: 'thin full-width strip', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'Notice', config: { style: 'strip', tiles: [] } }, fills: ['images'] },
  { id: 'split_banner', name: 'Split banner', hint: 'two tiles 50/50', group: 'frames',
    base: { shelf_type: 'tiles', rule: 'static', title: 'Split', config: { style: 'split', tiles: [] } }, fills: ['images'] },
  // Structure & navigation
  { id: 'category_row', name: 'Category row', hint: "'what's on your mind' · Food", group: 'structure', world: 'food',
    base: { shelf_type: 'category_rail', rule: 'world_categories', title: "What's on your mind?" },
    fills: ['auto'], autoRules: [['world_categories', "This world's craving rail"]] },
  { id: 'category_tiles', name: 'Category tiles', hint: 'tap → category or page', group: 'structure',
    base: { shelf_type: 'nav_tiles', rule: 'category_nodes', title: 'Shop by category' }, fills: ['nodes'] },
  { id: 'filter_chips', name: 'Filter chips', hint: 'sort / filter bar', group: 'structure',
    base: { shelf_type: 'controls', rule: 'static', title: 'Filters', config: { chips: [] } }, fills: ['chips'] },
];
const DESIGN_GROUPS = [
  ['shelves', 'Shelves — filled by rules, always fresh'],
  ['frames', 'Banners & frames — your images'],
  ['structure', 'Structure & navigation'],
];
const designById = (id) => DESIGN_CATALOG.find(d => d.id === id) || null;

// Alias resolver — maps a saved row (legacy fields) to its catalog design.
function resolveDesignId(s) {
  const cfg = s.config_json || {};
  if (cfg.design && designById(cfg.design)) return cfg.design;
  if (s.shelf_type === 'tiles') {
    return ({ hero_slider: 'hero_slider', strip: 'announcement_strip', split: 'split_banner', fullbleed: 'full_width_banner',
      carousel: 'image_cards', featured: 'image_cards', grid: 'image_grid',
      banner: 'banner_with_tiles', mosaic: 'collage', themed_rail: 'sale_zone' })[cfg.style || 'carousel'] || 'image_cards';
  }
  if (s.rule === 'library_products' && cfg.presentation_type === 'banner') return 'full_width_banner';
  if (s.shelf_type === 'products' && cfg.kind === 'menu') return 'food_menu';
  if (s.shelf_type === 'products') return 'product_shelf';
  if (s.shelf_type === 'offers' || s.shelf_type === 'mixed') return 'deals_shelf';
  if (s.shelf_type === 'brands') return cfg.main_list ? 'shops_list' : 'shops_row';
  if (s.shelf_type === 'creators') return 'creators_row';
  if (s.shelf_type === 'restaurant_list') return 'restaurants_list';
  if (s.shelf_type === 'category_rail') return 'category_row';
  if (s.shelf_type === 'nav_tiles') return 'category_tiles';
  if (s.shelf_type === 'controls') return 'filter_chips';
  return null;
}
function templateLabel(s) {
  const d = designById(resolveDesignId(s));
  return d ? d.name : (s.shelf_type || 'Section');
}

// A section's kind (for the no-rule / needs-rule tag) — derived from shelf_type so
// it works for already-saved rows too. Only the image/banner Frame needs a rule.
function sectionKind(s) {
  if (s.shelf_type === 'tiles') return 'frame';
  if (s.shelf_type === 'controls') return 'control';
  return 'data';
}

// ── Scheduling (mig 124 / features/section-scheduling) ───────────────────────
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
// Row chip: where this section is in its live window. null = always on (no chip).
function scheduleChip(s) {
  const now = Date.now();
  const st = s.starts_at ? new Date(s.starts_at).getTime() : null;
  const en = s.ends_at ? new Date(s.ends_at).getTime() : null;
  const fmt = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (en && en <= now) return { cls: 'bg-gray-100 text-gray-500', text: `Expired ${fmt(en)} — hidden in app` };
  if (st && st > now) return { cls: 'bg-amber-50 text-amber-700', text: `Starts ${fmt(st)}` };
  if (en) return { cls: 'bg-pink-50 text-pink-600', text: `Live until ${fmt(en)}` };
  return null;
}

// Editor guardrail (Phase 0): a past end time means the section can NEVER show —
// almost always a mistake while composing; a very short window probably is too.
function scheduleWarning(startsAt, endsAt) {
  if (!endsAt) return null;
  const en = new Date(endsAt).getTime();
  if (Number.isNaN(en)) return null;
  const mins = Math.round((en - Date.now()) / 60000);
  if (mins <= 0) return { kind: 'err', text: 'This end time is already in the past — the section will never appear in the app. Clear “Disappears” for always-on.' };
  if (mins < 360) return { kind: 'warn', text: `Heads up — this section disappears in about ${mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`}. Leave “Disappears” empty for always-on.` };
  return null;
}

// Phase 0 guardrail: what the backend will reject about a tap destination —
// caught here so the founder gets a plain-language message before Publish.
function tapDestinationProblem(td) {
  if (!td || typeof td !== 'object') return null;
  if (td.type === 'category' && !td.category_node_id) return '“Category browser” needs the exact category it opens — pick one (the world alone isn’t enough).';
  if (td.type === 'page' && !td.page_key) return '“A page” needs the page it opens — pick one.';
  return null;
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

// Phase 0 — “Category browser” destinations need a NODE, not just a world.
// Self-fetches the tree for whichever world is picked (cached per world) so the
// wizard, the inline editor and per-tile pickers can all offer real nodes.
const nodeTreeCache = {};
function CategoryNodePicker({ vertical, value, onChange }) {
  const [nodes, setNodes] = useState(nodeTreeCache[vertical] || []);
  useEffect(() => {
    if (!vertical || !CAT_TREE_WORLDS.has(vertical)) { setNodes([]); return undefined; }
    if (nodeTreeCache[vertical]) { setNodes(nodeTreeCache[vertical]); return undefined; }
    let on = true;
    adminApi.getListingTree(vertical).then(res => {
      const flat = res.success ? flattenTree(res.data?.tree || res.data || []) : [];
      nodeTreeCache[vertical] = flat;
      if (on) setNodes(flat);
    });
    return () => { on = false; };
  }, [vertical]);
  if (!vertical) return null;
  if (!CAT_TREE_WORLDS.has(vertical)) {
    return <span className="text-[10px] text-amber-700">this world has no category tree — use “Product grid” instead</span>;
  }
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value || undefined)}
      className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white">
      <option value="">— pick a category (required) —</option>
      {nodes.map(n => <option key={n.id} value={n.id}>{' '.repeat(n.depth * 2)}{n.name}</option>)}
    </select>
  );
}

// template → which RULES it can use (the explicit "what fills it" step). Templates
// with a single fixed rule (category_rail / restaurant_list / tiles per-tile / menu)
// don't show a picker.
const RULES_BY_SHELF = {
  creators: [
    { v: 'creators_smart', l: 'Smart creators (promote · near · famous · followed)' },
    { v: 'creators_listing', l: 'Top creators' },
    // offer-gated 'creators_in_category' pruned (P1-CLEAN) — listing twin instead
    { v: 'creators_in_category_listing', l: 'Creators in this world' },
  ],
  products: [
    { v: 'library_products', l: 'A Section Library group' },
    { v: 'products_in_category', l: 'Products in this world' },
  ],
  brands: [
    { v: 'businesses_in_category', l: 'Businesses in this world' },
  ],
};

// (TemplatePreview wireframe removed — the live phone pane on the right shows the
// real render, so the shape wireframe was redundant. Founder 2026-07-02.)

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
    if (cfg.style === 'hero_slider') {
      const first = tiles[0] || {};
      const dots = tiles.length ? tiles : [0, 1, 2];
      return (
        <div className="px-3 pt-2 pb-2">
          <div className="rounded-xl overflow-hidden relative" style={{ height: 92, background: '#2C2C2A' }}>
            {first.image_url ? <img src={first.image_url} alt="" className="w-full h-full object-cover" /> : null}
            <div className="absolute left-0 right-0 flex justify-center gap-1" style={{ bottom: 8 }}>
              {dots.slice(0, 5).map((_, i) => <span key={i} className={i === 0 ? 'h-1 rounded-full' : 'h-1 rounded-full'}
                style={{ width: i === 0 ? 14 : 4, background: i === 0 ? '#F8CB46' : 'rgba(255,255,255,.55)' }} />)}
            </div>
          </div>
        </div>
      );
    }
    if (cfg.style === 'strip') {
      const t = tiles[0] || {};
      return <div className="px-3 pt-2 pb-2"><div className="rounded-lg overflow-hidden" style={{ height: 30, background: '#fff6e0', border: '1px solid #f0dca6' }}>{t.image_url ? <img src={t.image_url} alt="" className="w-full h-full object-cover" /> : null}</div></div>;
    }
    if (cfg.style === 'split') {
      const list = (tiles.length ? tiles : [{}, {}]).slice(0, 2);
      return <div className="px-3 pt-2 pb-2"><div className="flex gap-2">{list.map((t, i) => <div key={i} className="flex-1 rounded-lg overflow-hidden bg-gray-100" style={{ height: 70 }}>{t.image_url ? <img src={t.image_url} alt="" className="w-full h-full object-cover" /> : null}</div>)}</div></div>;
    }
    if (cfg.style === 'fullbleed') {
      const t = tiles[0] || {};
      return <div className="px-3 pt-2 pb-2"><div className="rounded-lg overflow-hidden bg-gray-800" style={{ height: 100 }}>{t.image_url ? <img src={t.image_url} alt="" className="w-full h-full object-cover" /> : null}</div></div>;
    }
    if (cfg.style === 'mosaic') {
      const slot = cfg.slot_template || 'free';
      const list = tiles.length ? tiles : [{}, {}, {}];
      const Cell = ({ t, h }) => <div className="rounded overflow-hidden bg-gray-100 flex-1" style={{ height: h }}>{t && t.image_url ? <img src={t.image_url} alt="" className="w-full h-full object-cover" /> : null}</div>;
      if (slot === '2x2') {
        return <div className="px-3 pt-2 pb-2 grid grid-cols-2 gap-1.5">{list.slice(0, 4).map((t, i) => <Cell key={i} t={t} h={44} />)}</div>;
      }
      const smallCount = slot === '1+3' ? 3 : slot === '1big+2small' ? 2 : 2;
      return <div className="px-3 pt-2 pb-2 flex flex-col gap-1.5">
        <Cell t={list[0]} h={56} />
        <div className="flex gap-1.5">{list.slice(1, 1 + smallCount).map((t, i) => <Cell key={i} t={t} h={40} />)}</div>
      </div>;
    }
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

// ── Add-Section wizard (contract: features/app-builder-wizard, P2) ───────────
// One guided flow: 1 Design · 2 Content · 3 Display · 4 Action (founder-locked
// business language). Operates on a DRAFT shelf; nothing touches the page's
// shelves until Publish. Edit mode opens an existing row resolved via the
// design alias map. Deep per-tile fine-tuning stays available in the row's ⚙.
function AddSectionWizard({ wiz, setWiz, scopeValue, screen, catTree, worldTags, pages, worldSections, onFinish, saving }) {
  if (!wiz) return null;
  const d = wiz.draft;
  const cfg = d.config_json || {};
  const design = designById(wiz.designId);
  const patch = (p) => setWiz(prev => ({ ...prev, ...p, err: null }));
  const patchDraft = (p) => setWiz(prev => ({ ...prev, err: null, draft: { ...prev.draft, ...p } }));
  const patchCfg = (key, value) => setWiz(prev => {
    const c = { ...(prev.draft.config_json || {}) };
    if (value === null || value === undefined) delete c[key]; else c[key] = value;
    return { ...prev, err: null, draft: { ...prev.draft, config_json: c } };
  });
  const patchCfgNested = (parent, key, value) => setWiz(prev => {
    const c = { ...(prev.draft.config_json || {}) };
    const inner = { ...(c[parent] || {}) };
    if (value === null || value === undefined || value === '') delete inner[key]; else inner[key] = value;
    c[parent] = inner;
    return { ...prev, err: null, draft: { ...prev.draft, config_json: c } };
  });
  const tiles = cfg.tiles || [];
  const patchTile = (idx, p) => setWiz(prev => {
    const c = { ...(prev.draft.config_json || {}) };
    const list = [...(c.tiles || [])];
    list[idx] = { ...list[idx], ...p };
    c.tiles = list;
    return { ...prev, err: null, draft: { ...prev.draft, config_json: c } };
  });
  const addTile = () => patchCfg('tiles', [...tiles, { image_url: '', label: '', library_section_id: '' }]);
  const removeTile = (idx) => patchCfg('tiles', tiles.filter((_, i) => i !== idx));
  const upload = async (file, apply) => {
    const res = await uploadAdminStockImage(file);
    if (res.error) { patch({ err: res.error.message || 'Upload failed' }); return; }
    apply(res.public_url);
  };

  // Kind-2 inline rule builder (writes section_library on finish).
  const rj = wiz.ruleDraft || {};
  const patchRule = (key, value) => {
    const empty = value === '' || value == null || value === false || (Array.isArray(value) && value.length === 0);
    const next = { ...rj };
    if (empty) delete next[key]; else next[key] = value;
    patch({ ruleDraft: next, preview: null });
  };
  const checkMatches = async () => {
    patch({ preview: { loading: true } });
    const res = await adminApi.previewSectionLibrary({ business_type: scopeValue || 'ALL', rule_json: rj });
    if (res.success) patch({ preview: { count: res.data?.count ?? 0, sample: res.data?.sample || [] } });
    else patch({ preview: { error: res.error?.message || 'Preview unavailable' } });
  };
  // P4 hand-pick: search gated products; the picked ORDER is the shelf order.
  const searchPick = async (q) => {
    patch({ pickSearch: q });
    if (q.trim().length < 2) { patch({ pickResults: [] }); return; }
    const res = await adminApi.searchLibraryProducts(scopeValue || 'ALL', q.trim());
    patch({ pickResults: res.success ? (res.data?.products || []) : [] });
  };
  const picked = wiz.picked || [];
  const setPicked = (list) => {
    setWiz(prev => ({ ...prev, picked: list, preview: null, err: null,
      ruleDraft: (() => { const next = { ...(prev.ruleDraft || {}) };
        if (list.length) next.product_ids = list.map(x => x.id); else delete next.product_ids;
        return next; })() }));
  };

  const isTiles = d.shelf_type === 'tiles';
  const isBannerGateway = wiz.designId === 'full_width_banner';
  const usesLibraryRule = d.rule === 'library_products';
  const contentTabs = design?.fills || [];
  const window_ = { st: d.starts_at ? new Date(d.starts_at) : null, en: d.ends_at ? new Date(d.ends_at) : null };
  const badWindow = window_.st && window_.en && window_.en.getTime() <= window_.st.getTime();
  const fmtDT = (t) => t.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });

  // full_width_banner is the only dual-fill design: image → a fullbleed tile,
  // rule → the banner-gateway (headline + library rule). Switching the Content
  // fill reshapes the draft cleanly so a half-configured shape can never ship.
  const reconfigFill = (targetTab) => {
    if (wiz.designId === 'full_width_banner') {
      if (targetTab === 'images') {
        return { ...d, shelf_type: 'tiles', rule: 'static', item_type: null,
          config_json: { sub: cfg.sub || '', design: 'full_width_banner', style: 'fullbleed', tiles: cfg.tiles || [] } };
      }
      return { ...d, shelf_type: 'products', rule: 'library_products', item_type: 'products',
        config_json: { sub: cfg.sub || '', design: 'full_width_banner', presentation_type: 'banner', banner: cfg.banner || {}, library_section_id: cfg.library_section_id } };
    }
    if (targetTab === 'auto') return { ...d, rule: design.base.rule, config_json: { ...cfg, library_section_id: undefined } };
    if (targetTab === 'rule') return { ...d, rule: 'library_products' };
    return d;
  };

  const pickDesign = (dc) => {
    if (dc.p3) return;
    const base = dc.base;
    patch({
      designId: dc.id,
      tab: dc.fills[0],
      draft: {
        ...d,
        shelf_key: d.id ? d.shelf_key : `${slug(dc.name)}_${Date.now().toString(36).slice(-4)}`,
        shelf_type: base.shelf_type, rule: base.rule, item_type: base.item_type || null,
        title: d.title || '',
        config_json: { sub: '', ...(base.config ? JSON.parse(JSON.stringify(base.config)) : {}), design: dc.id },
      },
    });
  };

  const next = () => {
    if (wiz.step === 2 && !String(d.title || '').trim()) { patch({ err: 'Give the section a name — it shows in the app.' }); return; }
    patch({ step: wiz.step + 1 });
  };
  const finish = async () => {
    if (!String(d.title || '').trim()) { patch({ err: 'Give the section a name — it shows in the app.', step: 2 }); return; }
    if (badWindow) { patch({ err: '"Disappears" must be after "Goes live".', step: 3 }); return; }
    const schedErr = scheduleWarning(d.starts_at, d.ends_at);
    if (schedErr && schedErr.kind === 'err') { patch({ err: schedErr.text, step: 3 }); return; }
    const tdErr = tapDestinationProblem(cfg.tap_destination) ||
      (cfg.tiles || []).map(t => tapDestinationProblem(t.tap_destination)).find(Boolean);
    if (tdErr) { patch({ err: tdErr, step: 4 }); return; }
    if (usesLibraryRule && cfg.presentation_type === 'banner' && !(cfg.banner || {}).headline) { patch({ err: 'The banner needs a headline.', step: 2 }); return; }
    let final = { ...d };
    // My-rule (create) → save the reusable Section Library rule first, then wire it.
    if (usesLibraryRule && wiz.ruleMode === 'create') {
      const conds = Object.keys(rj);
      if (!conds.length) { patch({ err: 'Add at least one condition to your rule.', step: 2 }); return; }
      const name = (wiz.ruleName || '').trim() || d.title;
      const res = await adminApi.createSectionLibrary({ business_type: scopeValue || 'ALL', name, image_url: null, rule_json: rj });
      if (!res.success) { patch({ err: res.error?.message || 'Could not save the rule.', step: 2 }); return; }
      const newId = res.data?.section?.id || res.data?.id || '';
      final = { ...final, config_json: { ...(final.config_json || {}), library_section_id: newId } };
    }
    if (usesLibraryRule && wiz.ruleMode !== 'create' && !(final.config_json || {}).library_section_id) {
      patch({ err: 'Pick a saved rule (or build one).', step: 2 }); return;
    }
    onFinish(final, wiz.mode === 'edit');
  };

  const stepChip = (n, label) => (
    <div key={n} className={`flex-1 text-center text-[11px] font-semibold rounded-lg py-1.5 ${
      wiz.step === n ? 'bg-gray-900 text-white' : wiz.step > n ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
      {wiz.step > n ? `${label} ✓` : label}
    </div>
  );
  const destPicker = (td, apply) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select value={(td || {}).type || 'grid'}
        onChange={e => apply(e.target.value === 'category'
          ? { ...(td || {}), type: 'category', vertical: (td || {}).vertical || scopeValue }
          : { ...(td || {}), type: e.target.value })}
        className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white">
        <option value="grid">Product grid</option>
        <option value="category">Category browser</option>
        <option value="page">Custom page</option>
      </select>
      {(td || {}).type === 'category' && (
        <>
          <select value={(td || {}).vertical || ''}
            onChange={e => apply({ ...(td || {}), vertical: e.target.value, category_node_id: undefined })}
            className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white">
            <option value="">— world —</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <CategoryNodePicker vertical={(td || {}).vertical || ''} value={(td || {}).category_node_id}
            onChange={v => apply({ ...(td || {}), category_node_id: v })} />
        </>
      )}
      {(td || {}).type === 'page' && (
        <select value={(td || {}).page_key || ''} onChange={e => apply({ ...(td || {}), page_key: e.target.value })}
          className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white">
          <option value="">— page —</option>
          {pages.filter(p => p.enabled !== false).map(p => <option key={p.id} value={p.key}>{p.label}</option>)}
        </select>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/45 overflow-y-auto p-6" onClick={() => setWiz(null)}>
      <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex gap-1.5 mb-4">
          {stepChip(1, '1 Design')}{stepChip(2, '2 Content')}{stepChip(3, '3 Display')}{stepChip(4, '4 Action')}
        </div>
        {wiz.err && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700">{wiz.err}</div>}

        {/* ── 1 · Design ── */}
        {wiz.step === 1 && (
          <div>
            <div className="text-base font-bold text-gray-900">How should it look?</div>
            <div className="text-[11.5px] text-gray-500 mb-3">Pick a design. The next step asks what fills it.</div>
            {DESIGN_GROUPS.map(([g, glabel]) => {
              const cards = DESIGN_CATALOG.filter(dc => dc.group === g
                && (!dc.world || scopeValue === dc.world)
                && (!dc.biz || (screen === 'business' && scopeValue === dc.biz)) || (dc.group === g && dc.p3));
              const seen = new Set(); const list = cards.filter(c => !seen.has(c.id) && seen.add(c.id));
              if (!list.length) return null;
              return (
                <div key={g} className="mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">{glabel}</div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {list.map(dc => (
                      <button key={dc.id} type="button" onClick={() => pickDesign(dc)} disabled={!!dc.p3}
                        className={`text-left rounded-xl border-2 p-2.5 ${dc.p3 ? 'opacity-40 cursor-not-allowed border-gray-200'
                          : wiz.designId === dc.id ? 'border-gray-900 ring-2 ring-amber-300' : 'border-gray-200 hover:border-gray-400'}`}>
                        <div className="text-xs font-bold text-gray-900">{dc.name}{dc.p3 ? ' · P3' : ''}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{dc.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 2 · Content ── */}
        {wiz.step === 2 && design && (
          <div className="flex flex-col gap-3">
            <div className="text-base font-bold text-gray-900">What fills it?</div>
            <div className="text-[11px] bg-amber-50 rounded-lg px-3 py-1.5 self-start">Design: <b>{design.name}</b> · placing on <b>{scopeValue || screen}</b></div>
            <label className="text-[11px] font-semibold text-gray-600">Section name (shown in the app)
              <input value={d.title || ''} onChange={e => patchDraft({ title: e.target.value })}
                placeholder="e.g. Fashion Steals — min 20% off"
                className="mt-0.5 w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5" />
            </label>

            {/* Automatic rules */}
            {contentTabs.includes('auto') && (
              <div className={`rounded-xl border p-3 ${wiz.tab === 'auto' ? 'border-gray-900' : 'border-gray-200'}`}
                onClick={() => { if (wiz.tab !== 'auto') patch({ tab: 'auto', draft: { ...d, rule: design.base.rule, config_json: { ...cfg, library_section_id: undefined } } }); }}>
                <div className="text-xs font-bold text-gray-900 mb-1">⚡ Automatic — fills itself, always fresh</div>
                {wiz.tab === 'auto' && (design.autoRules || []).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 text-xs text-gray-700 py-1 cursor-pointer">
                    <input type="radio" name="autorule" checked={d.rule === v} onChange={() => patchDraft({ rule: v })} />{l}
                  </label>
                ))}
              </div>
            )}

            {/* My rule (Section Library inline) */}
            {contentTabs.includes('rule') && (
              <div className={`rounded-xl border p-3 ${wiz.tab === 'rule' ? 'border-gray-900' : 'border-gray-200'}`}
                onClick={() => { if (wiz.tab !== 'rule') patch({ tab: 'rule', draft: reconfigFill('rule') }); }}>
                <div className="text-xs font-bold text-gray-900 mb-1">🧩 My rule — build a filter, it keeps itself up to date</div>
                {wiz.tab === 'rule' && (
                  <div className="flex flex-col gap-2 mt-1" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      {[['create', 'Build a new rule'], ['pick', 'Use a saved rule']].map(([m, lbl]) => (
                        <button key={m} type="button" onClick={() => patch({ ruleMode: m })}
                          className={`text-[11px] font-semibold rounded px-2.5 py-1 border ${((wiz.ruleMode || 'create') === m) ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'}`}>{lbl}</button>
                      ))}
                    </div>
                    {(wiz.ruleMode || 'create') === 'pick' ? (
                      <select value={cfg.library_section_id || ''} onChange={e => patchCfg('library_section_id', e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                        <option value="">(pick a saved rule)</option>
                        {worldSections.map(sec => <option key={sec.id} value={sec.id}>{sec.name} · {sec.business_type}</option>)}
                      </select>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-col gap-2">
                        <input value={wiz.ruleName || ''} onChange={e => patch({ ruleName: e.target.value })}
                          placeholder="Rule name — saves to your Section Library for reuse"
                          className="text-[11px] border border-gray-300 rounded px-2 py-1" />
                        {CAT_TREE_WORLDS.has(scopeValue) && (
                          <select value={rj.subcategory_node_id || ''} onChange={e => patchRule('subcategory_node_id', e.target.value || undefined)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                            <option value="">Any category</option>
                            {catTree.map(n => <option key={n.id} value={n.id}>{' '.repeat(n.depth * 2)}{n.name}</option>)}
                          </select>
                        )}
                        <div className="flex gap-2">
                          <input type="number" value={rj.price_min ?? ''} onChange={e => patchRule('price_min', e.target.value === '' ? undefined : Number(e.target.value))}
                            placeholder="Min ₹" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" />
                          <input type="number" value={rj.price_max ?? ''} onChange={e => patchRule('price_max', e.target.value === '' ? undefined : Number(e.target.value))}
                            placeholder="Max ₹" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" />
                          <input type="number" value={rj.min_discount_pct ?? ''} onChange={e => patchRule('min_discount_pct', e.target.value === '' ? undefined : Number(e.target.value))}
                            placeholder="Min % off" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" />
                        </div>
                        {worldTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {worldTags.map(tag => {
                              const on = (rj.tags || []).includes(tag.slug);
                              return (
                                <button key={tag.slug} type="button"
                                  onClick={() => patchRule('tags', on ? (rj.tags || []).filter(x => x !== tag.slug) : [...(rj.tags || []), tag.slug])}
                                  className={`text-[10px] font-semibold rounded-full px-2.5 py-0.5 border ${on ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'}`}>{tag.label}</button>
                              );
                            })}
                          </div>
                        )}
                        <input value={rj.brand || ''} onChange={e => patchRule('brand', e.target.value || undefined)}
                          placeholder="Brand (optional) — the product's catalogue brand, e.g. Levi's"
                          className="text-xs border border-gray-300 rounded px-2 py-1" />
                        {worldTags.length > 0 && (
                          <div className="text-[11px] font-semibold text-gray-600">Exclude tags — hide anything carrying these
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {worldTags.map(tag => {
                                const on = (rj.exclude_tags || []).includes(tag.slug);
                                return (
                                  <button key={tag.slug} type="button"
                                    onClick={() => patchRule('exclude_tags', on ? (rj.exclude_tags || []).filter(x => x !== tag.slug) : [...(rj.exclude_tags || []), tag.slug])}
                                    className={`text-[10px] font-semibold rounded-full px-2.5 py-0.5 border ${on ? 'bg-red-700 text-white border-red-700 line-through' : 'bg-white text-gray-600 border-gray-300'}`}>{tag.label}</button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <label className="text-[11px] text-gray-600 flex items-center gap-1.5">
                          <input type="checkbox" checked={!!rj.has_offer} onChange={e => patchRule('has_offer', e.target.checked || undefined)} /> Only products with a live offer
                        </label>
                        <div className="text-[11px] font-semibold text-gray-600">Hand-pick products (optional) — your order is the shelf order
                          <input value={wiz.pickSearch || ''} onChange={e => searchPick(e.target.value)}
                            placeholder="🔎 Search products… (2+ letters)"
                            className="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1" />
                          {(wiz.pickResults || []).length > 0 && (
                            <div className="mt-1 border border-gray-200 rounded-lg bg-white max-h-32 overflow-auto">
                              {(wiz.pickResults || []).filter(r => !picked.some(x => x.id === r.id)).map(r => (
                                <div key={r.id} onClick={() => { setPicked([...picked, { id: r.id, name: r.name }]); patch({ pickSearch: '', pickResults: [] }); }}
                                  className="px-2.5 py-1.5 text-xs text-gray-700 cursor-pointer hover:bg-amber-50 flex justify-between">
                                  <span>{r.name}</span><span className="text-gray-400">₹{r.price} · {r.brand_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {picked.length > 0 && (
                            <div className="mt-1.5 flex flex-col gap-1">
                              {picked.map((x, i) => (
                                <div key={x.id} className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                                  <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#F8CB46' }}>{i + 1}</span>
                                  <span className="flex-1 truncate font-normal">{x.name || x.id}</span>
                                  <button type="button" onClick={() => setPicked(picked.filter(y => y.id !== x.id))} className="text-gray-300 hover:text-red-500">✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={checkMatches} className="text-[11px] font-semibold text-amber-700 border border-amber-300 rounded px-2.5 py-1">Check matches</button>
                          {wiz.preview?.loading && <span className="text-[11px] text-gray-400">checking…</span>}
                          {wiz.preview?.error && <span className="text-[11px] text-gray-400">{wiz.preview.error} — you can still publish</span>}
                          {wiz.preview && wiz.preview.count != null && (
                            <span className="text-[11px] font-bold text-green-700">✓ Matches {wiz.preview.count} products{wiz.preview.sample?.length ? ` · e.g. ${wiz.preview.sample.slice(0, 2).map(x => x.name).join(' · ')}` : ''}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {isBannerGateway && (
                      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Banner face</div>
                        <input value={(cfg.banner || {}).eyebrow || ''} onChange={e => patchCfgNested('banner', 'eyebrow', e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1" placeholder="Eyebrow — e.g. SUMMER SALE" />
                        <input value={(cfg.banner || {}).headline || ''} onChange={e => patchCfgNested('banner', 'headline', e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1" placeholder="Headline — e.g. FLAT 20% OFF (required)" />
                        <input value={(cfg.banner || {}).cta_label || ''} onChange={e => patchCfgNested('banner', 'cta_label', e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1" placeholder="Button label — default SHOP NOW" />
                        <label className="w-20 h-12 rounded border bg-white flex items-center justify-center overflow-hidden cursor-pointer text-[10px] text-gray-400">
                          {(cfg.banner || {}).image_url ? <img src={(cfg.banner).image_url} alt="" className="w-full h-full object-cover" /> : <span>＋ image</span>}
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f, url => patchCfgNested('banner', 'image_url', url)); }} />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* My images */}
            {contentTabs.includes('images') && (
              <div className={`rounded-xl border p-3 flex flex-col gap-2 ${(wiz.tab === 'images' || contentTabs.length === 1) ? 'border-gray-900' : 'border-gray-200'}`}
                onClick={() => { if (wiz.tab !== 'images' && contentTabs.length > 1) patch({ tab: 'images', draft: reconfigFill('images') }); }}>
                <div className="text-xs font-bold text-gray-900">🖼 My images — exactly what you upload</div>
                {(wiz.tab === 'images' || contentTabs.length === 1) && (
                <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                {wiz.designId === 'announcement_strip' && (
                  <div className="text-[10px] text-gray-500">Upload one thin strip image · 1080×240 px</div>
                )}
                {wiz.designId === 'split_banner' && (
                  <div className="text-[10px] text-gray-500">Upload two square images · 520×520 px · each taps to its own action</div>
                )}
                {wiz.designId === 'full_width_banner' && (
                  <div className="text-[10px] text-gray-500">Upload one edge-to-edge image · 1080×720 px</div>
                )}
                {wiz.designId === 'collage' && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-gray-500">Layout</span>
                    {[['free', 'Free'], ['1big+2small', '1 big + 2 small'], ['2x2', '2×2'], ['1+3', '1 + 3']].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => patchCfg('slot_template', v === 'free' ? null : v)}
                        className={`text-[10px] font-bold rounded px-2.5 py-0.5 border ${((cfg.slot_template) || 'free') === v ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-500 border-gray-300'}`}>{l}</button>
                    ))}
                  </div>
                )}
                {wiz.designId === 'hero_slider' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-gray-500">Auto-advance every</span>
                    <input type="number" min="0" value={(cfg.autoplay_ms ?? 4000) / 1000}
                      onChange={e => patchCfg('autoplay_ms', Math.max(0, Math.round(Number(e.target.value) || 0)) * 1000)}
                      className="w-14 text-xs border border-gray-300 rounded px-2 py-1" />
                    <span className="text-[10px] text-gray-500">seconds (0 = followers swipe manually) · upload slides 1080×560 px</span>
                  </div>
                )}
                {wiz.designId === 'image_cards' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-500">Card size</span>
                    {[['carousel', 'Small'], ['featured', 'Medium']].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => patchCfg('style', v)}
                        className={`text-[10px] font-bold rounded px-2.5 py-0.5 border ${(cfg.style || 'carousel') === v ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-500 border-gray-300'}`}>{l}</button>
                    ))}
                  </div>
                )}
                {wiz.designId === 'banner_with_tiles' && (
                  <label className="w-24 h-14 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer text-[10px] text-gray-400" title="Banner background">
                    {cfg.banner_image_url ? <img src={cfg.banner_image_url} alt="" className="w-full h-full object-cover" /> : <span>＋ background</span>}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f, url => patchCfg('banner_image_url', url)); }} />
                  </label>
                )}
                {wiz.designId === 'sale_zone' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-gray-500">Frame</span>
                    <input type="color" value={(cfg.frame || {}).bg_color || '#ffffff'} onChange={e => patchCfgNested('frame', 'bg_color', e.target.value)} className="w-8 h-7 border border-gray-300 rounded" />
                    <label className="w-14 h-8 rounded border bg-white flex items-center justify-center overflow-hidden cursor-pointer text-[9px] text-gray-400">
                      {(cfg.frame || {}).bg_image_url ? <img src={(cfg.frame).bg_image_url} alt="" className="w-full h-full object-cover" /> : <span>＋ img</span>}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f, url => patchCfgNested('frame', 'bg_image_url', url)); }} />
                    </label>
                    <span className="text-[10px] font-semibold text-gray-500 ml-1">Countdown label</span>
                    <input value={(cfg.timer || {}).label || ''} onChange={e => patchCfgNested('timer', 'label', e.target.value)}
                      placeholder="Ends in" className="w-24 text-xs border border-gray-300 rounded px-2 py-1" />
                  </div>
                )}
                {tiles.map((t, ti) => (
                  <div key={ti} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50">
                    <label className="w-12 h-12 rounded-lg border bg-white flex items-center justify-center overflow-hidden cursor-pointer shrink-0">
                      {t.image_url ? <img src={t.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-300 text-lg">＋</span>}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f, url => patchTile(ti, { image_url: url })); }} />
                    </label>
                    <input value={t.label || ''} onChange={e => patchTile(ti, { label: e.target.value })} placeholder="Label"
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" />
                    {wiz.designId === 'collage' && !cfg.slot_template && (
                      <select value={t.size || 'small'} onChange={e => patchTile(ti, { size: e.target.value })}
                        className="text-[11px] border border-gray-300 rounded px-1.5 py-1 bg-white">
                        <option value="small">Small</option><option value="large">Large</option>
                      </select>
                    )}
                    <button onClick={() => removeTile(ti)} className="text-gray-300 hover:text-red-500">✕</button>
                  </div>
                ))}
                <button onClick={addTile} className="self-start text-[11px] font-semibold text-amber-700 border border-amber-300 rounded px-2.5 py-1">＋ Add image</button>
                <div className="text-[10px] text-gray-400">Each image can carry its own rule + tap action — set those in step 4 (or later via the row's ⚙).</div>
                </div>
                )}
              </div>
            )}

            {/* Category tiles — node picker */}
            {contentTabs.includes('nodes') && (
              <div className="rounded-xl border border-gray-900 p-3 flex flex-col gap-2">
                <div className="text-xs font-bold text-gray-900">Pick categories (tap to add)</div>
                {!CAT_TREE_WORLDS.has(scopeValue) ? (
                  <div className="text-[11px] text-gray-400 italic">Category picking works on the fashion &amp; furniture worlds (they have a catalogue tree).</div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-auto text-xs bg-white">
                    {catTree.map(n => {
                      const on = (cfg.nodes || []).some(x => x.category_node_id === n.id);
                      return (
                        <div key={n.id} style={{ paddingLeft: 6 + n.depth * 14 }}
                          onClick={() => patchCfg('nodes', on
                            ? (cfg.nodes || []).filter(x => x.category_node_id !== n.id)
                            : [...(cfg.nodes || []), { category_node_id: n.id, vertical: scopeValue, label: n.name, icon: '' }])}
                          className={`py-1 rounded cursor-pointer ${on ? 'bg-amber-100 font-bold text-amber-800' : 'text-gray-600 hover:bg-gray-50'}`}>
                          {n.name}{on ? ' ✓' : ''}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Filter chips */}
            {contentTabs.includes('chips') && (
              <label className="text-[11px] font-semibold text-gray-600">Chip labels (comma-separated)
                <input value={(cfg.chips || []).join(', ')}
                  onChange={e => patchCfg('chips', e.target.value.split(',').map(x => x.trim()).filter(Boolean))}
                  className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="e.g. Offers, Nearest, Top Rated" />
              </label>
            )}
          </div>
        )}

        {/* ── 3 · Display ── */}
        {wiz.step === 3 && (
          <div className="flex flex-col gap-3">
            <div className="text-base font-bold text-gray-900">Where and when does it show?</div>
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-xs font-bold text-gray-900 mb-2">Placement</div>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="text-xs bg-gray-50 rounded-lg px-3 py-2">{SCOPES.find(x => x.key === screen)?.label} · <b>{scopeValue}</b></div>
                <label className="text-[11px] font-semibold text-gray-600">Items
                  <input type="number" value={d.item_limit ?? 8} onChange={e => patchDraft({ item_limit: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                    className="mt-0.5 w-16 text-xs border border-gray-300 rounded px-2 py-1 block" />
                </label>
                <label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5 pb-1">
                  <input type="checkbox" checked={d.enabled !== false} onChange={e => patchDraft({ enabled: e.target.checked })} /> Visible
                </label>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-xs font-bold text-gray-900 mb-2">Schedule (optional)</div>
              <div className="flex gap-3 flex-wrap">
                <label className="text-[11px] font-semibold text-gray-600">Goes live
                  <input type="datetime-local" value={toLocalInput(d.starts_at)} onChange={e => patchDraft({ starts_at: fromLocalInput(e.target.value) })}
                    className="mt-0.5 text-xs border border-gray-300 rounded px-2 py-1 block" />
                </label>
                <label className="text-[11px] font-semibold text-gray-600">Disappears
                  <input type="datetime-local" value={toLocalInput(d.ends_at)} onChange={e => patchDraft({ ends_at: fromLocalInput(e.target.value) })}
                    className="mt-0.5 text-xs border border-gray-300 rounded px-2 py-1 block" />
                </label>
              </div>
              {badWindow && <div className="text-[11px] font-bold text-red-600 mt-1.5">“Disappears” must be after “Goes live”.</div>}
              {!badWindow && (() => {
                const w = scheduleWarning(d.starts_at, d.ends_at);
                return w ? <div className={`text-[11px] font-bold mt-1.5 ${w.kind === 'err' ? 'text-red-600' : 'text-amber-700'}`}>{w.text}</div> : null;
              })()}
              {!badWindow && (window_.st || window_.en) && (
                <div className="inline-block text-[11px] font-semibold rounded-full px-2.5 py-1 bg-pink-50 text-pink-600 mt-1.5">
                  ⏱ {window_.st ? `Live ${fmtDT(window_.st)}` : 'Live now'} → {window_.en ? fmtDT(window_.en) : 'no end'}
                </div>
              )}
              <div className="text-[10px] text-gray-400 mt-1.5">Leave both empty for always on. When “Disappears” passes, the section leaves the app by itself — silently, no “sale over” message.</div>
              {isTiles && (
                <label className="text-[11px] text-gray-700 flex items-center gap-1.5 mt-2">
                  <input type="checkbox" checked={!!cfg.timer} disabled={!d.ends_at}
                    onChange={e => patchCfg('timer', e.target.checked ? { label: (cfg.timer || {}).label || 'Ends in' } : null)} />
                  Show a countdown on the section (uses the same end time){!d.ends_at ? ' — set “Disappears” first' : ''}
                </label>
              )}
            </div>
          </div>
        )}

        {/* ── 4 · Action ── */}
        {wiz.step === 4 && (
          <div className="flex flex-col gap-3">
            <div className="text-base font-bold text-gray-900">What happens when a follower taps it?</div>
            {isTiles ? (
              <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
                <div className="text-[11px] text-gray-500">Each image gets its own action:</div>
                {tiles.map((t, ti) => (
                  <div key={ti} className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-gray-700 w-28 truncate">{t.label || `Image ${ti + 1}`}</span>
                    {destPicker(t.tap_destination, (td) => patchTile(ti, { tap_destination: td }))}
                    {((t.tap_destination || {}).type || 'grid') === 'grid' && (
                      <select value={t.library_section_id || ''} onChange={e => patchTile(ti, { library_section_id: e.target.value })}
                        className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white">
                        <option value="">grid of… (pick a rule)</option>
                        {worldSections.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                {tiles.length === 0 && <div className="text-[11px] text-gray-400">No images yet — add them in step 2.</div>}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 p-3">
                <div className="text-[11px] text-gray-500 mb-1.5">“See all” and the section header open:</div>
                {destPicker(cfg.tap_destination, (td) => patchCfg('tap_destination', td))}
                <div className="text-[10px] text-gray-400 mt-1.5">Product grid (default) shows everything matching this section&apos;s rule. Individual cards always open their own page.</div>
              </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11.5px]">
              <div className="font-bold text-gray-900 mb-1.5 text-xs">Ready to publish</div>
              <div>Design: <b>{design?.name}</b></div>
              <div>Content: <b>{wiz.tab === 'rule' ? (wiz.ruleMode === 'pick' ? 'Saved rule' : `My rule — “${wiz.ruleName || d.title}”`) : wiz.tab === 'images' ? `${tiles.length} image${tiles.length === 1 ? '' : 's'}` : (design?.autoRules || []).find(r => r[0] === d.rule)?.[1] || d.rule}</b></div>
              <div>Display: <b>{SCOPES.find(x => x.key === screen)?.label} · {scopeValue}</b>{(window_.st || window_.en) ? <> · ⏱ {window_.st ? fmtDT(window_.st) : 'now'} → {window_.en ? fmtDT(window_.en) : 'no end'}</> : ' · always on'}</div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-5">
          <button onClick={() => wiz.step === 1 || (wiz.mode === 'edit' && wiz.step === 2) ? setWiz(null) : patch({ step: wiz.step - 1 })}
            className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600">
            {wiz.step === 1 || (wiz.mode === 'edit' && wiz.step === 2) ? 'Cancel' : '← Back'}
          </button>
          {wiz.step < 4 ? (
            <button onClick={next} disabled={wiz.step === 1 && !wiz.designId}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold disabled:opacity-40">
              Next · {['', 'Content', 'Display', 'Action'][wiz.step]} →
            </button>
          ) : (
            <button onClick={finish} disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: '#F8CB46', color: '#1A1D1F' }}>
              {saving ? 'Publishing…' : 'Publish — live in ~1 minute'}
            </button>
          )}
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
  const [wiz, setWiz] = useState(null);   // Add-Section wizard state (P2)
  const [analytics, setAnalytics] = useState(null);   // P5 — last-7-days per-section taps
  const [librarySections, setLibrarySections] = useState([]);
  // Manage Worlds (absorbed Home Builder) — the follower worlds (tabs).
  const [worlds, setWorlds] = useState([]);
  const [showWorlds, setShowWorlds] = useState(false);
  const [pages, setPages] = useState([]);   // custom pages (App Builder E)
  // Catalogue tree for the current world (fashion/furniture) — feeds the
  // "Category rail (pick from catalogue)" node picker.
  const [catTree, setCatTree] = useState([]);
  // Tag vocabulary for the current world — feeds the tile rule-builder's tag chips.
  const [worldTags, setWorldTags] = useState([]);

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

  // P5 — per-scope engagement (honest: section_events only; absent = no panel).
  useEffect(() => {
    setAnalytics(null);
    if (!scopeValue) return;
    adminApi.getSectionAnalytics({ days: 7, screen, scope_value: scopeValue })
      .then(res => { if (res.success) setAnalytics(res.data?.sections || []); })
      .catch(() => setAnalytics(null));
  }, [screen, scopeValue]);

  // Load the catalogue tree when the world has one (fashion/furniture).
  useEffect(() => {
    if (CAT_TREE_WORLDS.has(scopeValue)) {
      adminApi.getListingTree(scopeValue).then(res => {
        if (res.success) setCatTree(flattenTree(res.data?.tree || res.data || []));
      });
    } else {
      setCatTree([]);
    }
    if (scopeValue) {
      adminApi.listTagVocabulary?.(scopeValue)
        .then(res => { if (res?.success) setWorldTags((res.data?.tags || []).filter(t => t.status === 'active')); })
        .catch(() => setWorldTags([]));
    } else {
      setWorldTags([]);
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

  // ── Add-Section wizard (P2) — create / edit / finish ──────────────────────
  const openWizardCreate = () => setWiz({
    mode: 'create', step: 1, designId: null, tab: null,
    ruleMode: 'create', ruleDraft: {}, ruleName: '', preview: null, err: null,
    draft: {
      _tmp: `tmp_${Math.random().toString(36).slice(2, 8)}`, id: null,
      shelf_key: 'new_section', title: '', shelf_type: 'tiles', rule: 'static',
      item_type: null, category_key: null, item_limit: 8,
      position: shelves.length, enabled: true, starts_at: null, ends_at: null,
      config_json: { sub: '' },
    },
  });
  const openWizardEdit = (s) => {
    const did = resolveDesignId(s);
    const dsn = designById(did);
    if (!dsn) { toggleExpand(s); return; }   // unknown legacy shape → raw editor
    const fills = dsn.fills || ['auto'];
    const tab = (s.rule === 'library_products' && fills.includes('rule')) ? 'rule' : fills[0];
    setWiz({
      mode: 'edit', step: 2, designId: did, tab,
      ruleMode: 'pick', ruleDraft: {}, ruleName: '', preview: null, err: null,
      draft: JSON.parse(JSON.stringify({ ...s, config_json: { ...(s.config_json || {}), design: did } })),
    });
  };
  const wizardFinish = (final, isEdit) => {
    const list = isEdit
      ? shelves.map(x => rowId(x) === rowId(final) ? final : x)
      : [...shelves, final];
    setShelves(list);
    setWiz(null);
    publishList(list);
  };

  const removeShelf = async (s) => {
    if (!s.id) { setShelves(prev => prev.filter(x => rowId(x) !== rowId(s))); return; } // unsaved draft
    if (!confirm(`Remove "${s.title}"? This hides it from the app.`)) return;
    const res = await sectionApi.deleteSection(s.id);
    if (res.success) setShelves(prev => prev.filter(x => x.id !== s.id));
    else setMsg({ kind: 'err', text: res.error?.message || 'Delete failed' });
  };

  const publishList = async (list) => {
    // Every section must be named — the title is the name shown in the app.
    const unnamed = list.find(s => !String(s.title || '').trim());
    if (unnamed) { setMsg({ kind: 'err', text: 'Give every section a name (shown in the app) before publishing.' }); return; }
    // Phase 3c — a Library Section placement must reference a section.
    const unset = list.find(s => s.rule === 'library_products' && !(s.config_json || {}).library_section_id);
    if (unset) { setMsg({ kind: 'err', text: `"${unset.title || 'Library Section'}" — pick a library section before publishing.` }); return; }
    // Phase 6 — a Banner-Gateway placement needs a headline.
    const unsetBanner = list.find(s => (s.config_json || {}).presentation_type === 'banner' && !((s.config_json || {}).banner || {}).headline);
    if (unsetBanner) { setMsg({ kind: 'err', text: `"${unsetBanner.title || 'Banner'}" — add a banner headline before publishing.` }); return; }
    // Phase 0 — catch backend-rejected tap destinations with a plain message.
    for (const s of list) {
      const cj = s.config_json || {};
      const tdErr = tapDestinationProblem(cj.tap_destination) ||
        (cj.tiles || []).map(t => tapDestinationProblem(t.tap_destination)).find(Boolean);
      if (tdErr) { setMsg({ kind: 'err', text: `"${s.title || 'Section'}" — ${tdErr}` }); return; }
    }
    setSaving(true); setMsg(null);
    const payload = {
      scope_type: scopeType,
      scope_value: scopeType === 'global' ? null : (scopeValue || null),
      shelves: list.map((s, i) => ({
        id: s.id || undefined, shelf_key: s.shelf_key, title: s.title, shelf_type: s.shelf_type,
        rule: s.rule, item_type: s.item_type, category_key: s.category_key,
        item_limit: Number(s.item_limit), position: i, enabled: s.enabled !== false,
        pinned_ref: s.pinned_ref, config_json: s.config_json,
        starts_at: s.starts_at || null, ends_at: s.ends_at || null,   // mig 124
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
  const publish = () => publishList(shelves);

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
        {/* P5 — city override: a city's stack rides ON TOP of the page for
            followers in that city (same-named sections replaced, new ones added). */}
        <span className="ml-2 pl-3 border-l border-gray-200 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-500">📍 City override</span>
          <input value={cityDraft} onChange={e => setCityDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && cityDraft.trim()) { setScopeType('city'); setScopeValue(cityDraft.trim().toLowerCase()); } }}
            placeholder="e.g. vijayawada ⏎"
            className="text-[11px] border border-gray-300 rounded-lg px-2 py-1 w-32" />
          {scopeType === 'city' && (
            <>
              <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-blue-50 text-blue-700">editing the {String(scopeValue).toUpperCase()} stack</span>
              <button onClick={() => { setCityDraft(''); setScopeType('vertical'); setScopeValue(''); }}
                className="text-[11px] text-gray-400">✕ back to worlds</button>
            </>
          )}
        </span>
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

      {/* P5 — 📊 last-7-days engagement for this scope (real section_events only) */}
      {scopeValue && !loading && analytics && analytics.length > 0 && (
        <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs font-bold text-gray-900 mb-1.5">📊 Last 7 days — taps per section</div>
          <table className="w-full text-xs">
            <thead><tr className="text-[10px] uppercase text-gray-400 text-left">
              <th className="py-1">Section</th><th className="text-right">Taps</th><th className="text-right">See-all</th><th className="text-right">People</th></tr></thead>
            <tbody>
              {analytics.map(a => {
                const shelf = shelves.find(s => s.shelf_key === a.section_key);
                return (
                  <tr key={a.section_key} className="border-t border-gray-100">
                    <td className="py-1.5">{shelf?.title || a.section_key}</td>
                    <td className="text-right font-bold">{a.taps}</td>
                    <td className="text-right">{a.see_alls}</td>
                    <td className="text-right">{a.unique_followers}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-[10px] text-gray-400 mt-1.5">Counting started with this release — every number is a real recorded tap.</div>
        </div>
      )}
      {scopeValue && !loading && analytics && analytics.length === 0 && (
        <div className="mb-3 text-[11px] text-gray-400">📊 No taps recorded yet for this scope (counting started with this release).</div>
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
                      placeholder="Name this section — shown in the app (e.g. Summer Deals)"
                      className="w-full text-sm font-bold text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-amber-500 focus:outline-none bg-transparent placeholder:text-gray-300 placeholder:font-normal" />
                    <div className="text-[11px] text-gray-500 truncate flex items-center gap-1.5">
                      <span className="truncate">{templateLabel(s)}{s.id ? '' : ' · NEW'}</span>
                      {sectionKind(s) === 'frame'
                        ? <span className="shrink-0 text-[9px] font-bold rounded px-1.5 py-0.5 bg-pink-50 text-pink-600">NEEDS A RULE</span>
                        : sectionKind(s) === 'data'
                        ? <span className="shrink-0 text-[9px] font-bold rounded px-1.5 py-0.5 bg-green-50 text-green-700">NO RULE</span>
                        : null}
                      {(() => { const c = scheduleChip(s); return c ? <span className={`shrink-0 text-[9px] font-bold rounded-full px-1.5 py-0.5 ${c.cls}`}>⏱ {c.text}</span> : null; })()}
                    </div>
                  </div>
                  <button onClick={() => openWizardEdit(s)} title="Edit in the wizard"
                    className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-500">✏️</button>
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
                    {/* What fills it (rule) — only for data-driven templates with a choice */}
                    {RULES_BY_SHELF[s.shelf_type] && (s.config_json || {}).kind !== 'menu' && (
                      <label className="text-[11px] font-semibold text-gray-600">What fills it? (rule)
                        <select value={s.rule} onChange={e => update(id, { rule: e.target.value })}
                          className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                          {RULES_BY_SHELF[s.shelf_type].map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                        </select>
                      </label>
                    )}
                    {/* On tap, go to… (App Builder D) — section-level; frames (tiles) use per-tile destinations below instead */}
                    {s.shelf_type !== 'tiles' && (
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
                          <select value={(cfg.tap_destination || {}).vertical || ''}
                            onChange={e => patchConfig(id, 'tap_destination', { ...(cfg.tap_destination || {}), vertical: e.target.value, category_node_id: undefined })}
                            className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                            <option value="">— pick a world —</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className="mt-1.5">
                            <CategoryNodePicker vertical={(cfg.tap_destination || {}).vertical || ''} value={(cfg.tap_destination || {}).category_node_id}
                              onChange={v => patchNested(id, 'tap_destination', 'category_node_id', v)} />
                          </div>
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
                    )}

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
                            <option value="themed_rail">Themed rail (scrollable)</option>
                          </select>
                        </label>
                        {/* Themed rail — frame look: background (colour/image), title align, tile size */}
                        {cfg.style === 'themed_rail' && (
                          <div className="rounded-md border border-amber-200 bg-amber-50/40 p-2 flex flex-col gap-2">
                            <div className="text-[11px] font-bold text-amber-800">Frame look</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold text-gray-500">Background</span>
                              <input type="color" value={(cfg.frame || {}).bg_color || '#ffffff'} onChange={e => patchNested(id, 'frame', 'bg_color', e.target.value)} className="w-8 h-7 border border-gray-300 rounded" />
                              {(cfg.frame || {}).bg_color ? <button type="button" onClick={() => patchNested(id, 'frame', 'bg_color', null)} className="text-[10px] text-gray-400">no colour</button> : null}
                              <label className="w-12 h-8 rounded border bg-white flex items-center justify-center overflow-hidden cursor-pointer text-[9px] text-gray-400" title="Upload frame background image">
                                {(cfg.frame || {}).bg_image_url ? <img src={(cfg.frame).bg_image_url} alt="" className="w-full h-full object-cover" /> : <span>＋ img</span>}
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const res = await uploadAdminStockImage(f); if (res.error) { setMsg({ kind: 'err', text: res.error.message || 'Upload failed' }); return; } patchNested(id, 'frame', 'bg_image_url', res.public_url); }} />
                              </label>
                              {(cfg.frame || {}).bg_image_url ? <button type="button" onClick={() => patchNested(id, 'frame', 'bg_image_url', null)} className="text-[10px] text-gray-400">remove img</button> : null}
                            </div>
                            <div className="text-[10px] text-gray-400">Image wins over colour. Both blank → white shell.</div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-gray-500">Title</span>
                              {[['left', 'Left'], ['center', 'Center']].map(([v, l]) => (
                                <button key={v} type="button" onClick={() => patchNested(id, 'frame', 'title_align', v)}
                                  className={`text-[10px] font-bold rounded px-2.5 py-0.5 border ${((cfg.frame || {}).title_align || 'left') === v ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-500 border-gray-300'}`}>{l}</button>
                              ))}
                              <span className="text-[10px] font-semibold text-gray-500 ml-2">Tiles</span>
                              {[['medium', 'Small'], ['large', 'Big']].map(([v, l]) => (
                                <button key={v} type="button" onClick={() => patchNested(id, 'tile', 'size', v)}
                                  className={`text-[10px] font-bold rounded px-2.5 py-0.5 border ${((cfg.tile || {}).size || 'medium') === v ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-500 border-gray-300'}`}>{l}</button>
                              ))}
                            </div>
                          </div>
                        )}
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
                          {(cfg.timer || {}).ends_at && new Date((cfg.timer).ends_at).getTime() < Date.now() ? (
                            <div className="text-[10px] font-bold text-red-600">⚠ This end time is in the past — the countdown won’t show. Set a future time to run a timer.</div>
                          ) : (
                            <div className="text-[10px] text-gray-400">When it hits zero, the countdown just stops showing — the frame stays visible.</div>
                          )}
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
                              <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 flex flex-col gap-2">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Show products where — combine any</div>
                                {CAT_TREE_WORLDS.has(scopeValue) && (
                                  <label className="text-[11px] font-semibold text-gray-600">Category
                                    <select value={rj.subcategory_node_id || ''}
                                      onChange={e => { const n = catTree.find(x => x.id === e.target.value); patchTileRule(id, ti, 'subcategory_node_id', e.target.value || undefined); patchTileRule(id, ti, 'subcategory_label', n ? n.name : undefined); }}
                                      className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                                      <option value="">Any category</option>
                                      {catTree.map(n => <option key={n.id} value={n.id}>{' '.repeat(n.depth * 2)}{n.name}</option>)}
                                    </select>
                                  </label>
                                )}
                                <label className="text-[11px] font-semibold text-gray-600">Brand
                                  <input value={rj.brand || ''} onChange={e => patchTileRule(id, ti, 'brand', e.target.value || undefined)} placeholder="e.g. Adidas" className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" />
                                </label>
                                <div className="flex gap-2">
                                  <label className="flex-1 text-[11px] font-semibold text-gray-600">Price under ₹
                                    <input type="number" value={rj.price_max ?? ''} onChange={e => patchTileRule(id, ti, 'price_max', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="e.g. 499" className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" />
                                  </label>
                                  <label className="flex-1 text-[11px] font-semibold text-gray-600">Above ₹ <span className="text-gray-400 font-normal">(optional)</span>
                                    <input type="number" value={rj.price_min ?? ''} onChange={e => patchTileRule(id, ti, 'price_min', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="e.g. 0" className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" />
                                  </label>
                                </div>
                                <label className="text-[11px] font-semibold text-gray-600">At least % off
                                  <input type="number" value={rj.min_discount_pct ?? ''} onChange={e => patchTileRule(id, ti, 'min_discount_pct', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="e.g. 40" className="mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1" />
                                </label>
                                {worldTags.length > 0 && (
                                  <div className="text-[11px] font-semibold text-gray-600">Tags
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {worldTags.map(tag => {
                                        const on = (rj.tags || []).includes(tag.slug);
                                        return (
                                          <button key={tag.slug} type="button"
                                            onClick={() => patchTileRule(id, ti, 'tags', on ? (rj.tags || []).filter(x => x !== tag.slug) : [...(rj.tags || []), tag.slug])}
                                            className={`text-[10px] font-semibold rounded-full px-2.5 py-0.5 border ${on ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'}`}>{tag.label}</button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                <label className="text-[11px] text-gray-600 flex items-center gap-1.5"><input type="checkbox" checked={!!rj.has_offer} onChange={e => patchTileRule(id, ti, 'has_offer', e.target.checked || undefined)} /> Only products with a live offer</label>
                                <div className="flex items-center gap-1.5 pt-1.5 border-t border-amber-200">
                                  <input value={t.__saveName || ''} onChange={e => updateTile(id, ti, { __saveName: e.target.value })} placeholder="Save as… (e.g. Jeans under ₹499)" className="flex-1 text-[11px] border border-gray-300 rounded px-2 py-1" />
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
                            {/* When tapped, show… (per-tile destination) */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-gray-200">
                              <span className="text-[10px] font-semibold text-gray-500">On tap →</span>
                              <select value={(t.tap_destination || {}).type || 'grid'}
                                onChange={e => updateTile(id, ti, { tap_destination: { ...(t.tap_destination || {}), type: e.target.value } })}
                                className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white">
                                <option value="grid">Product grid (this tile&apos;s rule)</option>
                                <option value="category">Category browser</option>
                                <option value="page">A page</option>
                              </select>
                              {(t.tap_destination || {}).type === 'category' && (
                                <>
                                  <select value={(t.tap_destination || {}).vertical || ''}
                                    onChange={e => updateTile(id, ti, { tap_destination: { ...(t.tap_destination || {}), vertical: e.target.value, category_node_id: undefined } })}
                                    className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white">
                                    <option value="">— world —</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <CategoryNodePicker vertical={(t.tap_destination || {}).vertical || ''} value={(t.tap_destination || {}).category_node_id}
                                    onChange={v => updateTile(id, ti, { tap_destination: { ...(t.tap_destination || {}), category_node_id: v } })} />
                                </>
                              )}
                              {(t.tap_destination || {}).type === 'page' && (
                                <select value={(t.tap_destination || {}).page_key || ''} onChange={e => updateTile(id, ti, { tap_destination: { ...(t.tap_destination || {}), page_key: e.target.value } })}
                                  className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white">
                                  <option value="">— page —</option>
                                  {pages.filter(p => p.enabled !== false).map(p => <option key={p.id} value={p.key}>{p.label}</option>)}
                                </select>
                              )}
                            </div>
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
                    {/* Schedule (mig 124) — live window; expired sections leave the app silently */}
                    <div className="flex gap-3 flex-wrap items-end rounded-lg border border-gray-200 bg-gray-50 p-2">
                      <label className="text-[11px] font-semibold text-gray-600">Goes live
                        <input type="datetime-local" value={toLocalInput(s.starts_at)}
                          onChange={e => update(id, { starts_at: fromLocalInput(e.target.value) })}
                          className="mt-0.5 text-xs border border-gray-300 rounded px-2 py-1 block bg-white" />
                      </label>
                      <label className="text-[11px] font-semibold text-gray-600">Disappears
                        <input type="datetime-local" value={toLocalInput(s.ends_at)}
                          onChange={e => update(id, { ends_at: fromLocalInput(e.target.value) })}
                          className="mt-0.5 text-xs border border-gray-300 rounded px-2 py-1 block bg-white" />
                      </label>
                      <span className="text-[10px] text-gray-400 pb-1">empty = always on · after “Disappears” the section leaves the app silently</span>
                      {(() => {
                        const w = scheduleWarning(s.starts_at, s.ends_at);
                        return w ? <div className={`w-full text-[11px] font-bold ${w.kind === 'err' ? 'text-red-600' : 'text-amber-700'}`}>{w.text}</div> : null;
                      })()}
                    </div>

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

      {/* ＋ Add Section — opens the 4-step wizard (Design · Content · Display · Action) */}
      {!loading && !(scopeNeedsValue && !scopeValue) && (
        <div className="flex items-center gap-2 mt-4">
          <button onClick={openWizardCreate}
            className="px-4 py-2 rounded-lg border-2 border-dashed border-amber-600 text-amber-700 text-xs font-bold">
            ＋ Add section
          </button>
          <span className="text-[11px] text-gray-400">guided: 1 Design · 2 Content · 3 Display · 4 Action</span>
        </div>
      )}
      </div>

      <AddSectionWizard wiz={wiz} setWiz={setWiz} scopeValue={scopeValue} screen={screen}
        catTree={catTree} worldTags={worldTags} pages={pages} worldSections={worldSections}
        onFinish={wizardFinish} saving={saving} />

      {/* Live mobile preview — how the sections look in the app */}
      <MobilePreview shelves={shelves} scopeValue={scopeValue} />
    </div>
  );
}
