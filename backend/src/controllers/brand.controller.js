'use strict';

const db   = require('../config/db');
const notificationService = require('../services/notification.service');
const entitlementsService = require('../services/entitlements.service');
const { loadSchema, clearSchemaCache } = require('../services/schema.service');
const dishFlywheel = require('../services/dishFlywheel.service');
const tagsService = require('../services/tags.service');
const { collectProductIds } = require('../services/offerConfig.validator');
const { success } = require('../utils/response');
const { verticalFor } = require('../utils/vertical');
const AppError    = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { resolveProductImage } = require('../utils/productImage');
const businessCategory = require('../services/businessCategory.model');
// Item 2 — the eight fashion sub-categories + the pitch summary a creator sees.
// Contract: features/item2-pitch-invitation-settings
const referenceLists = require('../services/referenceLists.service');
const eligibility = require('../services/collabEligibility.service');
// Item 3 — branches, published products, storage checks for the logo.
// Contract: features/item3-discovery-profiles-groups
const branchesService = require('../services/brandBranches.service');
const brandProducts = require('../services/brandProducts.service');
const storageService = require('../services/storage.service');
// registration-and-profile — what "complete" means, the encrypted bank entry.
const completeness = require('../services/profileCompleteness.service');
const { encrypt } = require('../utils/encrypt');
// offer-builder-v2 — auto-add on create, creator notices on a price change.
const offerLife = require('../services/offerLife.service');
const stockService = require('../services/stock.service');
// product-approval-switch: every publish (create, Show) passes through the admin switch.
const productApproval = require('../services/productApproval.service');

