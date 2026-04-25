'use strict';

const db = require('../config/db');
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
const JSONB_FIELDS = new Set(['top_brand_partners', 'related_handles', 'raw_profile_data', 'brand_tags']);

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

  const updateSet = cols
    .filter(c => c !== 'ig_handle') // ig_handle is the conflict target
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');

  const sql = `
    INSERT INTO creator_profiles (${cols.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (ig_handle) DO UPDATE SET ${updateSet}
    RETURNING id, ig_handle, is_onboarded, linked_influencer_id, last_calculated_at,
              (xmax = 0) AS inserted
  `;

  const { rows } = await db.query(sql, values);
  const out = rows[0];

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

module.exports = { upsertCreatorMetrics, upsertPosts, health };
