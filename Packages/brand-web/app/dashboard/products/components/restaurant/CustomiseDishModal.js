'use client';

import { useState, useMemo } from 'react';

/**
 * CustomiseDishModal — Food World Phase 2 owner editor.
 * Contract: features/food-world-phase2-owner-editor.
 *
 * Per-dish builder for the unified customisation model (migration 113):
 *   - Variations  = single-select groups that SET the price (Half/Full).
 *   - Add-on groups = multi-select, "select up to N", priced as +delta.
 *   - Badge (free text) + Featured toggle on the dish.
 *
 * Edits a local draft and returns it via onSave({ addon_groups, badge,
 * is_featured }). The caller persists it (wizard → publishDriver after create;
 * existing dish → POST addon-groups + PATCH product directly).
 *
 * "Pull from my menu" prefills an add-on's name + price from another dish the
 * owner is listing (menuItems). source_product_id is recorded when the source
 * dish already has an id (existing products); null for not-yet-created wizard
 * rows — provenance only, never required.
 */

// Curated badge labels — a constrained dropdown (no free text) so owners pick a
// consistent, meaningful tag instead of typing something confusing.
const BADGE_OPTIONS = ['Popular', 'Bestseller', 'Must Try', "Chef's Special", 'Recommended', 'New'];
// Common variation group names (Half/Full → Portion; 250g/500g → Quantity; ...).
const VARIATION_NAME_SUGGESTIONS = ['Portion', 'Size', 'Quantity', 'Pieces', 'Plate', 'Servings'];

const blankVariationGroup = () => ({
  name: 'Portion', selection_type: 'single', is_variation: true, is_required: true,
  min_select: 1, max_select: 1,
  items: [{ name: '', price: '', is_default: true }],
});
const blankAddonGroup = () => ({
  name: '', selection_type: 'multi', is_variation: false, is_required: false,
  min_select: 0, max_select: 1,
  items: [{ name: '', price: '' }],
});

