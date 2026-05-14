'use client';

import { useState, useEffect, useMemo } from 'react';
import { brandApi } from '../../../../../lib/api';
import GalleryPicker from '../../../gallery/components/GalleryPicker';

/**
 * SalonServiceInlinePicker — Phase Salon-1 inline-expand multi-pick flow.
 *
 * Replaces the previous 3-step salon authoring (service_picker →
 * service_specs → service_pricing). One step now does all three:
 *
 *   1. Master grid stays visible the entire time.
 *   2. Tap an unpicked master service → it's added as a wizardItem with
 *      auto-filled defaults; the inline editor panel opens below the grid
 *      with focus on that item.
 *   3. Tap a picked service → toggles the inline editor for that item
 *      (collapses if already open, opens if not).
 *   4. The inline editor shows all per-service fields (price, duration,
 *      gender, premium, stylist-choice toggle, stylists, inclusions,
 *      before/after photos).
 *   5. "Remove" button on the editor unpicks the service.
 *
 * Per-service tap count drops from ~12 (across 3 steps with full re-renders)
 * to ~3 (pick → set price → done). Matches the Luzo authoring speed pitch
 * while keeping per-service detail control salon owners actually use.
 *
 * Field-name aliasing — same as SalonMasterPicker. salon.json's
 * storage_format references master_row.service_name + master_row.section,
 * but master_salon_services columns are name + category. We alias on pick.
 *
 * Multi-add flow uses wizardItems (the layout's per-item state). publish-
 * Driver iterates them and POSTs one brand_products row each. The layout's
 * handleItemAdd was extended in Phase Salon-1 to accept an initial-state
 * arg; pickers now seed populated items in a single call.
 *
 * Why "expanded below the grid" instead of inline-inside-the-grid:
 *   Responsive grid layouts make per-row expansion fiddly across breakpoints
 *   (single-col mobile vs two-col tablet vs three-col desktop). One
 *   single-instance editor panel beneath the grid is simpler, focuses
 *   attention, and matches mobile salon POS patterns more closely.
 */

