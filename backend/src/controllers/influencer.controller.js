'use strict';

const db = require('../config/db');
// The YouTube half of a creator's reach — channelUrl for the "Open" link.
// Contract: features/admin-creator-review-completeness
const youtubeService = require('../services/youtube.service');
const notificationService = require('../services/notification.service');
const pdfService = require('../services/pdf.service');
const { encrypt } = require('../utils/encrypt');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { resolveAvatars } = require('../utils/avatarResolver');
// Item 2 — one required content niche from the reference list, and the invitation summary
// a brand sees. Contract: features/item2-pitch-invitation-settings
const referenceLists = require('../services/referenceLists.service');
const eligibility = require('../services/collabEligibility.service');
// Item 3 — Google city, measured-at, what a brand sees on P1/P2, photo size check.
// Contract: features/item3-discovery-profiles-groups
const collabState = require('../services/collabState');
const storageService = require('../services/storage.service');
// Item 3b — social accounts (Instagram/YouTube), measured only after admin approval.
// Contract: features/item3b-social-numbers
const socialAccounts = require('../services/socialAccounts.service');
const socialMeasure = require('../services/socialMeasure.service');
const { MSG: SOCIAL_MSG } = require('../services/socialCopy');
const PHOTO_MSG = 'Upload a JPG or PNG under 5 MB.';
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
function fieldError(field, code, message) {
  return new AppError('VALIDATION_ERROR', message, 422, field, { fields: [{ field, code, message }] });
}
/** A YouTube handle from '@name', 'youtube.com/@name', '/c/name' or '/channel/UC…'. */
function normaliseYoutube(value) {
  if (value == null) return null;
  let v = String(value).trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\/(www\.|m\.)?youtube\.com\//i, '').replace(/^https?:\/\/youtu\.be\//i, '');
  v = v.replace(/^(c\/|user\/|channel\/)/i, '').replace(/[?#].*$/, '').replace(/\/.*$/, '');
  return v.replace(/^@+/, '').toLowerCase() || null;
}
/** Item 3 extras for the creator's own profile: canonical city names and measured-at. */
async function ownProfileExtras(influencer) {
  const { rows } = await db.query(
    `SELECT i.city_id, rc.name AS city_name, COALESCE(i.state_id, rc.state_id) AS state_id, rs.name AS state_name,
            GREATEST(i.scrape_last_run, i.youtube_scrape_last_run) AS measured_at
       FROM influencers i LEFT JOIN ref_cities rc ON rc.id = i.city_id LEFT JOIN ref_states rs ON rs.id = COALESCE(i.state_id, rc.state_id)
      WHERE i.id = $1`, [influencer.id]);
  const r = rows[0] || {};
  return { city_id: r.city_id == null ? null : Number(r.city_id), city_name: r.city_name || null,
           state_id: r.state_id == null ? null : Number(r.state_id), state_name: r.state_name || null, measured_at: r.measured_at || null };
}
const referralService = require('../services/referral.service');
// registration-and-profile — what "complete" means for approval; the offered state + city.
const completeness = require('../services/profileCompleteness.service');
const GENDERS = ['female', 'male', 'other'];
async function resolvePickedCity({ state_id, city_id, state, city }, field = 'city_id') {
  if (state_id != null || city_id != null) {
    const r = await referenceLists.resolveStateCity(state_id, city_id);
    if (!r) throw fieldError(field, 'CITY_REQUIRED', 'Pick your state, then your nearest major city.');
    return r;
  }
  if (state && city) {
    const r = await referenceLists.resolveStateCityNames(state, city);
    if (!r) throw fieldError(field, 'CITY_REQUIRED', 'Pick your state, then your nearest major city.');
    return r;
  }
  throw fieldError(field, 'CITY_REQUIRED', 'Pick your state, then your nearest major city.');
}
// Stage 0 — one step number and one needs-you count, both apps reading the same source.
const collabCounts = require('../services/collabCounts.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getInfluencerByUserId(userId) {
  const { rows } = await db.query(
    `SELECT i.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getInfluencerById(id) {
  const { rows } = await db.query(
    `SELECT i.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Remove encrypted fields and internal tokens from API response.
 * Sensitive data (bank_account_no, upi_id, pan_number) is never returned.
 */
function sanitiseInfluencer(row) {
  const {
    // Where her photo lives in storage. Internal — the response carries the
    // resolved profile_image_url instead. Contract: features/creator-photo-and-reach
    profile_image_r2_key: _photoKey,
    bank_account_no,
    upi_id,
    pan_number,
    fcm_token,
    phone: _phone,
    ...safe
  } = row;
  // Indicate whether the influencer has configured a payout method (without revealing the values)
  safe.has_payout_method = !!(bank_account_no || upi_id);
  safe.has_pan = !!pan_number;
  safe.has_bank_account = !!bank_account_no;
  safe.has_upi = !!upi_id;
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /influencers/register
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a social handle: trim, lowercase, strip leading '@'.
 * Returns null for empty input.
 */
function normaliseHandle(value) {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/^@+/, '').toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

// Item 3b: refreshYouTubeStats (the old direct writer of the youtube_* columns) was removed —
// the measurement pipeline (socialAccounts.writeThrough) is the only writer now.

/**
 * Try to claim (or create-and-claim) a creator_profiles row for this user.
 *
 * Matching: row.ig_handle === instagram_handle  OR  row.youtube_handle === youtube_handle.
 *
 *   1-match  → status='claimed', linked_influencer_id set on the existing row.
 *   N>1      → all candidates flagged with same claim_user_id, status stays
 *              'unclaimed' on each; admin queue surfaces the conflict.
 *   0-match  → create a STUB row (claimed + linked), fire n8n A2 scrape in the
 *              background. When n8n eventually upserts back via INGEST, the
 *              CREATOR_COLUMNS allow-list excludes the linkage columns so the
 *              claim survives the upsert untouched.
 *
 * Returns { match_count, conflict, claimed_profile_ids, scrape_fired }.
 */
async function tryClaimCreatorProfile({ userId, influencerId, instagramHandle, youtubeHandle }) {
  // Item 3b (founder Q3, §3): the claim step is Instagram-first; a YouTube-only sign-up
  // matches on youtube_handle only and otherwise gets a minimal 'claimed' row with no
  // ig_handle, so the admin queue can approve her. Nothing is scraped from here any more.
  const { rows: matches } = await db.query(
    `SELECT id FROM creator_profiles
      WHERE ($1::text IS NOT NULL AND ig_handle = $1)
         OR ($2::text IS NOT NULL AND youtube_handle = $2)`,
    [instagramHandle, youtubeHandle]
  );

  if (matches.length === 1) {
    // Single, clean claim → mark claimed and link
    await db.query(
      `UPDATE creator_profiles
          SET verification_status = 'claimed',
              claim_user_id        = $1,
              claim_requested_at   = COALESCE(claim_requested_at, NOW()),
              linked_influencer_id = $2
        WHERE id = $3`,
      [userId, influencerId, matches[0].id]
    );
    return {
      match_count: 1, conflict: false,
      claimed_profile_ids: [matches[0].id], scrape_fired: false,
    };
  }

  if (matches.length > 1) {
    // Multiple matches → conflict. Tag all candidates with claim_user_id so admin sees
    // the cluster, but keep status 'unclaimed' until admin picks the right one.
    const ids = matches.map(r => r.id);
    await db.query(
      `UPDATE creator_profiles
          SET claim_user_id      = $1,
              claim_requested_at = COALESCE(claim_requested_at, NOW())
        WHERE id = ANY($2::uuid[])`,
      [userId, ids]
    );
    return {
      match_count: matches.length, conflict: true,
      claimed_profile_ids: ids, scrape_fired: false,
    };
  }

  // ── 0-match: create a stub row pre-claimed to this signup, and fire an
  // async A2 v2 scrape so the marketing engine fills in the data. The user
  // explicitly typed their handle at signup, so 'claimed' is correct; admin
  // still has to verify by calling them, just like the 1-match case.
  //
  // INSERT ... ON CONFLICT DO NOTHING guards against a race where the same
  // handle is being scraped concurrently from the admin side. If the row
  // somehow appeared between the SELECT and the INSERT, we re-read it.
  let stubRow;
  const { rows: inserted } = await db.query(
    `INSERT INTO creator_profiles
       (ig_handle, youtube_handle, verification_status,
        claim_user_id, claim_requested_at, linked_influencer_id, source)
     VALUES ($1, $2, 'claimed', $3, NOW(), $4, 'signup')
     ON CONFLICT (ig_handle) DO NOTHING
     RETURNING id`,
    [instagramHandle, youtubeHandle, userId, influencerId]
  );

  if (inserted[0]) {
    stubRow = inserted[0];
  } else if (instagramHandle) {
    // Race: a row appeared. Re-fetch and treat it as a 1-match claim.
    const { rows: existing } = await db.query(
      `SELECT id FROM creator_profiles WHERE ig_handle = $1`,
      [instagramHandle]
    );
    if (existing[0]) {
      await db.query(
        `UPDATE creator_profiles
            SET verification_status = 'claimed',
                claim_user_id        = $1,
                claim_requested_at   = COALESCE(claim_requested_at, NOW()),
                linked_influencer_id = $2
          WHERE id = $3`,
        [userId, influencerId, existing[0].id]
      );
      stubRow = existing[0];
    }
  }

  // Item 3b (founder §3): the n8n "A2 profile scraper" webhook is no longer fired at
  // registration. Nothing may be scraped before admin approval; the n8n workflow and the
  // creator_profiles table themselves are untouched.
  return {
    match_count: 0, conflict: false,
    claimed_profile_ids: stubRow ? [stubRow.id] : [],
    scrape_fired: false,
  };
}

const register = asyncHandler(async (req, res) => {
  const userId = req.user.sub;

  // Item 3b (rules v1.12 §2A, founder Q3): at least ONE of Instagram / YouTube, each checked
  // for format with the exact §6 message, saved normalised. Nothing is measured and nothing
  // is scraped at registration — the first measurement starts when admin approves.
  // Contract: features/item3b-social-numbers
  const rawIg = req.body.instagram_handle, rawYt = req.body.youtube_handle;
  const hasIg = rawIg != null && String(rawIg).trim() !== '';
  const hasYt = rawYt != null && String(rawYt).trim() !== '';
  if (!hasIg && !hasYt) throw new AppError('VALIDATION_ERROR', SOCIAL_MSG.AT_LEAST_ONE, 422, 'instagram_handle');
  let igNorm = null, ytNorm = null;
  try { if (hasIg) igNorm = socialAccounts.normalise('instagram', rawIg); if (hasYt) ytNorm = socialAccounts.normalise('youtube', rawYt); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422, e.field); }
  const instagramHandle = igNorm ? igNorm.handle_norm : null;
  const youtubeHandle   = ytNorm ? socialAccounts.legacyHandle('youtube', ytNorm) : null;
  const fullName        = (req.body.name || '').trim();

  if (!fullName) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }
  // registration-and-profile §2.1: state and nearest major city, both required, both from the
  // offered lists, resolved on the way in. Typed names from the previous bundle still resolve.
  const place = await resolvePickedCity(req.body);

  // Prevent duplicate registration
  const existing = await getInfluencerByUserId(userId);
  if (existing) {
    throw new AppError('CONFLICT', 'Influencer profile already exists for this account', 409);
  }

  // Update users.name + users.city with the real values supplied at registration.
  // verify-otp inserted a "Pending (1234)" placeholder so the row would satisfy
  // the NOT NULL constraint. We overwrite it here once the user fills the form.
  await db.query(
    `UPDATE users SET name = $1, city = $2, state = $3 WHERE id = $4`,
    [fullName, place.cityName, place.stateName, userId]
  );

  // Item 3b: no Apify call here any more (it used to run apifyService.scrapeProfile before
  // approval). The number columns start NULL and are written only by the measurement
  // pipeline after admin approval.

  // full_name and city are written HERE as well as on users, not only on users.
  // They used to live only on the users row, so influencers.city was NULL for every
  // creator who signed up in the app — which is why the admin review page said
  // "Where: Not stated" for someone who had typed her city, and why the Influencers
  // list showed a dash. The search view worked around it in migration 146; the admin
  // read paths never were. Fixing the write closes it at the source for new rows; the
  // COALESCE reads below carry every row that predates this.
  // Contract: features/admin-creator-review-completeness
  const { rows } = await db.query(
    `INSERT INTO influencers
       (user_id, instagram_handle, youtube_handle, full_name, city, state, city_id, state_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, instagramHandle, youtubeHandle, fullName, place.cityName, place.stateName, place.cityId, place.stateId]
  );

  const influencer = rows[0];

  // Item 3b: her accounts, waiting for admin approval. Not measured until then.
  await socialAccounts.ensureForRegistration(influencer.id, { instagram: hasIg ? rawIg : null, youtube: hasYt ? rawYt : null });

  // registration-and-profile §10: the referral system is parked; referral_code is ignored.

  // Attempt to link to an existing scraped creator_profile.
  const claim = await tryClaimCreatorProfile({
    userId,
    influencerId: influencer.id,
    instagramHandle,
    youtubeHandle,
  });

  // If exactly one match, also auto-convert any pending creator_invitations
  // for that profile into real campaign_influencers rows. (Phase 3b — funnel close.)
  // Brand-side 'creator_invitations' rows exist only after Phase 3b ships;
  // this no-ops gracefully if none exist.
  if (claim.match_count === 1) {
    try {
      await db.query(
        `UPDATE creator_invitations
            SET status = 'converted',
                converted_at = NOW()
          WHERE creator_profile_id = $1
            AND status IN ('pending','contacted')`,
        [claim.claimed_profile_ids[0]]
      );
    } catch (e) {
      // Table may not exist in older DBs — non-fatal
      console.warn('[register] invitation auto-convert skipped:', e.message);
    }
  }

  const full = await getInfluencerById(influencer.id);

  return success(res, {
    influencer: sanitiseInfluencer(full),
    user_status: full.user_status,
    completeness: await completeness.forCreator(influencer.id),
    claim: {
      match_count:        claim.match_count,
      // True when exactly one creator_profile is linked to this user
      // (either a pre-existing single match, or the stub we just created
      // when no scraped data was found).
      claimed:            !claim.conflict && claim.claimed_profile_ids.length === 1,
      conflict:           claim.conflict,
      // Every signup now produces or links to a creator_profile row, so admin
      // verification is always the next step — left as a stable field for the
      // mobile client which already keys off it.
      requires_admin:     true,
      // True when no pre-existing creator_profile matched and we kicked off
      // a fresh A2 scrape. The scraped data lands asynchronously via INGEST.
      scrape_fired:       !!claim.scrape_fired,
      profile_ids:        claim.claimed_profile_ids,
    },
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turn the stored object key into a URL that actually loads, in place.
 * Presigned links expire, so this happens on every read rather than at upload.
 * Contract: features/creator-photo-and-reach
 */
async function withOwnPhoto(row) {
  await resolveAvatars([row], { urlField: 'profile_image_url', keyField: 'profile_image_r2_key' });
  return row;
}

const getMe = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  await withOwnPhoto(influencer);

  const sanitised = sanitiseInfluencer(influencer);
  // Include phone as read-only for profile display
  sanitised.phone = influencer.phone;
  Object.assign(sanitised, await ownProfileExtras(influencer));
  sanitised.needsNiche = !(Array.isArray(influencer.niche) && influencer.niche.length === 1);

  return success(res, {
    influencer: sanitised,
    user_status: influencer.user_status,
    completeness: await completeness.forCreator(influencer.id),
    submitted_for_review_at: influencer.submitted_for_review_at || null,
    rejection_reason: influencer.user_status === 'rejected' ? (influencer.rejection_reason || null) : null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /influencers/me/submit-for-review
// ─────────────────────────────────────────────────────────────────────────────

/**
 * registration-and-profile §6: her account reaches the admin queue when she submits it, not
 * when she registers. Refused while incomplete, with the list. A rejected creator edits her
 * own form (PATCH /influencers/me) and submits again through this same door — the creator
 * resubmit path that never existed (§6.4).
 */
const submitForReview = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  if (influencer.user_status === 'approved') throw new AppError('CONFLICT', 'This account is already approved.', 409);
  if (influencer.user_status === 'suspended') throw new AppError('CONFLICT', 'This account is suspended. Contact support.', 409);
  const summary = await completeness.forCreator(influencer.id);
  if (!summary.complete) throw completeness.incompleteError(AppError, summary, 'user');
  await db.query(`UPDATE influencers SET submitted_for_review_at = now(), rejection_reason = NULL, updated_at = now() WHERE id = $1`, [influencer.id]);
  if (influencer.user_status === 'rejected') {
    await db.query(`UPDATE users SET status = 'pending' WHERE id = $1`, [influencer.user_id]);
    // The claim row follows her back into the verification queue so admin can approve again.
    await db.query(
      `UPDATE creator_profiles SET verification_status = 'claimed', rejection_reason = NULL
        WHERE linked_influencer_id = $1 AND verification_status = 'rejected'`, [influencer.id]).catch(() => {});
  }
  return success(res, { user_status: 'pending', submitted: true, message: 'Sent for review. Usually within 24 hours.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /influencers/me/profile-image/upload-url
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hand the creator a short-lived link to put her photo straight into storage.
 * Contract: features/creator-photo-and-reach
 *
 * Same three-step shape the rest of the app already uses (ask for a URL, PUT the
 * file, save the key) rather than posting the image through this server.
 *
 * The key is derived from HER id, so one creator can never overwrite another's
 * photo by choosing a filename, and re-uploading replaces her own.
 */
const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png']);   // Item 3: JPG or PNG, ≤ 5 MB

const getProfileImageUploadUrl = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const ct = String(req.body?.content_type || '').toLowerCase();
  if (!IMAGE_MIMES.has(ct)) {
    throw new AppError('VALIDATION_ERROR',
      PHOTO_MSG, 422, 'content_type');
  }

  const ext = ct === 'image/png' ? 'png' : ct === 'image/webp' ? 'webp' : 'jpg';
  // Cache-busting suffix: without it, replacing the photo leaves the old one
  // sitting in the phone's image cache under an identical key.
  const key = `creator-photos/${influencer.id}/${Date.now()}.${ext}`;
  const upload = await storageService.generateUploadUrl(key, ct);

  return success(res, { key, ...upload });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /influencers/me
// ─────────────────────────────────────────────────────────────────────────────

const updateMe = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found. Please register first.', 404);

  const {
    language,
    content_style,
    niche,
    youtube_handle,
    instagram_handle,   // Item 3b: editable again, with the admin ownership re-check (founder Q17)
    upi_id,
    bank_account_no,
    bank_ifsc,
    pan_number,
    bio,
    city,
    full_name,
    name: userName,
    // The key of a photo SHE uploaded, from the upload-url step. The scraped
    // Instagram picture is never written here — founder instruction 2026-08-22.
    // Contract: features/creator-photo-and-reach
    profile_image_key,
    // registration-and-profile §3.1: the two pickers, age, gender, email, the Other description.
    state_id,
    city_id,
    age,
    gender,
    email,
    niche_other,
  } = req.body;

  const updates = {};

  // registration-and-profile §3.4: languages come from the list of 30, one or more.
  if (language !== undefined) {
    const arr = Array.isArray(language) ? language : (language == null || language === '' ? [] : [language]);
    const codes = [...new Set(arr.map(v => String(v).trim()).filter(Boolean))];
    const bad = referenceLists.unknownCodes(codes, await referenceLists.languages());
    if (bad.length) throw fieldError('language', 'LANGUAGE_UNKNOWN', 'Pick your languages from the list.');
    updates.language = codes;
  }
  if (content_style !== undefined) updates.content_style = content_style;
  // Item 2 (founder Q4, rules v1.10 §8A): a creator chooses EXACTLY ONE niche from the
  // reference list and the profile does not save without one. The column stays an array
  // (every reader takes niche[]); it now holds one code. Check 16.
  if (niche !== undefined) {
    const arr = Array.isArray(niche) ? niche : (niche == null || niche === '' ? [] : [niche]);
    const codes = [...new Set(arr.map(v => String(v).trim()).filter(Boolean))];
    if (codes.length !== 1) {
      throw new AppError('VALIDATION_ERROR', 'Choose one content niche.', 422, 'niche');
    }
    const bad = referenceLists.unknownCodes(codes, await referenceLists.creatorNiches());
    if (bad.length) {
      throw new AppError('VALIDATION_ERROR', 'Choose a niche from the list.', 422, 'niche');
    }
    updates.niche = codes;
    // registration-and-profile §3.3: Other needs the typed description; picking a real niche
    // clears it (and any open queue entry resolves itself).
    if (codes[0] === 'other') {
      const desc = niche_other == null ? '' : String(niche_other).trim();
      if (!desc) throw fieldError('niche_other', 'NICHE_OTHER_REQUIRED', 'Tell us what kind of content you make.');
      if (desc.length > 80) throw fieldError('niche_other', 'NICHE_OTHER_LONG', 'Keep it under 80 characters.');
      updates.niche_other = desc;
      updates.niche_other_resolved_at = null;
    } else {
      updates.niche_other = null;
      updates.niche_other_resolved_at = null;
    }
  } else if (niche_other !== undefined && Array.isArray(influencer.niche) && influencer.niche[0] === 'other') {
    const desc = niche_other == null ? '' : String(niche_other).trim();
    if (!desc) throw fieldError('niche_other', 'NICHE_OTHER_REQUIRED', 'Tell us what kind of content you make.');
    if (desc.length > 80) throw fieldError('niche_other', 'NICHE_OTHER_LONG', 'Keep it under 80 characters.');
    updates.niche_other = desc;
  }
  if (age !== undefined) {
    const n = age == null || age === '' ? null : Number(age);
    if (n != null && (!Number.isInteger(n) || n < 13 || n > 99)) throw fieldError('age', 'AGE_INVALID', 'Enter your age (13 to 99).');
    updates.age = n;
  }
  if (gender !== undefined) {
    const g = gender == null || gender === '' ? null : String(gender).trim().toLowerCase();
    if (g != null && !GENDERS.includes(g)) throw fieldError('gender', 'GENDER_INVALID', 'Choose one of the options.');
    updates.gender = g;
  }
  if (email !== undefined) {
    const v = email == null ? null : String(email).trim().toLowerCase();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw fieldError('email', 'EMAIL_INVALID', 'Enter a valid email address.');
    updates.email = v || null;
  }
  // Item 3b (A5): a handle change, add or remove goes through the social-account rules —
  // after approval the old numbers are cleared and the new handle waits for admin's
  // ownership check; before approval it just saves. The service writes the handle column.
  const socialChanges = [];
  for (const [platform, raw] of [['instagram', instagram_handle], ['youtube', youtube_handle]]) {
    if (raw === undefined) continue;
    try {
      const r = await socialAccounts.setHandle(influencer.id, platform, raw, { approved: influencer.user_status === 'approved' });
      if (r.action !== 'none') socialChanges.push({ platform, action: r.action });
    } catch (e) {
      if (e.code && e.status) throw new AppError(e.code, e.message, e.status, e.field);
      throw e;
    }
  }
  if (bank_ifsc !== undefined) updates.bank_ifsc = bank_ifsc;
  if (bio !== undefined) {
    const v = bio == null ? null : String(bio).trim();
    if (v && v.length > 150) throw fieldError('bio', 'BIO_TOO_LONG', 'Keep it under 150 characters.');
    updates.bio = v || null;
  }
  if (full_name !== undefined) {
    if (!String(full_name || '').trim()) throw fieldError('full_name', 'NAME_REQUIRED', 'Enter your full name.');
    updates.full_name = String(full_name).trim();
  }
  // registration-and-profile §1: the two pickers replace the Google city search. place_id is
  // ignored. A typed city alone is refused — there is no path that writes an unresolved name.
  let placeResolved = null;
  if (state_id !== undefined || city_id !== undefined) {
    placeResolved = await resolvePickedCity({ state_id: state_id !== undefined ? state_id : influencer.state_id, city_id });
    updates.city_id = placeResolved.cityId;
    updates.state_id = placeResolved.stateId;
    updates.city = placeResolved.cityName;
    updates.state = placeResolved.stateName;
  } else if (city !== undefined) {
    throw fieldError('city_id', 'CITY_REQUIRED', 'Pick your state, then your nearest major city.');
  }
  // '' clears the photo back to initials — a creator must be able to remove a
  // picture of herself, so an empty string is a deliberate value, not a no-op.
  if (profile_image_key !== undefined) {
    if (profile_image_key === '' || profile_image_key == null) {
      updates.profile_image_r2_key = null;
    } else {
      // Item 3 (founder Q16): the presigned PUT cannot cap a file, so check what landed.
      if (!String(profile_image_key).startsWith(`creator-photos/${influencer.id}/`)) throw fieldError('profile_image_key', 'PHOTO_TYPE_SIZE', PHOTO_MSG);
      const head = await storageService.headObject(profile_image_key);
      const type = String((head && head.contentType) || '').toLowerCase();
      const size = Number((head && head.size) || 0);
      const extOk = /\.(jpe?g|png)$/i.test(String(profile_image_key));
      if (head && (!/^image\/(jpe?g|png)$/.test(type) || size > PHOTO_MAX_BYTES)) throw fieldError('profile_image_key', 'PHOTO_TYPE_SIZE', PHOTO_MSG);
      if (!head && !extOk) throw fieldError('profile_image_key', 'PHOTO_TYPE_SIZE', PHOTO_MSG);
      updates.profile_image_r2_key = profile_image_key;
    }
  }

  // Encrypt sensitive fields before storing
  if (upi_id !== undefined) updates.upi_id = encrypt(upi_id);
  if (bank_account_no !== undefined) updates.bank_account_no = encrypt(bank_account_no);
  if (pan_number !== undefined) updates.pan_number = encrypt(pan_number);

  // Update name on users table if provided
  const nameUpdate = userName !== undefined ? userName : full_name;

  if (Object.keys(updates).length === 0 && nameUpdate === undefined && instagram_handle === undefined && youtube_handle === undefined) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
    const values = [influencer.id, ...Object.values(updates)];

    await db.query(
      `UPDATE influencers SET ${setClauses.join(', ')} WHERE id = $1`,
      values
    );
  }

  if (nameUpdate !== undefined) {
    await db.query(`UPDATE users SET name = $1 WHERE id = $2`, [nameUpdate, req.user.sub]);
  }
  if (placeResolved) {
    await db.query(`UPDATE users SET city = $1, state = $2 WHERE id = $3`, [placeResolved.cityName, placeResolved.stateName, req.user.sub]);
  }


  const updated = await getInfluencerById(influencer.id);
  await withOwnPhoto(updated);
  const out = sanitiseInfluencer(updated);
  Object.assign(out, await ownProfileExtras(updated));
  out.needsNiche = !(Array.isArray(updated.niche) && updated.niche.length === 1);
  return success(res, { influencer: out, cityAdded: false, social: { changed: socialChanges }, completeness: await completeness.forCreator(influencer.id) });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/search  (brand + admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: parse comma-separated query value into a string[].
 * Accepts "a,b,c" or array form. Trims and lowercases. Empty returns null.
 */
function parseList(value) {
  if (value == null) return null;
  const arr = Array.isArray(value)
    ? value
    : String(value).split(',').map(s => s.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

/**
 * Map a sort key from the brand UI to a SQL ORDER BY clause against the
 * v_searchable_creators view. NULLS LAST so missing metrics don't poison
 * sort order.
 */
const SORT_MAP = {
  rank:          'rank_score DESC NULLS LAST',
  view_er:       'view_based_er DESC NULLS LAST',
  followers:     'followers_count DESC NULLS LAST',
  active:        'posting_frequency_per_week DESC NULLS LAST',
  growth:        'growth_potential_score DESC NULLS LAST',
  cheapest:      'estimated_min_rate ASC NULLS LAST',
  most_collabs:  'total_brand_collaborations DESC NULLS LAST',
};
const DEFAULT_SORT = SORT_MAP.rank;

const search = asyncHandler(async (req, res) => {
  const {
    q,
    sort,
    page  = '1',
    limit = '20',
  } = req.query;

  const cities       = parseList(req.query.city);
  const states       = parseList(req.query.state);
  const niches       = parseList(req.query.niche);
  const tiers        = parseList(req.query.tier);
  const languages    = parseList(req.query.languages);
  const useCases     = parseList(req.query.use_case);

  const conditions = [`(is_active_creator IS DISTINCT FROM FALSE)`];
  const params = [];

  // Stage 0, job G — a brand searches PEOPLE, not prospects.
  //
  // v_searchable_creators unions two very different things: creators who have an
  // account on INFLX, and Instagram handles an admin fed in for Apify to scrape.
  // They render identically, so a brand could pick a scraped profile and open a
  // negotiation with somebody who has never heard of us. Searching and starting a
  // collaboration is the FIRST action in the whole product — having it lead nowhere
  // is the worst possible place for a dead end.
  //
  // So brands see onboarded creators only. Admin still sees everything, because the
  // scraped list is the prospect pipeline and its whole value is knowing who is on
  // it and who has since joined.
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin) conditions.push(`source = 'onboarded'`);
  // Item 3 (rules: only approved creators appear to brands). The view admits pending rows
  // for the admin pipeline; is_inflx_verified is (u.status = 'approved') since mig 055.
  if (!isAdmin) conditions.push(`is_inflx_verified = TRUE`);

  if (q) {
    params.push(`%${String(q).trim()}%`);
    conditions.push(`(full_name ILIKE $${params.length} OR ig_handle ILIKE $${params.length})`);
  }
  if (cities) {
    // Case-insensitive city match (consistent with the follower nearby
    // feed query LOWER(u_b.city)=LOWER($1)); users type "mumbai", stored
    // as "Mumbai".
    params.push(cities.map(c => String(c).trim().toLowerCase()));
    conditions.push(`LOWER(btrim(city)) = ANY($${params.length}::text[])`);
  }
  if (states) {
    params.push(states.map(s => String(s).trim().toLowerCase()));
    conditions.push(`LOWER(btrim(state)) = ANY($${params.length}::text[])`);
  }
  if (niches) {
    params.push(niches);
    conditions.push(`niche = ANY($${params.length}::text[])`);
  }
  // NOTE: the tier filter is deliberately applied LAST (just before the WHERE
  // is assembled) so the tier facet counts can reuse every other condition
  // without it. Do not move it back up here.
  if (languages) {
    params.push(languages);
    conditions.push(`languages && $${params.length}::text[]`);
  }
  if (useCases) {
    params.push(useCases);
    conditions.push(`recommended_use_cases && $${params.length}::text[]`);
  }
  if (req.query.min_followers) {
    params.push(parseInt(req.query.min_followers, 10));
    conditions.push(`followers_count >= $${params.length}`);
  }
  if (req.query.max_followers) {
    params.push(parseInt(req.query.max_followers, 10));
    conditions.push(`followers_count <= $${params.length}`);
  }
  if (req.query.min_view_er) {
    params.push(parseFloat(req.query.min_view_er));
    conditions.push(`view_based_er >= $${params.length}`);
  }
  if (req.query.min_rate) {
    params.push(parseFloat(req.query.min_rate));
    conditions.push(`estimated_min_rate >= $${params.length}`);
  }
  if (req.query.max_rate) {
    params.push(parseFloat(req.query.max_rate));
    conditions.push(`estimated_max_rate <= $${params.length}`);
  }
  if (req.query.min_posts_per_week) {
    params.push(parseFloat(req.query.min_posts_per_week));
    conditions.push(`posting_frequency_per_week >= $${params.length}`);
  }
  if (req.query.has_brand_collabs === 'true') {
    conditions.push(`total_brand_collaborations > 0`);
  }
  if (req.query.is_inflx_verified === 'true') {
    conditions.push(`is_inflx_verified = TRUE`);
  }
  if (req.query.is_business === 'true') {
    conditions.push(`is_business = TRUE`);
  }
  if (req.query.brand_handle) {
    // top_brand_partners is a JSONB array of objects with a "handle" key
    params.push(String(req.query.brand_handle).trim().toLowerCase());
    conditions.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(top_brand_partners, '[]'::jsonb)) AS bp
      WHERE LOWER(REPLACE(bp->>'handle', '@', '')) = $${params.length}
    )`);
  }

  // Snapshot every condition EXCEPT tier — the tier chip row needs counts for
  // all tiers under the current filters, otherwise selecting a tier zeroes the
  // others and the chips vanish, stranding the user with no way to switch.
  const facetConditions = [...conditions];
  const facetParams     = [...params];

  if (tiers) {
    params.push(tiers);
    conditions.push(`tier = ANY($${params.length}::text[])`);
  }

  const where    = conditions.join(' AND ');
  const orderBy  = SORT_MAP[String(sort || '').trim()] || DEFAULT_SORT;

  // Tier facets. Counts are whole-result-set, not page-scoped: the previous
  // client-side derivation counted only the ~50 loaded rows, so a chip could
  // read "Nano 10" while the real total was 13.
  const { rows: facetRows } = await db.query(
    `SELECT tier, COUNT(*)::int AS c
       FROM v_searchable_creators
      WHERE ${facetConditions.join(' AND ')}
      GROUP BY tier`,
    facetParams
  );
  const tierCounts = { all: 0 };
  for (const r of facetRows) {
    tierCounts.all += r.c;
    if (r.tier) tierCounts[r.tier] = r.c;
  }

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM v_searchable_creators WHERE ${where}`,
    params
  );
  const total = countRows[0].c;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * limitNum;
  params.push(limitNum, offset);

  const { rows } = await db.query(
    `SELECT
       row_id, source, ig_handle, full_name, profile_pic_url, profile_pic_r2_key,
       followers_count, view_based_er, follower_based_er,
       tier, city, state, niche, sub_niche, languages,
       ig_verified, is_business,
       estimated_min_rate, estimated_max_rate,
       rank_score, growth_potential_score, posting_frequency_per_week,
       total_posts_90d, total_brand_collaborations, unique_brands_count,
       commercial_post_rate, top_brand_partners, recommended_use_cases,
       avg_views, avg_likes, avg_comments,
       activity_status, linked_influencer_id,
       is_inflx_verified, last_calculated_at,
       -- Stage 1 — how many people follow her ON INFLX. Counted live from the follow
       -- table rather than stored, so it can never drift from what is actually true.
       --
       -- It leads the row in the app, ahead of Instagram, deliberately: social reach is
       -- who might SEE a post; INFLX following is who can BUY without leaving. For a
       -- brand choosing someone to sell for them, the second predicts revenue and the
       -- first predicts attention.
       --
       -- A scraped prospect has no account, so no follows — NULL rather than 0, because
       -- "nobody follows her here" and "she is not here" are different facts.
       (SELECT count(*)::int FROM follower_follows ff
         WHERE ff.influencer_id = v_searchable_creators.linked_influencer_id) AS inflx_followers,
       -- Only the picture SHE uploaded. The scraped Instagram one is never shown to a
       -- brand (founder decision 2026-08-22). Migration 157 consolidated this onto
       -- profile_image_r2_key — migration 156's avatar_url duplicated a column that
       -- already existed for exactly this, and both were empty.
       (SELECT i2.profile_image_r2_key FROM influencers i2
         WHERE i2.id = v_searchable_creators.linked_influencer_id) AS profile_image_r2_key
     FROM v_searchable_creators
     WHERE ${where}
     ORDER BY ${orderBy}, ig_handle
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  await resolveAvatars(rows);
  // Separately, the photo the creator uploaded herself. Kept apart from the line
  // above on purpose: that one resolves the SCRAPED Instagram picture, which the
  // apps must never display. Contract: features/creator-photo-and-reach
  await resolveAvatars(rows, {
    urlField: 'profile_image_url',
    keyField: 'profile_image_r2_key',
  });

  // Explicit brand-facing verification tag (product decision 2026-05-19):
  // search shows BOTH registered+admin-verified and scraped/pending
  // creators; `is_verified` lets the UI render the "verified" badge for
  // genuinely admin-verified registered influencers only. Derived from the
  // view's is_inflx_verified, which migration 055 made approval-aware for
  // onboarded ((u.status='approved')) and verification-aware for scraped.

  // The storage key is internal — strip it, and do not hand a brand the scraped
  // picture under any name.
  const creators = rows.map(({ profile_image_r2_key, profile_pic_r2_key, profile_pic_url, ...r }) => ({
    ...r,
    is_verified: r.is_inflx_verified === true,
  }));

  return success(res, { creators }, 200, { page: pageNum, limit: limitNum, total, tier_counts: tierCounts });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/:id  (brand + admin — public profile view)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public profile detail. Resolves IDs from EITHER source:
 *   1. influencers.id      (onboarded — legacy table)
 *   2. creator_profiles.id (scraped — new table)
 *
 * Both produce the same response shape (legacy `influencer` object) so
 * the existing brand-web detail page renders without changes. A few new
 * fields are added (`is_inflx_verified`, `source`, `view_based_er`,
 * `verification_status`) for the badge / future enhancements.
 *
 * UUID format guard prevents 22P02 errors when callers pass non-UUID strings.
 */
const getPublicById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid influencer id', 400);
  }

  // 1. Onboarded influencer (legacy)
  const { rows: legacy } = await db.query(
    `SELECT
       i.id, i.instagram_handle, i.youtube_handle,
       -- A creator who signed up in the app has her name and city on the USERS row —
       -- registration wrote them there and nowhere else until 2026-08-26. Reading
       -- i.city alone is why this page said "Where: Not stated" for someone who had
       -- typed her city. Contract: features/admin-creator-review-completeness
       COALESCE(i.full_name, u.name)   AS full_name,
       i.followers_count, i.engagement_rate, i.engagement_rate AS view_based_er,
       i.niche, i.secondary_niche,
       i.language, i.tier,
       COALESCE(i.city,  u.city)       AS city,
       COALESCE(i.state, u.state)      AS state,
       i.gender, i.platform,
       i.avg_views, i.avg_likes, i.avg_comments, i.avg_shares, i.avg_saves,
       i.total_posts, i.verified,
       i.bio, i.website,
       i.price_per_post_min, i.price_per_post_max,
       i.past_brands_json, i.collaboration_types_json,
       i.profile_image_url, i.age, i.created_at,
       i.profile_image_r2_key,
       -- YouTube reach, alongside Instagram reach rather than merged into it. Two
       -- audiences, two numbers; adding them would invent a creator who does not exist.
       -- NULL subscribers means never measured, which the screen states rather than
       -- rounding to 0. Contract: features/admin-creator-review-completeness
       i.youtube_channel_id, i.youtube_title, i.youtube_subscribers,
       i.youtube_views, i.youtube_videos, i.youtube_thumbnail_url,
       i.youtube_scrape_last_run,
       -- Counted live from the follow table, exactly as it is for a real person
       -- who follows her tomorrow. Never a stored or estimated number.
       (SELECT count(*)::int FROM follower_follows ff WHERE ff.influencer_id = i.id)
         AS inflx_followers,
       u.name, u.id AS user_id, u.status AS user_status,
       'onboarded'::text AS source,
       (u.status = 'approved') AS is_inflx_verified,
       u.status::text AS verification_status,
       i.city_id,
       GREATEST(i.scrape_last_run, i.youtube_scrape_last_run) AS measured_at
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.id = $1`,
    [id]
  );
  if (legacy[0]) {
    // Item 3 (D11): a brand sees approved creators only. Admin keeps the full view.
    if (req.user.role === 'brand' && legacy[0].user_status !== 'approved') {
      throw new AppError('NOT_FOUND', 'Creator not found', 404);
    }
    // Admin-only detail. Kept out of the shared select on purpose — this endpoint also
    // serves BRANDS, and a creator's personal number and earnings are not theirs to see.
    // Contract: features/admin-account-review
    if (req.user.role === 'admin') {
      const { rows: [priv] } = await db.query(
        `SELECT u.phone, u.status,
                i.wallet_balance, i.pending_balance,
                i.scrape_last_run, i.tds_exempt, i.tds_override_pct,
                i.niche_other, i.niche_other_resolved_at, i.email, i.submitted_for_review_at, i.rejection_reason,
                (i.pan_number IS NOT NULL) AS has_pan, (i.bank_account_no IS NOT NULL) AS has_bank_account, (i.upi_id IS NOT NULL) AS has_upi
           FROM influencers i JOIN users u ON u.id = i.user_id
          WHERE i.id = $1`,
        [id]
      );
      if (priv) Object.assign(legacy[0], priv);
      // registration-and-profile §9A.2: the review page's roll-up from the one rule.
      const c = await completeness.forCreator(id);
      if (c) { legacy[0].completeness = c; legacy[0].missing_fields = c.missing_labels; }
    }
    // Her own uploaded photo, turned into a URL that loads. This used to point at
    // the scraped-picture key and was therefore permanently a no-op for onboarded
    // creators — they have no scraped key. Contract: features/creator-photo-and-reach
    await resolveAvatars(legacy, {
      urlField: 'profile_image_url',
      keyField: 'profile_image_r2_key',
    });
    delete legacy[0].profile_image_r2_key;
    // A handle is not a link. Creators paste @name, youtube.com/@name and /channel/UC…
    // interchangeably; the server knows which is which, so it hands the page a URL that
    // opens rather than making every caller guess.
    legacy[0].youtube_url = youtubeService.channelUrl(legacy[0].youtube_handle);
    legacy[0].instagram_url = legacy[0].instagram_handle
      ? `https://instagram.com/${legacy[0].instagram_handle}` : null;
    // Item 2 (A6, screen X4) — what THIS brand may know about her invitation settings:
    // open or paused, the Aims and modes she accepts, and whether it may invite her, as a
    // coarse reason. Blocked looks exactly like paused. Admins get no verdict.
    let inviteSummary = null;
    // Item 3 (A6, screens P1–P4): city names, measured-at, the signed count across INFLX,
    // this brand's own signed collaborations with her, her place in this brand's groups,
    // and whether this brand has blocked her. Nothing private: no email, no phone, no
    // settings, no other brand's business.
    const extras = {};
    if (legacy[0].city_id) {
      const { rows: c } = await db.query(
        `SELECT rc.name AS city_name, rs.name AS state_name FROM ref_cities rc JOIN ref_states rs ON rs.id = rc.state_id WHERE rc.id = $1`, [legacy[0].city_id]);
      extras.cityName = c[0] ? c[0].city_name : null; extras.stateName = c[0] ? c[0].state_name : null;
    } else { extras.cityName = legacy[0].city || null; extras.stateName = legacy[0].state || null; }
    extras.measuredAt = legacy[0].measured_at || null;
    const { rows: signedAll } = await db.query(
      `SELECT count(*)::int AS n FROM contracts con JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
        WHERE ci.influencer_id = $1 AND ${collabState.SIGNED_CONTRACT_SQL}`, [legacy[0].id]);
    extras.signedCollaborations = signedAll[0].n;
    extras.signedCollaborationsLabel = signedAll[0].n > 0 ? collabState.P1_COUNT_LABEL(signedAll[0].n) : null;
    if (req.user.role === 'brand') {
      const { rows: me } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [req.user.sub]);
      const myBrandId = me[0] ? me[0].id : null;
      inviteSummary = await eligibility.inviteSummaryFor(legacy[0].id, myBrandId);
      if (myBrandId) {
        const { rows: collabs } = await db.query(
          `SELECT ci.id, ci.status::text AS status, c.name AS campaign_name, cs.name AS set_name, cs.goal::text AS aim,
                  GREATEST(con.influencer_signed_at, con.brand_signed_at) AS signed_at
             FROM contracts con
             JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
             JOIN campaign_sets cs ON cs.id = ci.set_id
             JOIN campaigns c ON c.id = cs.campaign_id
            WHERE ci.influencer_id = $1 AND c.brand_id = $2 AND ${collabState.SIGNED_CONTRACT_SQL}
            ORDER BY signed_at DESC`, [legacy[0].id, myBrandId]);
        extras.collaborationsWithYou = collabs.map(r => ({
          id: r.id, campaignName: r.campaign_name, setName: r.set_name, aim: r.aim, signedAt: r.signed_at,
          status: r.status, stateFamily: collabState.familyOf(r.status), stateLabel: collabState.FAMILY_LABEL[collabState.familyOf(r.status)],
        }));
        const { rows: groups } = await db.query(
          `SELECT g.id, g.name FROM influencer_group_members m JOIN influencer_groups g ON g.id = m.group_id
            WHERE g.brand_id = $1 AND m.influencer_id = $2 ORDER BY g.name`, [myBrandId, legacy[0].id]);
        extras.groups = groups;
        extras.blockedByYou = await eligibility.isBlocked('brand', myBrandId, 'creator', legacy[0].id);
      }
    }
    delete legacy[0].measured_at;
    // Item 3b (A1): the platform cards — brand-facing state only, never the internal reason.
    extras.social = await socialAccounts.brandView(legacy[0].id);
    return success(res, { influencer: legacy[0], inviteSummary, ...extras });
  }

  // 2. Scraped creator profile (new table) — shape into the legacy response
  const { rows: scraped } = await db.query(
    `SELECT
       cp.id,
       cp.ig_handle              AS instagram_handle,
       cp.youtube_handle,
       cp.full_name,
       cp.followers_count,
       cp.follower_based_er      AS engagement_rate,
       cp.view_based_er,
       ARRAY[cp.niche]            AS niche,
       CASE WHEN cp.sub_niche IS NULL THEN NULL ELSE ARRAY[cp.sub_niche] END AS secondary_niche,
       cp.languages              AS language,
       cp.follower_tier          AS tier,
       cp.city,
       -- Was hardcoded NULL. creator_profiles.state exists since migration
       -- 146, so a creator the admin has tagged now shows that state on their
       -- own profile, not just in search.
       cp.state,
       -- creator_profiles genuinely has no gender column; NULL is honest here.
       NULL::text                AS gender,
       'Instagram'::text         AS platform,
       cp.avg_views,
       cp.avg_likes,
       cp.avg_comments,
       0::int                    AS avg_shares,
       0::int                    AS avg_saves,
       cp.total_posts_lifetime   AS total_posts,
       cp.is_verified            AS verified,
       cp.bio,
       cp.external_url           AS website,
       cp.estimated_min_rate     AS price_per_post_min,
       cp.estimated_max_rate     AS price_per_post_max,
       cp.top_brand_partners     AS past_brands_json,
       cp.recommended_use_cases  AS collaboration_types_json,
       cp.profile_pic_url        AS profile_image_url,
       cp.profile_pic_r2_key,
       NULL::int                 AS age,
       cp.full_name              AS name,
       cp.linked_influencer_id   AS user_id,
       cp.activity_status        AS user_status,
       'scraped'::text           AS source,
       (cp.verification_status = 'verified') AS is_inflx_verified,
       cp.verification_status,
       -- Extra fields exposed for the new UI
       cp.posting_frequency_per_week,
       cp.total_posts_90d,
       cp.total_brand_collaborations,
       cp.unique_brands_count,
       cp.commercial_post_rate,
       cp.growth_potential_score,
       cp.rank_score,
       cp.recommended_use_cases,
       cp.last_calculated_at
     FROM creator_profiles cp
     WHERE cp.id = $1`,
    [id]
  );
  if (scraped[0]) {
    // Admin-only detail for a SCRAPED creator. She has no account, so there is no
    // users.phone — but a number is often scraped out of her bio, and an admin may have
    // typed one in by hand. Both were stored and neither could ever be seen: this branch
    // had no admin block at all, so a scraped creator's page showed no way to reach her.
    // manual_phone wins, because a human typed it.
    // Contract: features/admin-account-review
    if (req.user.role === 'admin') {
      const { rows: [priv] } = await db.query(
        `SELECT COALESCE(manual_phone, bio_phone) AS phone,
                manual_phone, bio_phone
           FROM creator_profiles WHERE id = $1`,
        [id]
      );
      if (priv) Object.assign(scraped[0], priv);
    }
    // The fix for the reported blank avatar. Search already did this; detail
    // did not, so it returned the raw Instagram CDN URL — which decays in 1-2
    // weeks (see utils/avatarResolver.js). A 76-day-old row therefore rendered
    // a dead image on the profile while the Discover list showed the cached
    // R2 copy just fine.
    await resolveAvatars(scraped, { urlField: 'profile_image_url' });
    // Internal storage key — never part of the public response.
    delete scraped[0].profile_pic_r2_key;
    // Same openable links the onboarded branch hands over, so one page renders both.
    scraped[0].youtube_url = youtubeService.channelUrl(scraped[0].youtube_handle);
    scraped[0].instagram_url = scraped[0].instagram_handle
      ? `https://instagram.com/${scraped[0].instagram_handle}` : null;
    return success(res, { influencer: scraped[0] });
  }

  throw new AppError('NOT_FOUND', 'Creator not found', 404);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/earnings  (Phase 3 — Block E)
// ─────────────────────────────────────────────────────────────────────────────

const getEarnings = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  // Locked escrow entries for this influencer (T2/T3 not yet released)
  const { rows: lockedEntries } = await db.query(
    `SELECT ee.*, c.name AS campaign_name, c.id AS campaign_id
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id  = ee.campaign_influencer_id
     JOIN campaign_sets        cs ON cs.id  = ci.set_id
     JOIN campaigns            c  ON c.id   = cs.campaign_id
     WHERE ci.influencer_id = $1 AND ee.status = 'locked'
     ORDER BY ee.tranche_number ASC`,
    [inf.id]
  );

  const pendingAmount = lockedEntries.reduce(
    (sum, e) => sum + parseFloat(e.net_to_influencer),
    0
  );

  // Phase 4: commission summary from follower_transactions
  const { rows: commRows } = await db.query(
    `SELECT
       SUM(CASE WHEN ft.commission_confirmed_at IS NULL THEN ft.influencer_commission ELSE 0 END) AS pending,
       SUM(CASE WHEN ft.commission_confirmed_at IS NOT NULL THEN ft.influencer_commission ELSE 0 END) AS confirmed
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     WHERE ci.influencer_id = $1 AND ft.status = 'completed'`,
    [inf.id]
  );
  const commSummary = commRows[0] || { pending: 0, confirmed: 0 };
  const pendingComm   = parseFloat(commSummary.pending  || 0);
  const confirmedComm = parseFloat(commSummary.confirmed || 0);

  // Phase 5: recent withdrawals + TDS this financial year
  const { rows: recentWithdrawals } = await db.query(
    `SELECT id AS withdrawal_id, amount_requested, tds_deducted, net_paid,
            method, status, created_at, completed_at
     FROM influencer_withdrawals
     WHERE influencer_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [inf.id]
  );

  // Indian financial year: April 1 to March 31
  const now = new Date();
  const fyStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)        // April 1 this year
    : new Date(now.getFullYear() - 1, 3, 1);   // April 1 last year

  const { rows: tdsRows } = await db.query(
    `SELECT COALESCE(SUM(tds_deducted), 0) AS tds_this_fy
     FROM influencer_withdrawals
     WHERE influencer_id = $1
       AND status IN ('completed', 'processing')
       AND created_at >= $2`,
    [inf.id, fyStart.toISOString()]
  );
  const tdsThisFinancialYear = parseFloat(tdsRows[0].tds_this_fy || 0);

  // available_to_withdraw = current wallet_balance
  const availableToWithdraw = parseFloat(inf.wallet_balance);

  return success(res, {
    wallet_balance:           inf.wallet_balance,
    pending_balance:          inf.pending_balance,
    total_earned:             inf.total_earned,
    available_to_withdraw:    availableToWithdraw,
    pending_amount:           pendingAmount.toFixed(2),
    locked_entries:           lockedEntries,
    commission_summary: {
      pending:   pendingComm,
      confirmed: confirmedComm,
      total:     pendingComm + confirmedComm,
    },
    recent_withdrawals:       recentWithdrawals,
    tds_this_financial_year:  tdsThisFinancialYear,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/ledger?limit=50&offset=0  (Money G-5)
// Paginated earnings ledger for the authed influencer (forward-only audit
// trail from influencer_ledger; written by sale/confirm/tranche/withdrawal/
// enquiry/referral/return-clawback sites).
// ─────────────────────────────────────────────────────────────────────────────

const getLedger = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const limit  = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM influencer_ledger WHERE influencer_id = $1`,
    [inf.id]
  );
  const total = countRows[0]?.total || 0;

  const { rows } = await db.query(
    `SELECT id, type, amount, direction, balance_field, balance_after,
            source, source_ref_id, note, created_at
       FROM influencer_ledger
      WHERE influencer_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [inf.id, limit, offset]
  );

  return success(res, { entries: rows }, 200, {
    total,
    limit,
    offset,
    has_more: offset + rows.length < total,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/tds-certificate?fy=2024-25
// Returns a Form 16A-style PDF for the requested financial year
// ─────────────────────────────────────────────────────────────────────────────

const getTdsCertificate = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  // Parse requested FY — default to current FY
  const fyParam = (req.query.fy || '').trim();
  let fyStart, fyEnd, fyLabel;

  if (fyParam && /^\d{4}-\d{2}$/.test(fyParam)) {
    const startYear = parseInt(fyParam.slice(0, 4));
    fyStart = new Date(startYear, 3, 1);       // April 1 of start year
    fyEnd   = new Date(startYear + 1, 2, 31);  // March 31 of end year
    fyLabel = fyParam;
  } else {
    // Default: current Indian financial year
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    fyStart = new Date(startYear, 3, 1);
    fyEnd   = new Date(startYear + 1, 2, 31);
    fyLabel = `${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  // Query completed withdrawals within the FY
  const { rows: withdrawalRows } = await db.query(
    `SELECT COALESCE(SUM(amount_requested), 0) AS gross_earnings,
            COALESCE(SUM(tds_deducted), 0)     AS tds_deducted,
            COALESCE(SUM(net_paid), 0)          AS net_paid
     FROM influencer_withdrawals
     WHERE influencer_id = $1
       AND status IN ('completed', 'processing')
       AND created_at >= $2
       AND created_at <= $3`,
    [inf.id, fyStart.toISOString(), fyEnd.toISOString()]
  );

  const grossEarnings = parseFloat(withdrawalRows[0].gross_earnings);
  const tdsDeducted   = parseFloat(withdrawalRows[0].tds_deducted);
  const netPaid       = parseFloat(withdrawalRows[0].net_paid);

  // Fetch name and phone from users table for the cert
  const { rows: userRows } = await db.query(
    `SELECT u.name AS full_name, u.phone, i.instagram_handle, i.pan_number
     FROM users u
     JOIN influencers i ON i.user_id = u.id
     WHERE u.id = $1`,
    [req.user.sub]
  );
  const influencerDetails = userRows[0] || {};

  const pdfBuffer = await pdfService.generateTdsCertificate({
    influencer: influencerDetails,
    fy:         fyLabel,
    fyStart,
    fyEnd,
    grossEarnings,
    tdsDeducted,
    netPaid,
  });

  const filename = `inflx_tds_certificate_${fyLabel.replace('-', '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.end(pdfBuffer);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /influencers/:id/rescrape  (admin only — refresh Instagram stats)
// ─────────────────────────────────────────────────────────────────────────────

const rescrape = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerById(req.params.id);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer not found', 404);

  // Item 3b: "Rescrape" is now "Measure now" through the measurement pipeline — nothing
  // writes the number columns directly any more. Every confirmed account of an approved
  // creator gets a full run; the response reports what was started.
  // Contract: features/item3b-social-numbers
  if (influencer.user_status !== 'approved') throw new AppError('CONFLICT', 'Only an approved creator can be measured', 409);
  const accounts = await socialAccounts.currentAll(influencer.id);
  const started = [];
  for (const platform of socialAccounts.PLATFORMS) {
    const a = accounts[platform];
    if (a && a.ownership === 'confirmed') {
      if (req.query.wait === '1') await socialMeasure.runAccount(a.id, 'full', 'measure_now');
      else socialMeasure.kick(a.id, 'full', 'measure_now');
      started.push(platform);
    }
  }
  const updated = await getInfluencerById(influencer.id);
  return success(res, {
    influencer: sanitiseInfluencer(updated),
    scraped_at: new Date().toISOString(),
    measure_now: { started },
    social: await socialAccounts.mine(influencer.id),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported for admin controller re-use
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/campaigns
// Returns all campaigns the influencer is part of (via campaign_influencers)
// ─────────────────────────────────────────────────────────────────────────────

const getMyCampaigns = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { status } = req.query;
  const conditions = [`ci.influencer_id = $1`];
  const params = [inf.id];

  // Filter by campaign_influencer status group
  if (status === 'active') {
    conditions.push(`ci.status IN ('accepted', 'contracted', 'active')`);
  } else if (status === 'completed') {
    conditions.push(`ci.status = 'completed'`);
  }
  // 'all' or no filter returns everything except declined/expired
  if (!status || status === 'all') {
    conditions.push(`ci.status NOT IN ('declined', 'expired')`);
  }

  const { rows } = await db.query(
    `SELECT
       ci.id AS campaign_influencer_id,
       ci.status AS influencer_status,
       ci.agreed_fee,
       -- The list showed "Fee ₹0" for every sales collaboration because this was never
       -- sent. The detail screen selects it; the list did not.
       -- Contract: features/collab-terms-by-aim (item 1)
       ci.commission_pct,
       ci.influencer_budget,
       ci.posting_date,
       ci.contract_signed_at,
       ci.brand_signed_at,
       ci.created_at AS invited_at,
       c.id AS campaign_id,
       c.name AS campaign_name,
       c.brief,
       c.status AS campaign_status,
       c.start_date,
       c.end_date,
       cs.name AS set_name,
       cs.goal,
       b.business_name AS brand_name,
       (SELECT COUNT(*) FROM deliverables d WHERE d.campaign_influencer_id = ci.id) AS deliverable_count,
       (SELECT COUNT(*) FROM deliverables d WHERE d.campaign_influencer_id = ci.id AND d.status = 'approved') AS approved_count
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.created_at DESC`,
    params
  );

  return success(res, { campaigns: rows });
});

// collab-part6 §6.1 ──────────────────────────────────────────────────────────
// What the creator already agreed, and what they are allowed to sell.
//
// Both are computed from values that already existed (agreement_id since Part 2,
// alloc_* since Part 4) and were returned to the creator nowhere.

/**
 * The terms settled at the handshake, or null for a cold invite.
 * Returning null — rather than an empty shell — is what lets the app show a single
 * undivided list for a creator who never negotiated. A creator who did not agree
 * anything must never be told they did.
 */
function summariseSettledTerms(row) {
  if (!row.agreement_id || !row.agreed_terms_json) return null;
  const t = row.agreed_terms_json || {};
  const items = [];
  if (t.money && t.money.commission_pct != null) {
    items.push({ key: 'commission', label: 'Commission', value: `${t.money.commission_pct}%` });
  }
  if (t.money && t.money.fee != null) {
    items.push({ key: 'fee', label: 'Fee', value: `₹${Number(t.money.fee).toLocaleString('en-IN')}` });
  }
  if (t.time && t.time.post_by) {
    items.push({ key: 'post_by', label: 'Post by', value: String(t.time.post_by).slice(0, 10) });
  } else if (t.time && t.time.window_end) {
    items.push({
      key: 'window',
      label: 'Posting window',
      value: `${String(t.time.window_start || '').slice(0, 10)} – ${String(t.time.window_end).slice(0, 10)}`,
    });
  }
  if (!items.length) return null;
  return { agreement_id: row.agreement_id, agreed_at: row.terms_agreed_at, items };
}

/**
 * What the creator may sell, in words. 'store' and 'category' auto-join new arrivals;
 * a hand-picked list never does — which is the distinction the creator most needs and
 * could not previously see.
 */
function summariseAllocation(row) {
  const scope = row.alloc_scope || null;
  if (!scope) return null;
  if (scope === 'store') {
    return { scope, label: 'Their whole store', auto_joins_new_products: true };
  }
  if (scope === 'category') {
    return {
      scope,
      label: row.alloc_category || 'A category',
      auto_joins_new_products: true,
    };
  }
  const count = Array.isArray(row.alloc_product_ids) ? row.alloc_product_ids.length : 0;
  return {
    scope: 'products',
    label: `${count} selected product${count === 1 ? '' : 's'}`,
    auto_joins_new_products: false,
    product_count: count,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/campaigns/:campaign_influencer_id
// Full campaign detail from the influencer's perspective
// ─────────────────────────────────────────────────────────────────────────────

const getMyCampaignDetail = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const ciId = req.params.campaign_influencer_id;

  // Validate UUID format to avoid Postgres cast errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!ciId || !uuidRegex.test(ciId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid campaign assignment ID', 400);
  }

  let campaign, deliverables = [], contract = null, tranches = [];

  // Step 1: Main campaign + influencer assignment
  try {
    const { rows: ciRows } = await db.query(
      `SELECT
         ci.id AS campaign_influencer_id,
         ci.status AS influencer_status,
         ci.agreed_fee,
         ci.influencer_budget,
         ci.posting_date,
         ci.coupon_code,
         ci.commission_pct,
         ci.offer_type,
         ci.offer_config_json,
         ci.physical_delivery,
         -- Item 11, finding 2: ci.delivery_address was selected here and returned on the
         -- creator's collaboration read. It is a free-text legacy column (migration 002) that
         -- nothing writes — 0 of 19 rows in production carry one — but it is a CREATOR STREET
         -- ADDRESS, and item 11 is the item that starts holding those. A column that leaves
         -- through a payload nobody audits is the shape of the leak, whether or not it is
         -- populated today. Her address now lives on the shoot row behind address_sent_at and
         -- reaches the brand through F1 alone. The column and its data are left in place.
         -- collab-part6 §6.1 — the creator was never told WHICH terms were already
         -- settled at the handshake. Part 2 enforces it (renegotiation is refused);
         -- the value was stored and delivered to nobody, so the one-click promise was
         -- real in the API and invisible on the creator's screen.
         ci.agreement_id,
         ag.terms_json      AS agreed_terms_json,
         -- collab_agreements has no agreed_at column: the row is CREATED at the moment
         -- of acceptance (Part 2's acceptIntoAgreement), so created_at IS the date the
         -- terms were agreed. Verified against the prod schema rather than assumed.
         ag.created_at      AS terms_agreed_at,
         -- collab-part6 §6.1 — what she is allowed to sell. The allocated PRODUCTS are
         -- already reachable via /campaigns/:id/products; the scope RULE behind them
         -- was never stated, so a creator given the whole store could not tell that new
         -- arrivals join automatically.
         ci.alloc_scope,
         ci.alloc_category,
         ci.alloc_product_ids,
         ci.contract_signed_at,
         ci.brand_signed_at,
         ci.created_at AS invited_at,
         c.id AS campaign_id,
         c.name AS campaign_name,
         c.brief,
         c.status AS campaign_status,
         c.start_date,
         c.end_date,
         c.total_budget,
         cs.id AS set_id,
         cs.name AS set_name,
         cs.goal,
         cs.set_budget,
         cs.per_influencer_budget,
         cs.coupon_prefix,
         cs.content_start_date,
         cs.content_end_date,
         cs.formats_json,
         -- stage-a — SC-05's "two things you cannot change": the day and the shoot. Read
         -- through the window fallback (goLiveDayOf) below, same as the brand's own builder
         -- card, so a set built before set-first still shows her a real day, not a blank.
         cs.go_live_date, cs.window_end, cs.window_start, cs.shoot_mode,
         -- her channels/formats, else the set's (resolveChannels/resolveFormats below)
         cs.channels_json   AS set_channels_json,
         ci.channels_json   AS ci_channels_json,
         ci.formats_json    AS ci_formats_json,
         b.id AS brand_id,
         b.business_name AS brand_name,
         b.logo_url AS brand_logo_url,
         u.name AS brand_contact_name
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = c.brand_id
       JOIN users u ON u.id = b.user_id
       -- LEFT: a cold invite has no agreement, and must stay exactly as it is today.
       LEFT JOIN collab_agreements ag ON ag.id = ci.agreement_id
       WHERE ci.id = $1 AND ci.influencer_id = $2`,
      [ciId, inf.id]
    );
    if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Campaign assignment not found', 404);
    campaign = ciRows[0];
    // collab-part6 §6.1 — deliver the two facts, already stored, that the creator could
    // not see. Built here rather than in the app so both apps cannot drift, and so the
    // test can assert the PAYLOAD rather than the query.
    campaign.settled_terms = summariseSettledTerms(campaign);
    campaign.allocation_summary = summariseAllocation(campaign);

    // stage-a — SC-05: the two things she cannot change, and what SB-30 gave her. All four
    // resolved once, here, from the same functions the brand's own screens use — never a
    // second derivation that could disagree with theirs.
    const { goLiveDayOf } = require('../services/setShape.model');
    const { resolveChannels, describeChannels } = require('../services/campaignChannels');
    const { resolveFormats } = require('../services/deliverables.model');
    const { describeUsage } = require('../services/collabTerms.model');

    campaign.go_live_date = goLiveDayOf(campaign);
    campaign.formats_json = resolveFormats(campaign.ci_formats_json, campaign.formats_json);
    const resolvedChannels = resolveChannels(campaign.ci_channels_json, campaign.set_channels_json);
    campaign.channels_summary = describeChannels(resolvedChannels);
    campaign.usage_text = describeUsage(campaign.agreed_terms_json?.usage);
  } catch (e) {
    if (e instanceof AppError) throw e;
    console.error('[getMyCampaignDetail] Step 1 (main query) failed:', e.message);
    throw new AppError('INTERNAL_ERROR', `Campaign query failed: ${e.message}`, 500);
  }

  // Step 2: Deliverables
  try {
    const { rows } = await db.query(
      `SELECT d.id, d.type, d.quantity, d.status, d.submission_deadline,
              d.submitted_at, d.live_url, d.live_confirmed_at,
              d.revision_count, d.revision_limit, d.brand_feedback
       FROM deliverables d
       WHERE d.campaign_influencer_id = $1
       ORDER BY d.id ASC`,
      [ciId]
    );
    deliverables = rows;
  } catch (e) {
    console.error('[getMyCampaignDetail] Step 2 (deliverables) failed:', e.message);
    // Non-critical: return empty deliverables
  }

  // Step 3: Contract (moved before Step 2b which depends on contract status).
  //
  // Pull every field the influencer's CampaignDetailScreen renders. Earlier
  // version selected only id/status/signatures/pdf_url, which made the
  // screen fall back to campaign.agreed_fee for the total — losing any
  // brand bonus and showing a stale figure (e.g. base ₹500 instead of
  // ₹500 + ₹800 bonus). Tranches were correct because they come from
  // escrow_entries, but the headline 'Total Fee' was wrong. This SELECT
  // is the source of truth for everything the influencer sees.
  try {
    // Pulls contract row + the few fields the influencer's CampaignDetailScreen
    // expects but which actually live on adjacent tables:
    //   - goal              → campaign_sets.goal
    //   - commission_pct    → campaign_influencers.commission_pct
    //   - offer_type        → campaign_influencers.offer_type
    //   - offer_config_json → campaign_influencers.offer_config_json
    // Selecting these directly off `contracts` (as an earlier version did)
    // throws "column does not exist", which the catch below swallowed,
    // leaving `contract` null. That made the CampaignDetailScreen render
    // its "Contract is being created. Pull to refresh in a few seconds."
    // fallback even when the contract row was already in the DB.
    const { rows: contractRows } = await db.query(
      `SELECT con.id, con.status, con.influencer_signed_at, con.brand_signed_at,
              con.pdf_url, con.created_at,
              con.influencer_fee, con.bonus_amount,
              con.production_mode, con.content_requirements, con.custom_clauses,
              con.posting_date, con.revision_limit,
              cs.goal,
              ci.commission_pct, ci.offer_type, ci.offer_config_json
         FROM contracts con
         JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
         JOIN campaign_sets cs        ON cs.id = ci.set_id
        WHERE con.campaign_influencer_id = $1`,
      [ciId]
    );
    contract = contractRows[0] || null;
  } catch (e) {
    console.error('[getMyCampaignDetail] Step 3 (contract) failed:', e.message);
    // Non-critical: contract may not exist yet
  }

  // Does this collaboration have a shoot to arrange?
  //
  // Her collab screen decides between "The shoot" and "You are live" on this. Without it,
  // `hasShoot` was always false and a creator with a store visit to plan was told she was
  // live and shown no way to reach it.
  // Contract: features/shoot-plan-you-can-actually-see
  let production_event = null;
  if (contract && contract.id) {
    try {
      const { rows: peRows } = await db.query(
        `SELECT id, mode, status, visit_scheduled_at,
                brand_completed_at, influencer_completed_at
           FROM production_events WHERE contract_id = $1`,
        [contract.id]
      );
      production_event = peRows[0] || null;
    } catch (e) {
      console.error('[getMyCampaignDetail] production_event lookup failed:', e.message);
    }
  }

  // Step 2b: Auto-create deliverables if the contract is SIGNED BY BOTH but none exist
  // (handles contracts signed before deliverable-creation fix was deployed).
  //
  // Item 10 (approval §2.1): this used to key on the contract's STATUS being active, which is
  // not a signature test — four seeded production rows are active with no signatures at all, and
  // would have had deliverables invented for them here. The two timestamps are the only
  // definition of signed (item 7; collabState.SIGNED_CONTRACT_SQL). 'completed' was never a
  // contract_status value, so that arm was dead.
  if (deliverables.length === 0 && contract && contract.influencer_signed_at && contract.brand_signed_at) {
    try {
      // Fetch formats_json — her own row first, else the set's (stage-a, migration 166)
      const { rows: setRows } = await db.query(
        `SELECT cs.formats_json AS set_formats_json, ci.formats_json AS ci_formats_json, cs.goal
         FROM campaign_sets cs
         JOIN campaign_influencers ci ON ci.set_id = cs.id
         WHERE ci.id = $1`,
        [ciId]
      );
      // ⚠️ This used to fall back to [{ type: 'reel', count: 1 }] when the set had no formats,
      // which INVENTED a deliverable on a commission collaboration and then showed it to her as
      // pending work she had never agreed to. A commission creator sells product, not content.
      // Same rule as the countersign, from the same function, so the two cannot disagree again.
      // Contract: features/deliverables-only-when-buying-content
      const { plannedDeliverables, resolveFormats } = require('../services/deliverables.model');
      const resolvedSetFormats = resolveFormats(setRows[0]?.ci_formats_json, setRows[0]?.set_formats_json);
      const { formats } = plannedDeliverables(setRows[0]?.goal, resolvedSetFormats);

      for (const fmt of formats) {
        const delType = fmt.type || 'reel';
        const count = parseInt(fmt.count, 10) || 1;
        for (let i = 0; i < count; i++) {
          await db.query(
            `INSERT INTO deliverables
               (campaign_influencer_id, type, quantity, status, submission_deadline, revision_limit)
             VALUES ($1, $2, 1, 'pending', $3, 2)`,
            [ciId, delType, campaign.posting_date || null]
          );
        }
      }

      // Re-fetch deliverables after creation
      const { rows: newRows } = await db.query(
        `SELECT d.id, d.type, d.quantity, d.status, d.submission_deadline,
                d.submitted_at, d.live_url, d.live_confirmed_at,
                d.revision_count, d.revision_limit, d.brand_feedback
         FROM deliverables d
         WHERE d.campaign_influencer_id = $1
         ORDER BY d.id ASC`,
        [ciId]
      );
      deliverables = newRows;
      console.log(`[getMyCampaignDetail] Auto-created ${deliverables.length} deliverable(s) for CI ${ciId}`);
    } catch (e) {
      console.error('[getMyCampaignDetail] Step 2b (auto-create deliverables) failed:', e.message);
    }
  }

  // Step 4: Escrow / tranche entries
  try {
    const { rows } = await db.query(
      `SELECT tranche_number, amount, net_to_influencer, status, trigger_event, triggered_at, released_at
       FROM escrow_entries
       WHERE campaign_influencer_id = $1
       ORDER BY tranche_number ASC`,
      [ciId]
    );
    tranches = rows;
  } catch (e) {
    console.error('[getMyCampaignDetail] Step 4 (escrow) failed:', e.message);
    // Non-critical: tranches may not exist yet
  }

  // Step 5: Product counts for the "Publish to Store (X/Y)" badge on
  // CampaignDetailScreen. Total mirrors the resolution order used by
  // getCampaignProducts: per-influencer offer_config first, then set-level
  // campaign_offers.products_json, then full brand catalogue. Published
  // count is just the rows in influencer_product_notes for this campaign +
  // influencer pair. Both are non-critical — failures log and leave the
  // counts as null so the UI hides the badge.
  let productsTotal = null;
  let productsPublished = null;
  try {
    if (campaign?.campaign_id) {
      // Pull the CI's offer config + set's offer rows + brand id in one go.
      const { rows: ctxRows } = await db.query(
        `SELECT ci.set_id, c.brand_id, ci.offer_config_json,
                (SELECT COALESCE(SUM(jsonb_array_length(COALESCE(co.products_json, '[]'::jsonb))), 0)
                 FROM   campaign_offers co
                 WHERE  co.set_id = ci.set_id AND co.is_active = true) AS set_products_count
         FROM   campaign_influencers ci
         JOIN   campaign_sets cs ON cs.id = ci.set_id
         JOIN   campaigns c ON c.id = cs.campaign_id
         WHERE  ci.id = $1`,
        [ciId]
      );
      if (ctxRows[0]) {
        const cfg = ctxRows[0].offer_config_json || {};
        const ciProducts =
          (Array.isArray(cfg.products)   ? cfg.products.length   : 0) +
          (Array.isArray(cfg.d_prods)    ? cfg.d_prods.length    : 0) +
          (Array.isArray(cfg.v_prods)    ? cfg.v_prods.length    : 0) +
          (Array.isArray(cfg.bnd_prods)  ? cfg.bnd_prods.length  : 0);
        if (ciProducts > 0) {
          productsTotal = ciProducts;
        } else if (Number(ctxRows[0].set_products_count) > 0) {
          productsTotal = Number(ctxRows[0].set_products_count);
        } else {
          const { rows: brandCount } = await db.query(
            `SELECT COUNT(*)::int AS n FROM brand_products WHERE brand_id = $1 AND is_active = true`,
            [ctxRows[0].brand_id]
          );
          productsTotal = brandCount[0]?.n || 0;
        }

        const { rows: pubCount } = await db.query(
          `SELECT COUNT(*)::int AS n
           FROM   influencer_product_notes
           WHERE  influencer_id = $1 AND campaign_id = $2`,
          [inf.id, campaign.campaign_id]
        );
        productsPublished = pubCount[0]?.n || 0;
      }
    }
  } catch (e) {
    console.error('[getMyCampaignDetail] Step 5 (product counts) failed:', e.message);
  }

  return success(res, {
    campaign,
    deliverables,
    contract,
    tranches,
    // Whether there is a shoot to arrange. Her screen chooses between 'The shoot' and
    // 'You are live' on this. Contract: features/shoot-plan-you-can-actually-see
    production_event,
    products_total:     productsTotal,
    products_published: productsPublished,
  });
});

// ── GET /influencers/me/store-preview — influencer sees their store as followers see it

const followerService = require('../services/follower.service');

const storePreview = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const data = await followerService.getInfluencerStorePreview(inf.id);
  if (!data) throw new AppError('NOT_FOUND', 'Store data not found', 404);

  return success(res, data);
});

// ── GET /influencers/me/campaigns/:ci_id/products — products assigned via campaign
const getCampaignProducts = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const { campaign_influencer_id } = req.params;

  // Verify this CI belongs to the influencer
  const { rows: ciRows } = await db.query(
    `SELECT ci.id, ci.set_id, cs.campaign_id, c.brand_id, b.business_name, b.category,
            ci.offer_type, ci.offer_config_json,
            -- collab-part4 §4.1 — allocation is its own axis, not the offer's scope.
            ci.alloc_scope, ci.alloc_category_node_id, ci.alloc_category, ci.alloc_product_ids
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     WHERE ci.id = $1 AND ci.influencer_id = $2`,
    [campaign_influencer_id, inf.id]
  );
  if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Campaign assignment not found', 404);
  const ci = ciRows[0];

  // Get offer data — first from campaign_influencers (per-influencer offer), then campaign_offers
  const ciOfferType = ciRows[0].offer_type || null;
  const ciOfferConfig = ciRows[0].offer_config_json || {};
  const offerConfigProducts = ciOfferConfig.products || [];

  // Also check campaign_offers for this set
  const { rows: offers } = await db.query(
    `SELECT id, offer_type, discount_value, products_json, availing_modes
     FROM campaign_offers WHERE set_id = $1 AND is_active = true`,
    [ci.set_id]
  );

  // Get existing notes (published products) by this influencer for this campaign FIRST
  const { rows: notes } = await db.query(
    `SELECT product_id, note_text FROM influencer_product_notes
     WHERE influencer_id = $1 AND campaign_id = $2`,
    [inf.id, ci.campaign_id]
  );
  const publishedProductIds = notes.map(n => n.product_id);

  // Determine product IDs — priority order:
  // 0. Scope-aware LIVE allocation (store/category incl. category_node_id subtree)
  //    — same resolver as the follower store, so the creator sees the SAME
  //    universe followers do (previously store/category fell to "all products").
  // 1. offer_config_json.products (brand selected specific products for this influencer)
  // 2. campaign_offers.products_json (set-level product assignment)
  // 3. Published products (influencer already published these)
  // 4. All brand products (fallback — brand-level offer, no specific products)
  let productIds = [];

  // collab-part4 §4.1 — gate on the ALLOCATION's scope, not the offer's. The old
  // gate only ran the resolver for store/category-scoped OFFERS, which is why a
  // creator with no offer saw nothing here. Now any allocation resolves, and a
  // legacy row with no allocation still falls through the resolver's transitional
  // offer-scope fallback, so nothing regresses.
  const alloc = followerService.allocFromRow(ci);
  const effScope = String(alloc?.scope || ciOfferConfig.scope || '').toLowerCase();
  if (effScope) {
    productIds = await followerService.resolveAllocatedProductIds({
      alloc, ciCfg: ciOfferConfig, offerProductsJson: offers[0]?.products_json, brandId: ci.brand_id,
    });
  }

  // From per-influencer offer config
  if (productIds.length === 0 && Array.isArray(offerConfigProducts) && offerConfigProducts.length > 0) {
    productIds = offerConfigProducts.map(p => typeof p === 'string' ? p : p.product_id || p.id).filter(Boolean);
  }

  // From campaign_offers if no per-influencer products
  if (productIds.length === 0) {
    productIds = offers.flatMap(o => {
      if (!o.products_json) return [];
      const pj = typeof o.products_json === 'string' ? JSON.parse(o.products_json) : o.products_json;
      return (Array.isArray(pj) ? pj : []).map(p => typeof p === 'string' ? p : p.product_id).filter(Boolean);
    });
  }

  // From published notes if still no specific products
  if (productIds.length === 0 && publishedProductIds.length > 0) {
    productIds = publishedProductIds;
  }

  let products;
  if (productIds.length > 0) {
    const { rows } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag, description, variants_json,
               category_key, super_category, category_node_id
       FROM brand_products WHERE brand_id = $1 AND id = ANY($2) AND is_active = true
       ORDER BY section NULLS LAST, name`,
      [ci.brand_id, productIds]
    );
    products = rows;
  } else {
    // No specific products at all — return all brand products
    const { rows } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag, description, variants_json,
               category_key, super_category, category_node_id
       FROM brand_products WHERE brand_id = $1 AND is_active = true
       ORDER BY section NULLS LAST, name`,
      [ci.brand_id]
    );
    products = rows;
  }

  // Build discount info from CI or campaign_offers
  const discountValue = ciOfferConfig.value || offers[0]?.discount_value || ci.commission_pct || null;
  const offerType = ciOfferType || offers[0]?.offer_type || null;
  const noteMap = {};
  for (const n of notes) noteMap[n.product_id] = n.note_text;

  // Attach notes to products
  const productsWithNotes = products.map(p => ({
    ...p,
    price: parseFloat(p.price || 0),   // rupees — brand_products.price is stored in rupees
    influencer_note: noteMap[p.id] || null,
    is_published: !!noteMap[p.id],     // has note = published to store
  }));

  return success(res, {
    campaign_id: ci.campaign_id,
    brand: { id: ci.brand_id, name: ci.business_name, category: ci.category },
    offer: {
      type: offerType,
      discount_value: discountValue,
      config: ciOfferConfig,
    },
    offers,
    products: productsWithNotes,
  });
});

// ── GET /influencers/me/transactions — influencer's transaction feed
const getMyTransactions = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { campaign_id, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['ci.influencer_id = $1'];
  const params = [inf.id];
  if (campaign_id) { params.push(campaign_id); conditions.push(`ft.campaign_id = $${params.length}`); }
  const where = conditions.join(' AND ');

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     WHERE ${where}`,
    params
  );

  params.push(limitNum, offset);
  const { rows } = await db.query(
    `SELECT
       ft.id, ft.transaction_type, ft.status, ft.gross_amount, ft.net_amount,
       ft.influencer_commission, ft.coupon_code_used, ft.created_at,
       ci.commission_pct, ft.return_window_ends_at, ft.commission_confirmed_at,
       b.business_name AS brand_name, b.category AS brand_category,
       c.name AS campaign_name,
       u_f.name AS follower_name,
       bp.name AS product_name,
       fb.booking_type,
       fb.booking_date, fb.booking_time,
       fb.pickup_date, fb.return_date, fb.duration_days, fb.pickup_type,
       fb.stylist_id,
       fb.reference_code AS booking_ref
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     JOIN brands b ON b.id = ft.brand_id
     LEFT JOIN campaigns c ON c.id = ft.campaign_id
     LEFT JOIN followers f ON f.id = ft.follower_id
     LEFT JOIN users u_f ON u_f.id = f.user_id
     LEFT JOIN follower_bookings fb ON fb.transaction_id = ft.id
     LEFT JOIN follower_orders fo2 ON fo2.transaction_id = ft.id
     LEFT JOIN brand_products bp ON bp.id = CASE WHEN fo2.items_json IS NOT NULL THEN (fo2.items_json->0->>'product_id')::uuid ELSE NULL END
     WHERE ${where}
     ORDER BY ft.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Summary
  const { rows: summary } = await db.query(
    `SELECT
       COUNT(*)::int AS total_transactions,
       COALESCE(SUM(ft.influencer_commission), 0)::bigint AS total_commission,
       COUNT(CASE WHEN ft.created_at >= CURRENT_DATE THEN 1 END)::int AS today_count,
       COALESCE(SUM(CASE WHEN ft.created_at >= CURRENT_DATE THEN ft.influencer_commission ELSE 0 END), 0)::bigint AS today_commission
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     WHERE ci.influencer_id = $1 AND ft.status = 'completed'`,
    [inf.id]
  );

  return success(res, {
    transactions: rows,
    summary: summary[0],
  }, 200, { page: pageNum, limit: limitNum, total: countRows[0].count });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/me/referral  (Contract 4 — Refer & Earn)
// Read-only: the influencer's own referral code, total earned, and ledger.
// ─────────────────────────────────────────────────────────────────────────────

const getReferralInfo = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const codeRow = await referralService.getOrCreateCode('influencer', influencer.id);

  const { rows: ledger } = await db.query(
    `SELECT l.id, l.source, l.base_amount, l.pct, l.amount, l.payout_status, l.created_at,
            e.referred_type,
            CASE WHEN e.referred_type = 'influencer' THEN di.instagram_handle
                 WHEN e.referred_type = 'brand'      THEN db_.business_name END AS referred_name
       FROM referral_ledger l
       JOIN referral_edges e ON e.id = l.edge_id
       LEFT JOIN influencers di ON e.referred_type = 'influencer' AND di.id = e.referred_id
       LEFT JOIN brands      db_ ON e.referred_type = 'brand'     AND db_.id = e.referred_id
      WHERE l.referrer_type = 'influencer' AND l.referrer_id = $1
      ORDER BY l.created_at DESC
      LIMIT 50`,
    [influencer.id]
  );

  const { rows: cnt } = await db.query(
    `SELECT COUNT(*)::int AS n FROM referral_edges
      WHERE referrer_type = 'influencer' AND referrer_id = $1 AND status = 'active'`,
    [influencer.id]
  );

  return success(res, {
    code: codeRow.code,
    earned_total: parseFloat(influencer.referral_earned_total || 0),
    window_months: referralService.REFERRAL_WINDOW_MONTHS,
    referred_count: cnt[0].n,
    ledger: ledger.map(r => ({
      id: r.id,
      referred_type: r.referred_type,
      referred_name: r.referred_name || (r.referred_type === 'brand' ? 'A brand' : 'An influencer'),
      source: r.source,
      base_amount: parseFloat(r.base_amount),
      pct: parseFloat(r.pct),
      amount: parseFloat(r.amount),
      payout_status: r.payout_status,
      created_at: r.created_at,
    })),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /influencers/locations  (brand + admin — powers the State → City filter)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Distinct states, each with the cities actually present under it, derived
 * live from the searchable pool.
 *
 * Deliberately data-driven rather than a maintained reference list: the admin
 * tags city + state at intake, so the dropdowns should show exactly what has
 * been tagged. A separate lookup table would drift from reality and would need
 * a row added before a newly-tagged city could ever be selected.
 *
 * Grouped case-insensitively — production carries both 'hyderabad' and
 * 'Hyderabad' from earlier intake — and the display label is the most common
 * spelling for that key, so one canonical entry surfaces per place. New intake
 * is Title-Cased on write (normaliseGeo), so this mainly protects legacy rows.
 *
 * Rows with no state are omitted entirely: a creator who cannot be placed
 * cannot be offered as a location choice.
 */
const getLocations = asyncHandler(async (req, res) => {
  // Stage 0, job G — these counts drive the place picker, so they must count the
  // same people the search will return. Promising "Vijayawada 10" and then showing
  // a brand three is a worse lie than showing three from the start.
  const isAdmin = req.user?.role === 'admin';
  const { rows } = await db.query(
    `SELECT
       LOWER(btrim(state)) AS state_key,
       MODE() WITHIN GROUP (ORDER BY btrim(state)) AS state_label,
       LOWER(btrim(city))  AS city_key,
       MODE() WITHIN GROUP (ORDER BY btrim(city))  AS city_label,
       COUNT(*)::int       AS creators
     FROM v_searchable_creators
     WHERE (is_active_creator IS DISTINCT FROM FALSE)
       ${isAdmin ? '' : `AND source = 'onboarded'`}
       AND state IS NOT NULL AND btrim(state) <> ''
     GROUP BY LOWER(btrim(state)), LOWER(btrim(city))
     ORDER BY 2, 4`
  );

  const byState = new Map();
  for (const r of rows) {
    if (!byState.has(r.state_key)) {
      byState.set(r.state_key, { state: r.state_label, creators: 0, cities: [] });
    }
    const entry = byState.get(r.state_key);
    entry.creators += r.creators;
    // A creator can carry a state but no city — count them for the state
    // without inventing a blank city option.
    if (r.city_key) entry.cities.push({ city: r.city_label, creators: r.creators });
  }

  const states = [...byState.values()].sort((a, b) => b.creators - a.creators);
  return success(res, { states });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/influencers/me/needs-you
//
// Stage 0 — the creator's half of the two server-side numbers. The brand has had a
// "what needs me" answer since the inbox summary shipped; the creator has never had
// one, and the step number she sees had no source at all.
//
// Both numbers come from collabCounts, which is the same module the brand's summary
// reads. That is the whole point: when a brand rings a creator and says "we're stuck
// on step 3", both phones got that 3 from here. Deriving it in either app is what
// eventually makes the two screens disagree about the same collaboration.
//
// Nothing renders this yet — her Collabs tab is Stage 1. Shipping the doorway first
// means both apps read the same answer from the day their screens land.
// Contract: features/stage-0-clear-the-decks.
// ─────────────────────────────────────────────────────────────────────────────
const getNeedsYou = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const [counts, collaborations] = await Promise.all([
    collabCounts.forCreator(influencer.id),
    collabCounts.stepsForCreator(influencer.id),
  ]);

  return success(res, {
    total: counts.total,
    items: counts.items,
    collaborations,
  });
});

module.exports = { register, getMe, submitForReview, updateMe, getProfileImageUploadUrl, search, getLocations, getPublicById, getInfluencerById, getEarnings, getLedger, getTdsCertificate, rescrape, getMyCampaigns, getMyCampaignDetail, storePreview, getCampaignProducts, getMyTransactions, getReferralInfo, getNeedsYou };
