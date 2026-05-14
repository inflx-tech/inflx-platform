'use strict';

const db = require('../config/db');
const imageProxy = require('../services/imageProxy.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Allow-list of columns that can be written via the ingest endpoint.
// Order matters — used to build the INSERT column list and the
// ON CONFLICT DO UPDATE SET clause.
//
// Excluded on purpose:
//   id, is_onboarded, linked_influencer_id, created_at, updated_at
//   (these are managed by Inflx, never by the marketing automation push)
// ─────────────────────────────────────────────────────────────────────────────
const CREATOR_COLUMNS = [
  'ig_handle',
  'ig_user_id',
  'full_name',
  'bio',
  'profile_pic_url',
  'external_url',
  'followers_count',
  'following_count',
  'total_posts_lifetime',
  'is_verified',
  'is_business',
  'is_private',
  'joined_recently',
  'ig_category',
  'highlights_count',
  'city',
  'niche',
  'sub_niche',
  'languages',
  'bio_email',
  'bio_phone',
  'total_posts_90d',
  'total_videos_90d',
  'total_carousels_90d',
  'posting_frequency_per_day',
  'posting_frequency_per_week',
  'avg_likes',
  'avg_comments',
  'avg_views',
  'median_likes',
  'median_views',
  'follower_based_er',
  'view_based_er',
  'best_post_views',
  'best_post_engagement',
  'consistency_score',
  'total_brand_collaborations',
  'unique_brands_count',
  'commercial_post_rate',
  'cta_usage_rate',
  'brand_diversity_score',
  'top_brand_partners',
  'follower_tier',
  'account_age_days',
  'is_active_creator',
  'activity_status',
  'growth_potential_score',
  'rank_score',
  'estimated_min_rate',
  'estimated_max_rate',
  'recommended_use_cases',
  'related_handles',
  'raw_profile_data',
  'last_scraped_at',
  'last_calculated_at',
  'scrape_count',
  // ── Added migration 043 (marketing engine v2). NOT writable from this
  // endpoint: manual_phone / manual_email / manual_whatsapp (admin-only)
  // and outreach_status (managed by admin marketing endpoints).
  'inferred_city',
  'inferred_niche',
  'inferred_sub_niche',
  'bio_whatsapp',
  'primary_offering',
  'tone',
  'bio_business_type',
  'reachability_score',
  'contact_intel_extracted_at',
  'priority_score',
  'scoring_summary',
  'scoring_strengths',
  'scoring_concerns',
  'is_paused',
  'paused_at',
  'reengagement_date',
  'source',
  'notes',
];

// Columns the marketing engine cannot write to — these are admin-only or
// system-managed. Listed here for self-documentation; enforcement is by
// virtue of their absence from CREATOR_COLUMNS / BRAND_COLUMNS.
//
// creator_profiles: manual_phone, manual_email, manual_whatsapp,
//                   outreach_status, is_onboarded, linked_influencer_id,
//                   verification_status, claim_user_id, ...
// brand_profiles:   manual_phone, manual_email, manual_whatsapp,
//                   outreach_status, is_onboarded, linked_brand_id

const BRAND_COLUMNS = [
  'instagram_handle',
  'ig_user_id',
  'business_name',
  'full_name',
  'bio',
  'profile_pic_url',
  'external_url',
  'website',
  'followers_count',
  'following_count',
  'total_posts_lifetime',
  'is_verified',
  'is_business',
  'is_private',
  'ig_category',
  'highlights_count',
  'business_address',
  // Claude-inferred (manual variants are admin-only via admin marketing API)
  'inferred_city',
  'inferred_industry',
  'inferred_sub_industry',
  'bio_phone',
  'bio_email',
  'bio_whatsapp',
  'primary_offering',
  'tone',
  'languages_used',
  'bio_business_type',
  'reachability_score',
  'contact_intel_extracted_at',
  // Collaboration intelligence
  'influencer_collabs_90d',
  'influencer_collab_count',
  'unique_influencer_partners',
  'marketing_intensity',
  // Scoring
  'priority_score',
  'tier',
  'scoring_summary',
  'scoring_strengths',
  'scoring_concerns',
  // Lifecycle (admin can override these via admin marketing API too, but
  // the marketing engine flips them in some cases)
  'is_active',
  'source',
  'raw_profile_data',
  // Audit
  'last_scraped_at',
  'last_calculated_at',
  'scrape_count',
];

const CAPTION_INSIGHT_COLUMNS = [
  'post_shortcode',
  'ig_handle',
  'creator_profile_id',
  'brand_usernames',
  'commercial_intent',
  'intent_type',
  'intent_strength',
  'cta_present',
  'cta_type',
  'has_link',
  'has_discount',
  'has_promo_code',
  'product_category',
  'collaboration_type',
  'sales_funnel_stage',
  'content_theme',
  'emotion_type',
  'analyzed_at',
];

const COLLAB_MAP_COLUMNS = [
  'creator_profile_id',
  'post_shortcode',
  'brand_name',
  'brand_instagram',
  'collab_type',
  'detected_signals',
  'confidence',
  // detected_at intentionally omitted — the column is NOT NULL DEFAULT NOW()
  // in migration 041. If listed here, valueFor returns null for payloads
  // that don't set it (n8n's A3 v2 doesn't), which overrides the DEFAULT
  // and trips the NOT NULL constraint. Leaving the column out lets the
  // database default fill it in.
];

const POST_COLUMNS = [
  'creator_profile_id',
  'ig_post_id',
  'shortcode',
  'permalink',
  'type',
  'posted_at',
  'caption',
  'media_url',
  'hashtags',
  'mentions',
  'likes_count',
  'comments_count',
  'views_count',
  'shares_count',
  'saves_count',
  'brand_tags',
  'has_commercial_intent',
  'has_cta',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normaliseHandle(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/^@/, '').toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build values array for one row using CREATOR_COLUMNS / POST_COLUMNS order.
 * JSONB columns are JSON.stringified; arrays are passed through (pg driver
 * handles TEXT[] natively).
 */
const JSONB_FIELDS = new Set([
  // creator_profiles
  'top_brand_partners', 'related_handles', 'raw_profile_data',
  'scoring_strengths', 'scoring_concerns',
  // posts
  'brand_tags',
  // brand_profiles
  'influencer_collabs_90d',
  // caption_insights
  'brand_usernames',
  // collab_map
  'detected_signals',
  // insights / outreach_activity
  'metadata',
]);

function valueFor(col, row) {
  const v = row[col];
  if (v === undefined) return null;
  if (v === null) return null;
  if (JSONB_FIELDS.has(col)) {
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/creator-metrics
// ─────────────────────────────────────────────────────────────────────────────

const upsertCreatorMetrics = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Defense in depth — marketing automation should already filter these
  // out at source, but if a brand row leaks through, refuse it loudly.
  if (body.target_type && body.target_type !== 'influencer') {
    throw new AppError(
      'IGNORED_BRAND_TYPE',
      `target_type=${body.target_type} is not accepted by the Inflx ingest endpoint`,
      400,
      'target_type'
    );
  }

  const ig_handle = normaliseHandle(body.ig_handle);
  if (!ig_handle) {
    throw new AppError('INVALID_PAYLOAD', 'ig_handle is required', 422, 'ig_handle');
  }

  // Build payload using only known columns; ig_handle is normalised above.
  const row = { ...body, ig_handle };

  const cols = CREATOR_COLUMNS;
  const values = cols.map(c => valueFor(c, row));
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

  // PARTIAL-UPDATE semantics: on conflict, only update columns that were
  // actually present in the request body. Fields missing from the payload
  // preserve their existing database value. Old full-payload callers
  // (existing System A workflows) continue to see full-overwrite behaviour
  // because all their fields are present in the payload.
  const updateSet = cols
    .filter(c => c !== 'ig_handle' && Object.prototype.hasOwnProperty.call(body, c))
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');

  const conflictClause = updateSet
    ? `ON CONFLICT (ig_handle) DO UPDATE SET ${updateSet}`
    : `ON CONFLICT (ig_handle) DO UPDATE SET ig_handle = EXCLUDED.ig_handle`;

  const sql = `
    INSERT INTO creator_profiles (${cols.join(', ')})
    VALUES (${placeholders})
    ${conflictClause}
    RETURNING id, ig_handle, is_onboarded, linked_influencer_id, last_calculated_at,
              (xmax = 0) AS inserted
  `;

  const { rows } = await db.query(sql, values);
  const out = rows[0];

  // Fire-and-forget: cache the Instagram-signed profile pic to R2 so
  // it doesn't 403 in two weeks. Failure is logged inside the service
  // and never blocks the INGEST response. Only runs when the payload
  // actually carried a profile_pic_url.
  if (body.profile_pic_url) {
    imageProxy.cacheProfilePic({
      targetType: 'creator',
      handle: out.ig_handle,
      igUrl: body.profile_pic_url,
    }).catch(e => console.error('[ingest] avatar cache failed:', e.message));
  }

  return success(res, {
    ok: true,
    ig_handle: out.ig_handle,
    action: out.inserted ? 'created' : 'updated',
    is_onboarded: out.is_onboarded,
    linked_to_user: out.linked_influencer_id !== null,
    calculated_at: out.last_calculated_at,
  }, out.inserted ? 201 : 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/posts
// Body: { ig_handle: string, posts: [{ ig_post_id, ... }, ...] }
// ─────────────────────────────────────────────────────────────────────────────

const upsertPosts = asyncHandler(async (req, res) => {
  const ig_handle = normaliseHandle(req.body?.ig_handle);
  const posts = Array.isArray(req.body?.posts) ? req.body.posts : null;

  if (!ig_handle) {
    throw new AppError('INVALID_PAYLOAD', 'ig_handle is required', 422, 'ig_handle');
  }
  if (!posts) {
    throw new AppError('INVALID_PAYLOAD', 'posts must be an array', 422, 'posts');
  }

  // Resolve creator_profile_id. The marketing automation pushes metrics
  // before posts, so the profile row should already exist. If not, refuse —
  // this is a sequencing bug on the sender side and silently creating a
  // stub row would mask it.
  const { rows: cpRows } = await db.query(
    `SELECT id FROM creator_profiles WHERE ig_handle = $1`,
    [ig_handle]
  );
  if (!cpRows[0]) {
    throw new AppError(
      'INVALID_PAYLOAD',
      `No creator_profile found for ig_handle="${ig_handle}". Push creator-metrics first.`,
      422,
      'ig_handle'
    );
  }
  const creator_profile_id = cpRows[0].id;

  // Filter to posts that have an ig_post_id; the rest are unusable.
  const validPosts = posts.filter(p => p && typeof p.ig_post_id === 'string' && p.ig_post_id.length > 0);
  if (validPosts.length === 0) {
    return success(res, { ok: true, ig_handle, posts_upserted: 0, posts_skipped: posts.length });
  }

  const cols = POST_COLUMNS;
  const updateSet = cols
    .filter(c => c !== 'creator_profile_id' && c !== 'ig_post_id')
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');

  // Bulk-insert in a single statement using a row-constructor list.
  const params = [];
  const tuples = validPosts.map(p => {
    const row = { ...p, creator_profile_id };
    const placeholders = cols.map(c => {
      params.push(valueFor(c, row));
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const sql = `
    INSERT INTO posts (${cols.join(', ')})
    VALUES ${tuples.join(', ')}
    ON CONFLICT (creator_profile_id, ig_post_id) DO UPDATE SET ${updateSet}
  `;
  await db.query(sql, params);

  return success(res, {
    ok: true,
    ig_handle,
    posts_upserted: validPosts.length,
    posts_skipped: posts.length - validPosts.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/internal/ingest/health
// ─────────────────────────────────────────────────────────────────────────────

const health = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      COUNT(*)::int                                                 AS total_creators,
      COUNT(*) FILTER (WHERE is_active_creator)::int                AS total_active,
      COUNT(*) FILTER (
        WHERE last_calculated_at IS NULL
           OR last_calculated_at < NOW() - INTERVAL '48 hours'
      )::int                                                        AS total_stale_48h,
      MIN(last_calculated_at)                                       AS oldest_calculated_at,
      MAX(last_calculated_at)                                       AS last_ingest_at
    FROM creator_profiles
  `);

  const r = rows[0];
  return success(res, {
    ok: true,
    total_creators: r.total_creators,
    total_active: r.total_active,
    total_stale_48h: r.total_stale_48h,
    oldest_calculated_at: r.oldest_calculated_at,
    last_ingest_at: r.last_ingest_at,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Marketing Engine v2 endpoints (added with migrations 040–043)
//
// These handlers extend the existing INGEST contract for the unified
// marketing engine. n8n workflows write through here; no direct Supabase
// access from n8n going forward.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generic partial-update UPSERT builder. Inserts all `cols` (NULL for
 * missing). On conflict, only updates columns actually present in `body`.
 * Returns { sql, values }.
 */
function buildUpsertSQL(table, cols, conflictCols, body) {
  const values = cols.map(c => valueFor(c, body));
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = cols
    .filter(c => !conflictCols.includes(c) && Object.prototype.hasOwnProperty.call(body, c))
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');
  const conflictClause = updateSet
    ? `ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updateSet}`
    : `ON CONFLICT (${conflictCols.join(', ')}) DO NOTHING`;
  const sql = `
    INSERT INTO ${table} (${cols.join(', ')})
    VALUES (${placeholders})
    ${conflictClause}
  `;
  return { sql, values };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/brand-metrics
// Mirror of /creator-metrics for scraped brands. Manual fields
// (manual_phone/email/whatsapp, city, industry, sub_industry) are NOT in
// BRAND_COLUMNS — the marketing engine never overwrites admin entries.
// ─────────────────────────────────────────────────────────────────────────────
const upsertBrandMetrics = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const handle = normaliseHandle(body.instagram_handle);
  if (!handle) {
    throw new AppError('INVALID_PAYLOAD', 'instagram_handle is required', 422, 'instagram_handle');
  }
  const row = { ...body, instagram_handle: handle };

  const cols = BRAND_COLUMNS;
  const values = cols.map(c => valueFor(c, row));
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = cols
    .filter(c => c !== 'instagram_handle' && Object.prototype.hasOwnProperty.call(body, c))
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');
  const conflictClause = updateSet
    ? `ON CONFLICT (instagram_handle) DO UPDATE SET ${updateSet}`
    : `ON CONFLICT (instagram_handle) DO UPDATE SET instagram_handle = EXCLUDED.instagram_handle`;

  const sql = `
    INSERT INTO brand_profiles (${cols.join(', ')})
    VALUES (${placeholders})
    ${conflictClause}
    RETURNING id, instagram_handle, is_onboarded, linked_brand_id, last_calculated_at,
              (xmax = 0) AS inserted
  `;
  const { rows } = await db.query(sql, values);
  const out = rows[0];

  // Same R2-cache fire-and-forget as the creator path.
  if (body.profile_pic_url) {
    imageProxy.cacheProfilePic({
      targetType: 'brand',
      handle: out.instagram_handle,
      igUrl: body.profile_pic_url,
    }).catch(e => console.error('[ingest] avatar cache failed:', e.message));
  }

  return success(res, {
    ok: true,
    instagram_handle: out.instagram_handle,
    action: out.inserted ? 'created' : 'updated',
    is_onboarded: out.is_onboarded,
    linked_to_brand: out.linked_brand_id !== null,
    calculated_at: out.last_calculated_at,
  }, out.inserted ? 201 : 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/brand-collabs
// Updates only the collab-related fields on a brand row.
// Body: { instagram_handle, influencer_collabs_90d, influencer_collab_count,
//         unique_influencer_partners, marketing_intensity }
// ─────────────────────────────────────────────────────────────────────────────
const updateBrandCollabs = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const handle = normaliseHandle(body.instagram_handle);
  if (!handle) {
    throw new AppError('INVALID_PAYLOAD', 'instagram_handle is required', 422, 'instagram_handle');
  }

  const collabFields = [
    'influencer_collabs_90d',
    'influencer_collab_count',
    'unique_influencer_partners',
    'marketing_intensity',
  ];
  const presentCols = collabFields.filter(c => Object.prototype.hasOwnProperty.call(body, c));
  if (presentCols.length === 0) {
    throw new AppError('INVALID_PAYLOAD', 'At least one collab field is required', 422);
  }
  const setSql = presentCols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const values = [handle, ...presentCols.map(c => valueFor(c, body))];

  const { rows } = await db.query(
    `UPDATE brand_profiles SET ${setSql} WHERE instagram_handle = $1 RETURNING id`,
    values
  );
  if (rows.length === 0) {
    throw new AppError(
      'INVALID_PAYLOAD',
      `No brand_profile found for instagram_handle="${handle}". Push brand-metrics first.`,
      422, 'instagram_handle'
    );
  }
  return success(res, { ok: true, instagram_handle: handle, fields_updated: presentCols });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/caption-insights
// Bulk upsert by post_shortcode. Body: { ig_handle, insights: [...] }
// The handler resolves creator_profile_id once from ig_handle.
// ─────────────────────────────────────────────────────────────────────────────
const upsertCaptionInsights = asyncHandler(async (req, res) => {
  const ig_handle = normaliseHandle(req.body?.ig_handle);
  const insights = Array.isArray(req.body?.insights) ? req.body.insights : null;
  if (!ig_handle) {
    throw new AppError('INVALID_PAYLOAD', 'ig_handle is required', 422, 'ig_handle');
  }
  if (!insights) {
    throw new AppError('INVALID_PAYLOAD', 'insights must be an array', 422, 'insights');
  }

  const { rows: cpRows } = await db.query(
    `SELECT id FROM creator_profiles WHERE ig_handle = $1`, [ig_handle]
  );
  if (!cpRows[0]) {
    throw new AppError(
      'INVALID_PAYLOAD',
      `No creator_profile found for ig_handle="${ig_handle}". Push creator-metrics first.`,
      422, 'ig_handle'
    );
  }
  const creator_profile_id = cpRows[0].id;

  const valid = insights.filter(i => i && typeof i.post_shortcode === 'string' && i.post_shortcode.length > 0);
  if (valid.length === 0) {
    return success(res, { ok: true, ig_handle, upserted: 0, skipped: insights.length });
  }

  const cols = CAPTION_INSIGHT_COLUMNS;
  const updateSet = cols
    .filter(c => c !== 'post_shortcode')
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');

  const params = [];
  const tuples = valid.map(i => {
    const row = { ...i, ig_handle, creator_profile_id };
    const placeholders = cols.map(c => {
      params.push(valueFor(c, row));
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const sql = `
    INSERT INTO caption_insights (${cols.join(', ')})
    VALUES ${tuples.join(', ')}
    ON CONFLICT (post_shortcode) DO UPDATE SET ${updateSet}
  `;
  await db.query(sql, params);

  return success(res, {
    ok: true,
    ig_handle,
    upserted: valid.length,
    skipped: insights.length - valid.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/collab-map
// Bulk upsert by (creator_profile_id, post_shortcode).
// Body: { ig_handle, collabs: [...] }
// ─────────────────────────────────────────────────────────────────────────────
const upsertCollabMap = asyncHandler(async (req, res) => {
  const ig_handle = normaliseHandle(req.body?.ig_handle);
  const collabs = Array.isArray(req.body?.collabs) ? req.body.collabs : null;
  if (!ig_handle) {
    throw new AppError('INVALID_PAYLOAD', 'ig_handle is required', 422, 'ig_handle');
  }
  if (!collabs) {
    throw new AppError('INVALID_PAYLOAD', 'collabs must be an array', 422, 'collabs');
  }

  const { rows: cpRows } = await db.query(
    `SELECT id FROM creator_profiles WHERE ig_handle = $1`, [ig_handle]
  );
  if (!cpRows[0]) {
    throw new AppError(
      'INVALID_PAYLOAD',
      `No creator_profile found for ig_handle="${ig_handle}". Push creator-metrics first.`,
      422, 'ig_handle'
    );
  }
  const creator_profile_id = cpRows[0].id;

  const valid = collabs.filter(c => c && typeof c.post_shortcode === 'string' && c.post_shortcode.length > 0);
  if (valid.length === 0) {
    return success(res, { ok: true, ig_handle, upserted: 0, skipped: collabs.length });
  }

  const cols = COLLAB_MAP_COLUMNS;
  const updateSet = cols
    .filter(c => c !== 'creator_profile_id' && c !== 'post_shortcode')
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');

  const params = [];
  const tuples = valid.map(c => {
    const row = { ...c, creator_profile_id };
    const placeholders = cols.map(col => {
      params.push(valueFor(col, row));
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const sql = `
    INSERT INTO collab_map (${cols.join(', ')})
    VALUES ${tuples.join(', ')}
    ON CONFLICT (creator_profile_id, post_shortcode) DO UPDATE SET ${updateSet}
  `;
  await db.query(sql, params);

  return success(res, {
    ok: true,
    ig_handle,
    upserted: valid.length,
    skipped: collabs.length - valid.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/insight-log
// Append-only log of AI runs / daily reports.
// Body: { insight_type, title, body?, score?, model_used?, metadata?,
//         creator_profile_id? | ig_handle?, brand_profile_id? | instagram_handle? }
// ─────────────────────────────────────────────────────────────────────────────
const insertInsightLog = asyncHandler(async (req, res) => {
  const body = req.body || {};

  if (!body.insight_type || !body.title) {
    throw new AppError('INVALID_PAYLOAD', 'insight_type and title are required', 422);
  }

  let creator_profile_id = body.creator_profile_id || null;
  let brand_profile_id = body.brand_profile_id || null;

  // Resolve from handle if id not given
  if (!creator_profile_id && body.ig_handle) {
    const h = normaliseHandle(body.ig_handle);
    if (h) {
      const { rows } = await db.query(
        `SELECT id FROM creator_profiles WHERE ig_handle = $1`, [h]
      );
      if (rows[0]) creator_profile_id = rows[0].id;
    }
  }
  if (!brand_profile_id && body.instagram_handle) {
    const h = normaliseHandle(body.instagram_handle);
    if (h) {
      const { rows } = await db.query(
        `SELECT id FROM brand_profiles WHERE instagram_handle = $1`, [h]
      );
      if (rows[0]) brand_profile_id = rows[0].id;
    }
  }

  const metadata = body.metadata
    ? (typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata))
    : '{}';

  const { rows } = await db.query(
    `INSERT INTO insights (insight_type, creator_profile_id, brand_profile_id,
                           title, body, score, model_used, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id, created_at`,
    [body.insight_type, creator_profile_id, brand_profile_id,
     body.title, body.body || null, body.score || null,
     body.model_used || null, metadata]
  );

  return success(res, { ok: true, id: rows[0].id, created_at: rows[0].created_at }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/internal/ingest/profile-bundle/:ig_handle
// One-shot read for A2.5 metrics calculator. Returns the profile row + the
// last N posts + caption_insights for that creator. Replaces three separate
// Supabase queries with a single n8n call.
// ─────────────────────────────────────────────────────────────────────────────
const profileBundle = asyncHandler(async (req, res) => {
  const ig_handle = normaliseHandle(req.params.ig_handle);
  if (!ig_handle) {
    throw new AppError('INVALID_PAYLOAD', 'ig_handle is required', 422, 'ig_handle');
  }
  const limit = Math.min(parseInt(req.query.posts_limit, 10) || 120, 500);

  const { rows: cpRows } = await db.query(
    `SELECT * FROM creator_profiles WHERE ig_handle = $1`, [ig_handle]
  );
  if (!cpRows[0]) {
    throw new AppError('NOT_FOUND', `No creator_profile for ig_handle="${ig_handle}"`, 404);
  }
  const profile = cpRows[0];

  const { rows: posts } = await db.query(
    `SELECT * FROM posts
       WHERE creator_profile_id = $1
       ORDER BY posted_at DESC NULLS LAST
       LIMIT $2`,
    [profile.id, limit]
  );

  const { rows: insights } = await db.query(
    `SELECT * FROM caption_insights WHERE creator_profile_id = $1`,
    [profile.id]
  );

  return success(res, { ok: true, profile, posts, caption_insights: insights });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/internal/ingest/brand-profile/:handle
// Returns one brand_profile row. Symmetric to /profile-bundle but lighter
// (no posts/insights for brands).
// ─────────────────────────────────────────────────────────────────────────────
const brandProfile = asyncHandler(async (req, res) => {
  const handle = normaliseHandle(req.params.handle);
  if (!handle) {
    throw new AppError('INVALID_PAYLOAD', 'handle is required', 422, 'handle');
  }
  const { rows } = await db.query(
    `SELECT * FROM brand_profiles WHERE instagram_handle = $1`, [handle]
  );
  if (!rows[0]) {
    throw new AppError('NOT_FOUND', `No brand_profile for handle="${handle}"`, 404);
  }
  return success(res, { ok: true, profile: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/internal/ingest/refresh-due
// Returns handles due for refresh per tier cadence from system_settings.
// Used by the A6 daily refresh workflow.
// Query: ?limit=500&target_type=influencer|brand|all (default all)
// ─────────────────────────────────────────────────────────────────────────────
const refreshDue = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const target_type = req.query.target_type || 'all';

  const { rows: settingsRows } = await db.query(
    `SELECT * FROM system_settings WHERE id = 1`
  );
  const s = settingsRows[0] || {};
  const HIGH_T = Number(s.high_tier_threshold || 70);
  const LOW_T  = Number(s.low_tier_threshold || 40);
  const HIGH_D = Number(s.high_refresh_days || 3);
  const MID_D  = Number(s.mid_refresh_days || 7);
  const LOW_D  = Number(s.low_refresh_days || 14);
  const BRAND_D = Number(s.brand_refresh_days || 7);
  const SKIP_H = Number(s.skip_recent_scrape_hours || 24);

  const result = { influencers: [], brands: [], settings: { HIGH_T, LOW_T, HIGH_D, MID_D, LOW_D, BRAND_D, SKIP_H } };

  if (target_type === 'all' || target_type === 'influencer') {
    const { rows } = await db.query(
      `SELECT ig_handle, priority_score, last_scraped_at,
              CASE
                WHEN priority_score >= $1 THEN 'high'
                WHEN priority_score >= $2 THEN 'mid'
                ELSE 'low'
              END AS tier_label
         FROM creator_profiles
        WHERE is_paused = FALSE
          AND (
            (priority_score >= $1 AND (last_scraped_at IS NULL OR last_scraped_at < NOW() - ($3 || ' days')::interval))
         OR (priority_score >= $2 AND priority_score < $1 AND (last_scraped_at IS NULL OR last_scraped_at < NOW() - ($4 || ' days')::interval))
         OR (priority_score < $2 AND (last_scraped_at IS NULL OR last_scraped_at < NOW() - ($5 || ' days')::interval))
          )
        ORDER BY last_scraped_at ASC NULLS FIRST
        LIMIT $6`,
      [HIGH_T, LOW_T, String(HIGH_D), String(MID_D), String(LOW_D), limit]
    );
    result.influencers = rows;
  }

  if (target_type === 'all' || target_type === 'brand') {
    const { rows } = await db.query(
      `SELECT instagram_handle, priority_score, last_scraped_at
         FROM brand_profiles
        WHERE is_paused = FALSE
          AND (last_scraped_at IS NULL OR last_scraped_at < NOW() - ($1 || ' days')::interval)
        ORDER BY last_scraped_at ASC NULLS FIRST
        LIMIT $2`,
      [String(BRAND_D), limit]
    );
    result.brands = rows;
  }

  return success(res, result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/internal/ingest/settings
// Read system_settings (single row). Used by A2 for the freshness-gate
// check and by A6 for tier cadence.
// ─────────────────────────────────────────────────────────────────────────────
const getSettings = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM system_settings WHERE id = 1`);
  return success(res, { ok: true, settings: rows[0] || null });
});

module.exports = {
  // Existing
  upsertCreatorMetrics,
  upsertPosts,
  health,
  // Marketing engine v2
  upsertBrandMetrics,
  updateBrandCollabs,
  upsertCaptionInsights,
  upsertCollabMap,
  insertInsightLog,
  profileBundle,
  brandProfile,
  refreshDue,
  getSettings,
};
