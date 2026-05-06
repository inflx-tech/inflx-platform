'use client';
import { useState, useEffect, useCallback } from 'react';
import { brandApi } from '../../../../lib/api';
import ListingTemplateLayout from './ListingTemplateLayout';

// Business-specific custom wizards (legacy path, kept until PR-C migration)
import CarRentalWizard from './car-rental/CarRentalWizard';

/**
 * ListingWizard — top-level orchestrator.
 *
 * Loads /brands/me/listing-config + products + quality-score, then either:
 *   (a) routes to a legacy CUSTOM_WIZARDS entry (car_rental today), OR
 *   (b) mounts <ListingTemplateLayout /> with the loaded template.
 *
 * Path (a) preserves car_rental's existing production flow unchanged in PR-A.
 * Path (b) uses the new shared layout for everything else. Restaurant + salon
 * register their step components in templateRegistry.js (PR-B). Car_rental
 * migrates to path (b) in PR-C, at which point CarRentalWizard.js and the old
 * DynamicStepRenderer.js are deleted.
 */

// Map of category_key → custom wizard component (legacy path).
// PR-C empties this and deletes CarRentalWizard.js per success criteria.
const CUSTOM_WIZARDS = {
  car_rental: CarRentalWizard,
};

export default function ListingWizard() {
  const [config, setConfig] = useState(null);
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [scoreData, setScoreData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Load config + products + score ────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      const [configRes, productsRes, scoreRes] = await Promise.all([
        brandApi.get('/brands/me/listing-config'),
        brandApi.get('/brands/me/products'),
        brandApi.get('/brands/me/quality-score').catch(() => null),
      ]);

      setConfig(configRes.data?.config || null);
      setBrand(configRes.data || null);
      setProducts(productsRes.data?.products || []);
      if (scoreRes?.data) setScoreData(scoreRes.data);

      // Preview is best-effort — failures don't block listing
      const previewRes = await brandApi.get('/brands/me/listing-preview').catch(() => null);
      if (previewRes?.data) setPreviewData(previewRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load listing config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refreshProducts = useCallback(async () => {
    try {
      const res = await brandApi.get('/brands/me/products');
      if (res.data?.products) setProducts(res.data.products);
      const scoreRes = await brandApi.get('/brands/me/quality-score').catch(() => null);
      if (scoreRes?.data) setScoreData(scoreRes.data);
    } catch (e) {
      console.error('refreshProducts failed:', e);
    }
  }, []);

  // ── Render guards ──────────────────────────────────────────────────────────

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

  // ── Custom wizard routing — MUST stay above the layout fallback ───────────
  // Preserves production flow for car_rental (and any other entry in
  // CUSTOM_WIZARDS) until PR-C migration.

  const categoryKey = config?.category_key;
  const CustomWizard = categoryKey ? CUSTOM_WIZARDS[categoryKey] : null;

  if (CustomWizard) {
    return <CustomWizard config={config} />;
  }

  // ── Default — schema-driven layout ─────────────────────────────────────────

  if (!config) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-500 text-sm">Listing wizard not available for this category yet.</p>
      </div>
    );
  }

  return (
    <ListingTemplateLayout
      template={config}
      brand={brand}
      myProducts={products}
      scoreData={scoreData}
      previewData={previewData}
      onRefreshProducts={refreshProducts}
    />
  );
}
