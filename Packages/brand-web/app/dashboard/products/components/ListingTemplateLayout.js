'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { brandApi } from '../../../../lib/api';
import { getTemplate } from './templateRegistry';
import * as builtins from './builtinStepComponents';
import { runPublish, canSkipBrandSteps } from './publishDriver';
import BulkUploadCard from './BulkUploadCard';
import LivePreview from './LivePreview';
import CustomiseDishModal from './restaurant/CustomiseDishModal';

/**
 * ListingTemplateLayout — shared chrome for category-driven listing wizards.
 *
 * Owns:
 *   - View tabs (Fleet / Add / Upload)
 *   - Header (title + count)
 *   - Fleet view chrome (empty state, list container, remove action)
 *   - Bulk Excel UI (download template, upload result)
 *   - Wizard chrome (progress bar, step container, Back / Next / Publish, Done)
 *   - State management (currentStep, wizardState, wizardItems, errors, saving)
 *   - Default storage_format-driven publish via publishDriver
 *   - Brand-step skip semantics on repeat-add (per chat lock-in: walks
 *     brand_config.fields[] where required:true)
 *
 * Templates contribute via templateRegistry:
 *   - stepComponents (overrides for snake_case step.component values)
 *   - FleetRowComponent (per-row body in the fleet list)
 *   - customPublish (override the publishDriver for complex shapes)
 *   - initialWizardState (seed values on wizard entry)
 *
 * Built-in step components live in builtinStepComponents.js. Dispatch order:
 *   template.stepComponents[step.component] || builtins[step.component] || ErrorPlaceholder
 *
 * As of PR-3 (locked v1.3 success criteria), every category — car_rental
 * included — routes through this layout via templateRegistry. The legacy
 * CarRentalWizard.js + DynamicStepRenderer.js are deleted. CUSTOM_WIZARDS
 * escape hatch is removed from ListingWizard.js.
 */

