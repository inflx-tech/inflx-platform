'use client';
import { useState, useEffect, useCallback } from 'react';
import { brandApi } from '../../../../lib/api';
import ListingTemplateLayout from './ListingTemplateLayout';

/**
 * ListingWizard — top-level orchestrator.
 *
 * Loads /brands/me/listing-config + products + quality-score, then mounts
 * <ListingTemplateLayout /> with the loaded template. Every category
 * (car_rental, restaurant, salon, future verticals) routes through the
 * shared layout via templateRegistry.
 *
 * PR-3 deleted the CUSTOM_WIZARDS escape hatch + the legacy
 * CarRentalWizard.js + DynamicStepRenderer.js. Schema-driven layout is
 * the only path forward.
 */

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

  // After a publish, three things change: products[], the quality score,
  // AND brand.listing_data (when the publish updated brand fields). We
  // refresh all three so the next "Add" tap correctly skips brand steps
  // (canSkipBrandSteps reads brand.listing_data).
  const refreshProducts = useCallback(async () => {
    try {
      const [productsRes, scoreRes, configRes] = await Promise.all([
        brandApi.get('/brands/me/products'),
        brandApi.get('/brands/me/quality-score').catch(() => null),
        brandApi.get('/brands/me/listing-config').catch(() => null),
      ]);
      if (productsRes.data?.products) setProducts(productsRes.data.products);
      if (scoreRes?.data) setScoreData(scoreRes.data);
      if (configRes?.data) setBrand(configRes.data);
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
