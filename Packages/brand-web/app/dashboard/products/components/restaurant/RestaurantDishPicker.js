'use client';

import { useState, useEffect, useMemo } from 'react';
import { brandApi } from '../../../../../lib/api';
import GalleryPicker from '../../../gallery/components/GalleryPicker';
import BulkUploadCard from '../BulkUploadCard';
import CustomiseDishModal from './CustomiseDishModal';

/**
 * RestaurantDishPicker — step 4 component for restaurant authoring.
 *
 * Path-choice on entry: "Bulk Upload" or "Add Individually". Per chat
 * decision (single component with internal toggle, not two-step):
 *   - Bulk path mounts the shared BulkUploadCard. Backend endpoint is
 *     the existing /brands/me/products/bulk-upload — bypasses the master
 *     catalogue, accepts free-form rows.
 *   - Individual path: cuisine top-nav (filtered to brand's selected
 *     cuisines from step 1), section sub-nav, dish grid. Tap to add;
 *     pre-fills name + image + suggested_price (mid-point of master
 *     row's range). Inline edit for price; image swap mounts
 *     GalleryPicker for replacement.
 *
 * Already-activated dishes (per brand_products.master_dish_id) are greyed
 * with "Added at ₹X" — same pattern as SalonMasterPicker. Prevents
 * accidental double-add.
 *
 * No min_items gate — chat removed the validation. Brand can publish a
 * zero-item menu; admin moderation in next phase catches that.
 */

const PATH_CARDS = [
  { key: 'individual', icon: '🧑‍🍳', title: 'Add individually', sub: 'Browse popular dishes from our catalogue and tap to add — pre-filled name, image, and suggested pricing' },
  { key: 'bulk',       icon: '📤', title: 'Bulk upload via Excel', sub: 'Download our template, fill in your menu, upload — best for large existing menus' },
];