export default function ListingTemplateLayout({
  template,
  brand,
  myProducts,
  scoreData,
  previewData,
  onRefreshProducts,
}) {
  const tmpl = getTemplate(template?.category_key);

  // ── View + wizard state ────────────────────────────────────────────────────
  const [view, setView] = useState('fleet');
  const [wizardState, setWizardState] = useState(() => tmpl?.initialWizardState?.() || {});
  const [wizardItems, setWizardItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ── Step list with brand-step skip applied ─────────────────────────────────
  // Two modes:
  //   - SKIP (default for returning brands) — only menu + preview + done render.
  //     The brand has filled all required brand fields once; we don't make them
  //     re-fill on every menu-add loop.
  //   - FULL — all 9 steps render. Entered by the user clicking "Edit business
  //     profile" near the wizard header. Lets them edit one-time fields (vibes,
  //     hours, photos, etc.) without losing the rest of the flow.
  const [editSetupMode, setEditSetupMode] = useState(false);
  // Edit-a-published-dish (price + variations + add-ons) via CustomiseDishModal.
  const [editProduct, setEditProduct] = useState(null);
  const [editInitial, setEditInitial] = useState(null);
  const allSteps = useMemo(() => template?.listing_steps || [], [template]);
  const autoSkipBrand = useMemo(
    () => canSkipBrandSteps(template, brand, myProducts),
    [template, brand, myProducts]
  );
  // Active skip = auto-skip eligible AND user hasn't asked to edit setup.
  const skipBrand = autoSkipBrand && !editSetupMode;
  // Registration already captures the store address; drop the redundant
  // "Location" step when the brand already has location (unless they explicitly
  // entered Edit-setup mode to change it).
  const hasLocation = useMemo(() => {
    const ld = brand?.listing_data || {};
    return !!(brand?.lat && brand?.lng) || !!brand?.locality || !!brand?.formatted_address
      || !!ld.google_maps_url || !!ld.locality;
  }, [brand]);
  const visibleSteps = useMemo(() => {
    let steps = skipBrand ? allSteps.filter(s => s.writes_to !== 'brand') : allSteps;
    if (hasLocation && !editSetupMode) steps = steps.filter(s => s.id !== 'location');
    return steps;
  }, [allSteps, skipBrand, hasLocation, editSetupMode]);

  // Drill-down templates (fashion/furniture) have NO in-page product-authoring
  // step — registration is store-profile only and products are added in the
  // dedicated tree+facets wizard. Their Add/Bulk entry points must route there,
  // not to an empty 'add' view (the blank-screen bug).
  const hasProductStep = useMemo(
    () => allSteps.some(s => s.writes_to !== 'brand' && !['preview', 'done'].includes(s.component)),
    [allSteps]
  );
  // Add-intent entry point — carry the intent so the wizard lands on the Add
  // products tab, not the My-listings default (contract: listing-add-intent-nav).
  const gotoProductWizard = () => { window.location.href = '/dashboard/products/listing?tab=add'; };

  // Drill-down verticals (fashion/furniture) get a category folder browse of the
  // inventory instead of one flat list (contract: listing-fashion-inventory-browse).
  const isDrilldown = /^(fashion|furniture)/.test(template?.category_key || '');

  const [currentStep, setCurrentStep] = useState(0);
  const stepConfig = visibleSteps[currentStep];
  const isDoneStep = stepConfig?.component === 'done';
  const isPublishStep = currentStep === visibleSteps.length - 2 && visibleSteps[visibleSteps.length - 1]?.component === 'done';

  // ── Field handlers ─────────────────────────────────────────────────────────

  const handleFieldChange = useCallback((key, value) => {
    setWizardState(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Wave 1 (Dining) — multi-key writer for field types that derive several
  // wizardState entries from one user action. google_maps_link uses this to
  // write { google_maps_url, lat, lng, locality, formatted_address } from
  // a single Verify click.
  const handleMultiFieldChange = useCallback((updates) => {
    if (!updates || typeof updates !== 'object') return;
    setWizardState(prev => ({ ...prev, ...updates }));
    setErrors(prev => {
      const touchedKeys = Object.keys(updates);
      if (touchedKeys.every(k => !prev[k])) return prev;
      const next = { ...prev };
      for (const k of touchedKeys) delete next[k];
      return next;
    });
  }, []);

  // Adjacent fix (Phase Salon-1): accept an optional initial item state so
  // pickers like RestaurantDishPicker + SalonServiceInlinePicker can append
  // a populated item in one call. Default `{}` preserves the original
  // signature for any caller that invoked onItemAdd() with no args.
  const handleItemAdd = useCallback((initial = {}) => {
    setWizardItems(prev => [...prev, initial]);
  }, []);

  const handleItemRemove = useCallback((idx) => {
    setWizardItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleItemFieldChange = useCallback((idx, key, value) => {
    setWizardItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function canProceedFromStep() {
    // v1.3 §6.5 canProceed registry hook. PR-B step 3.2 wired this from PR-A's
    // stub. Templates that don't register canProceed (restaurant, car_rental
    // today) keep the permissive default.
    if (tmpl?.canProceed && stepConfig) {
      return tmpl.canProceed(wizardState, stepConfig, wizardItems);
    }
    return true;
  }

  const canProceed = canProceedFromStep();

  function goNext() {
    if (!canProceed) return;
    setErrors({});
    if (currentStep < visibleSteps.length - 1) setCurrentStep(s => s + 1);
  }

  function goBack() {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
      setErrors({});
    }
  }

  // Used by the preview step's section-summary Edit buttons. Resolves a
  // step ID against visibleSteps (so it respects the brand-skip mode).
  function jumpToStep(stepId) {
    const idx = visibleSteps.findIndex(s => s.id === stepId);
    if (idx >= 0) {
      setCurrentStep(idx);
      setErrors({});
    }
  }

  function resetWizard() {
    setCurrentStep(0);
    setWizardState(tmpl?.initialWizardState?.() || {});
    setWizardItems([]);
    setErrors({});
    setPublishResult(null);
  }

  // ── Publish ────────────────────────────────────────────────────────────────

  async function handlePublish() {
    // Block publish on duplicate dishes (same name added more than once) so the
    // owner removes them first — no silent double-listing.
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const counts = new Map();
    for (const it of wizardItems) {
      const k = norm(it.name);
      if (!k) continue;
      if (!counts.has(k)) counts.set(k, { name: it.name, n: 0 });
      counts.get(k).n += 1;
    }
    const dups = [...counts.values()].filter(c => c.n > 1);
    if (dups.length) {
      setErrors({ _publish: `Duplicate dishes: ${dups.map(d => `${d.name} (×${d.n})`).join(', ')}. Please remove the duplicates before publishing.` });
      return;
    }

    setSaving(true);
    try {
      const publishFn = tmpl?.customPublish || runPublish;
      const result = await publishFn({ template, brand, wizardState, wizardItems });
      setPublishResult(result);
      if (result.errors?.length) {
        setErrors({ _publish: result.errors.join(' · ') });
      }
      if (onRefreshProducts) await onRefreshProducts();
      // Advance to done step if one exists
      if (visibleSteps[visibleSteps.length - 1]?.component === 'done') {
        setCurrentStep(visibleSteps.length - 1);
      }
    } catch (err) {
      setErrors({ _publish: err.message || 'Publish failed' });
    } finally {
      setSaving(false);
    }
  }

  // ── Excel handlers ─────────────────────────────────────────────────────────

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
      a.download = `INFLX_${(template?.label || 'Listing').replace(/\s+/g, '_')}_Template.xlsx`;
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

  async function handleRemoveProduct(productId) {
    if (!confirm('Remove this listing?')) return;
    try {
      await brandApi.delete(`/brands/me/products/${productId}`);
      if (onRefreshProducts) await onRefreshProducts();
    } catch (e) {
      alert('Failed to remove: ' + (e.message || e));
    }
  }

  // Phase 2a — push/un-push a product to the brand store (only pushed products
  // show in the storefront; the product stays listed + allocatable regardless).
  async function handleTogglePush(productId, next) {
    try {
      await brandApi.patch(`/brands/me/products/${productId}`, { pushed_to_store: next });
      if (onRefreshProducts) await onRefreshProducts();
    } catch (e) {
      alert('Failed to update: ' + (e.message || e));
    }
  }

  // Edit a PUBLISHED dish: load its current customisation, open the modal, and
  // on save persist price + add-on groups + badge/featured to the live product.
  async function openEditProduct(product) {
    let groups = [];
    try {
      const r = await brandApi.get(`/brands/me/products/${product.id}/addon-groups`);
      groups = r.data?.groups || [];
    } catch { /* no groups yet */ }
    setEditInitial({
      addon_groups: groups,
      badge: product.badge || '',
      is_featured: product.is_featured === true,
      price: product.price,
      description: product.description || '',
      image_url: product.image_url || '',
    });
    setEditProduct(product);
  }
  async function saveLiveCustomisation(result) {
    const id = editProduct.id;
    try {
      const ag = await brandApi.post(`/brands/me/products/${id}/addon-groups`, { groups: result.addon_groups });
      const patch = { badge: result.badge, is_featured: result.is_featured };
      if (result.price != null) patch.price = result.price;
      if (result.description !== undefined) patch.description = result.description;
      if (result.image_url !== undefined) patch.image_url = result.image_url;
      const pr = await brandApi.patch(`/brands/me/products/${id}`, patch);
      if ((ag && ag.success === false) || (pr && pr.success === false)) alert('Some changes did not save.');
    } catch (e) { alert('Failed to save: ' + (e.message || e)); }
    setEditProduct(null); setEditInitial(null);
    if (onRefreshProducts) await onRefreshProducts();
  }

  // ── Step component dispatch ────────────────────────────────────────────────

  function renderStep() {
    if (!stepConfig) return null;
    const name = stepConfig.component;
    const StepComponent = tmpl?.stepComponents?.[name] || builtins[name];
    if (!StepComponent) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
          Unknown step component: <code>{name}</code>. Register it in templateRegistry
          or builtinStepComponents.
        </div>
      );
    }
    return (
      <StepComponent
        step={stepConfig}
        template={template}
        brand={brand}
        wizardState={wizardState}
        wizardItems={wizardItems}
        onFieldChange={handleFieldChange}
        onMultiFieldChange={handleMultiFieldChange}
        onItemAdd={handleItemAdd}
        onItemRemove={handleItemRemove}
        onItemFieldChange={handleItemFieldChange}
        onJumpToStep={jumpToStep}
        errors={errors}
        scoreData={scoreData}
        previewData={previewData}
        publishResult={publishResult}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!template) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
        No listing template available for this category yet.
      </div>
    );
  }

  const FleetRow = tmpl?.FleetRowComponent;
  const labelPlural = template.product_noun_plural || 'Listings';
  const labelSingular = template.product_noun || 'Listing';

  // Wide layout (1180px) when the wizard is open + not on the Done step,
  // because the 2-col form + 380px live-preview rail needs the room.
  const wideLayout = view === 'add' && !isDoneStep;

  return (
    <div className={wideLayout ? 'max-w-[1180px] mx-auto' : 'max-w-[780px] mx-auto'}>
      {/* Header */}
      <div className="text-center mb-5">
        <h1 className="font-display text-3xl font-extrabold text-ink-1 tracking-tight">
          {template.icon || ''} Your {labelPlural}
        </h1>
        <p className="text-sm text-ink-3 mt-1">
          <span className="font-mono text-xs">{myProducts?.length || 0}</span> {(myProducts?.length === 1 ? labelSingular : labelPlural).toLowerCase()} in your listing
        </p>

        {/* Setup-mode toggle. Visible only when the brand is eligible for the
            menu-only fast path (required brand fields filled + has products).
            Default mode: menu-only loop. Click to expand into the full 9-step
            setup for editing one-time fields (hours, photos, vibes, etc.). */}
        {autoSkipBrand && (
          <button
            type="button"
            onClick={() => {
              setEditSetupMode(prev => !prev);
              setCurrentStep(0); // jump back to step 1 of the new visible step list
              resetWizard();     // clear any in-progress wizardState/wizardItems
            }}
            className="mt-2 text-xs underline transition-colors"
            style={{
              color: editSetupMode ? '#1F2328' : '#CA8A04',
            }}
          >
            {editSetupMode
              ? '← Done editing setup · back to menu-only'
              : '✏️ Edit business setup (hours, photos, vibes, etc.)'}
          </button>
        )}

        {/* Banner when in edit-setup mode — explains what changed and where
            menu-only mode lives. */}
        {editSetupMode && (
          <div className="mt-3 mx-auto max-w-md px-3 py-2 rounded-lg border text-xs"
               style={{ backgroundColor: 'rgba(255,184,0,0.08)', borderColor: 'rgba(255,184,0,0.35)', color: '#92400E' }}>
            ✏️ <strong>Editing your business setup.</strong> All {allSteps.length} steps are visible.
            Adding a new menu item later? You'll see only the menu step again.
          </div>
        )}
      </div>

      {/* View tabs — Bulk Upload tab hidden when the template handles bulk
          upload internally inside its wizard (restaurant's path-choice in
          step 4). Per chat decision: two entry points to bulk is confusing;
          per-template chrome divergence is justified. */}
      <div className="flex gap-2 mb-6 justify-center">
        {[
          { key: 'fleet',  label: `${labelPlural} (${myProducts?.length || 0})`, icon: template.icon || '📋' },
          { key: 'add',    label: `Add ${labelSingular}`, icon: '➕' },
          // Hide the top-level Bulk Upload tab for drill-down templates
          // (fashion/furniture): there you pick the item type first, then choose
          // one-by-one OR bulk inside the wizard — a tab here just lands on the
          // same page and is confusing (founder walkthrough 2026-06-12).
          ...((tmpl?.hideUploadTab || !hasProductStep)
            ? []
            : [{ key: 'upload', label: 'Bulk Upload', icon: '📤' }]),
        ].map(t => (
          <button key={t.key}
            onClick={() => {
              if ((t.key === 'add' || t.key === 'upload') && !hasProductStep) return gotoProductWizard();
              setView(t.key); if (t.key === 'add') resetWizard();
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5
              ${view === t.key
                ? 'bg-yellow text-ink-1 shadow-sm'
                : 'bg-paper-surface text-ink-2 hover:bg-paper-deep border border-line-soft'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ FLEET VIEW ═══════ */}
      {view === 'fleet' && (isDrilldown ? (
        <DrilldownFleetView
          flatProducts={myProducts}
          icon={template.icon}
          labelPlural={labelPlural}
          onRemove={handleRemoveProduct}
          onTogglePush={handleTogglePush}
          onAdd={gotoProductWizard}
        />
      ) : (
        <FleetView
          products={myProducts}
          FleetRow={FleetRow}
          labelSingular={labelSingular}
          labelPlural={labelPlural}
          icon={template.icon}
          onRemove={handleRemoveProduct}
          onTogglePush={handleTogglePush}
          onEdit={brand?.category === 'restaurant' ? openEditProduct : undefined}
          onAdd={() => { if (!hasProductStep) return gotoProductWizard(); setView('add'); resetWizard(); }}
          onUpload={() => { if (!hasProductStep) return gotoProductWizard(); setView('upload'); }}
        />
      ))}

      {editProduct && (
        <CustomiseDishModal
          key={editProduct.id}
          dish={editProduct}
          initial={editInitial}
          showPrice
          menuItems={myProducts.filter(p => p.id !== editProduct.id).map(p => ({ name: p.name, price: p.price, id: p.id }))}
          onSave={saveLiveCustomisation}
          onClose={() => { setEditProduct(null); setEditInitial(null); }}
        />
      )}

      {/* ═══════ UPLOAD VIEW ═══════ */}
      {view === 'upload' && (
        <UploadView
          labelPlural={labelPlural}
          uploading={uploading}
          uploadResult={uploadResult}
          onDownload={handleDownloadTemplate}
          onUpload={handleBulkUpload}
        />
      )}

      {/* ═══════ ADD WIZARD VIEW ═══════ */}
      {view === 'add' && (
        <AddWizardView
          steps={visibleSteps}
          currentStep={currentStep}
          stepConfig={stepConfig}
          isDoneStep={isDoneStep}
          isPublishStep={isPublishStep}
          canProceed={canProceed}
          renderStep={renderStep}
          errors={errors}
          saving={saving}
          scoreData={scoreData}
          template={template}
          brand={brand}
          wizardState={wizardState}
          wizardItems={wizardItems}
          previewData={previewData}
          onBack={goBack}
          onNext={goNext}
          onPublish={handlePublish}
          onListAnother={resetWizard}
          onViewFleet={() => setView('fleet')}
        />
      )}
    </div>
  );
}

// ── Subviews ────────────────────────────────────────────────────────────────

function FleetView({ products, FleetRow, labelSingular, labelPlural, icon, onRemove, onTogglePush, onEdit, onAdd, onUpload }) {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <p className="text-4xl mb-3">{icon || '📋'}</p>
        <p className="text-base font-bold text-gray-700 mb-1">No {labelPlural.toLowerCase()} yet</p>
        <p className="text-sm text-gray-400 mb-4">Add your first {labelSingular.toLowerCase()} or upload an Excel sheet</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onAdd}
            className="px-5 py-2.5 bg-yellow text-ink-1 text-sm font-bold rounded-xl hover:bg-yellow-deep transition-colors">
            ➕ Add {labelSingular}
          </button>
          <button onClick={onUpload}
            className="px-5 py-2.5 bg-paper-surface text-ink-2 text-sm font-bold rounded-xl border border-line-soft hover:bg-paper-deep transition-colors">
            📤 Bulk Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.map(product => (
        FleetRow
          ? <FleetRow key={product.id} product={product} onRemove={() => onRemove(product.id)} onTogglePush={onTogglePush} onEdit={onEdit ? () => onEdit(product) : undefined} />
          : <DefaultFleetRow key={product.id} product={product} icon={icon} onRemove={() => onRemove(product.id)} onTogglePush={onTogglePush} />
      ))}
    </div>
  );
}

function DefaultFleetRow({ product, icon, onRemove, onTogglePush, onEdit, selected, onToggleSelect }) {
  const pushed = product.pushed_to_store !== false;
  // product-approval-switch (M4): where the product stands with INFLX while the switch is on.
  const waiting = product.approval_status === 'pending';
  const sentBack = product.approval_status === 'rejected';
  return (
    <div className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${selected ? 'border-yellow ring-1 ring-yellow' : 'border-gray-200'} ${pushed || waiting ? '' : 'opacity-60'}`}>
      {onToggleSelect && (
        // eslint-disable-next-line jsx-a11y/label-has-associated-control
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
          aria-label={`Select ${product.name}`}
          className="w-4 h-4 flex-shrink-0 cursor-pointer accent-yellow-deep" />
      )}
      <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
        {product.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={product.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          : (icon || '📋')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{product.name}</span>
          {waiting ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700" data-testid="pill-waiting">Waiting for INFLX approval</span>
          ) : sentBack ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700" data-testid="pill-sent-back">Sent back</span>
          ) : (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pushed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {pushed ? 'In store' : 'Hidden'}
            </span>
          )}
        </div>
        {waiting ? (
          <p className="text-xs text-gray-500 mt-0.5">It goes live in your store once INFLX approves it.</p>
        ) : sentBack ? (
          <p className="text-xs text-red-600 mt-0.5">INFLX: {product.approval_note || 'not approved'} — fix it, then switch In store on to send it again.</p>
        ) : (
          <p className="text-xs text-gray-500 mt-0.5">{product.description || product.section}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-lg font-extrabold text-gray-900">
          ₹{Number(product.price || 0).toLocaleString('en-IN')}
        </div>
      </div>
      {onTogglePush && (
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">In store</span>
          <button type="button" onClick={() => onTogglePush(product.id, !pushed)}
            className={`w-10 h-5 rounded-full relative transition-colors ${pushed ? 'bg-green-500' : 'bg-gray-300'}`}
            title={waiting ? 'Waiting for INFLX approval — tap to withdraw' : sentBack ? 'Sent back by INFLX — tap to send it again' : pushed ? 'Showing in your store — tap to hide' : 'Hidden from your store — tap to show'}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${pushed ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      )}
      {onEdit && (
        <button onClick={onEdit}
          className="text-gray-500 hover:text-gray-900 text-xs font-semibold ml-2">Edit</button>
      )}
      <button onClick={onRemove}
        className="text-red-400 hover:text-red-600 text-xs font-semibold ml-2">Remove</button>
    </div>
  );
}

// DrilldownFleetView — inventory browse for fashion/furniture: the brand's own
// products organised by the category tree they listed under, instead of one flat
// list (contract: listing-fashion-inventory-browse). Rows reuse DefaultFleetRow so
// the In-store toggle + Remove behave identically to the flat view. A name/SKU
// search flattens across the whole catalogue as an escape hatch.
function DrilldownFleetView({ flatProducts, icon, labelPlural, onRemove, onTogglePush, onAdd }) {
  const [tree, setTree] = useState(null);
  const [level, setLevel] = useState([]);
  const [crumb, setCrumb] = useState([]);
  const [leaf, setLeaf] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());   // bulk-select in the leaf view
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    brandApi.get('/brands/me/listing-tree')
      .then(r => { if (cancel) return; setLoading(false); if (r.success) { setTree(r.data.tree || []); setLevel(r.data.tree || []); } else setErr(r.error?.message || 'Failed to load your inventory'); })
      .catch(() => { if (!cancel) { setLoading(false); setErr('Failed to load your inventory'); } });
    return () => { cancel = true; };
  }, []);

  const loadLeaf = useCallback(async (node) => {
    setRowsLoading(true); setRows([]); setSelected(new Set());
    const r = await brandApi.get(`/brands/me/listing-nodes/${node.id}/products`);
    setRowsLoading(false);
    if (r.success) setRows(r.data.products || []); else setErr(r.error?.message || 'Failed to load products');
  }, []);

  const drill = (node) => {
    setErr('');
    setCrumb(c => [...c, { name: node.name, children: level }]);
    if (node.is_leaf) { setLeaf(node); loadLeaf(node); }
    else setLevel(node.children || []);
  };
  const jump = (i) => {
    setLeaf(null); setRows([]); setErr('');
    if (i < 0) { setLevel(tree || []); setCrumb([]); return; }
    setLevel(crumb[i].children); setCrumb(crumb.slice(0, i));
  };
  const refetchLeaf = () => { if (leaf) loadLeaf(leaf); };
  const removeRow = async (id) => { await onRemove(id); refetchLeaf(); };
  const toggleRow = async (id, next) => { await onTogglePush(id, next); refetchLeaf(); };

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every(p => selected.has(p.id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(p => p.id)));
  const bulkDelete = async () => {
    if (!selected.size || bulkBusy) return;
    if (!confirm(`Remove ${selected.size} product${selected.size === 1 ? '' : 's'}? This can't be undone here.`)) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    let failed = 0;
    for (const id of ids) {
      try { await brandApi.delete(`/brands/me/products/${id}`); } catch { failed += 1; }
    }
    setBulkBusy(false); setSelected(new Set()); refetchLeaf();
    if (failed) alert(`${failed} of ${ids.length} could not be removed.`);
  };

  const q = search.trim().toLowerCase();
  const results = q ? (flatProducts || []).filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)) : [];
  const rowEl = (p) => <DefaultFleetRow key={p.id} product={p} icon={icon} onRemove={() => removeRow(p.id)} onTogglePush={toggleRow} selected={selected.has(p.id)} onToggleSelect={() => toggleSelect(p.id)} onEdit={() => { window.location.href = `/dashboard/products/listing?edit=${p.id}`; }} />;

  if (loading) return <div className="text-center text-sm text-gray-400 py-10">Loading your inventory…</div>;

  const total = (tree || []).reduce((a, n) => a + (n.product_count || 0), 0);
  const folders = (level || []).filter(n => (n.product_count || 0) > 0);

  return (
    <div>
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search your products by name or SKU…"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-yellow" />
      </div>

      {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">{err}</div>}

      {q ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">{results.length} match{results.length === 1 ? '' : 'es'}</p>
          {results.map(rowEl)}
          {results.length === 0 && <p className="text-sm text-gray-400">No products match. Clear search to browse by category.</p>}
        </div>
      ) : total === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-4xl mb-3">{icon || '📋'}</p>
          <p className="text-base font-bold text-gray-700 mb-1">No products listed yet</p>
          <p className="text-sm text-gray-400 mb-4">Add products and they&apos;ll show here, organised by category.</p>
          <button onClick={onAdd} className="px-5 py-2.5 bg-yellow text-ink-1 text-sm font-bold rounded-xl hover:bg-yellow-deep transition-colors">➕ Add Item</button>
        </div>
      ) : (
        <>
          <div className="flex items-center flex-wrap gap-1 text-sm text-gray-500 mb-4 font-semibold">
            <button onClick={() => jump(-1)} className="hover:text-gray-900">{labelPlural}</button>
            {crumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-gray-300">›</span>
                {i === crumb.length - 1 && leaf
                  ? <span className="text-gray-900">{c.name}</span>
                  : <button onClick={() => jump(i)} className="hover:text-gray-900">{c.name}</button>}
              </span>
            ))}
          </div>

          {!leaf ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
              {folders.map(n => {
                const subCats = (n.children || []).filter(c => (c.product_count || 0) > 0).length;
                return (
                  <button key={n.id} onClick={() => drill(n)}
                    className={`flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl p-3.5 text-left hover:border-yellow transition-colors ${n.is_leaf ? 'border-l-[3px] border-l-yellow' : ''}`}>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-gray-900 truncate">{n.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{n.is_leaf ? `${n.product_count} listed` : `${subCats} categor${subCats === 1 ? 'y' : 'ies'}`}</div>
                    </div>
                    <span className="font-mono text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ backgroundColor: '#FFF7CC', color: '#6B5A00' }}>{n.product_count}</span>
                  </button>
                );
              })}
              {folders.length === 0 && <p className="text-sm text-gray-400">Nothing listed under here.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs uppercase tracking-wide text-gray-400 font-bold">{leaf.name} — {rows.length} product{rows.length === 1 ? '' : 's'}</p>
                {rows.length > 0 && (
                  <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-yellow-deep cursor-pointer" />
                    Select all
                  </label>
                )}
              </div>
              {selected.size > 0 && (
                <div className="flex items-center gap-3 bg-yellow-pale border border-yellow rounded-xl px-3 py-2 sticky top-2 z-10">
                  <span className="text-xs font-bold text-ink-1">{selected.size} selected</span>
                  <button onClick={bulkDelete} disabled={bulkBusy}
                    className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50">
                    {bulkBusy ? 'Removing…' : `🗑 Delete selected (${selected.size})`}
                  </button>
                  <button onClick={() => setSelected(new Set())} className="text-xs font-semibold text-gray-500 hover:text-gray-800 ml-auto">Clear</button>
                </div>
              )}
              {rowsLoading ? <p className="text-sm text-gray-400">Loading…</p>
                : rows.length === 0 ? <p className="text-sm text-gray-400">No products under {leaf.name} yet.</p>
                : rows.map(rowEl)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// UploadView — thin wrapper around BulkUploadCard for back-compat with the
// existing call site. PR-2 extracted the card body into BulkUploadCard so
// RestaurantDishPicker's Bulk path can mount the same UI without duplication.
function UploadView({ labelPlural, uploading, uploadResult, onDownload, onUpload }) {
  return (
    <BulkUploadCard
      labelPlural={labelPlural}
      uploading={uploading}
      uploadResult={uploadResult}
      onDownload={onDownload}
      onUpload={onUpload}
    />
  );
}

function AddWizardView({
  steps, currentStep, stepConfig, isDoneStep, isPublishStep, canProceed,
  renderStep, errors, saving, scoreData,
  template, brand, wizardState, wizardItems, previewData,
  onBack, onNext, onPublish, onListAnother, onViewFleet,
}) {
  // Pts-unlocked figure surfaces the quality-score progress as the brand
  // walks through the wizard. We use the running scoreData.score (0–100)
  // rather than per-step earned points because (a) the schema doesn't
  // ship a step→rule map and (b) the score recomputes on every save
  // anyway, so the running total is honest.
  const score = Math.max(0, Math.min(100, Number(scoreData?.score) || 0));
  const stepTitle = (stepConfig?.title || '').toUpperCase();
  const stepNumStr = String(currentStep + 1).padStart(2, '0');
  const stepTotalStr = String(steps.length).padStart(2, '0');
  const nextStep = steps[currentStep + 1];
  const nextLabel = nextStep
    ? (nextStep.component === 'done' ? 'Publish & go live' : `Next: ${nextStep.title}`)
    : 'Next';

  return (
    <>
      {/* Pill progress bar — thin segments, yellow active/done, grey upcoming */}
      <div className="flex gap-1.5 mb-2 px-0.5">
        {steps.map((s, i) => (
          <div key={s.id}
               className={`flex-1 h-1 rounded-full transition-colors
                 ${i <= currentStep ? 'bg-yellow' : 'bg-paper-deep'}`} />
        ))}
      </div>

      {/* Step meta — mono, uppercase, "STEP 01 / 09 · NAME" + pts unlocked */}
      <div className="flex items-center justify-between mb-6 px-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        <span>
          Step <span className="text-ink-1 font-bold">{stepNumStr}</span> / {stepTotalStr}
          <span className="text-ink-3"> · </span>
          <span className="text-ink-1">{stepTitle}</span>
        </span>
        <span>
          <span className="text-yellow-deep font-bold">{score}</span>
          <span className="text-ink-3"> pts unlocked of </span>
          <span className="text-ink-1 font-bold">100</span>
        </span>
      </div>

      {/* Body grid — 2-col with pinned LivePreview rail on non-done steps */}
      {!isDoneStep ? (
        <div className="grid gap-5 mb-4" style={{ gridTemplateColumns: '1fr 380px' }}>
          <div className="bg-paper border border-line-soft rounded-2xl p-6 shadow-sm min-w-0">
            {renderStep()}
            {errors._publish && (
              <div className="bg-red-pale border border-red rounded-xl p-3 mt-4">
                <p className="text-red text-xs">{errors._publish}</p>
              </div>
            )}
          </div>
          <div className="sticky top-4 self-start">
            <LivePreview
              brand={previewData?.brand || brand}
              products={previewData?.products || wizardItems}
              cardConfig={previewData?.card_config || template?.card_config}
              actionTypes={previewData?.action_types || template?.action_types}
              wizardState={wizardState}
              template={template}
            />
          </div>
        </div>
      ) : (
        <div className="bg-paper border border-line-soft rounded-2xl p-6 mb-4 shadow-sm">
          {renderStep()}
        </div>
      )}

      {/* Navigation — hidden on done step */}
      {!isDoneStep ? (
        <div className="flex items-center justify-between">
          {currentStep > 0 ? (
            <button onClick={onBack}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-ink-2 border-[1.5px] border-line-soft hover:border-yellow hover:text-ink-1 transition-colors">
              ← Back
            </button>
          ) : <div />}
          {isPublishStep ? (
            <button onClick={onPublish} disabled={saving || canProceed === false}
              className={`px-8 py-3 rounded-xl text-sm font-bold transition-all
                ${!saving && canProceed !== false
                  ? 'bg-yellow hover:bg-yellow-deep text-ink-1 shadow-sm'
                  : 'bg-paper-deep text-ink-3 cursor-not-allowed'}`}>
              {saving ? 'Publishing...' : 'Publish & go live →'}
            </button>
          ) : (
            <button onClick={onNext} disabled={canProceed === false}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all
                ${canProceed === false
                  ? 'bg-paper-deep text-ink-3 cursor-not-allowed'
                  : 'bg-yellow hover:bg-yellow-deep text-ink-1 shadow-sm'}`}>
              {nextLabel} →
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-3 justify-center">
          <button onClick={onListAnother}
            className="px-5 py-2.5 bg-yellow hover:bg-yellow-deep text-ink-1 text-sm font-bold rounded-xl shadow-sm transition-colors">
            + List another
          </button>
          <button onClick={onViewFleet}
            className="px-5 py-2.5 bg-paper-surface hover:bg-paper-deep text-ink-2 text-sm font-bold rounded-xl border border-line-soft transition-colors">
            View list
          </button>
        </div>
      )}
    </>
  );
}
