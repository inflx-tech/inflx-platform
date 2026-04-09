'use client';
import { useState, useEffect, useCallback } from 'react';
import { brandApi } from '../../../../lib/api';
import DynamicStepRenderer from './DynamicStepRenderer';
import QualityScore from './QualityScore';
import LivePreview from './LivePreview';

// Business-specific custom wizards
import CarRentalWizard from './car-rental/CarRentalWizard';

/**
 * ListingWizard — the top-level orchestrator for config-driven listing.
 *
 * For businesses with custom wizards (e.g. car_rental), routes to the custom component.
 * For generic businesses, renders DynamicStepRenderer with listing_steps from config.
 */

// Map of category_key → custom wizard component
const CUSTOM_WIZARDS = {
  car_rental: CarRentalWizard,
  // salon: SalonWizard,        // future
  // gym_fitness: GymWizard,    // future
};

export default function ListingWizard() {
  const [config, setConfig] = useState(null);
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [products, setProducts] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Quality score + preview
  const [scoreData, setScoreData] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // ── Load config ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [configRes, productsRes, scoreRes] = await Promise.all([
          brandApi.get('/brands/me/listing-config'),
          brandApi.get('/brands/me/products'),
          brandApi.get('/brands/me/quality-score').catch(() => null),
        ]);

        setConfig(configRes.data.config);
        setBrand(configRes.data);

        // Load existing products
        if (productsRes.data.products) {
          setProducts(productsRes.data.products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            description: p.description,
            section: p.section,
            veg_flag: p.veg_flag,
            image_url: p.image_url,
            stock: p.stock,
            variants_json: p.variants_json,
            duration_mins: p.duration_mins,
          })));
        }

        if (scoreRes?.data) setScoreData(scoreRes.data);

        // Load preview
        const previewRes = await brandApi.get('/brands/me/listing-preview').catch(() => null);
        if (previewRes?.data) setPreviewData(previewRes.data);
      } catch (err) {
        setError(err.message || 'Failed to load listing config');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Steps from config ──────────────────────────────────────────────────────

  const steps = config?.listing_steps || [];
  const currentStepConfig = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isPreviewStep = currentStepConfig?.id === 'preview';

  // ── Form handlers ──────────────────────────────────────────────────────────

  const handleFieldChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, [errors]);

  const handleProductAdd = useCallback(() => {
    setProducts(prev => [...prev, {}]);
  }, []);

  const handleProductRemove = useCallback((index) => {
    setProducts(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleProductFieldChange = useCallback((productIndex, key, value) => {
    setProducts(prev => {
      const updated = [...prev];
      updated[productIndex] = { ...updated[productIndex], [key]: value };
      return updated;
    });
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateStep(stepConfig) {
    const errs = {};
    if (stepConfig.fields) {
      for (const field of stepConfig.fields) {
        if (field.required) {
          const val = formData[field.key];
          if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
            errs[field.key] = `${field.label} is required`;
          }
        }
      }
    }
    return errs;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function handleNext() {
    const errs = validateStep(currentStepConfig);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
      setErrors({});
    }
  }

  // ── Save products ──────────────────────────────────────────────────────────

  async function handleSaveProducts() {
    setSaving(true);
    try {
      // Save new products (no id) and update existing
      for (const product of products) {
        if (!product.name || !product.price) continue;
        const payload = {
          name: product.name,
          price: product.price,
          description: product.description || '',
          section: product.section || null,
          veg_flag: product.veg_flag || 'na',
          image_url: product.image_url || '',
          stock: product.stock || null,
          variants_json: product.variants_json || null,
          duration_mins: product.duration_mins || null,
        };

        if (product.id) {
          await brandApi.patch(`/brands/me/products/${product.id}`, payload);
        } else {
          const res = await brandApi.post('/brands/me/products', payload);
          product.id = res.data.product.id;
        }
      }

      // Refresh score
      const scoreRes = await brandApi.get('/brands/me/quality-score').catch(() => null);
      if (scoreRes?.data) setScoreData(scoreRes.data);
    } catch (err) {
      setErrors({ _save: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  // ── Custom wizard routing ───────────────────────────────────────────────────
  // If this business type has a dedicated wizard component, use it instead of generic
  const categoryKey = config?.category_key;
  const CustomWizard = categoryKey ? CUSTOM_WIZARDS[categoryKey] : null;

  if (CustomWizard) {
    return <CustomWizard config={config} />;
  }

  if (!config || !steps.length) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-500 text-sm">Listing wizard not available for this category yet.</p>
      </div>
    );
  }

  // ── Excel bulk upload handlers ─────────────────────────────────────────────
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
      const a = document.createElement('a'); a.href = url;
      a.download = `INFLX_${(config?.label || 'Products').replace(/\s+/g, '_')}_Template.xlsx`; a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert('Download failed: ' + e.message); }
  }

  async function handleBulkUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('inflx_token') : null;
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');
      const formData = new FormData(); formData.append('file', file);
      const res = await fetch(`${apiBase}/brands/me/products/bulk-upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const json = await res.json();
      if (json.data?.created > 0) {
        alert(`${json.data.created} items uploaded successfully!`);
        // Refresh products
        const productsRes = await brandApi.get('/brands/me/products');
        if (productsRes.data?.products) setProducts(productsRes.data.products);
      }
      if (json.data?.errors?.length) {
        alert('Some rows had errors:\n' + json.data.errors.join('\n'));
      }
    } catch (e) { alert('Upload failed: ' + e.message); }
  }

  return (
    <div className="flex gap-6">
      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {/* Excel bulk upload bar */}
        <div className="flex items-center gap-3 mb-4 bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
          <span className="text-sm">📤</span>
          <span className="text-xs text-blue-700 font-medium flex-1">Bulk upload via Excel — download template, fill offline, upload</span>
          <button onClick={handleDownloadTemplate}
            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold rounded-lg transition-colors">
            📥 Template
          </button>
          <label className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors">
            📤 Upload
            <input type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" />
          </label>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <button onClick={() => i < currentStep ? setCurrentStep(i) : null}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${i === currentStep ? 'bg-orange-500 text-white' :
                    i < currentStep ? 'bg-green-500 text-white cursor-pointer' : 'bg-gray-200 text-gray-500'}`}>
                {i < currentStep ? '✓' : i + 1}
              </button>
              <span className={`text-xs font-semibold ${i === currentStep ? 'text-gray-800' : 'text-gray-400'}`}>
                {step.title}
              </span>
              {i < steps.length - 1 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white border-2 border-gray-100 rounded-2xl p-6">
          <DynamicStepRenderer
            step={currentStepConfig}
            formData={formData}
            onFieldChange={handleFieldChange}
            products={products}
            onProductAdd={handleProductAdd}
            onProductRemove={handleProductRemove}
            onProductFieldChange={handleProductFieldChange}
            errors={errors}
          />

          {errors._save && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
              <p className="text-red-600 text-xs">{errors._save}</p>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-4">
          <button onClick={handleBack} disabled={currentStep === 0}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors
              ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}>
            ← Back
          </button>

          <div className="flex gap-3">
            {/* Save products button (on product steps) */}
            {currentStepConfig?.sections?.some(s => s.type === 'repeatable_items') && (
              <button onClick={handleSaveProducts} disabled={saving}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors">
                {saving ? 'Saving...' : '💾 Save Products'}
              </button>
            )}

            {!isLastStep ? (
              <button onClick={handleNext}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors">
                Next →
              </button>
            ) : (
              <button onClick={handleSaveProducts} disabled={saving}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-colors">
                {saving ? 'Publishing...' : '🚀 Publish Listing'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar — LivePreview + QualityScore */}
      <div className="w-[320px] flex-shrink-0 space-y-4">
        <QualityScore scoreData={scoreData} />
        <LivePreview
          brand={previewData?.brand}
          products={previewData?.products || products}
          cardConfig={previewData?.card_config || config?.card_config}
          actionTypes={previewData?.action_types || config?.action_types}
        />
      </div>
    </div>
  );
}
