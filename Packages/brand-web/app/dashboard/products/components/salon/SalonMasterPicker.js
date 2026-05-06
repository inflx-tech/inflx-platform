'use client';

import { useState, useEffect, useMemo } from 'react';
import { brandApi } from '../../../../../lib/api';

/**
 * SalonMasterPicker — service_picker step for salon's listing wizard.
 *
 * Calls GET /brands/me/master-catalogue (existing endpoint per
 * contracts-v1.3 patch notes — no backend changes needed; brand.category
 * dispatch routes salon brands to master_salon_services rows).
 *
 * Each row arrives annotated with `is_activated`, `product_id`,
 * `activated_price` (per master-catalogue recon). Already-activated services
 * are disabled with "Already added at ₹X" — prevents accidental double-add
 * per chat lock-in.
 *
 * Field-name aliasing: salon.json's storage_format references
 * master_row.service_name + master_row.section, but master_salon_services
 * columns are name + category. We alias here on pick so the schema's path
 * resolution in publishDriver works without touching the schema or
 * extending the backend's response shape.
 */

export default function SalonMasterPicker({ step, wizardState, onFieldChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectionFilter, setSectionFilter] = useState(null);

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

  const sections = useMemo(() => {
    const set = new Set(items.map(i => i.category).filter(Boolean));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    if (!sectionFilter) return items;
    return items.filter(i => i.category === sectionFilter);
  }, [items, sectionFilter]);

  function handlePick(masterRow) {
    if (masterRow.is_activated) return;

    const aliasedRow = {
      ...masterRow,
      service_name: masterRow.name,    // alias for schema's master_row.service_name
      section: masterRow.category,     // alias for schema's master_row.section
    };
    onFieldChange('_master_row', aliasedRow);

    // Auto-pre-fill spec defaults from the master row so the next step is
    // mostly review-and-tweak rather than fill-from-blank.
    onFieldChange('duration_mins', masterRow.duration_mins_default || 30);
    onFieldChange('section', masterRow.category);
    if (masterRow.gender) {
      const titled = masterRow.gender.charAt(0).toUpperCase() + masterRow.gender.slice(1);
      onFieldChange('gender', titled);   // 'unisex' → 'Unisex' to match attributes_schema options
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-400">Loading services…</div>;
  }
  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>;
  }
  if (items.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">No master services available.</div>;
  }

  const pickedId = wizardState._master_row?.id;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>

      {/* Section filter */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setSectionFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
            ${!sectionFilter
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
          All ({items.length})
        </button>
        {sections.map(s => {
          const count = items.filter(i => i.category === s).length;
          return (
            <button key={s} type="button" onClick={() => setSectionFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
                ${sectionFilter === s
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Service grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(svc => {
          const isPicked = svc.id === pickedId;
          const isActivated = !!svc.is_activated;

          return (
            <button key={svc.id} type="button" onClick={() => handlePick(svc)} disabled={isActivated}
              className={`text-left p-3 rounded-xl border-2 transition-all
                ${isActivated
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                  : isPicked
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-purple-400'}`}>
              <div className="flex gap-3 items-start">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center text-xl flex-shrink-0">
                  {svc.image_url
                    ? <img src={svc.image_url} alt={svc.name} className="w-full h-full object-cover" />
                    : '💇'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900">{svc.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {svc.category} · {svc.duration_mins_default}m
                  </div>
                  {isActivated ? (
                    <div className="text-[10px] text-amber-600 font-semibold mt-1">
                      Already added at ₹{Number(svc.activated_price || 0).toLocaleString('en-IN')}
                    </div>
                  ) : isPicked ? (
                    <div className="text-[10px] text-purple-600 font-semibold mt-1">
                      ✓ Picked
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-6 text-center text-sm text-gray-400">No services in this section.</div>
      )}
    </div>
  );
}
