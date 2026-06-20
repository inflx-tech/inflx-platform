'use strict';

const db = require('../config/db');
const apifyService = require('../services/apify.service');
const notificationService = require('../services/notification.service');
const marketingAutomation = require('../services/marketingAutomation.service');
const pdfService = require('../services/pdf.service');
const { encrypt } = require('../utils/encrypt');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { resolveAvatars } = require('../utils/avatarResolver');
const referralService = require('../services/referral.service');

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
  const { rows: matches } = await db.query(
    `SELECT id FROM creator_profiles
      WHERE ig_handle = $1
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
  } else {
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

  // Fire-and-forget scrape — don't await, don't fail register if n8n is down.
  // The marketingAutomation service logs errors internally.
  marketingAutomation.triggerScrape({
    handle: instagramHandle,
    target_type: 'influencer',
    scrape_mode: 'deep',
    source: 'signup',
    signup_user_id: userId,
    signup_influencer_id: influencerId,
  }).catch(e => {
    console.error('[register] signup scrape trigger failed:', e.message);
  });

  return {
    match_count: 0, conflict: false,
    claimed_profile_ids: stubRow ? [stubRow.id] : [],
    scrape_fired: true,
  };
}

const register = asyncHandler(async (req, res) => {
  const userId = req.user.sub;

  const instagramHandle = normaliseHandle(req.body.instagram_handle);
  const youtubeHandle   = normaliseHandle(req.body.youtube_handle);
  const fullName        = (req.body.name || '').trim();
  const city            = (req.body.city || '').trim();

  if (!instagramHandle) {
    throw new AppError('VALIDATION_ERROR', 'instagram_handle is required', 422, 'instagram_handle');
  }
  if (!fullName) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }

  // Prevent duplicate registration
  const existing = await getInfluencerByUserId(userId);
  if (existing) {
    throw new AppError('CONFLICT', 'Influencer profile already exists for this account', 409);
  }

  // Update users.name + users.city with the real values supplied at registration.
  // verify-otp inserted a "Pending (1234)" placeholder so the row would satisfy
  // the NOT NULL constraint. We overwrite it here once the user fills the form.
  await db.query(
    `UPDATE users SET name = $1, city = COALESCE(NULLIF($2, ''), city) WHERE id = $3`,
    [fullName, city, userId]
  );

  // Run Apify scrape (mocked in dev). Kept as a fallback so brand-new
  // creators not yet in creator_profiles still get baseline metrics.
  const scraped = await apifyService.scrapeProfile(instagramHandle);

  const { rows } = await db.query(
    `INSERT INTO influencers
       (user_id, instagram_handle, youtube_handle, followers_count, engagement_rate,
        niche, scrape_data, scrape_last_run)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     RETURNING *`,
    [
      userId,
      instagramHandle,
      youtubeHandle,
      scraped.followers_count,
      scraped.engagement_rate,
      scraped.niche,
      JSON.stringify(scraped.scrape_data),
    ]
  );

  const influencer = rows[0];

  // D-1 intake — optional referral code attaches a referral edge at signup.
  // Best-effort: a bad/missing/duplicate code is soft-noted, never aborts
  // registration. Reuses the exact redeem path POST /referrals/redeem uses.
  const referral = await referralService.redeemCodeForEntity({
    code: req.body.referral_code,
    referredType: 'influencer',
    referredId: influencer.id,
  });

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
    referral_applied: !!referral.edge,
    ...(referral.note ? { referral_note: referral.note } : {}),
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

const getMe = asyncHandler(async (req, res) => {
  const influencer = await getInfluencerByUserId(req.user.sub);
  if (!influencer) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const sanitised = sanitiseInfluencer(influencer);
  // Include phone as read-only for profile display
  sanitised.phone = influencer.phone;

  return success(res, {
    influencer: sanitised,
    user_status: influencer.user_status,
  });
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
    upi_id,
    bank_account_no,
    bank_ifsc,
    pan_number,
    bio,
    city,
    full_name,
    name: userName,
  } = req.body;

  const updates = {};

  if (language !== undefined) updates.language = language;
  if (content_style !== undefined) updates.content_style = content_style;
  if (niche !== undefined) updates.niche = niche;
  if (youtube_handle !== undefined) updates.youtube_handle = youtube_handle;
  if (bank_ifsc !== undefined) updates.bank_ifsc = bank_ifsc;
  if (bio !== undefined) updates.bio = bio;
  if (city !== undefined) updates.city = city;
  if (full_name !== undefined) updates.full_name = full_name;

  // Encrypt sensitive fields before storing
  if (upi_id !== undefined) updates.upi_id = encrypt(upi_id);
  if (bank_account_no !== undefined) updates.bank_account_no = encrypt(bank_account_no);
  if (pan_number !== undefined) updates.pan_number = encrypt(pan_number);

  // Update name on users table if provided
  const nameUpdate = userName !== undefined ? userName : full_name;

  if (Object.keys(updates).length === 0 && nameUpdate === undefined) {
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

  const updated = await getInfluencerById(influencer.id);
  return success(res, { influencer: sanitiseInfluencer(updated) });
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
  const niches       = parseList(req.query.niche);
  const tiers        = parseList(req.query.tier);
  const languages    = parseList(req.query.languages);
  const useCases     = parseList(req.query.use_case);

  const conditions = [`(is_active_creator IS DISTINCT FROM FALSE)`];
  const params = [];

  if (q) {
    params.push(`%${String(q).trim()}%`);
    conditions.push(`(full_name ILIKE $${params.length} OR ig_handle ILIKE $${params.length})`);
  }
  if (cities) {
    // Case-insensitive city match (consistent with the follower nearby
    // feed query LOWER(u_b.city)=LOWER($1)); users type "mumbai", stored
    // as "Mumbai".
    params.push(cities.map(c => String(c).toLowerCase()));
    conditions.push(`LOWER(city) = ANY($${params.length}::text[])`);
  }
  if (niches) {
    params.push(niches);
    conditions.push(`niche = ANY($${params.length}::text[])`);
  }
  if (tiers) {
    params.push(tiers);
    conditions.push(`tier = ANY($${params.length}::text[])`);
  }
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

  const where    = conditions.join(' AND ');
  const orderBy  = SORT_MAP[String(sort || '').trim()] || DEFAULT_SORT;

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
       tier, city, niche, sub_niche, languages,
       ig_verified, is_business,
       estimated_min_rate, estimated_max_rate,
       rank_score, growth_potential_score, posting_frequency_per_week,
       total_posts_90d, total_brand_collaborations, unique_brands_count,
       commercial_post_rate, top_brand_partners, recommended_use_cases,
       avg_views, avg_likes, avg_comments,
       activity_status, linked_influencer_id,
       is_inflx_verified, last_calculated_at
     FROM v_searchable_creators
     WHERE ${where}
     ORDER BY ${orderBy}, ig_handle
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  await resolveAvatars(rows);

  // Explicit brand-facing verification tag (product decision 2026-05-19):
  // search shows BOTH registered+admin-verified and scraped/pending
  // creators; `is_verified` lets the UI render the "verified" badge for
  // genuinely admin-verified registered influencers only. Derived from the
  // view's is_inflx_verified, which migration 055 made approval-aware for
  // onboarded ((u.status='approved')) and verification-aware for scraped.
  const creators = rows.map(r => ({ ...r, is_verified: r.is_inflx_verified === true }));

  return success(res, { creators }, 200, { page: pageNum, limit: limitNum, total });
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
       i.id, i.instagram_handle, i.youtube_handle, i.full_name,
       i.followers_count, i.engagement_rate, i.engagement_rate AS view_based_er,
       i.niche, i.secondary_niche,
       i.language, i.tier, i.city, i.state, i.gender, i.platform,
       i.avg_views, i.avg_likes, i.avg_comments, i.avg_shares, i.avg_saves,
       i.total_posts, i.verified,
       i.bio, i.website,
       i.price_per_post_min, i.price_per_post_max,
       i.past_brands_json, i.collaboration_types_json,
       i.profile_image_url, i.age,
       u.name, u.id AS user_id, u.status AS user_status,
       'onboarded'::text AS source,
       TRUE AS is_inflx_verified,
       'verified'::text AS verification_status
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.id = $1`,
    [id]
  );
  if (legacy[0]) return success(res, { influencer: legacy[0] });

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
       NULL::text                AS state,
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
  if (scraped[0]) return success(res, { influencer: scraped[0] });

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

  const scraped = await apifyService.scrapeProfile(influencer.instagram_handle);

  await db.query(
    `UPDATE influencers
     SET followers_count = $1, engagement_rate = $2, niche = $3,
         scrape_data = $4, scrape_last_run = now()
     WHERE id = $5`,
    [
      scraped.followers_count,
      scraped.engagement_rate,
      scraped.niche,
      JSON.stringify(scraped.scrape_data),
      influencer.id,
    ]
  );

  const updated = await getInfluencerById(influencer.id);
  return success(res, { influencer: sanitiseInfluencer(updated), scraped_at: new Date().toISOString() });
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
         ci.delivery_address,
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
         b.id AS brand_id,
         b.business_name AS brand_name,
         b.logo_url AS brand_logo_url,
         u.name AS brand_contact_name
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = c.brand_id
       JOIN users u ON u.id = b.user_id
       WHERE ci.id = $1 AND ci.influencer_id = $2`,
      [ciId, inf.id]
    );
    if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Campaign assignment not found', 404);
    campaign = ciRows[0];
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

  // Step 2b: Auto-create deliverables if contract is active but none exist
  // (handles contracts signed before deliverable-creation fix was deployed)
  if (deliverables.length === 0 && contract && (contract.status === 'active' || contract.status === 'completed')) {
    try {
      // Fetch formats_json from the campaign set
      const { rows: setRows } = await db.query(
        `SELECT cs.formats_json FROM campaign_sets cs
         JOIN campaign_influencers ci ON ci.set_id = cs.id
         WHERE ci.id = $1`,
        [ciId]
      );
      let formats = [];
      if (setRows[0]?.formats_json) {
        const raw = setRows[0].formats_json;
        formats = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      }
      if (formats.length === 0) formats = [{ type: 'reel', count: 1 }];

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
            ci.offer_type, ci.offer_config_json
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
  // 1. offer_config_json.products (brand selected specific products for this influencer)
  // 2. campaign_offers.products_json (set-level product assignment)
  // 3. Published products (influencer already published these)
  // 4. All brand products (fallback — brand-level offer, no specific products)
  let productIds = [];

  // From per-influencer offer config
  if (Array.isArray(offerConfigProducts) && offerConfigProducts.length > 0) {
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
      `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
       FROM brand_products WHERE brand_id = $1 AND id = ANY($2) AND is_active = true
       ORDER BY section NULLS LAST, name`,
      [ci.brand_id, productIds]
    );
    products = rows;
  } else {
    // No specific products at all — return all brand products
    const { rows } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
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

module.exports = { register, getMe, updateMe, search, getPublicById, getInfluencerById, getEarnings, getTdsCertificate, rescrape, getMyCampaigns, getMyCampaignDetail, storePreview, getCampaignProducts, getMyTransactions, getReferralInfo };