export default function CustomiseDishModal({ dish, menuItems = [], initial, onSave, onClose, showPrice = false }) {
  const init = initial || {};
  const [badge, setBadge] = useState(init.badge || '');
  const [isFeatured, setIsFeatured] = useState(init.is_featured === true);
  const [price, setPrice] = useState(init.price != null ? init.price : (dish?.price != null ? dish.price : ''));
  const [description, setDescription] = useState(init.description || '');
  const [groups, setGroups] = useState(() => {
    const g = Array.isArray(init.addon_groups) ? init.addon_groups : [];
    return g.map(x => ({
      ...x,
      items: (x.items || []).map(it => ({ ...it, price: it.price ?? '' })),
    }));
  });
  const [pullForGroup, setPullForGroup] = useState(null); // group index the picker is open for
  const [err, setErr] = useState(null);

  const variations = useMemo(() => groups.map((g, i) => ({ g, i })).filter(x => x.g.is_variation), [groups]);
  const addons     = useMemo(() => groups.map((g, i) => ({ g, i })).filter(x => !x.g.is_variation), [groups]);

  function patchGroup(i, patch) {
    setGroups(gs => gs.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function patchItem(gi, ii, patch) {
    setGroups(gs => gs.map((g, idx) => {
      if (idx !== gi) return g;
      return { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) };
    }));
  }
  function setDefault(gi, ii) {
    // single-select: exactly one default
    setGroups(gs => gs.map((g, idx) => {
      if (idx !== gi) return g;
      return { ...g, items: g.items.map((it, j) => ({ ...it, is_default: j === ii })) };
    }));
  }
  function addItem(gi) {
    setGroups(gs => gs.map((g, idx) => (idx === gi ? { ...g, items: [...g.items, { name: '', price: '' }] } : g)));
  }
  function removeItem(gi, ii) {
    setGroups(gs => gs.map((g, idx) => (idx === gi ? { ...g, items: g.items.filter((_, j) => j !== ii) } : g)));
  }
  function removeGroup(gi) { setGroups(gs => gs.filter((_, idx) => idx !== gi)); }
  function addVariationGroup() { setGroups(gs => [...gs, blankVariationGroup()]); }
  function addAddonGroup() { setGroups(gs => [...gs, blankAddonGroup()]); }

  function pickFromMenu(gi, menuItem) {
    setGroups(gs => gs.map((g, idx) => {
      if (idx !== gi) return g;
      const item = { name: menuItem.name, price: menuItem.price ?? '', source_product_id: menuItem.id || null };
      // Replace a trailing blank row if present, else append.
      const items = [...g.items];
      const last = items[items.length - 1];
      if (last && !String(last.name || '').trim()) items[items.length - 1] = item;
      else items.push(item);
      return { ...g, items };
    }));
    setPullForGroup(null);
  }

  function handleSave() {
    // Normalise + validate, mirroring the backend (productAddons.controller).
    const clean = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const name = String(g.name || '').trim();
      if (!name) { setErr('Every group needs a name.'); return; }
      const items = (g.items || [])
        .map(it => ({
          name: String(it.name || '').trim(),
          price: it.price === '' || it.price == null ? 0 : Number(it.price),
          is_default: it.is_default === true,
          source_product_id: it.source_product_id || null,
        }))
        .filter(it => it.name);
      if (!items.length) { setErr(`"${name}" needs at least one option.`); return; }
      if (items.some(it => !Number.isFinite(it.price) || it.price < 0)) {
        setErr(`"${name}" has an invalid price.`); return;
      }
      clean.push({
        name,
        selection_type: g.is_variation ? 'single' : 'multi',
        is_variation: g.is_variation === true,
        is_required: g.is_variation === true ? true : g.is_required === true,
        min_select: g.is_variation ? 1 : (Number(g.min_select) || 0),
        max_select: g.is_variation ? 1 : (g.max_select != null && g.max_select !== '' ? Number(g.max_select) : null),
        sort_order: i,
        items: items.map((it, j) => ({ ...it, sort_order: j })),
      });
    }
    if (showPrice && (price === '' || !(Number(price) >= 0))) { setErr('Enter a valid base price.'); return; }
    setErr(null);
    onSave({
      addon_groups: clean, badge: (badge || '').trim() || null, is_featured: isFeatured,
      ...(showPrice ? { price: Number(price), description: description.trim() || null } : {}),
    });
  }

  const inputCls = 'border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400';

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-start justify-center overflow-auto p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl my-6">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg">🍲</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">Customise — {dish?.name || 'dish'}</div>
            <div className="text-[11px] text-gray-400">base price ₹{Number(dish?.price || 0)}</div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <datalist id="variation-name-suggestions">
            {VARIATION_NAME_SUGGESTIONS.map(o => <option key={o} value={o} />)}
          </datalist>
          {/* Badge + Featured */}
          {showPrice && (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Base price (₹)</div>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
                  className={`${inputCls} w-40`} />
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Description (optional)</div>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                  placeholder="Taste, ingredients, what's special…" className={`${inputCls} w-full resize-none`} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <div className="text-[11px] text-gray-500 mb-1">Badge (optional)</div>
              <select value={badge} onChange={e => setBadge(e.target.value)} className={`${inputCls} w-full bg-white`}>
                <option value="">No badge</option>
                {BADGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <label className="text-center cursor-pointer">
              <div className="text-[11px] text-gray-500 mb-1">Featured dish</div>
              <button type="button" onClick={() => setIsFeatured(v => !v)}
                className={`w-10 h-6 rounded-full relative transition-colors ${isFeatured ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${isFeatured ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </label>
          </div>

          {/* Variations */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-gray-700">Variations</span>
              <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">pick one · sets price</span>
            </div>
            {variations.map(({ g, i }) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <input value={g.name} onChange={e => patchGroup(i, { name: e.target.value })}
                    list="variation-name-suggestions" placeholder="Portion" className={`${inputCls} w-40`} />
                  <span className="text-[10px] text-gray-400">required · single-select</span>
                  <button type="button" onClick={() => removeGroup(i)} className="ml-auto text-[11px] text-red-400 hover:text-red-600">Remove</button>
                </div>
                {g.items.map((it, ii) => (
                  <div key={ii} className="flex items-center gap-2 py-1">
                    <button type="button" onClick={() => setDefault(i, ii)} title="Default"
                      className={`w-4 h-4 rounded-full border-2 ${it.is_default ? 'border-green-500 bg-green-500' : 'border-gray-300'}`} />
                    <input value={it.name} onChange={e => patchItem(i, ii, { name: e.target.value })}
                      placeholder="Half / Full" className={`${inputCls} flex-1`} />
                    <span className="text-xs text-gray-500">₹</span>
                    <input type="number" value={it.price} onChange={e => patchItem(i, ii, { price: e.target.value })}
                      placeholder="0" className={`${inputCls} w-20`} />
                    {g.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i, ii)} className="text-gray-300 hover:text-red-500 text-sm">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addItem(i)} className="mt-1.5 text-[11px] text-orange-600 hover:underline">＋ Add option</button>
              </div>
            ))}
            <button type="button" onClick={addVariationGroup}
              className="text-[11px] font-semibold text-gray-600 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 hover:border-orange-400 hover:text-orange-600">
              ＋ Add variation group
            </button>
          </div>

          {/* Add-on groups */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-gray-700">Add-on groups</span>
              <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">stack on top</span>
            </div>
            {addons.map(({ g, i }) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <input value={g.name} onChange={e => patchGroup(i, { name: e.target.value })}
                    placeholder="Accompaniment / Beverage" className={`${inputCls} w-44`} />
                  <span className="text-[10px] text-gray-400">select up to</span>
                  <input type="number" value={g.max_select ?? ''} onChange={e => patchGroup(i, { max_select: e.target.value })}
                    placeholder="∞" className={`${inputCls} w-14 text-center`} />
                  <label className="text-[10px] text-gray-400 flex items-center gap-1">
                    <input type="checkbox" checked={g.is_required === true} onChange={e => patchGroup(i, { is_required: e.target.checked })} />
                    required
                  </label>
                  <button type="button" onClick={() => removeGroup(i)} className="ml-auto text-[11px] text-red-400 hover:text-red-600">Remove</button>
                </div>
                {g.items.map((it, ii) => (
                  <div key={ii} className="flex items-center gap-2 py-1">
                    <input value={it.name} onChange={e => patchItem(i, ii, { name: e.target.value })}
                      placeholder="Roti / Coke" className={`${inputCls} flex-1`} />
                    <span className="text-xs text-gray-500">+₹</span>
                    <input type="number" value={it.price} onChange={e => patchItem(i, ii, { price: e.target.value })}
                      placeholder="0" className={`${inputCls} w-20`} />
                    {g.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i, ii)} className="text-gray-300 hover:text-red-500 text-sm">✕</button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 mt-1.5 relative">
                  <button type="button" onClick={() => addItem(i)} className="text-[11px] text-orange-600 hover:underline">＋ Add item</button>
                  <button type="button" onClick={() => setPullForGroup(pullForGroup === i ? null : i)}
                    className="text-[11px] text-gray-600 hover:underline">⊞ Pull from my menu</button>
                  {pullForGroup === i && (
                    <div className="absolute top-6 left-0 z-10 w-56 max-h-52 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg p-1">
                      {menuItems.length === 0 && <div className="px-3 py-2 text-[11px] text-gray-400">No other dishes yet</div>}
                      {menuItems.map((m, mi) => (
                        <button key={mi} type="button" onClick={() => pickFromMenu(i, m)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-orange-50 rounded-lg">
                          <span className="flex-1 text-xs font-semibold text-gray-800 truncate">{m.name}</span>
                          <span className="text-[10px] text-gray-400">₹{Number(m.price || 0)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addAddonGroup}
              className="text-[11px] font-semibold text-gray-600 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 hover:border-orange-400 hover:text-orange-600">
              ＋ Add add-on group
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg px-3 py-2 text-[11px] text-gray-500">
            Customer sees: pick portion (Half / Full) → add Roti / Coke → live total updates
          </div>

          {err && <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
          <button type="button" onClick={handleSave}
            className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-4 py-1.5">Save customisation</button>
        </div>
      </div>
    </div>
  );
}