export default function RestaurantDishPicker({ step, template, brand, wizardState, wizardItems, onItemAdd, onItemRemove, onItemFieldChange, onRefreshProducts }) {
  const [path, setPath] = useState(null);   // null = path-choice screen; 'individual' | 'bulk' once chosen
  const [masterItems, setMasterItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cuisines added inline via the "Add cuisine" control (this session).
  const [addedCuisines, setAddedCuisines] = useState([]);
  const [savingCuisine, setSavingCuisine] = useState(false);
  const [showAddCuisine, setShowAddCuisine] = useState(false);

  // Inline "add your own item under this category" (custom dish not in the dictionary).
  const [showCustomTile, setShowCustomTile] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // The brand's cuisines. Seed from the in-session wizard value, ELSE from the
  // SAVED profile (brand.listing_data.cuisines) — so re-opening just to add menu
  // shows the brand's cuisines instead of "none". Union with cuisines added
  // inline this session. (Founder report 2026-06-07: add-menu showed "no dishes"
  // because saved cuisines were never loaded here.)
  const brandCuisines = useMemo(() => {
    const fromState = Array.isArray(wizardState.cuisines) && wizardState.cuisines.length
      ? wizardState.cuisines : null;
    const fromSaved = Array.isArray(brand?.listing_data?.cuisines)
      ? brand.listing_data.cuisines : [];
    return Array.from(new Set([...(fromState || fromSaved), ...addedCuisines]));
  }, [wizardState.cuisines, brand, addedCuisines]);

  const [activeCuisine, setActiveCuisine] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  // Bulk-upload state (mirrors layout's UploadView pattern)
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Image-swap state for inline edit on added items
  const [swapTargetIdx, setSwapTargetIdx] = useState(null);

  // Per-dish "Customise" modal (variations + add-on groups + badge + featured)
  const [customiseIdx, setCustomiseIdx] = useState(null);

  // Dish search (typeahead + custom add)
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Debounced fuzzy search against master_dishes (+ aliases)
  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await brandApi.get(`/brands/me/dishes/search?q=${encodeURIComponent(q)}`);
        if (!cancelled && res.success) setSearchResults(res.data?.matches || []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQ]);

  // ── Load master_dishes when entering Individual path ─────────────────────
  useEffect(() => {
    if (path !== 'individual' || masterItems.length > 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await brandApi.get('/brands/me/master-catalogue');
        if (cancelled) return;
        if (res.success && res.data?.items) {
          setMasterItems(res.data.items);
        } else {
          setError(res.error?.message || 'Failed to load dishes');
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load dishes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [path, masterItems.length]);

  // Filter master_items to brand's selected cuisines + group by cuisine → section
  const cuisinesAvailable = useMemo(() => {
    return brandCuisines.filter(c => masterItems.some(d => d.cuisine === c));
  }, [brandCuisines, masterItems]);

  // Cuisines our catalogue offers that the brand hasn't added yet — for the
  // inline "Add cuisine" control. Cuisine management lives WITH the menu (a
  // frequent activity), not behind "Edit business setup" (rare).
  const addableCuisines = useMemo(() => {
    const all = Array.from(new Set(masterItems.map(d => d.cuisine).filter(Boolean))).sort();
    return all.filter(c => !brandCuisines.includes(c));
  }, [masterItems, brandCuisines]);

  // Add a cuisine inline: reflect locally (its dishes are already loaded in
  // masterItems) AND persist to the brand profile so it sticks. Non-blocking —
  // a failed PATCH still shows the cuisine for this session.
  async function handleAddCuisine(c) {
    if (!c || brandCuisines.includes(c)) return;
    setAddedCuisines(prev => Array.from(new Set([...prev, c])));
    setActiveCuisine(c);
    setShowAddCuisine(false);
    setSavingCuisine(true);
    try {
      const nextCuisines = Array.from(new Set([...brandCuisines, c]));
      const merged = { ...(brand?.listing_data || {}), cuisines: nextCuisines };
      await brandApi.patch('/brands/me', { listing_data: merged });
    } catch { /* local state still reflects it */ }
    finally { setSavingCuisine(false); }
  }

  // Auto-select first cuisine on load
  useEffect(() => {
    if (path === 'individual' && !activeCuisine && cuisinesAvailable.length > 0) {
      setActiveCuisine(cuisinesAvailable[0]);
    }
  }, [path, activeCuisine, cuisinesAvailable]);

  const sectionsForCuisine = useMemo(() => {
    if (!activeCuisine) return [];
    const set = new Set(masterItems.filter(d => d.cuisine === activeCuisine).map(d => d.section));
    return Array.from(set);
  }, [activeCuisine, masterItems]);

  useEffect(() => {
    if (sectionsForCuisine.length > 0) {
      setActiveSection(prev => sectionsForCuisine.includes(prev) ? prev : sectionsForCuisine[0]);
    } else {
      setActiveSection(null);
    }
  }, [sectionsForCuisine]);

  const dishesForSection = useMemo(() => {
    if (!activeCuisine || !activeSection) return [];
    return masterItems.filter(d => d.cuisine === activeCuisine && d.section === activeSection);
  }, [activeCuisine, activeSection, masterItems]);

  // ── Item operations ─────────────────────────────────────────────────────

  function handleAddDish(masterRow) {
    if (masterRow.is_activated) return;   // prevent double-add per chat lock-in

    // Suggested price = mid-point of master row's range (rounded down to 5)
    const min = Number(masterRow.suggested_price_min) || 0;
    const max = Number(masterRow.suggested_price_max) || 0;
    const suggested = max > min ? Math.floor((min + max) / 2 / 5) * 5 : (min || max || 0);

    onItemAdd({
      _master_row: masterRow,
      name: masterRow.name,
      price: suggested, // master mid-range as an editable hint; owner confirms/changes
      image_url: null,  // blank — the owner adds their OWN photo (no stock/dummy image)
      description: masterRow.default_description,
      section: masterRow.section,
    });
  }

  function isAddedFromMaster(masterRow) {
    return wizardItems.some(item => item._master_row?.id === masterRow.id);
  }

  // Add a canonical dish picked from the fuzzy-search dropdown. Carries
  // _master_row so publishDriver maps master_dish_id (links to the catalogue).
  function handleAddFromSearch(match) {
    if (match.is_activated) return;
    // Flywheel custom suggestion (another restaurant's typed dish): no canonical
    // id → add as a custom dish (master_dish_id stays null → re-captured into the
    // flywheel under this brand, growing the cross-restaurant count).
    if (match.is_custom || !match.id) {
      onItemAdd({
        name: match.name, price: 0, image_url: null, description: null,
        section: match.section || activeSection || null, _custom: true,
      });
    } else {
      onItemAdd({
        _master_row: { id: match.id, name: match.name, section: match.section },
        name: match.name, price: 0, image_url: null, description: null, section: match.section,
      });
    }
    setSearchQ('');
    setSearchResults([]);
  }

  // Add the seller's own wording verbatim. No _master_row → master_dish_id
  // stays null → backend captures it into the review queue (goes live anyway).
  function handleAddCustom() {
    const nm = searchQ.trim();
    if (!nm) return;
    onItemAdd({
      name: nm,
      price: 0,
      image_url: null,
      description: null,
      section: activeSection || sectionsForCuisine[0] || null,
      _custom: true,
    });
    setSearchQ('');
    setSearchResults([]);
  }

  function handleSwapImage(picked) {
    if (swapTargetIdx == null || picked.length === 0) return;
    onItemFieldChange(swapTargetIdx, 'image_url', picked[0].download_url);
    setSwapTargetIdx(null);
  }

  // Add the seller's own unique item UNDER the currently-open cuisine + category
  // (not in the dictionary). master_dish_id stays null → goes live + into the
  // admin review queue (flywheel), exactly like the search-box custom add.
  function handleAddCustomInSection() {
    const nm = customName.trim();
    if (!nm) return;
    onItemAdd({
      name: nm,
      price: customPrice === '' ? 0 : Number(customPrice),
      image_url: null,
      description: null,
      section: activeSection || sectionsForCuisine[0] || null,
      _custom: true,
    });
    setCustomName(''); setCustomPrice(''); setShowCustomTile(false);
  }

  // ── Excel handlers (mirrors layout's pattern) ────────────────────────────
  async function handleDownloadTemplate() {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('inflx_token') : null;
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');
      const res = await fetch(`${apiBase}/brands/me/listing-template/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INFLX_${(template?.label || 'Restaurant').replace(/\s+/g, '_')}_Menu_Template.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Download failed: ' + e.message);
    }
  }

  async function handleBulkUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('inflx_token') : null;
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiBase}/brands/me/products/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      setUploadResult(json.data || json);
      if ((json.success || json.data?.created > 0) && onRefreshProducts) {
        await onRefreshProducts();
      }
    } catch (e) {
      setUploadResult({ errors: [e.message] });
    } finally {
      setUploading(false);
    }
  }

  // ── Render: path-choice screen ────────────────────────────────────────────

  if (!path) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{step.title || 'Add your menu'}</h2>
          {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
        </div>

        {wizardItems.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800">
            ✓ {wizardItems.length} dish{wizardItems.length === 1 ? '' : 'es'} added so far
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PATH_CARDS.map(card => (
            <button key={card.key} type="button" onClick={() => setPath(card.key)}
              className="text-left p-5 rounded-2xl border-2 border-gray-200 bg-white hover:border-orange-500 hover:bg-orange-50/50 transition-all">
              <div className="text-4xl mb-2">{card.icon}</div>
              <div className="text-base font-bold text-gray-900 mb-1">{card.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{card.sub}</div>
            </button>
          ))}
        </div>

        {wizardItems.length > 0 && (
          <button type="button" onClick={() => setPath('individual')}
            className="text-xs text-orange-600 hover:underline">
            View / edit added dishes ({wizardItems.length})
          </button>
        )}
      </div>
    );
  }

  // ── Render: Bulk path ─────────────────────────────────────────────────────

  if (path === 'bulk') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPath(null)}
            className="text-xs text-gray-500 hover:text-gray-700">← Back to choices</button>
          <h2 className="text-xl font-bold text-gray-900 flex-1">Bulk upload your menu</h2>
        </div>
        <BulkUploadCard
          labelPlural="menu items"
          uploading={uploading}
          uploadResult={uploadResult}
          onDownload={handleDownloadTemplate}
          onUpload={handleBulkUpload}
        />
        <p className="text-[10px] text-gray-400 italic">
          Bulk-uploaded rows are accepted as-is — they don't have to match the curated catalogue. (Admin moderation in a future phase will surface quality issues.)
        </p>
      </div>
    );
  }

  // ── Render: Individual path ──────────────────────────────────────────────

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading dishes…</div>;
  if (error) return (
    <div className="space-y-3">
      <button type="button" onClick={() => setPath(null)} className="text-xs text-gray-500 hover:text-gray-700">← Back</button>
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>
    </div>
  );

  if (cuisinesAvailable.length === 0) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setPath(null)} className="text-xs text-gray-500 hover:text-gray-700">← Back</button>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-3xl mb-2">🍽️</div>
          <div className="text-sm font-bold text-gray-900 mb-1">Pick a cuisine to start your menu</div>
          <div className="text-xs text-gray-500 mb-4">
            Choose a cuisine and we&rsquo;ll show popular dishes to add. You can add more cuisines anytime —
            no need to touch your business setup.
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {addableCuisines.length === 0 && (
              <span className="text-xs text-gray-400">Loading cuisines…</span>
            )}
            {addableCuisines.map(c => (
              <button key={c} type="button" disabled={savingCuisine} onClick={() => handleAddCuisine(c)}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50">
                ＋ {c}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => setPath('bulk')}
          className="text-xs text-orange-600 hover:underline">Or switch to Bulk Upload →</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setPath(null)}
          className="text-xs text-gray-500 hover:text-gray-700">← Back to choices</button>
        <h2 className="text-xl font-bold text-gray-900 flex-1">Add dishes</h2>
        <span className="text-xs text-gray-500">{wizardItems.length} added</span>
      </div>

      {/* Dish search — typeahead + add-your-own */}
      <div className="relative">
        <input
          type="text"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Search or type a dish…"
          className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-400 px-4 py-2.5 text-sm outline-none transition-colors" />
        {searchQ.trim().length >= 2 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {searching && <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>}
            {!searching && searchResults.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-50">Did you mean</div>
                {searchResults.map(m => (
                  <button key={m.id} type="button" disabled={m.is_activated}
                    onClick={() => handleAddFromSearch(m)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left ${m.is_activated ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-50'}`}>
                    <span className="flex-1 text-sm font-semibold text-gray-900">{m.name}</span>
                    <span className="text-[10px] text-gray-400">{m.section}</span>
                    {m.is_activated
                      ? <span className="text-[10px] text-amber-600 font-semibold">on menu</span>
                      : m.is_custom
                        ? <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{m.restaurant_count > 1 ? `${m.restaurant_count} restaurants` : 'added by a restaurant'}</span>
                        : <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{Math.round((m.score || 0) * 100)}%</span>}
                  </button>
                ))}
              </>
            )}
            <button type="button" onClick={handleAddCustom}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-orange-50 bg-orange-50/40 border-t border-gray-100">
              <span className="text-orange-600 text-lg leading-none">＋</span>
              <span className="flex-1 text-sm font-bold text-orange-700">Add &ldquo;{searchQ.trim()}&rdquo; as your own dish</span>
            </button>
          </div>
        )}
      </div>

      {/* Cuisine top-nav — your cuisines + add a new one inline (no business-setup trip) */}
      <div>
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Cuisine</div>
        <div className="flex gap-2 flex-wrap items-center">
          {cuisinesAvailable.map(c => (
            <button key={c} type="button" onClick={() => setActiveCuisine(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
                ${activeCuisine === c
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {c}
            </button>
          ))}
          {addableCuisines.length > 0 && (
            <div className="relative">
              <button type="button" onClick={() => setShowAddCuisine(v => !v)} disabled={savingCuisine}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-dashed border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50">
                ＋ Add cuisine
              </button>
              {showAddCuisine && (
                <div className="absolute z-20 left-0 mt-1 w-44 max-h-60 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg p-1">
                  {addableCuisines.map(c => (
                    <button key={c} type="button" onClick={() => handleAddCuisine(c)}
                      className="w-full text-left px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-orange-50 rounded-lg">
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section sub-nav */}
      {sectionsForCuisine.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Category</div>
          <div className="flex gap-2 flex-wrap">
            {sectionsForCuisine.map(s => (
              <button key={s} type="button" onClick={() => setActiveSection(s)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all
                  ${activeSection === s
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dish grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {dishesForSection.map(dish => {
          const added = isAddedFromMaster(dish);
          const activated = !!dish.is_activated;
          const disabled = activated;
          const suggested = dish.suggested_price_min && dish.suggested_price_max
            ? `₹${dish.suggested_price_min}–${dish.suggested_price_max}`
            : null;

          return (
            <button key={dish.id} type="button" disabled={disabled} onClick={() => handleAddDish(dish)}
              className={`text-left rounded-xl border-2 overflow-hidden transition-all
                ${disabled
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                  : added
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-400'}`}>
              <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                {dish.default_image_url
                  ? <img src={dish.default_image_url} alt={dish.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>}
                {added && !activated && (
                  <div className="absolute top-1 right-1 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                    ✓ Added
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <div className="text-xs font-bold text-gray-900 truncate">{dish.name}</div>
                {activated ? (
                  <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                    Already on menu — ₹{Number(dish.activated_price || 0).toLocaleString('en-IN')}
                  </div>
                ) : suggested ? (
                  <div className="text-[10px] text-gray-500 mt-0.5">Suggested {suggested}</div>
                ) : null}
              </div>
            </button>
          );
        })}
        {/* Add your own unique item under this category (not in the dictionary) */}
        {activeSection && (
          <div className="rounded-xl border-2 border-dashed border-orange-300 bg-orange-50/40 flex flex-col items-center justify-center p-3 min-h-[140px]">
            {!showCustomTile ? (
              <button type="button" onClick={() => setShowCustomTile(true)} className="text-center text-orange-600 hover:text-orange-700">
                <div className="text-2xl leading-none">＋</div>
                <div className="text-[11px] font-bold mt-1.5">Add your own<br />{activeSection} item</div>
                <div className="text-[9px] text-orange-400 mt-1">not in the list?</div>
              </button>
            ) : (
              <div className="w-full space-y-2">
                <input value={customName} autoFocus onChange={e => setCustomName(e.target.value)}
                  placeholder={`New ${activeSection} dish`}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400" />
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <span className="px-2 text-xs text-gray-500 bg-gray-50 border-r border-gray-200">₹</span>
                  <input type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)}
                    placeholder="price" className="w-full px-2 py-1.5 text-xs outline-none" />
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={handleAddCustomInSection} disabled={!customName.trim()}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50">Add</button>
                  <button type="button" onClick={() => { setShowCustomTile(false); setCustomName(''); setCustomPrice(''); }}
                    className="px-2 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {dishesForSection.length === 0 && !activeSection && (
          <div className="col-span-full py-6 text-center text-sm text-gray-400">Pick a category above.</div>
        )}
      </div>

      {/* Added dishes — inline edit */}
      {wizardItems.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2 mt-4">
            Added dishes ({wizardItems.length})
          </div>
          <div className="space-y-2">
            {wizardItems.map((item, idx) => {
              const needsPhoto = !item.image_url;
              const needsPrice = item.price == null || Number(item.price) <= 0;
              return (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                {/* Photo: owner's own — blank starts as an "Add photo" prompt, never a stock image */}
                <button type="button" onClick={() => setSwapTargetIdx(idx)}
                  title={needsPhoto ? 'Add your own photo' : 'Change photo'}
                  className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex flex-col items-center justify-center ${needsPhoto ? 'bg-stone-50 border-[1.5px] border-dashed border-stone-300 text-stone-400' : 'bg-gray-100 hover:ring-2 hover:ring-orange-300'}`}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    : <><span className="text-lg leading-none">📷</span><span className="text-[8px] font-bold mt-0.5">ADD PHOTO</span></>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-gray-900 truncate">{item.name}</div>
                    {!item._master_row && (
                      <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">NEW · pending review</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500">{item.section || item._master_row?.section}</div>
                  {(needsPhoto || needsPrice) && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      {needsPhoto && needsPrice ? '⚠ Add your photo & price' : needsPhoto ? '📷 Add your own photo' : '⚠ Set your price'}
                    </span>
                  )}
                </div>
                <div className={`flex items-center border rounded-lg overflow-hidden ${needsPrice ? 'border-yellow bg-yellow-50' : 'border-gray-200'}`}>
                  <span className="px-2 text-xs text-gray-500 bg-gray-50 border-r border-gray-200">₹</span>
                  <input type="number" value={item.price ?? ''} placeholder="0"
                    onChange={e => onItemFieldChange(idx, 'price', e.target.value === '' ? null : Number(e.target.value))}
                    className="w-20 px-2 py-1 text-xs font-semibold outline-none bg-transparent" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button type="button" onClick={() => setCustomiseIdx(idx)}
                    className={`text-xs font-semibold px-2 py-1 rounded-lg border whitespace-nowrap ${
                      (Array.isArray(item._addon_groups) && item._addon_groups.length) || item._badge || item._is_featured
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'}`}>
                    {(Array.isArray(item._addon_groups) && item._addon_groups.length) ? '✓ Customised' : 'Customise'}
                  </button>
                  <button type="button" onClick={() => onItemRemove(idx)}
                    className="text-red-400 hover:text-red-600 text-[11px] font-semibold">Remove</button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Image-swap GalleryPicker */}
      <GalleryPicker
        open={swapTargetIdx != null}
        onClose={() => setSwapTargetIdx(null)}
        onSelect={handleSwapImage}
        multiple={false}
      />

      {/* Per-dish Customise modal — variations + add-on groups + badge + featured */}
      {customiseIdx != null && wizardItems[customiseIdx] && (
        <CustomiseDishModal
          dish={wizardItems[customiseIdx]}
          initial={{
            addon_groups: wizardItems[customiseIdx]._addon_groups,
            badge: wizardItems[customiseIdx]._badge,
            is_featured: wizardItems[customiseIdx]._is_featured,
          }}
          menuItems={wizardItems
            .filter((_, i) => i !== customiseIdx)
            .map(it => ({ name: it.name, price: it.price, id: it._product_id || null }))}
          onSave={(custom) => {
            onItemFieldChange(customiseIdx, '_addon_groups', custom.addon_groups);
            onItemFieldChange(customiseIdx, '_badge', custom.badge);
            onItemFieldChange(customiseIdx, '_is_featured', custom.is_featured);
            setCustomiseIdx(null);
          }}
          onClose={() => setCustomiseIdx(null)}
        />
      )}
    </div>
  );
}
