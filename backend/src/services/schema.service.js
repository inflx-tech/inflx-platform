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

function loadSchema(categoryKey) {
  if (!categoryKey) return null;
  const key = categoryKey.toLowerCase().replace(/\s+/g, '_');
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
