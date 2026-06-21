'use client';

import { brandApi } from '../../../../lib/api';

/**
 * publishDriver.js — storage_format-driven payload assembly + API call.
 *
 * Replaces the imperative handlePublish / handleSaveProducts that today's
 * ListingWizard.js (line 156-190) and CarRentalWizard.js (line 82-113) carry
 * separately. The contract has promised this since v1; PR-A finally wires it.
 *
 * Two API targets:
 *   1. brand.listing_data        — typed brand fields from BrandFieldsStep
 *   2. brand_products rows       — typed listing fields from RepeatableItemStep
 *                                  or single-product wizards (wizardState only)
 *
 * Storage_format spec source: template.product_config.storage_format on the
 * schema. The map's left side is a column on brand_products (or a dotted path
 * inside variants_json); the right side is a source expression:
 *   "wizard_state.foo"   — pull from wizardState[foo]
 *   "master_row.foo"     — pull from the master-catalogue row (when present)
 *   "literal:value"      — use the literal string after the colon
 *   bare string          — treated as wizard_state path for back-compat
 *
 * For RepeatableItemStep flows (restaurant menu, salon services), the layout
 * passes wizardItems[] and the driver POSTs one row per item. For single-
 * product wizards (a one-vehicle-at-a-time car_rental flow, or schemas with
 * no repeatable step), it POSTs a single row from wizardState.
 *
 * Brand-step skip handling lives in the layout (canSkipBrandSteps below).
 * The driver is invoked AFTER the user clicks Publish; it doesn't decide
 * whether brand fields were skipped.
 */

// ── canSkipBrandSteps ────────────────────────────────────────────────────────
// Predicate the layout uses to decide whether brand steps render.
// Refined per chat's lock-in: walks brand_config.fields[] where required:true
// and verifies each is non-empty in brand.listing_data. A half-filled brand
// profile (team_members yes, salon_description no) does NOT skip past the
// description step on listing #2.

export function canSkipBrandSteps(template, brand, myProducts) {
  if (!myProducts || myProducts.length === 0) return false;

  const brandFields = template?.brand_config?.fields || {};
  const listingData = brand?.listing_data || {};

  // Location (google_maps_url / locality) is captured at registration and lives
  // in brand COLUMNS (lat/lng/locality/formatted_address), not listing_data — so
  // a required location field would otherwise always read "empty" and force the
  // whole wizard to re-ask every step on each new dish. Treat it as satisfied
  // when the brand already has any location signal.
  const hasLocation = !!(brand?.lat && brand?.lng) || !!brand?.locality
    || !!brand?.formatted_address || !!listingData.google_maps_url || !!listingData.locality;

  for (const [key, fieldDef] of Object.entries(brandFields)) {
    if (!fieldDef?.required) continue;
    if ((key === 'google_maps_url' || key === 'locality') && hasLocation) continue;
    const value = listingData[key];
    if (isEmptyValue(value)) return false;
  }
  return true;
}