const LOGO_MSG = 'Upload a JPG or PNG under 5 MB.';
const LOGO_MAX_BYTES = 5 * 1024 * 1024;
function stableAssetUrl(id) {
  const base = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${base}/v1/media/assets/${id}`;
}
function fieldError(field, code, message) {
  return new AppError('VALIDATION_ERROR', message, 422, field, { fields: [{ field, code, message }] });
}

/**
 * Item 2 (founder Q5b, rules v1.10 §8A): a brand picks Fashion, then one or more of the
 * eight sub-categories. Required at registration and in Business details. Codes come from
 * ref_brand_categories, so the list can only be changed in one place.
 * Returns the cleaned array or throws the 422 the form shows.
 */
async function validateSubCategories(value, { required }) {
  if (value === undefined) {
    if (required) throw new AppError('VALIDATION_ERROR', 'Pick at least one category your brand sells.', 422, 'sub_categories');
    return undefined;
  }
  const arr = Array.isArray(value) ? [...new Set(value.map(v => String(v).trim().toUpperCase()).filter(Boolean))] : [];
  if (!arr.length) throw new AppError('VALIDATION_ERROR', 'Pick at least one category your brand sells.', 422, 'sub_categories');
  const bad = referenceLists.unknownCodes(arr, await referenceLists.brandCategories());
  if (bad.length) throw new AppError('VALIDATION_ERROR', `Unknown category: ${bad.join(', ')}`, 422, 'sub_categories');
  return arr;
}

// Category-aware validation using schema
function validateProductFields(schema, body) {
  const errors = [];
  if (!schema) return errors;
  for (const field of (schema.fields || [])) {
    if (field.required && (body[field.key] == null || body[field.key] === '')) {
      errors.push({ field: field.key, message: `${field.label} is required` });
    }
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getBrandByUserId(userId) {
  const { rows } = await db.query(
    `SELECT b.*, u.status AS user_status, u.phone, u.phone AS login_phone, u.name, u.fcm_token,
            -- A brand's city and state live on the USER row — there is no brands.city
            -- column. The admin page asked for brand.city and so always printed a dash.
            -- Contract: features/admin-account-review
            u.city, u.state, u.created_at AS user_created_at
     FROM brands b
     JOIN users u ON u.id = b.user_id
     WHERE b.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getBrandById(brandId) {
  const { rows } = await db.query(
    `SELECT b.*, u.status AS user_status, u.phone, u.phone AS login_phone, u.name, u.fcm_token,
            -- Same reason as above: the admin brand page asked for brand.city, which does
            -- not exist on brands. Contract: features/admin-account-review
            u.city, u.state, u.created_at AS user_created_at
     FROM brands b
     JOIN users u ON u.id = b.user_id
     WHERE b.id = $1`,
    [brandId]
  );
  return rows[0] || null;
}

function sanitiseBrand(brand) {
  // Never return internal admin fields to non-admin callers, and never the bank account
  // number — only whether one is on file (registration-and-profile §5).
  const { fcm_token, bank_account_no, ...safe } = brand;
  safe.has_bank_account = !!bank_account_no;
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/register
// ─────────────────────────────────────────────────────────────────────────────

/**
 * registration-and-profile (spec §2.2, §2.3): the seven fields, every one required and
 * validated here. State and city arrive as ids from the offered lists and are resolved to a
 * canonical row on the way in — there is no longer any path that writes an unresolved city
 * name. A typed `city`/`state` pair is still accepted from phones on the previous bundle and
 * is resolved against the same lists; when it does not resolve the registration is refused.
 * latitude / longitude / locality / formatted_address / google_maps_url / referral_code are
 * no longer read — they are simply ignored, so an old phone is not broken mid-OTA.
 */
async function resolvePickedCity({ state_id, city_id, state, city }, field = 'city_id') {
  let resolved = null;
  if (state_id != null || city_id != null) {
    resolved = await referenceLists.resolveStateCity(state_id, city_id);
    if (!resolved) throw fieldError(field, 'CITY_REQUIRED', 'Pick your state, then your city.');
    return resolved;
  }
  if (state && city) {
    resolved = await referenceLists.resolveStateCityNames(state, city);
    if (!resolved) throw fieldError(field, 'CITY_REQUIRED', 'Pick your state, then your city.');
    return resolved;
  }
  throw fieldError(field, 'CITY_REQUIRED', 'Pick your state, then your city.');
}

const register = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const {
    name,           // brand contact's real name; verify-otp wrote "Brand User" as a placeholder
    business_name,
    category,
    sub_categories, // Item 2 — one or more of the eight fashion sub-categories (required)
    address_line,
    pincode,
  } = req.body;

  if (!business_name || !business_name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'business_name is required', 422, 'business_name');
  }
  // Business type stays stated, not chosen: Fashion. An absent category means fashion; a
  // present one still has to pass THE CUT's gate (Docs/THE_CUT.md pass 0).
  const cat = category && String(category).trim() ? String(category).trim() : 'fashion';
  if (!businessCategory.isAcceptedCategory(cat)) {
    throw new AppError('VALIDATION_ERROR', businessCategory.rejectionMessage(), 422, 'category');
  }
  // Item 2 — check 15: a new brand cannot finish registration without a sub-category.
  const subCategories = await validateSubCategories(sub_categories, { required: true });
  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }
  if (!address_line || !address_line.trim()) {
    throw new AppError('VALIDATION_ERROR', 'address_line is required', 422, 'address_line');
  }
  // courier-ready-addresses (founder, 7 Oct 2026): the registration address IS the Main Branch,
  // and a courier has to be able to find it — the same rule Add / Edit branch applies.
  const streetCode = branchesService.streetProblem(address_line);
  if (streetCode) {
    throw new AppError('VALIDATION_ERROR', branchesService.streetMessage(streetCode), 422, 'address_line',
      { fields: [{ field: 'address_line', code: streetCode, message: branchesService.streetMessage(streetCode) }] });
  }
  if (!pincode || !/^[0-9]{6}$/.test(String(pincode).trim())) {
    throw new AppError('VALIDATION_ERROR', 'pincode must be a 6-digit number', 422, 'pincode');
  }
  const place = await resolvePickedCity(req.body);

  // Idempotency: disallow duplicate registration
  const existing = await getBrandByUserId(userId);
  if (existing) {
    throw new AppError('CONFLICT', 'Brand profile already exists for this account', 409);
  }

  // The users row carries the contact name and the resolved city/state names (there is no
  // brands.city column). Written first so a failed insert leaves the name updated.
  await db.query(
    `UPDATE users SET name = $2, city = $3, state = $4 WHERE id = $1`,
    [userId, name.trim(), place.cityName, place.stateName]
  );

  const { rows } = await db.query(
    `INSERT INTO brands (user_id, business_name, category, address_line, pincode, sub_categories)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, business_name.trim(), cat, address_line.trim(), String(pincode).trim(), subCategories]
  );

  const brand = rows[0];

  // The registration address is the brand's Main Branch (spec §4, §7) — with the resolved
  // city and state ids, so creators see its city from day one.
  await branchesService.ensureMainFromBrandRow(brand.id, { cityId: place.cityId, stateId: place.stateId })
    .catch((e) => console.error('[branches] seeding the main branch failed:', e.message));

  // Fetch with user status joined
  const full = await getBrandById(brand.id);

  return success(res, {
    brand: sanitiseBrand(full),
    user_status: full.user_status,
    completeness: await completeness.forBrand(brand.id),
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me
// ─────────────────────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  // Item 3 (A1 header): branches and the main city, plus the sub-category reminder flag.
  // registration-and-profile: the completeness roll-up the profile tab and Submit read.
  const [branches, mainCity, complete] = await Promise.all([branchesService.list(brand.id), branchesService.mainCity(brand.id), completeness.forBrand(brand.id)]);
  return success(res, {
    brand: sanitiseBrand(brand), user_status: brand.user_status,
    branches, mainCity,
    needsSubCategories: !Array.isArray(brand.sub_categories) || brand.sub_categories.length === 0,
    needsMainCity: !mainCity,
    completeness: complete,
    submitted_for_review_at: brand.submitted_for_review_at || null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/submit-for-review   (also POST /brands/resubmit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * registration-and-profile §6: the account reaches the admin queue when the brand submits
 * it, not when it registers. Refused while incomplete, with the list. A rejected brand
 * edits its own form (PATCH /brands/me) and then submits again through the same door —
 * that is the resubmit the old endpoint pretended to be.
 */
const submitForReview = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  if (brand.user_status === 'approved') throw new AppError('CONFLICT', 'This account is already approved.', 409);
  if (brand.user_status === 'suspended') throw new AppError('CONFLICT', 'This account is suspended. Contact support.', 409);
  const summary = await completeness.forBrand(brand.id);
  if (!summary.complete) throw completeness.incompleteError(AppError, summary, 'user');
  await db.query(`UPDATE brands SET submitted_for_review_at = now(), rejection_reason = NULL, updated_at = now() WHERE id = $1`, [brand.id]);
  if (brand.user_status === 'rejected') {
    await db.query(`UPDATE users SET status = 'pending' WHERE id = $1`, [brand.user_id]);
  }
  return success(res, { user_status: 'pending', submitted: true, message: 'Sent for review. Usually within 24 hours.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /brands/me
// ─────────────────────────────────────────────────────────────────────────────


const updateMe = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);

  // Phase A12.6 — multi_branch_support gate.
  // brands.listing_data.branches is a jsonb array; branches[0] is the
  // Main Branch (auto-named by the UI), branches[1..] are additional
  // branches added via the profile editor's "+ Add Branch" button.
  // Free/Growth tiers may only save 1 branch (Main); Pro/Enterprise
  // unlimited.
  //
  // Grandfathering: the gate uses count-is-increasing logic — it fires
  // only when the patch is ADDING branches beyond the existing count.
  // Existing brands with multi-branch data saved (pre-M067) can still
  // edit other profile fields without being locked out, because the
  // frontend always re-sends the full listing_data on every save.
  // Reducing branch count is never gated.
  //
  // Defensive fail-open via requireFeature/is_enforced (pre-M067 the
  // gate is a no-op).
  const incomingBranches = req.body.listing_data?.branches;
  if (Array.isArray(incomingBranches) && incomingBranches.length > 1) {
    const existing      = brand.listing_data?.branches;
    const existingCount = Array.isArray(existing) ? existing.length : 0;
    if (incomingBranches.length > existingCount) {
      await entitlementsService.requireFeature(db, brand.id, 'multi_branch_support', {
        label: 'Multi-branch support',
      });
    }
  }

  // Whitelist of updatable fields. lat/lng are the CANONICAL distance columns
  // (mig 051 index + discovery rules read these); latitude/longitude are legacy.
  // registration-and-profile §9: lat/lng/latitude/longitude/locality/formatted_address and
  // google_maps_url are no longer accepted — coordinates are not captured anywhere any more.
  // address_line/pincode are written through the main branch (below), never here directly.
  const allowed = ['business_name', 'category', 'gstin', 'logo_url', 'listing_data', 'cover_image_url'];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  // Item 2 — Business details can set the sub-categories (existing brands have none yet).
  // Validated against ref_brand_categories; at least one when the field is written.
  if (req.body.sub_categories !== undefined) {
    updates.sub_categories = await validateSubCategories(req.body.sub_categories, { required: true });
  }

  // Item 3 (A2 Business details) — the same rules and words the app shows (prompt §7).
  if (req.body.business_name !== undefined && !String(req.body.business_name || '').trim()) {
    throw fieldError('business_name', 'NAME_REQUIRED', 'Enter your brand name.');
  }
  if (req.body.contact_person !== undefined) {
    const v = String(req.body.contact_person || '').trim();
    if (!v) throw fieldError('contact_person', 'CONTACT_REQUIRED', 'Enter a contact person.');
    updates.contact_person = v;
  }
  if (req.body.about !== undefined) {
    const v = req.body.about == null ? null : String(req.body.about).trim();
    if (v && v.length > 200) throw fieldError('about', 'ABOUT_TOO_LONG', 'Keep it under 200 characters.');
    updates.about = v || null;
  }
  if (req.body.website_url !== undefined) {
    const v = req.body.website_url == null ? null : String(req.body.website_url).trim();
    updates.website_url = v || null;
  }
  if (req.body.instagram_handle !== undefined) {
    const v = req.body.instagram_handle == null ? null : String(req.body.instagram_handle).trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').toLowerCase();
    updates.instagram_handle = v || null;
  }
  // Logo: the app uploads through /brands/me/media-assets (tag 'logo') and then saves the
  // asset id here. The server re-checks what was actually stored: JPG or PNG, ≤ 5 MB
  // (founder Q16). logo_url: null removes it.
  if (req.body.logo_asset_id !== undefined) {
    if (req.body.logo_asset_id === null || req.body.logo_asset_id === '') {
      updates.logo_url = null;
    } else {
      const { rows: a } = await db.query(
        `SELECT id, file_r2_key, file_type, file_size_bytes FROM brand_media_assets WHERE id = $1 AND brand_id = $2`,
        [req.body.logo_asset_id, brand.id]
      );
      if (!a[0]) throw fieldError('logo_asset_id', 'LOGO_TYPE_SIZE', LOGO_MSG);
      const head = await storageService.headObject(a[0].file_r2_key);
      const type = String((head && head.contentType) || a[0].file_type || '').toLowerCase();
      const size = Number((head && head.size) || a[0].file_size_bytes || 0);
      if (!/^image\/(jpe?g|png)$/.test(type) || size > LOGO_MAX_BYTES) {
        throw fieldError('logo_asset_id', 'LOGO_TYPE_SIZE', LOGO_MSG);
      }
      updates.logo_url = stableAssetUrl(a[0].id);
    }
  }

  // Docs/THE_CUT.md pass 0 — closing signup alone would not have held. A brand could
  // register as fashion and then switch itself to restaurant from the profile edit,
  // which is the same door in a different wall. Checked only when the field is actually
  // being written, so the nine existing brands (one of them a restaurant) can still
  // edit their address, logo and everything else without being forced to re-categorise.
  if (updates.category !== undefined && !businessCategory.isAcceptedCategory(updates.category)) {
    throw new AppError('VALIDATION_ERROR', businessCategory.rejectionMessage(), 422, 'category');
  }

  // Wave 2 (Dining) — mirror cover_image_url from nested listing_data into
  // the typed brands.cover_image_url column so discovery queries can SELECT
  // it without unpacking JSONB. publishDriver writes the wizard cover into
  // listing_data; this mirror keeps the typed column in sync without
  // requiring the driver to learn which keys are typed.
  if (req.body.listing_data?.cover_image_url !== undefined && updates.cover_image_url === undefined) {
    updates.cover_image_url = req.body.listing_data.cover_image_url;
  }

  // registration-and-profile §3.2, §5, §7 — email (collected only), the bank entry (account
  // number + IFSC together, encrypted like the creator's), and the address as the main branch.
  if (req.body.email !== undefined) {
    const v = req.body.email == null ? null : String(req.body.email).trim().toLowerCase();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw fieldError('email', 'EMAIL_INVALID', 'Enter a valid email address.');
    updates.email = v || null;
  }
  if (req.body.bank_account_no !== undefined || req.body.bank_ifsc !== undefined) {
    const acct = req.body.bank_account_no == null ? '' : String(req.body.bank_account_no).replace(/\s+/g, '');
    const ifsc = req.body.bank_ifsc == null ? '' : String(req.body.bank_ifsc).trim().toUpperCase();
    if (!acct && !ifsc) { updates.bank_account_no = null; updates.bank_ifsc = null; }
    else if (!acct || !ifsc) throw fieldError(acct ? 'bank_ifsc' : 'bank_account_no', 'BANK_PAIR', 'Enter the account number and the IFSC together.');
    else { updates.bank_account_no = encrypt(acct); updates.bank_ifsc = ifsc; }
  }
  const addressKeys = ['address_line', 'pincode', 'state_id', 'city_id'];
  const addressPatch = addressKeys.some(k => req.body[k] !== undefined);
  if (addressPatch) {
    try {
      await branchesService.setMainAddress(brand.id, {
        address_text: req.body.address_line, pincode: req.body.pincode, state_id: req.body.state_id, city_id: req.body.city_id,
      });
    } catch (e) {
      if (e && e.code === 'VALIDATION_ERROR') throw new AppError('VALIDATION_ERROR', e.message, 422, e.field || null, e.details || null);
      throw e;
    }
  }

  if (Object.keys(updates).length === 0 && !addressPatch) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
    const values = [brand.id, ...Object.values(updates)];
    await db.query(`UPDATE brands SET ${setClauses.join(', ')} WHERE id = $1`, values);
  }

  const updated = await getBrandById(brand.id);
  return success(res, { brand: sanitiseBrand(updated), completeness: await completeness.forBrand(brand.id) });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/:id  (admin only)
// ─────────────────────────────────────────────────────────────────────────────

const getById = asyncHandler(async (req, res) => {
  const brand = await getBrandById(req.params.id);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  // registration-and-profile §9A.1: the review page's missing list comes from the one rule.
  const [complete, branches] = await Promise.all([completeness.forBrand(brand.id), branchesService.list(brand.id)]);
  const { bank_account_no, ...safe } = brand;
  safe.has_bank_account = !!bank_account_no;
  return success(res, { brand: safe, completeness: complete, missing_fields: complete.missing_labels, branches, submitted_for_review_at: brand.submitted_for_review_at || null });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /brands/:id/status  (admin approve / reject)
// ─────────────────────────────────────────────────────────────────────────────

const updateStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const adminUserId = req.user.sub;

  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be approved, rejected, or suspended', 422, 'status');
  }
  if (status === 'rejected' && !reason) {
    throw new AppError('VALIDATION_ERROR', 'reason is required when rejecting an account', 422, 'reason');
  }

  const brand = await getBrandById(req.params.id);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  // Update brand record
  if (status === 'approved') {
    // Founder, 19 Sep 2026 (amending registration-and-profile §6.3): approval is the team's
    // manual check, not a completeness check — the missing list informs, never blocks.
    await db.query(
      `UPDATE brands SET rejection_reason = NULL, approved_at = now(), approved_by = $2 WHERE id = $1`,
      [brand.id, adminUserId]
    );
  } else if (status === 'rejected') {
    await db.query(
      `UPDATE brands SET rejection_reason = $2, approved_at = NULL, approved_by = NULL WHERE id = $1`,
      [brand.id, reason]
    );
  }

  // Update user status
  await db.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, brand.user_id]);

  const updated = await getBrandById(brand.id);

  // Send notification to brand user
  const templates = {
    approved: {
      type: 'account.approved',
      title: 'Account Approved',
      body: 'Your brand account is approved. Start creating campaigns!',
    },
    rejected: {
      type: 'account.rejected',
      title: 'Account Needs More Info',
      body: `Your account needs more info. Reason: ${reason}`,
    },
    suspended: {
      type: 'account.suspended',
      title: 'Account Suspended',
      body: 'Your account has been suspended. Please contact support.',
    },
  };

  const tpl = templates[status];
  await notificationService.send({
    userId: brand.user_id,
    type: tpl.type,
    title: tpl.title,
    body: tpl.body,
    data: { screen: 'brand_dashboard' },
    fcmToken: brand.fcm_token,
    sendSms: true,
    phone: brand.phone,
  });

  return success(res, { brand: updated, notification_sent: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/resubmit
// ─────────────────────────────────────────────────────────────────────────────

// registration-and-profile §6.4: resubmit used to flip the status back and resend the identical
// data. It is now the same door as Submit for review — refused when incomplete, and only
// meaningful from rejected.
const resubmit = asyncHandler(async (req, res, next) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  if (brand.user_status !== 'rejected') {
    throw new AppError('CONFLICT', 'Account can only be resubmitted when in rejected status', 409);
  }
  return submitForReview(req, res, next);
});

// ─────────────────────────────────────────────────────────────────────────────
// Products CRUD  (brand_products table)
// GET  /brands/me/products
// POST /brands/me/products
// PATCH /brands/me/products/:pid
// DELETE /brands/me/products/:pid
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/schema  — return the category schema for the authenticated brand
// ─────────────────────────────────────────────────────────────────────────────

const getCategorySchema = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const schema = loadSchema(brand.category);
  if (!schema) throw new AppError('NOT_FOUND', `No schema found for category: ${brand.category}`, 404);

  return success(res, { schema });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/products
// ─────────────────────────────────────────────────────────────────────────────

const listProducts = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { section, is_active } = req.query;
  const conditions = ['brand_id = $1'];
  const params = [brand.id];

  if (section) { params.push(section); conditions.push(`section = $${params.length}`); }
  if (is_active !== undefined) { params.push(is_active === 'true'); conditions.push(`is_active = $${params.length}`); }

  // category_label / category_path come from the listing tree, so the shared product
  // picker can GROUP products the way the catalogue is actually organised rather than by
  // the older free-text `section`. Contract: features/stage-2-build-a-campaign-from-the-phone
  // (slice 1, ledger #86/#87). category_nodes carries denormalised segment and category,
  // so the readable path is a join and not a recursive walk.
  // Products with no node keep NULL and the picker files them under "Other ·
  // uncategorised" — visible and selectable, because hiding them would hide real stock.
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.description, p.price, p.category_key, p.sku, p.section,
            p.veg_flag, p.duration_mins, p.variants_json, p.image_url, p.facets,
            p.is_active, p.is_bookable, p.stock, p.availability_json,
            p.booking_config_json, p.tags, p.pushed_to_store,
            p.approval_status, p.approval_note, p.approval_requested_at,
            p.badge, p.is_featured, p.featured_sort, p.created_at, p.updated_at,
            p.category_node_id,
            cn.name AS category_label,
            NULLIF(concat_ws(' › ', cn.segment, cn.category, cn.name), '') AS category_path
     FROM brand_products p
     LEFT JOIN category_nodes cn ON cn.id = p.category_node_id
     WHERE ${conditions.map(c => `p.${c}`).join(' AND ')}
     ORDER BY cn.name NULLS LAST, p.section NULLS LAST, p.name ASC`,
    params
  );

  // Resolve a display image per product (image_url OR variant/facet images) so
  // pickers/lists show a real thumbnail, never a blank (offer product finder).
  const products = rows.map((r) => ({ ...r, image_url: resolveProductImage(r) }));
  const schema = loadSchema(brand.category);
  return success(res, { products, schema, category: brand.category });
});