export default function SalonServiceInlinePicker({
  step, template, wizardState, wizardItems,
  onItemAdd, onItemRemove, onItemFieldChange,
}) {
  // ── Master catalogue load ──────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await brandApi.get('/brands/me/master-catalogue');
        if (cancelled) return;
        if (res.success && res.data?.items) {
          setItems(res.data.items);
        } else {
          setError(res.error?.message || 'Failed to load services');
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load services');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [sectionFilter, setSectionFilter] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const sections = useMemo(() => {
    const set = new Set(items.map(i => i.category).filter(Boolean));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    if (!sectionFilter) return items;
    return items.filter(i => i.category === sectionFilter);
  }, [items, sectionFilter]);

  // master_id → idx in wizardItems, for the "is this picked?" lookup
  const pickedByMasterId = useMemo(() => {
    const map = new Map();
    wizardItems.forEach((it, idx) => {
      const id = it?._master_row?.id;
      if (id) map.set(id, idx);
    });
    return map;
  }, [wizardItems]);

  // ── Pick / unpick / toggle expand ──────────────────────────────────────────
  function handleMasterTap(masterRow) {
    if (masterRow.is_activated) return;   // already added to brand_products in a prior session

    const existingIdx = pickedByMasterId.get(masterRow.id);

    if (existingIdx != null) {
      // Already picked in this wizard session → toggle the editor.
      setExpandedIdx(prev => prev === existingIdx ? null : existingIdx);
      return;
    }

    // Not yet picked → add with auto-filled defaults; expand the editor.
    const aliasedRow = {
      ...masterRow,
      service_name: masterRow.name,
      section: masterRow.category,
    };
    const initial = {
      _master_row: aliasedRow,
      name: masterRow.name,                                 // also persists at top-level for publishDriver fallback
      section: masterRow.category,
      duration_mins: masterRow.duration_mins_default || 30,
      gender: titlecase(masterRow.gender) || 'Unisex',
      premium: false,
      requires_stylist_choice: false,
      available_stylist_ids: [],
      inclusions: [],
      before_after_images: [],
      description: masterRow.default_description || '',
      price: null,                                          // brand must set
    };

    const newIdx = wizardItems.length;
    onItemAdd(initial);
    setExpandedIdx(newIdx);
  }

  function handleRemovePicked(idx) {
    onItemRemove(idx);
    setExpandedIdx(prev => {
      if (prev === idx) return null;
      if (prev != null && prev > idx) return prev - 1;
      return prev;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-400">Loading services…</div>;
  }
  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>;
  }
  if (items.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">No master services available.</div>;
  }

  const teamMembers = Array.isArray(wizardState.team_members) ? wizardState.team_members : [];
  const expandedItem = expandedIdx != null ? wizardItems[expandedIdx] : null;
  const expandedMaster = expandedItem?._master_row;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title || 'Pick & price your services'}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>

      {/* Status strip */}
      {wizardItems.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-xs text-purple-800">
          ✓ {wizardItems.length} service{wizardItems.length === 1 ? '' : 's'} picked
          {' · '}
          <span className="text-purple-600">Tap any picked card to edit its price and details below.</span>
        </div>
      )}

      {/* Section filter pills */}
      <div className="flex gap-2 flex-wrap">
        <FilterPill active={!sectionFilter} onClick={() => setSectionFilter(null)}>
          All ({items.length})
        </FilterPill>
        {sections.map(s => {
          const count = items.filter(i => i.category === s).length;
          return (
            <FilterPill key={s} active={sectionFilter === s} onClick={() => setSectionFilter(s)}>
              {s} ({count})
            </FilterPill>
          );
        })}
      </div>

      {/* Master grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filtered.map(svc => {
          const isPicked = pickedByMasterId.has(svc.id);
          const isExpanded = isPicked && pickedByMasterId.get(svc.id) === expandedIdx;
          const isActivated = !!svc.is_activated;
          const pickedItem = isPicked ? wizardItems[pickedByMasterId.get(svc.id)] : null;

          return (
            <button key={svc.id} type="button"
              onClick={() => handleMasterTap(svc)}
              disabled={isActivated}
              className={`text-left rounded-xl border-2 overflow-hidden transition-all
                ${isActivated
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                  : isExpanded
                    ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-200'
                    : isPicked
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-purple-400'}`}>
              <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                {svc.image_url
                  ? <img src={svc.image_url} alt={svc.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-3xl">💇</div>}
                {isPicked && !isActivated && (
                  <div className="absolute top-1 right-1 px-2 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-bold">
                    ✓ Picked
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <div className="text-xs font-bold text-gray-900 truncate">{svc.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {svc.category} · {svc.duration_mins_default}m
                </div>
                {isActivated ? (
                  <div className="text-[10px] text-amber-600 font-semibold mt-1">
                    Already added at ₹{Number(svc.activated_price || 0).toLocaleString('en-IN')}
                  </div>
                ) : pickedItem && pickedItem.price ? (
                  <div className="text-[10px] text-purple-700 font-bold mt-1">
                    ₹{Number(pickedItem.price).toLocaleString('en-IN')}
                  </div>
                ) : isPicked ? (
                  <div className="text-[10px] text-amber-600 font-semibold mt-1">
                    Tap to set price ↓
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-6 text-center text-sm text-gray-400">No services in this section.</div>
      )}

      {/* Inline editor panel */}
      {expandedItem && expandedMaster && (
        <InlineEditor
          idx={expandedIdx}
          item={expandedItem}
          master={expandedMaster}
          template={template}
          teamMembers={teamMembers}
          onChange={(key, val) => onItemFieldChange(expandedIdx, key, val)}
          onRemove={() => handleRemovePicked(expandedIdx)}
          onClose={() => setExpandedIdx(null)}
        />
      )}
    </div>
  );
}

// ── Inline editor ────────────────────────────────────────────────────────────