function isEmptyValue(v) {
  if (v == null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return true;
  return false;
}

// ── Source resolution ────────────────────────────────────────────────────────

function resolveSource(spec, ctx) {
  if (typeof spec !== 'string') return spec;

  if (spec.startsWith('literal:')) {
    const rest = spec.slice('literal:'.length);
    // Coerce common literal types so storage_format can express booleans/null
    // without the consuming column receiving the string "true" / "null".
    if (rest === 'true')  return true;
    if (rest === 'false') return false;
    if (rest === 'null')  return null;
    if (/^-?\d+(\.\d+)?$/.test(rest)) return Number(rest);
    return rest;
  }

  if (spec.startsWith('master_row.')) {
    return readPath(ctx.masterRow, spec.slice('master_row.'.length));
  }

  if (spec.startsWith('wizard_state.')) {
    return readPath(ctx.wizardState, spec.slice('wizard_state.'.length));
  }

  // Bare string — treat as wizard_state path.
  return readPath(ctx.wizardState, spec);
}

function readPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

// ── Payload assembly ─────────────────────────────────────────────────────────

function assembleProductPayload(storageFormat, ctx) {
  const payload = {};
  for (const [column, spec] of Object.entries(storageFormat || {})) {
    if (typeof spec === 'object' && spec !== null && !Array.isArray(spec)) {
      // Nested JSON sub-object (e.g. variants_json: { day_rate: "number", ... })
      // For PR-A we treat this as a hint that the column receives a JSON object;
      // we collect children under a sub-namespace in wizardState. Templates
      // needing complex shapes should use customPublish.
      payload[column] = collectNestedJson(spec, ctx, column);
    } else {
      payload[column] = resolveSource(spec, ctx);
    }
  }
  return payload;
}

function collectNestedJson(subSpec, ctx, columnName) {
  // Look for ctx.wizardState[columnName] — if present, use it as-is.
  // Otherwise walk the sub-spec keys and pull from wizard_state by name.
  const direct = ctx.wizardState?.[columnName];
  if (direct && typeof direct === 'object') return direct;

  const out = {};
  for (const [key, typeOrSpec] of Object.entries(subSpec)) {
    if (typeof typeOrSpec === 'object') {
      out[key] = collectNestedJson(typeOrSpec, ctx, key);
    } else {
      // typeOrSpec is "string" / "number" / "boolean" / "string[]" — a type hint.
      // Source the value from wizardState by the same key name.
      out[key] = readPath(ctx.wizardState, key);
    }
  }
  return out;
}

// ── Brand listing_data updates ───────────────────────────────────────────────

function extractBrandListingData(template, wizardState) {
  const brandFields = template?.brand_config?.fields || {};
  const out = {};
  for (const key of Object.keys(brandFields)) {
    if (wizardState[key] !== undefined) out[key] = wizardState[key];
  }
  return out;
}

// ── Public driver ────────────────────────────────────────────────────────────

/**
 * runPublish — execute the publish flow for a wizard session.
 *
 * Returns: { brand_updated, products_created, errors[] }
 */
export async function runPublish({ template, brand, wizardState, wizardItems }) {
  const errors = [];
  let brandUpdated = false;
  let productsCreated = 0;

  // 1. Brand listing_data update (only if any brand_config field was touched)
  const brandPatch = extractBrandListingData(template, wizardState);
  if (Object.keys(brandPatch).length > 0) {
    try {
      const next = { ...(brand?.listing_data || {}), ...brandPatch };
      const res = await brandApi.patch('/brands/me', { listing_data: next });
      // The brand-web API client RESOLVES on non-2xx (returns {success:false})
      // instead of throwing — so we MUST inspect the envelope, not just the
      // absence of a throw, or a rejected save is counted as a success.
      if (res && (res.ok === true || res.success === true)) {
        brandUpdated = true;
      } else {
        errors.push(`Brand profile didn't save: ${res?.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      errors.push(`Brand profile didn't save: ${err.message || err}`);
    }
  }

  // 2. Product rows
  const storageFormat = template?.product_config?.storage_format;
  const itemsToCreate = (wizardItems && wizardItems.length > 0) ? wizardItems : [wizardState];

  for (const item of itemsToCreate) {
    // For repeatable items, each item is its own wizardState slice.
    // The driver gives the per-item state precedence over the outer wizardState.
    const ctx = {
      wizardState: { ...wizardState, ...item },
      masterRow: item?._master_row || wizardState?._master_row || null,
    };
    const payload = storageFormat
      ? assembleProductPayload(storageFormat, ctx)
      : defaultPayload(ctx.wizardState);

    if (!payload.name || payload.price == null) {
      // Skip empty rows silently — restaurant menu authors often leave a blank
      // last-row when adding items. Don't surface as error.
      continue;
    }

    try {
      const productRes = await brandApi.post('/brands/me/products', payload);
      // Honest-save: the API client resolves on non-2xx (returns
      // {success:false}) — a rejected POST must NOT be counted as created.
      if (!productRes || !(productRes.ok === true || productRes.success === true)) {
        errors.push(`"${payload.name}" didn't save: ${productRes?.error?.message || 'Unknown error'}`);
        continue;
      }
      productsCreated += 1;

      // Fashion-1: if the item carries `_variants`, write them via the
      // dedicated variants endpoint after the product is created. The
      // variants endpoint is opt-in per product — categories without
      // variants (restaurant/salon/car_rental) simply don't populate
      // `_variants` on wizardItems and this branch is skipped.
      const variants = Array.isArray(item?._variants) ? item._variants : null;
      const newProductId = productRes?.data?.product?.id || productRes?.data?.id || productRes?.product?.id;
      if (variants && variants.length > 0 && newProductId) {
        const varRes = await brandApi.post(`/brands/me/products/${newProductId}/variants`, { variants });
        if (!varRes || !(varRes.ok === true || varRes.success === true)) {
          errors.push(`Variants for "${payload.name}" didn't save: ${varRes?.error?.message || 'Unknown error'}`);
        }
      }

      // Food World P2: dish customisation authored in the Customise modal rides
      // on the wizard item under underscore keys. Write add-on/variation groups
      // via the dedicated endpoint, and badge/featured via PATCH — both after
      // the product row exists. Non-food items don't populate these → skipped.
      const addonGroups = Array.isArray(item?._addon_groups) ? item._addon_groups : null;
      if (addonGroups && addonGroups.length > 0 && newProductId) {
        const agRes = await brandApi.post(`/brands/me/products/${newProductId}/addon-groups`, { groups: addonGroups });
        if (!agRes || !(agRes.ok === true || agRes.success === true)) {
          errors.push(`Customisation for "${payload.name}" didn't save: ${agRes?.error?.message || 'Unknown error'}`);
        }
      }
      if (newProductId && (item?._badge != null || item?._is_featured != null)) {
        const patch = {};
        if (item._badge != null) patch.badge = item._badge;
        if (item._is_featured != null) patch.is_featured = item._is_featured === true;
        const pRes = await brandApi.patch(`/brands/me/products/${newProductId}`, patch);
        if (!pRes || !(pRes.ok === true || pRes.success === true)) {
          errors.push(`Badge/featured for "${payload.name}" didn't save: ${pRes?.error?.message || 'Unknown error'}`);
        }
      }
    } catch (err) {
      errors.push(`"${payload.name}" didn't save: ${err.message || err}`);
    }
  }

  return { brand_updated: brandUpdated, products_created: productsCreated, errors };
}

// Fallback when template has no storage_format defined — copies wizardState
// directly with a sensible field set. Generic categories without the
// storage_format declaration still work, just with hardcoded keys.
function defaultPayload(state) {
  return {
    name: state.name,
    price: state.price,
    description: state.description || '',
    section: state.section || null,
    veg_flag: state.veg_flag || 'na',
    image_url: state.image_url || '',
    stock: state.stock || null,
    variants_json: state.variants_json || null,
    duration_mins: state.duration_mins || null,
  };
}