// GET /brands/me/offer-categories — the COMPLETE set of categories a brand can
// scope an offer to = the distinct `category` level of its vertical taxonomy
// (offers match brand_products.section, which is set to the node's category).
// Comprehensive (every category in the world, not just ones with products yet),
// so the offer builder's Category picker isn't limited to current inventory.
const getOfferCategories = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const vertical = verticalFor(brand.category);
  const { rows } = await db.query(
    `SELECT DISTINCT category FROM category_nodes
      WHERE vertical = $1 AND category IS NOT NULL AND category <> ''
      ORDER BY category ASC`,
    [vertical]
  );
  return success(res, { categories: rows.map((r) => r.category), vertical });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/products
// ─────────────────────────────────────────────────────────────────────────────

const createProduct = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const schema = loadSchema(brand.category);

  const {
    name, description, price,
    section, veg_flag, duration_mins,
    variants_json, image_url, sku,
    is_bookable, stock,
    availability_json, booking_config_json,
    master_vehicle_id, master_service_id, master_dish_id,
    tags, pushed_to_store,
  } = req.body;

  // For master-catalogue activations, skip schema validation (name/image come from master)
  const isMasterActivation = master_vehicle_id != null || master_service_id != null || master_dish_id != null;
  if (!isMasterActivation) {
    const validationErrors2 = validateProductFields(schema, req.body);
    if (validationErrors2.length > 0) {
      throw new AppError('VALIDATION_ERROR', validationErrors2[0].message, 422, validationErrors2[0].field);
    }
  }

  if (!name || !name.trim()) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');

  // product-approval-switch (spec §4.1): with the switch on, a published product waits instead.
  const gate = await productApproval.onCreate(pushed_to_store);

  const { rows } = await db.query(
    `INSERT INTO brand_products
       (brand_id, name, description, price, category_key, section,
        veg_flag, duration_mins, variants_json, image_url, sku,
        is_active, is_bookable, stock, availability_json, booking_config_json,
        master_vehicle_id, master_service_id, master_dish_id, tags, pushed_to_store,
        approval_status, approval_requested_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      brand.id,
      name.trim(),
      description || null,
      price != null ? parseFloat(price) : null,
      brand.category || null,
      section || null,
      veg_flag || 'na',
      duration_mins ? parseInt(duration_mins, 10) : null,
      variants_json ? JSON.stringify(variants_json) : null,
      // derive the cover from variant/facet images when image_url is absent, so
      // the generic create matches the listing wizard (product-image-resolution)
      image_url || resolveProductImage({ image_url, variants_json }) || null,
      sku || null,
      is_bookable === true || is_bookable === 'true',
      // stock-asked-once: a product saved with sizes takes its own number from them; any other
      // product keeps the number sent.
      stockService.ownStock(variants_json, stock),
      availability_json ? JSON.stringify(availability_json) : '{}',
      booking_config_json ? JSON.stringify(booking_config_json) : '{}',
      master_vehicle_id ? parseInt(master_vehicle_id, 10) : null,
      master_service_id ? parseInt(master_service_id, 10) : null,
      master_dish_id ? parseInt(master_dish_id, 10) : null,
      tagsService.sanitizeProductTags(tags),
      gate.pushed_to_store,
      gate.approval_status,
      gate.approval_requested_at,
    ]
  );

  const product = rows[0];

  // offer-builder-v2 (rules 1.4, spec D9): a product listed after an offer was published joins
  // it when the offer's auto-add line matches. Never fails the listing.
  await offerLife.autoAddProduct(product.id);

  // Restaurant custom-dish flywheel: a dish typed without a canonical link
  // (master_dish_id null) is captured into the review queue. Best-effort —
  // a queue-capture failure must NEVER block the listing from going live.
  if ((brand.category || '').toLowerCase() === 'restaurant' && product.master_dish_id == null) {
    try {
      await dishFlywheel.capturePendingDish(db, {
        brand_id: brand.id,
        brand_product_id: product.id,
        raw_name: product.name,
        section: product.section,
      });
    } catch (e) {
      console.error('[dishFlywheel] capture failed (non-fatal):', e.message);
    }
  }

  return success(res, { product, approval: productApproval.approvalOf(product) }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/tag-options — fixed tag vocabulary for this brand's business
// (its own scope + cross-business 'ALL'). Drives the listing tag-picker.
// ─────────────────────────────────────────────────────────────────────────────

const getTagOptions = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const options = await tagsService.listTagOptions(brand.category);
  return success(res, { options, scope: brand.category });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/dishes/search?q=  — restaurant dish typeahead (fuzzy)
// Returns canonical matches (>= 0.30 similarity) + allow_custom so the seller
// can always add their own wording. Non-restaurant verticals get an empty,
// custom-only response. Never blocks.
// ─────────────────────────────────────────────────────────────────────────────

const searchDishes = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const q = (req.query.q || '').trim();
  if ((brand.category || '').toLowerCase() !== 'restaurant' || q.length < 2) {
    return success(res, { matches: [], allow_custom: q.length > 0 });
  }

  let matches = [];
  try {
    matches = await dishFlywheel.searchMasterDishes(db, q, brand.id);
  } catch (e) {
    // pg_trgm/unaccent missing or query error → degrade to no suggestions.
    console.error('[dishFlywheel] search failed, degrading:', e.message);
  }
  return success(res, { matches, allow_custom: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /brands/me/products/:pid
// ─────────────────────────────────────────────────────────────────────────────

const updateProduct = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { rows: existing } = await db.query(
    `SELECT id, name, price, stock, is_active, pushed_to_store, variants_json, approval_status FROM brand_products WHERE id = $1 AND brand_id = $2`,
    [req.params.pid, brand.id]
  );
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Product not found', 404);

  const ALLOWED = ['name','description','price','section','veg_flag','duration_mins',
                   'variants_json','image_url','sku','is_active','is_bookable','stock',
                   'availability_json','booking_config_json','pushed_to_store',
                   'badge','is_featured','featured_sort'];

  const updates = {};
  ALLOWED.forEach(f => {
    if (req.body[f] !== undefined) {
      if (['variants_json','availability_json','booking_config_json'].includes(f)) {
        updates[f] = JSON.stringify(req.body[f]);
      } else {
        updates[f] = req.body[f];
      }
    }
  });

  // tags is a text[] column — sanitize to slugs (mix of fixed + free), not JSON.
  if (req.body.tags !== undefined) {
    updates.tags = tagsService.sanitizeProductTags(req.body.tags);
  }

  if (!Object.keys(updates).length) throw new AppError('VALIDATION_ERROR', 'No valid fields to update', 422);

  // product-approval-switch (spec §4.2–4.3): Show on a product never approved waits for INFLX
  // while the switch is on; Hide on a waiting product withdraws it. The gate's columns win over
  // the raw pushed_to_store sent.
  let approval = null;
  if (req.body.pushed_to_store !== undefined) {
    const g = await productApproval.onShowHide(existing[0], req.body.pushed_to_store !== false);
    Object.assign(updates, g.updates);
    approval = g.approval;
  }

  const write = async (q) => {
    updates.updated_at = new Date();
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    await q.query(
      `UPDATE brand_products SET ${setClauses.join(', ')} WHERE id = $1`,
      [req.params.pid, ...Object.values(updates)]
    );
  };

  // stock-asked-once: a product with sizes has ONE stock, its sizes. Whenever this save touches the
  // stock or the sizes, the own number is their total — not what was sent, and not what was there.
  if (req.body.stock !== undefined || req.body.variants_json !== undefined) {
    // backend-defect-cover-photo-stock-overwrite: that total was worked out from sizes read above
    // with no hold on the row, so an order landing before the write left the own number saying the
    // old total. The row is now held from the read to the write. (A save that sends neither — Hide,
    // Show, a new price — takes the other branch and is exactly as it was.)
    await db.withTransaction(async (client) => {
      const { rows: [live] } = await client.query(
        `SELECT stock, variants_json FROM brand_products WHERE id = $1 AND brand_id = $2 FOR UPDATE`, [req.params.pid, brand.id]);
      if (!live) throw new AppError('NOT_FOUND', 'Product not found', 404);
      existing[0].stock = live.stock;                 // "before", for the notices below
      existing[0].variants_json = live.variants_json;
      const sizesAfter = req.body.variants_json !== undefined ? req.body.variants_json : live.variants_json;
      const sent = req.body.stock !== undefined ? req.body.stock : live.stock;
      updates.stock = stockService.ownStock(sizesAfter, sent);
      await write(client);
    });
  } else {
    await write(db);
  }

  const { rows } = await db.query(`SELECT * FROM brand_products WHERE id = $1`, [req.params.pid]);

  // collab-part1-corrections §1.1 — unpublishing a product that sits inside a
  // live offer WARNS and proceeds (founder's call). Blocking would make
  // unpublishing a fight; silently dropping the product from the offer is the
  // class of silence that caused the other faults this contract fixes. So the
  // brand simply gets told which offers to look at.
  let affected_offers = [];
  if (req.body.pushed_to_store === false) {
    affected_offers = await offersReferencingProduct(brand.id, req.params.pid);
  }

  // offer-builder-v2 (rules 1.11): a new price on a product in a live or scheduled offer tells
  // each creator given that offer, old -> new. Never fails the save.
  if (req.body.price !== undefined) {
    await offerLife.afterPriceChange(brand.id, req.params.pid, existing[0].price, rows[0].price);
  }
  // creator-terms-v2 (rules 2.8, 2.11): out of stock, taken off sale, or a new price on a product
  // she sells at normal price — the creators who can sell it are told. Never fails the save.
  await require('../services/creatorTerms.service').afterProductChange(req.params.pid, existing[0], rows[0]);

  return success(res, { product: rows[0], affected_offers, approval: approval || productApproval.approvalOf(rows[0]) });
});

/**
 * Library offers whose config references this product. Uses the validator's
 * collectProductIds so every offer shape (discount / volume / bundle / BOGO /
 * free-gift pairs) is understood, rather than string-matching the jsonb.
 * Archived offers are ignored — they cannot go live again.
 */
async function offersReferencingProduct(brandId, productId) {
  const { rows } = await db.query(
    `SELECT id, name, offer_type, offer_config_json, published_to_store
       FROM brand_offers
      WHERE brand_id = $1 AND status <> 'archived'`,
    [brandId]
  );
  return rows
    .filter(o => collectProductIds(o.offer_type, o.offer_config_json || {}).includes(productId))
    .map(o => ({
      id: o.id,
      name: o.name,
      offer_type: o.offer_type,
      published_to_store: !!o.published_to_store,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /brands/me/products/:pid
// ─────────────────────────────────────────────────────────────────────────────

const deleteProduct = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  // Soft-delete: a hard DELETE fails the moment a product has been booked,
  // ordered, returned, or referenced by an influencer/lookbook. follower_*
  // tables hold FKs without ON DELETE SET NULL by design (we want to
  // preserve attribution + analytics history). Soft-delete (is_active=false)
  // hides the product from every active query (brand listing + follower
  // discovery + master_catalog joins all filter on is_active=true) while
  // keeping the row intact for the historical record.
  //
  // listing-shop-safety (A): Remove is the PERMANENT one — Hide is only a pause now — so it also
  // works on a product that is already hidden (it used to answer "already removed"), and it is
  // refused for a piece of a set that is running or scheduled, as the offer page refuses it (1.10):
  // a set with a piece taken out of its posts for good could never be bought again.
  const { rows: [target] } = await db.query(
    `SELECT id, name, is_active FROM brand_products WHERE id = $1 AND brand_id = $2`, [req.params.pid, brand.id]);
  if (!target) throw new AppError('NOT_FOUND', 'Product not found', 404);
  const { rows: [set] } = await db.query(
    `SELECT o.name FROM offer_pool_items i JOIN brand_offers o ON o.id = i.offer_id
      WHERE i.product_id = $1 AND i.pool = 'buy' AND i.removed_at IS NULL AND o.sub_type = 'fixed'
        AND o.status = 'published' AND o.ends_on >= (now() AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY o.starts_on LIMIT 1`, [req.params.pid]);
  if (set) throw new AppError('REMOVE_REFUSED', `"${target.name}" is part of the set "${set.name}". Hide it to pause the set, or end the offer first.`, 422);
  await db.query(`UPDATE brand_products SET is_active = false WHERE id = $1 AND brand_id = $2`, [req.params.pid, brand.id]);

  // Cascade soft-delete to product_variants (fashion SKUs). Variants stay
  // inactive so any pending returns referencing them keep their FK valid.
  await db.query(
    `UPDATE product_variants SET is_active = false
      WHERE product_id = $1 AND is_active = true`,
    [req.params.pid]
  );

  // creator-terms-v2 / shoppable-posts-v2 (rules 2.8, 4.9): a deleted product is no longer on sale —
  // the creators who could sell it are told, and it leaves their posts. Never fails the delete.
  const { rows: [gone] } = await db.query(`SELECT name, price, stock, pushed_to_store FROM brand_products WHERE id = $1`, [req.params.pid]);
  if (gone) {
    await require('../services/creatorTerms.service').afterProductChange(req.params.pid,
      { ...gone, is_active: target.is_active }, { ...gone, is_active: false }, { permanent: true });
  }

  return success(res, { message: 'Product removed', soft_deleted: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/master-catalogue
// Returns master vehicles (car_rental) or master salon services (salon),
// each annotated with is_activated + the brand's product_id and price if active.
// ─────────────────────────────────────────────────────────────────────────────

const getMasterCatalogue = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const cat = (brand.category || '').toLowerCase();

  if (cat === 'car_rental') {
    const { rows } = await db.query(`
      SELECT
        mv.*,
        bp.id           AS product_id,
        bp.price        AS activated_price,
        bp.is_active    AS is_active,
        bp.variants_json,
        (bp.id IS NOT NULL) AS is_activated
      FROM master_vehicles mv
      LEFT JOIN brand_products bp
        ON bp.master_vehicle_id = mv.id AND bp.brand_id = $1
      ORDER BY mv.sort_order, mv.segment, mv.make
    `, [brand.id]);

    return success(res, { category: 'car_rental', items: rows });
  }

  if (cat === 'salon') {
    const { rows } = await db.query(`
      SELECT
        ms.*,
        bp.id           AS product_id,
        bp.price        AS activated_price,
        bp.duration_mins AS activated_duration,
        bp.is_active    AS is_active,
        (bp.id IS NOT NULL) AS is_activated
      FROM master_salon_services ms
      LEFT JOIN brand_products bp
        ON bp.master_service_id = ms.id AND bp.brand_id = $1
      ORDER BY ms.sort_order, ms.category, ms.name
    `, [brand.id]);

    return success(res, { category: 'salon', items: rows });
  }

  if (cat === 'restaurant') {
    // Phase-1 seed of 129 dishes across 8 cuisines (migration 035). Admin
    // owns content forever via the admin-web CRUD UI landing in the next
    // phase. Each row annotated with brand-specific activation status so the
    // restaurant_dish_picker can grey out already-added dishes.
    const { rows } = await db.query(`
      SELECT
        md.*,
        bp.id           AS product_id,
        bp.price        AS activated_price,
        bp.is_active    AS is_active,
        (bp.id IS NOT NULL) AS is_activated
      FROM master_dishes md
      LEFT JOIN brand_products bp
        ON bp.master_dish_id = md.id AND bp.brand_id = $1
      ORDER BY md.cuisine, md.section, md.sort_order, md.name
    `, [brand.id]);

    return success(res, { category: 'restaurant', items: rows });
  }

  throw new AppError('NOT_FOUND', `Master catalogue not available for category: ${cat}`, 404);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/orders  — Brand sees all follower online orders for their products
// ─────────────────────────────────────────────────────────────────────────────

const listBrandOrders = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { status, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['ft.brand_id = $1'];
  const params = [brand.id];

  if (status) {
    params.push(status);
    conditions.push(`fo.order_status = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     WHERE ${where}`,
    params
  );
  const total = parseInt(countRows[0].count, 10);

  params.push(limitNum, offset);
  // NOTE: follower_orders has NO delivery_address column — the shipping address
  // lives in follower_addresses via fo.address_id. Join + compose it (the old
  // query SELECTed a non-existent column and errored). courier_name + the step
  // timestamps come from migration 105.
  const { rows } = await db.query(
    `SELECT
       fo.id, fo.order_status, fo.tracking_number, fo.courier_name,
       fo.created_at, fo.packed_at, fo.dispatched_at, fo.out_for_delivery_at,
       fo.delivered_at, fo.cancelled_at,
       ft.net_amount, ft.gross_amount, ft.brand_net,
       ft.brand_settlement_status, ft.brand_settled_at, ft.return_window_ends_at,
       fo.items_json,
       u_f.name AS follower_name, u_f.phone AS follower_phone,
       a.label AS address_label,
       NULLIF(CONCAT_WS(', ', a.line1, a.line2, a.city, a.pincode), '') AS delivery_address
     FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     JOIN followers f ON f.id = ft.follower_id
     JOIN users u_f ON u_f.id = f.user_id
     LEFT JOIN follower_addresses a ON a.id = fo.address_id
     WHERE ${where}
     ORDER BY fo.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return success(res, { orders: rows }, 200, { page: pageNum, limit: limitNum, total });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/transactions — ALL transactions (pay_at_store + prebook + online_order)
// ─────────────────────────────────────────────────────────────────────────────

const listAllTransactions = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { type, campaign_id, influencer_id, status, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['ft.brand_id = $1'];
  const params = [brand.id];

  if (type) { params.push(type); conditions.push(`ft.transaction_type = $${params.length}`); }
  if (campaign_id) { params.push(campaign_id); conditions.push(`ft.campaign_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`ft.status = $${params.length}`); }
  if (influencer_id) {
    params.push(influencer_id);
    conditions.push(`ci.influencer_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int FROM follower_transactions ft
     LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     WHERE ${where}`,
    params
  );
  const total = countRows[0].count;

  params.push(limitNum, offset);
  const { rows } = await db.query(
    `SELECT
       ft.id, ft.transaction_type, ft.status, ft.gross_amount, ft.discount_amount,
       ft.net_amount, ft.influencer_commission, ft.marketplace_fee_amount AS platform_fee, ft.brand_net,
       ft.coupon_code_used, ft.razorpay_payment_id, ft.created_at,
       ft.brand_settlement_status, ft.brand_settled_at, ft.return_window_ends_at,
       ft.campaign_id, ft.set_id, ft.campaign_influencer_id,
       c.name AS campaign_name,
       u_i.name AS influencer_name, i.instagram_handle,
       u_f.name AS follower_name, u_f.phone AS follower_phone,
       bp.name AS product_name, bp.section AS product_section,
       fb.booking_type,
       fb.booking_date, fb.booking_time,
       fb.pickup_date, fb.return_date, fb.duration_days, fb.pickup_type,
       fb.stylist_id, fb.notes AS booking_notes,
       fb.reference_code AS booking_ref,
       fo.order_status
     FROM follower_transactions ft
     LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     LEFT JOIN influencers i ON i.id = ci.influencer_id
     LEFT JOIN users u_i ON u_i.id = i.user_id
     LEFT JOIN followers f ON f.id = ft.follower_id
     LEFT JOIN users u_f ON u_f.id = f.user_id
     LEFT JOIN campaigns c ON c.id = ft.campaign_id
     LEFT JOIN follower_bookings fb ON fb.transaction_id = ft.id
     LEFT JOIN follower_orders fo ON fo.transaction_id = ft.id
     LEFT JOIN follower_orders fo2 ON fo2.transaction_id = ft.id
     LEFT JOIN brand_products bp ON bp.id = CASE WHEN fo2.items_json IS NOT NULL THEN (fo2.items_json->0->>'product_id')::uuid ELSE NULL END
     WHERE ${where}
     ORDER BY ft.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Summary stats
  const { rows: summaryRows } = await db.query(
    `SELECT
       COUNT(*)::int AS total_transactions,
       COALESCE(SUM(ft.net_amount), 0)::bigint AS total_revenue,
       COALESCE(SUM(ft.influencer_commission), 0)::bigint AS total_commission,
       COALESCE(SUM(ft.marketplace_fee_amount), 0)::bigint AS total_platform_fee,
       COALESCE(SUM(ft.brand_net), 0)::bigint AS total_brand_net,
       COALESCE(SUM(CASE WHEN ft.brand_settlement_status = 'settled' THEN ft.brand_net ELSE 0 END), 0)::bigint AS settled_brand_net,
       COALESCE(SUM(CASE WHEN ft.brand_settlement_status IS DISTINCT FROM 'settled' THEN ft.brand_net ELSE 0 END), 0)::bigint AS held_brand_net,
       COUNT(CASE WHEN ft.transaction_type = 'pay_at_store' THEN 1 END)::int AS pay_at_store_count,
       COUNT(CASE WHEN ft.transaction_type = 'prebook' THEN 1 END)::int AS prebook_count,
       COUNT(CASE WHEN ft.transaction_type = 'online_order' THEN 1 END)::int AS online_order_count
     FROM follower_transactions ft
     WHERE ft.brand_id = $1 AND ft.status = 'completed'`,
    [brand.id]
  );

  return success(res, {
    transactions: rows,
    summary: summaryRows[0],
  }, 200, { page: pageNum, limit: limitNum, total });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/:id/public — Public brand profile (for influencers viewing brand info)
// ─────────────────────────────────────────────────────────────────────────────

const getPublicProfile = asyncHandler(async (req, res) => {
  // Item 3 (A10, screens O1–O4). What a creator may know about a brand: name, logo,
  // category and sub-categories, about, main city, branch cities and count, links, and
  // its published products at list price. NEVER the street address (the item-2 report
  // found it leaking here), phone, email, GSTIN, contact person or offers.
  const { rows } = await db.query(
    `SELECT b.id, b.business_name, b.category, b.sub_categories, b.logo_url, b.about, b.website_url,
            b.instagram_handle, b.created_at, u.status AS user_status, b.user_id
       FROM brands b JOIN users u ON u.id = b.user_id
      WHERE b.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const b = rows[0];
  const isOwner = req.user.role === 'brand' && b.user_id === req.user.sub;
  if (b.user_status !== 'approved' && !isOwner && req.user.role !== 'admin') {
    throw new AppError('NOT_FOUND', 'Brand not found', 404);
  }

  const [mainCity, branchCities, branchCount, products] = await Promise.all([
    branchesService.mainCity(b.id),
    branchesService.cityNames(b.id),
    branchesService.count(b.id),
    brandProducts.list(b.id, { page: 1, limit: 4 }),
  ]);

  let pitchSummary = null;
  if (req.user.role === 'influencer') {
    const { rows: me } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [req.user.sub]);
    pitchSummary = await eligibility.pitchSummaryFor(b.id, me[0] ? me[0].id : null);
  }

  return success(res, {
    brand: {
      id: b.id,
      business_name: b.business_name,
      name: b.business_name,
      category: b.category,
      sub_categories: Array.isArray(b.sub_categories) ? b.sub_categories : [],
      subCategories: Array.isArray(b.sub_categories) ? b.sub_categories : [],
      logo_url: b.logo_url || null,
      logoUrl: b.logo_url || null,
      about: b.about || null,
      city: mainCity ? mainCity.name : null,
      mainCity: mainCity ? mainCity.name : null,
      branchCount,
      branchCities: branchCities.map(c => c.name),
      websiteUrl: b.website_url || null,
      instagramHandle: b.instagram_handle || null,
      productCount: products.total,
      created_at: b.created_at,
    },
    products: { total: products.total, rows: products.rows },
    // Item 13 fills this from creator_posts; the grid exists now, empty.
    posts: { total: 0, rows: [] },
    pitchSummary,
    isOwner,
  });
});

// ── GET /brands/me/store-preview — brand sees their store as followers see it ─

const followerService = require('../services/follower.service');

const storePreview = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const data = await followerService.getBrandStorePreview(brand.id);
  if (!data) throw new AppError('NOT_FOUND', 'Store data not found', 404);

  return success(res, data);
});

// ─────────────────────────────────────────────────────────────────────────────
// Listing Engine endpoints
// ─────────────────────────────────────────────────────────────────────────────

const listingService = require('../services/listing.service');

// GET /brands/me/listing-config — full config including listing_steps, card_config, quality_rules
const getListingConfig = asyncHandler(async (req, res) => {
  // Always bust the schema cache — production observation: when a schema
  // file is updated on disk and the Render container reloads, the cache
  // can warm with the new content correctly, BUT if any orchestration
  // detail (deploy race, sleeper container, build caching) causes the
  // process to outlive the file change, the cache holds the old schema
  // indefinitely. The cost of fs.readFileSync on a 5KB JSON file per
  // brand request is microseconds; the cost of a stale schema is "user
  // sees 6 old steps instead of 9 new ones, files a bug." Trade-off is
  // obvious. Cache stays for non-brand-facing reads (getCategoryStores
  // etc.) where the schema is unchanged-during-session.
  listingService.clearSchemaCache();
  clearSchemaCache();

  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  // Augmenting variant — for restaurant, merges admin-managed master_dishes
  // cuisines into brand_config.fields.cuisines.options so admin additions
  // surface in the wizard's step 1 multi-select on the next request. Other
  // categories pass through unchanged.
  const config = await listingService.getAugmentedConfigForBrand(brand);
  if (!config) throw new AppError('NOT_FOUND', `No config for category: ${brand.category}`, 404);

  const isActive = listingService.isCategoryActive(brand.category);

  // Bug fix (issue 2 of brand-wizard skip): the response was missing the
  // brand's stored profile fields, so canSkipBrandSteps() in the brand-web
  // client always saw an empty listing_data and re-rendered the brand-info
  // steps on every "Add" tap. We now surface listing_data + the few brand
  // fields the wizard needs to reason about skipping + identity.
  return success(res, {
    config,
    listing_engine_active: isActive,
    current_phase: listingService.LISTING_ENGINE_PHASE,
    brand_id: brand.id,
    business_name: brand.business_name,
    category: brand.category,
    listing_data: brand.listing_data || {},
    // Surface the brand's stored location so the wizard can skip the redundant
    // "Location" step when registration already captured the address.
    lat: brand.lat,
    lng: brand.lng,
    locality: brand.locality,
    formatted_address: brand.formatted_address,
  });
});

// GET /brands/me/quality-score — quality score with breakdown and suggestions
const getQualityScore = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const result = await listingService.calculateQualityScore(brand.id, brand.category);
  return success(res, result);
});

// GET /brands/me/listing-preview — products + card_config for LivePreview component
const getListingPreview = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const cardConfig = listingService.getCardConfig(brand.category);
  const actionTypes = listingService.getActionTypes(brand.category);
  const qualityScore = await listingService.calculateQualityScore(brand.id, brand.category);

  // Fetch top products for preview
  const { rows: products } = await db.query(
    `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
     FROM brand_products
     WHERE brand_id = $1 AND is_active = true
     ORDER BY section NULLS LAST, name ASC
     LIMIT 10`,
    [brand.id]
  );

  return success(res, {
    brand: {
      id: brand.id,
      business_name: brand.business_name,
      category: brand.category,
      city: brand.city,
    },
    card_config: cardConfig,
    action_types: actionTypes,
    quality_score: qualityScore,
    products,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Excel Bulk Upload endpoints
// ─────────────────────────────────────────────────────────────────────────────

const excelService = require('../services/excel.service');

// GET /brands/me/listing-template/download — download auto-generated Excel template
const downloadListingTemplate = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  let wb;
  try {
    wb = await excelService.generateTemplate(brand.category, brand.business_name);
  } catch (err) {
    if (err.code === 'EXCEL_UPLOAD_DISABLED') {
      throw new AppError('EXCEL_UPLOAD_DISABLED', err.message, 422);
    }
    throw err;
  }
  const schema = listingService.getConfigForCategory(brand.category);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=INFLX_${(schema?.label || brand.category).replace(/\s+/g, '_')}_Template.xlsx`);

  await wb.xlsx.write(res);
  res.end();
});

// POST /brands/me/products/bulk-upload — parse Excel and create products
//
// Per-category behaviors layered on the parsed rows:
//   · restaurant — try findMasterMatch(name, section) → set master_dish_id
//                  on the product so it inherits the catalogue's photo +
//                  cross-brand analytics
//   · salon      — same; sets master_service_id
//   · fashion    — for rows with sizes/colors, post-create one
//                  product_variants row per (size × color) with the row's
//                  stock_per_variant
//   · car_rental — endpoint blocked at parseUpload (schema's
//                  excel_upload: false) — surfaces clean error
const bulkUploadProducts = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded', 400);

  let parseResult;
  try {
    parseResult = await excelService.parseUpload(req.file.buffer, brand.category);
  } catch (err) {
    if (err.code === 'EXCEL_UPLOAD_DISABLED') {
      throw new AppError('EXCEL_UPLOAD_DISABLED', err.message, 422);
    }
    throw err;
  }
  const { rows, errors, totalParsed } = parseResult;

  if (errors.length > 0 && rows.length === 0) {
    return success(res, { created: 0, errors, totalParsed }, 400);
  }

  const products = excelService.rowsToProducts(rows, brand.category);
  const created = [];
  let mastersLinked = 0;
  let variantsCreated = 0;

  for (const product of products) {
    // Pull out the post-insert payloads (handled separately so the
    // brand_products INSERT signature stays stable).
    const fashionVariantSpec = product._fashion_variants;
    delete product._fashion_variants;

    // Master-catalogue linking — restaurant + salon.
    // When a row auto-links to a master row AND the row didn't provide its
    // own image_url, inherit the master's default photo. This is what
    // makes "bulk upload + auto-link" feel like a real onboarding shortcut
    // for brands without their own product photography.
    let masterDishId = null;
    let masterServiceId = null;
    if (brand.category === 'restaurant') {
      masterDishId = await excelService.findMasterMatch('restaurant', product.name, product.section);
      if (masterDishId) {
        mastersLinked++;
        if (!product.image_url) {
          const { rows: mdRows } = await db.query(
            `SELECT default_image_url FROM master_dishes WHERE id = $1`,
            [masterDishId]
          );
          if (mdRows[0]?.default_image_url) product.image_url = mdRows[0].default_image_url;
        }
      }
    } else if (brand.category === 'salon') {
      masterServiceId = await excelService.findMasterMatch('salon', product.name, product.section);
      if (masterServiceId) {
        mastersLinked++;
        if (!product.image_url) {
          const { rows: msRows } = await db.query(
            `SELECT image_url FROM master_salon_services WHERE id = $1`,
            [masterServiceId]
          );
          if (msRows[0]?.image_url) product.image_url = msRows[0].image_url;
        }
      }
    }

    // product-approval-switch (spec §4.1): the Excel upload publishes, so it waits like the wizard.
    const gateRow = await productApproval.onCreate(true);
    const { rows: [newProd] } = await db.query(
      `INSERT INTO brand_products (
         brand_id, name, price, section, description, image_url, veg_flag,
         variants_json, stock, duration_mins,
         is_active, is_bookable, category_key,
         master_dish_id, master_service_id, return_policy_days,
         pushed_to_store, approval_status, approval_requested_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, name, price, section, master_dish_id, master_service_id, pushed_to_store, approval_status`,
      [
        brand.id,
        product.name,
        product.price,
        product.section,
        product.description || '',
        product.image_url || '',
        product.veg_flag || 'na',
        product.variants_json ? JSON.stringify(product.variants_json) : null,
        product.stock,
        product.duration_mins || null,
        product.is_bookable || false,
        brand.category,
        masterDishId,
        masterServiceId,
        product.return_policy_days || null,
        gateRow.pushed_to_store,
        gateRow.approval_status,
        gateRow.approval_requested_at,
      ]
    );
    created.push(newProd);

    // Fashion variant decomposition — one product_variants row per (size × color)
    if (fashionVariantSpec && (fashionVariantSpec.sizes?.length || fashionVariantSpec.colors?.length)) {
      const variantRows = excelService.buildFashionVariantRows(newProd.id, fashionVariantSpec);
      for (const v of variantRows) {
        await db.query(
          `INSERT INTO product_variants (product_id, size, color, stock)
           VALUES ($1, $2, $3, $4)`,
          [v.product_id, v.size, v.color, v.stock]
        );
        variantsCreated++;
      }
    }
  }

  // offer-builder-v2 (spec D9) — auto-add, as on every other create path.
  for (const p of created) await offerLife.autoAddProduct(p.id);

  return success(res, {
    created: created.length,
    masters_linked: mastersLinked,
    variants_created: variantsCreated,
    products: created,
    errors,
    totalParsed,
  });
});

// GET /brands/me/listing-template/columns — get column definitions (for frontend preview)
const getTemplateColumns = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const columns = excelService.getColumnsForCategory(brand.category);
  return success(res, { columns, category: brand.category });
});

module.exports = {
  submitForReview,
  register, getMe, updateMe, getById, updateStatus, resubmit,
  getCategorySchema, getMasterCatalogue, searchDishes,
  listProducts, createProduct, updateProduct, deleteProduct, getTagOptions, getOfferCategories,

  listBrandOrders, listAllTransactions, getPublicProfile, storePreview,
  getListingConfig, getQualityScore, getListingPreview,
  downloadListingTemplate, bulkUploadProducts, getTemplateColumns,
};