function InlineEditor({ idx, item, master, template, teamMembers, onChange, onRemove, onClose }) {
  const attrs = template?.attributes_schema || {};
  const benchMin = master?.price_min;
  const benchMax = master?.price_max;
  const showBenchmark = benchMin != null && benchMax != null;

  return (
    <div className="border-2 border-purple-300 rounded-2xl bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border-b border-purple-200">
        <div className="w-12 h-12 rounded-lg bg-white overflow-hidden flex items-center justify-center text-xl flex-shrink-0">
          {master.image_url
            ? <img src={master.image_url} alt={master.name} className="w-full h-full object-cover" />
            : '💇'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-purple-900 truncate">{master.name}</div>
          <div className="text-[10px] text-purple-600">{master.category} · master default {master.duration_mins_default}m</div>
        </div>
        <button type="button" onClick={onClose}
          className="text-purple-500 hover:text-purple-700 text-lg leading-none px-2">−</button>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-4">
        {/* Price + duration row */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Your price" required>
            <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-400">
              <div className="px-3 py-2.5 text-sm text-gray-500 border-r border-gray-200 bg-gray-50">₹</div>
              <input type="number" value={item.price ?? ''}
                onChange={e => onChange('price', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="0"
                className="flex-1 px-3 py-2.5 text-sm font-semibold outline-none" />
            </div>
            {showBenchmark ? (
              <p className="text-[10px] text-gray-500 mt-1">
                Suggested ₹{benchMin}–{benchMax}
              </p>
            ) : null}
          </Field>
          <Field label="Duration">
            <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-400">
              <input type="number" value={item.duration_mins ?? ''}
                onChange={e => onChange('duration_mins', e.target.value === '' ? null : Number(e.target.value))}
                placeholder={String(master.duration_mins_default || 30)}
                className="flex-1 px-3 py-2.5 text-sm font-semibold outline-none" />
              <div className="px-3 py-2.5 text-sm text-gray-500 border-l border-gray-200 bg-gray-50">min</div>
            </div>
          </Field>
        </div>

        {/* For whom + premium + stylist-choice toggles row */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="For">
            <select value={item.gender || 'Unisex'}
              onChange={e => onChange('gender', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400 bg-white">
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Unisex">Unisex</option>
            </select>
          </Field>
          <div className="flex flex-col gap-2 pt-5">
            <Toggle
              label="✨ Premium service"
              checked={!!item.premium}
              onChange={v => onChange('premium', v)}
            />
            <Toggle
              label="Buyer picks stylist"
              checked={!!item.requires_stylist_choice}
              onChange={v => onChange('requires_stylist_choice', v)}
            />
          </div>
        </div>

        {/* Stylist multi-select (visible when buyer-picks-stylist OR when team_members exist
            so the brand can assign a default subset). */}
        {teamMembers.length > 0 && (
          <Field
            label={attrs.available_stylist_ids?.label || 'Stylists offering this service'}
            hint={item.requires_stylist_choice
              ? 'Buyer will choose from these stylists at booking time'
              : 'Pick which stylists can deliver this (or leave empty = any)'}>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map(tm => {
                const active = (item.available_stylist_ids || []).includes(tm.id);
                return (
                  <button key={tm.id} type="button"
                    onClick={() => {
                      const cur = item.available_stylist_ids || [];
                      const next = active ? cur.filter(v => v !== tm.id) : [...cur, tm.id];
                      onChange('available_stylist_ids', next);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-all
                      ${active
                        ? 'border-purple-400 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <span className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-[10px]">
                      {tm.photo_url
                        ? <img src={tm.photo_url} alt="" className="w-full h-full object-cover" />
                        : '💇'}
                    </span>
                    {tm.name || 'Unnamed'}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* Description */}
        <Field label="Description" hint="A short line followers see">
          <textarea value={item.description || ''}
            onChange={e => onChange('description', e.target.value)}
            placeholder={master.default_description || 'e.g. Includes wash, cut, blow-dry'}
            rows={2}
            maxLength={attrs.description?.max || 280}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400 resize-none" />
        </Field>

        {/* Inclusions chips input */}
        <Field
          label={attrs.inclusions?.label || "What's included"}
          hint="Comma-separated (e.g. Wash, Cut, Blow-dry)">
          <input type="text"
            value={Array.isArray(item.inclusions) ? item.inclusions.join(', ') : ''}
            onChange={e => {
              const arr = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
              onChange('inclusions', arr);
            }}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400" />
        </Field>

        {/* Before / after photos */}
        <BeforeAfterField
          label={attrs.before_after_images?.label || 'Before / After photos'}
          max={attrs.before_after_images?.max || 6}
          value={item.before_after_images || []}
          onChange={next => onChange('before_after_images', next)}
        />

        {/* Remove */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <button type="button" onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 font-semibold">
            Remove this service
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-lg">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Local sub-components ─────────────────────────────────────────────────────

function FilterPill({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
        ${active
          ? 'border-purple-500 bg-purple-50 text-purple-700'
          : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
      {children}
    </button>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1 italic">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-left">
      <span className={`w-9 h-5 rounded-full relative transition-colors
        ${checked ? 'bg-purple-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
          ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className="text-xs text-gray-700 font-medium">{label}</span>
    </button>
  );
}

function BeforeAfterField({ label, max, value, onChange }) {
  const [open, setOpen] = useState(false);
  const urls = Array.isArray(value) ? value : [];

  function handlePicked(assets) {
    const next = [...urls];
    for (const a of assets) {
      if (a?.download_url && !next.includes(a.download_url)) {
        if (next.length >= max) break;
        next.push(a.download_url);
      }
    }
    onChange(next);
  }

  function removeAt(idx) {
    onChange(urls.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 mb-2">
        <span className="text-[11px] text-gray-500">{urls.length} of {max} photos</span>
        <button type="button" onClick={() => setOpen(true)} disabled={urls.length >= max}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg
            ${urls.length >= max
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-purple-500 hover:bg-purple-600 text-white'}`}>
          {urls.length === 0 ? '+ Add photos' : '+ Add more'}
        </button>
      </div>
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url, idx) => (
            <div key={`${url}-${idx}`} className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative group border border-gray-200">
              <img src={url} alt={`Before/after ${idx + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeAt(idx)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <GalleryPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={handlePicked}
        multiple={true}
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function titlecase(s) {
  if (!s || typeof s !== 'string') return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
