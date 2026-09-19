'use strict';

/**
 * profileCompleteness.service.js — what "complete" means for approval.
 * Contract: features/registration-and-profile · spec §6.2, §6.3, §9A
 *
 * One rule, read by four places: the app's profile tab ("N things left", the Submit button),
 * Submit for review, both admin approval paths, and the two admin review pages. Bank, UPI,
 * PAN, GSTIN and email are never on the list — they are Wallet, not approval (§5).
 *
 * Each item: { key, label } with the label being the words the app and admin show.
 */

const db = require('../config/db');

const CREATOR_ITEMS = Object.freeze([
  { key: 'full_name', label: 'full name' },
  { key: 'state',     label: 'state' },
  { key: 'city',      label: 'nearest major city' },
  { key: 'handle',    label: 'an Instagram or YouTube handle' },
  { key: 'photo',     label: 'photo' },
  { key: 'bio',       label: 'bio' },
  { key: 'niche',     label: 'niche' },
  { key: 'language',  label: 'a language' },
  { key: 'age',       label: 'age' },
  { key: 'gender',    label: 'gender' },
]);

const BRAND_ITEMS = Object.freeze([
  { key: 'contact_name',   label: 'contact name' },
  { key: 'business_name',  label: 'business name' },
  { key: 'sub_categories', label: 'what you sell' },
  { key: 'address_line',   label: 'street address' },
  { key: 'pincode',        label: 'pincode' },
  { key: 'state',          label: 'state' },
  { key: 'city',           label: 'nearest major city' },
  { key: 'logo',           label: 'logo' },
  { key: 'about',          label: 'about' },
  { key: 'contact_person', label: 'contact person' },
]);

const filled = (v) => v != null && String(v).trim() !== '';

/** Pure: evaluate a creator row (influencers.* joined with users.name). */
function creatorFromRow(i) {
  const present = {
    full_name: filled(i.full_name) || filled(i.name),
    state:     i.state_id != null,
    city:      i.city_id != null,
    handle:    filled(i.instagram_handle) || filled(i.youtube_handle),
    photo:     filled(i.profile_image_r2_key) || filled(i.profile_image_url),
    bio:       filled(i.bio),
    niche:     Array.isArray(i.niche) && i.niche.length === 1 && (i.niche[0] !== 'other' || filled(i.niche_other)),
    language:  Array.isArray(i.language) && i.language.length > 0,
    age:       i.age != null && Number(i.age) > 0,
    gender:    filled(i.gender),
  };
  return summarise(CREATOR_ITEMS, present);
}

/** Pure: evaluate a brand row (brands.* joined with users.name) plus its main branch. */
function brandFromRow(b, mainBranch) {
  const present = {
    contact_name:   filled(b.name),
    business_name:  filled(b.business_name),
    sub_categories: Array.isArray(b.sub_categories) && b.sub_categories.length > 0,
    address_line:   filled(mainBranch && mainBranch.formattedAddress) || filled(b.address_line),
    pincode:        /^\d{6}$/.test(String((mainBranch && mainBranch.pincode) || b.pincode || '').trim()),
    state:          !!(mainBranch && mainBranch.stateId),
    city:           !!(mainBranch && mainBranch.cityId),
    logo:           filled(b.logo_url),
    about:          filled(b.about),
    contact_person: filled(b.contact_person),
  };
  return summarise(BRAND_ITEMS, present);
}

function summarise(items, present) {
  const missing = items.filter(it => !present[it.key]);
  return {
    total: items.length,
    done: items.length - missing.length,
    complete: missing.length === 0,
    missing: missing.map(it => it.key),
    missing_labels: missing.map(it => it.label),
  };
}

async function forCreator(influencerId) {
  const { rows } = await db.query(
    `SELECT i.full_name, i.state_id, i.city_id, i.instagram_handle, i.youtube_handle, i.profile_image_r2_key,
            i.profile_image_url, i.bio, i.niche, i.niche_other, i.language, i.age, i.gender, u.name
       FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`, [influencerId]);
  if (!rows[0]) return null;
  return creatorFromRow(rows[0]);
}

async function forBrand(brandId) {
  const { rows } = await db.query(
    `SELECT b.business_name, b.sub_categories, b.address_line, b.pincode, b.logo_url, b.about, b.contact_person, u.name
       FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`, [brandId]);
  if (!rows[0]) return null;
  const { rows: mb } = await db.query(
    `SELECT formatted_address AS "formattedAddress", pincode, city_id AS "cityId", state_id AS "stateId"
       FROM brand_branches WHERE brand_id = $1 AND is_main LIMIT 1`, [brandId]);
  return brandFromRow(rows[0], mb[0] || null);
}

/** The 422 both submit and approve throw. */
function incompleteError(AppError, summary, who) {
  const list = summary.missing_labels.join(', ');
  const msg = who === 'admin'
    ? `This profile is missing: ${list}. Ask them to complete it before approving.`
    : `Finish these first: ${list}.`;
  return new AppError('PROFILE_INCOMPLETE', msg, 422, null, { missing: summary.missing, missing_labels: summary.missing_labels, done: summary.done, total: summary.total });
}

module.exports = { CREATOR_ITEMS, BRAND_ITEMS, creatorFromRow, brandFromRow, forCreator, forBrand, incompleteError };
