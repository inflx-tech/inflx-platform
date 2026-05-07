'use client';

import { useState, useMemo, useCallback } from 'react';
import { brandApi } from '../../../../lib/api';
import { getTemplate } from './templateRegistry';
import * as builtins from './builtinStepComponents';
import { runPublish, canSkipBrandSteps } from './publishDriver';
import BulkUploadCard from './BulkUploadCard';

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
 * NOT used by car_rental in PR-A — car_rental keeps routing through
 * CarRentalWizard.js via CUSTOM_WIZARDS in ListingWizard.js. PR-C migrates
 * car_rental to this layout and deletes CarRentalWizard.js + DynamicStepRenderer.js.
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
  const allSteps = useMemo(() => template?.listing_steps || [], [template]);
  const skipBrand = useMemo(
    () => canSkipBrandSteps(template, brand, myProducts),
    [template, brand, myProducts]
  );
  const visibleSteps = useMemo(
    () => skipBrand ? allSteps.filter(s => s.writes_to !== 'brand') : allSteps,
    [allSteps, skipBrand]
  );

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

  const handleItemAdd = useCallback(() => {
    setWizardItems(prev => [...prev, {}]);
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

  function resetWizard() {
    setCurrentStep(0);
    setWizardState(tmpl?.initialWizardState?.() || {});
    setWizardItems([]);
    setErrors({});
    setPublishResult(null);
  }

  // ── Publish ────────────────────────────────────────────────────────────────

  async function handlePublish() {
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
        onItemAdd={handleItemAdd}
        onItemRemove={handleItemRemove}
        onItemFieldChange={handleItemFieldChange}
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

  return (
    <div className="max-w-[780px] mx-auto">
      {/* Header */}
      <div className="text-center mb-5">
        <h1 className="text-2xl font-extrabold text-gray-900">
          {template.icon || ''} Your {labelPlural}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {myProducts?.length || 0} {(myProducts?.length === 1 ? labelSingular : labelPlural).toLowerCase()} in your listing
        </p>
        {skipBrand && (
          <button
            type="button"
            onClick={() => alert('Edit business profile coming soon')}
            className="mt-2 text-xs text-orange-600 hover:text-orange-700 underline"
          >
            Edit business profile
          </button>
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
          ...(tmpl?.hideUploadTab
            ? []
            : [{ key: 'upload', label: 'Bulk Upload', icon: '📤' }]),
        ].map(t => (
          <button key={t.key}
            onClick={() => { setView(t.key); if (t.key === 'add') resetWizard(); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5
              ${view === t.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
          onAdd={() => { setView('add'); resetWizard(); }}
          onUpload={() => setView('upload')}
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

function FleetView({ products, FleetRow, labelSingular, labelPlural, icon, onRemove, onAdd, onUpload }) {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <p className="text-4xl mb-3">{icon || '📋'}</p>
        <p className="text-base font-bold text-gray-700 mb-1">No {labelPlural.toLowerCase()} yet</p>
        <p className="text-sm text-gray-400 mb-4">Add your first {labelSingular.toLowerCase()} or upload an Excel sheet</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onAdd}
            className="px-5 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600">
            ➕ Add {labelSingular}
          </button>
          <button onClick={onUpload}
            className="px-5 py-2.5 bg-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-300">
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
          ? <FleetRow key={product.id} product={product} onRemove={() => onRemove(product.id)} />
          : <DefaultFleetRow key={product.id} product={product} icon={icon} onRemove={() => onRemove(product.id)} />
      ))}
    </div>
  );
}

function DefaultFleetRow({ product, icon, onRemove }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
        {icon || '📋'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{product.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {product.is_active ? 'Live' : 'Inactive'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{product.description || product.section}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-lg font-extrabold text-gray-900">
          ₹{Number(product.price || 0).toLocaleString('en-IN')}
        </div>
      </div>
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
  renderStep, errors, saving,
  onBack, onNext, onPublish, onListAnother, onViewFleet,
}) {
  return (
    <>
      {/* Progress bar */}
      <div className="flex items-center mb-6">
        {steps.map((s, i) => (
          <div key={s.id} className="flex-1 flex flex-col items-center relative">
            {i < steps.length - 1 && (
              <div className={`absolute top-3 left-[calc(50%+14px)] right-[calc(-50%+14px)] h-0.5 ${i < currentStep ? 'bg-orange-500' : 'bg-gray-300'}`} />
            )}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-all
              ${i === currentStep ? 'bg-orange-500 text-white ring-4 ring-orange-200'
                : i < currentStep ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
              {i < currentStep ? '✓' : i + 1}
            </div>
            <div className={`text-[10px] mt-1 font-medium text-center
              ${i === currentStep ? 'text-orange-600 font-semibold'
                : i < currentStep ? 'text-green-600' : 'text-gray-400'}`}>
              {s.title}
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        {renderStep()}
        {errors._publish && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
            <p className="text-red-600 text-xs">{errors._publish}</p>
          </div>
        )}
      </div>

      {/* Navigation — hidden on done step */}
      {!isDoneStep ? (
        <div className="flex items-center justify-between">
          {currentStep > 0 ? (
            <button onClick={onBack}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border-[1.5px] border-gray-200 hover:border-orange-500 hover:text-orange-600">
              ← Back
            </button>
          ) : <div />}
          {isPublishStep ? (
            <button onClick={onPublish} disabled={saving || canProceed === false}
              className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all
                ${!saving && canProceed !== false
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {saving ? 'Publishing...' : 'Publish listing ✓'}
            </button>
          ) : (
            <button onClick={onNext} disabled={canProceed === false}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${canProceed === false
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>
              Next →
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-3 justify-center">
          <button onClick={onListAnother}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl">
            + List another
          </button>
          <button onClick={onViewFleet}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl">
            View list
          </button>
        </div>
      )}
    </>
  );
}
