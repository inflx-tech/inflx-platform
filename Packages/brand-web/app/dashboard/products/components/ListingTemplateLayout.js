'use client';

import { useState, useMemo, useCallback } from 'react';
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
  const gotoProductWizard = () => { window.location.href = '/dashboard/products/listing'; };

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
      {view === 'fleet' && (
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
      )}

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

function DefaultFleetRow({ product, icon, onRemove, onTogglePush }) {
  const pushed = product.pushed_to_store !== false;
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 ${pushed ? '' : 'opacity-60'}`}>
      <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
        {icon || '📋'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{product.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pushed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {pushed ? 'In store' : 'Hidden'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{product.description || product.section}</p>
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
            title={pushed ? 'Showing in your store — tap to hide' : 'Hidden from your store — tap to show'}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${pushed ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      )}
      <button onClick={onRemove}
        className="text-red-400 hover:text-red-600 text-xs font-semibold ml-2">Remove</button>
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
