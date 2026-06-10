'use strict';

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Schema service — reads JSON from public/schemas/{category_key}.json.
// Single source of truth for category schemas, consumed by the brand
// controller (listing config, /me/schema) AND the feature-gating
// middleware (requireBrandFeature). Falls back to a minimal generic
// schema for unknown categories so callers never crash on a missing file.
// ─────────────────────────────────────────────────────────────────────────────

const schemaCache = new Map();

// Legacy category aliases → canonical schema. Fashion was unified (2026-06-09):
// the old walk-in/online split is dropped (one listing, both CTAs). The legacy
// fashion_walkin.json / fashion_online.json are broken stubs (undefined step
// components) — map them to the good unified `fashion` schema so existing
// fashion_walkin/online brands list correctly.
const SCHEMA_ALIASES = { fashion_walkin: 'fashion', fashion_online: 'fashion' };

function loadSchema(categoryKey) {
  if (!categoryKey) return null;
  let key = categoryKey.toLowerCase().replace(/\s+/g, '_');
  key = SCHEMA_ALIASES[key] || key;
  if (schemaCache.has(key)) return schemaCache.get(key);

  const filePath = path.join(__dirname, '../../public/schemas', `${key}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(raw);
    schemaCache.set(key, schema);
    return schema;
  } catch {
    // Schema file not found — return a minimal generic schema
    const generic = {
      category_key: key,
      label: key.replace(/_/g, ' '),
      icon: '🏪',
      product_noun: 'Product',
      product_noun_plural: 'Products',
      features: { sections: false, veg_flag: false, duration_mins: false, stock: true, booking: false, enquiry_only: false },
      sections: [],
      availing_modes: ['pay_at_store'],
      fields: [
        { key: 'name',      label: 'Name',        type: 'text',     required: true  },
        { key: 'price',     label: 'Price (₹)',   type: 'number',   required: true  },
        { key: 'description', label: 'Description', type: 'textarea', required: false },
        { key: 'image_url', label: 'Image URL',   type: 'url',      required: false },
      ],
      buyer_config: { cta_label: 'Buy Now' },
    };
    schemaCache.set(key, generic);
    return generic;
  }
}

function clearSchemaCache() {
  schemaCache.clear();
}

module.exports = { loadSchema, clearSchemaCache };
