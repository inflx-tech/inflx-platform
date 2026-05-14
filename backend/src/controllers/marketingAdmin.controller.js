'use strict';

/**
 * Marketing Admin Controller
 *
 * The admin-facing API for the marketing engine. Powers the Inflx Admin
 * Web pages under /dashboard/marketing/*.
 *
 *   - Intake (single + bulk) with dedup-conflict UX
 *   - Triage list (combined influencers + brands, filterable)
 *   - Lead detail (profile + activity timeline)
 *   - Activity logging + quick-status updates
 *   - Inbox (today's follow-ups)
 *   - Funnel (stage counts + conversion rates)
 *   - Settings (system_settings read/write)
 *
 * Auth: all routes require an admin JWT. See marketingAdmin.routes.js for
 * the role gates (reviewer+ for reads/writes, superadmin for settings).
 *
 * The intake handler also fires the n8n A2 profile-scraper webhook
 * (best-effort — failures are logged, not propagated to the API caller,
 * because the row is already saved and a manual retry can refire later).
 */

const db = require('../config/db');
const env = require('../config/env');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise an Instagram handle: strips @, strips instagram.com URL prefix,
 * strips trailing slash, strips query string, lowercases, trims.
 */
function normaliseHandle(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .split('?')[0]
    .toLowerCase();
  return cleaned.length > 0 ? cleaned : null;
}

const ALLOWED_STATUS = [
  'not_contacted', 'contacted', 'replied',
  'interested', 'negotiating', 'registered',
  'dead', 'paused',
];

// State machine — what transitions are allowed.
const STATUS_TRANSITIONS = {
  not_contacted: new Set(['contacted', 'dead', 'paused']),
  contacted:     new Set(['replied', 'dead', 'paused', 'not_contacted']),
  replied:       new Set(['interested', 'negotiating', 'registered', 'dead', 'paused']),
  interested:    new Set(['negotiating', 'registered', 'dead', 'paused']),
  negotiating:   new Set(['interested', 'registered', 'dead', 'paused']),
  registered:    new Set(['dead']),
  dead:          new Set([]), // terminal unless force=true
  paused:        new Set(['not_contacted', 'contacted', 'replied', 'interested', 'negotiating', 'dead']),
};

function isAllowedTransition(from, to, force) {
  if (force) return ALLOWED_STATUS.includes(to);
  if (!STATUS_TRANSITIONS[from]) return false;
  return STATUS_TRANSITIONS[from].has(to);
}

/**
 * Trigger the n8n A2 profile-scraper webhook. Best-effort — does not
 * throw if it fails. Returns { ok, status, skipped?, error? }.
 */
async function triggerScrape({ handle, target_type, scrape_mode = 'deep' }) {
  if (!env.N8N_BASE_URL) {
    console.warn('[marketing] N8N_BASE_URL not configured; skipping scrape trigger');
    return { skipped: true, reason: 'n8n_not_configured' };
  }
  const url = env.N8N_BASE_URL.replace(/\/+$/, '') + '/webhook/a2-profile-scraper';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: handle, target_type, scrape_mode }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: r.ok, status: r.status };
  } catch (e) {
    console.error('[marketing] A2 webhook trigger failed:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Lookup helper — find a handle in either creator_profiles or brand_profiles.
 * Returns { found: true, type, row } or { found: false }.
 */
async function findByHandle(handle) {
  const { rows: cp } = await db.query(
    `SELECT id, ig_handle AS handle, outreach_status, last_scraped_at, full_name,
            city, niche, sub_niche
       FROM creator_profiles WHERE ig_handle = $1`,
    [handle]
  );
  if (cp[0]) return { found: true, type: 'influencer', row: cp[0] };

  const { rows: bp } = await db.query(
    `SELECT id, instagram_handle AS handle, outreach_status, last_scraped_at,
            business_name, city, industry, sub_industry
       FROM brand_profiles WHERE instagram_handle = $1`,
    [handle]
  );
  if (bp[0]) return { found: true, type: 'brand', row: bp[0] };

  return { found: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/marketing/leads/intake
// Single-row intake with dedup-conflict resolution.
// ─────────────────────────────────────────────────────────────────────────────

const intakeLead = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const target_type = body.target_type;
  if (!['influencer', 'brand'].includes(target_type)) {
    throw new AppError('INVALID_PAYLOAD', 'target_type must be "influencer" or "brand"', 422, 'target_type');
  }
  const handle = normaliseHandle(body.handle);
  if (!handle) {
    throw new AppError('INVALID_PAYLOAD', 'handle is required', 422, 'handle');
  }

  const force_action = body.force_action || null;

  // Dedup check
  const existing = await findByHandle(handle);

  if (existing.found && !force_action) {
    // Not an "error" per se — admin needs to pick what to do next. Return a
    // successful response with action=requires_decision and the conflict
    // detail. Client renders a modal with the options.
    const isDead = existing.row.outreach_status === 'dead';
    const sameType = existing.type === target_type;
    let message;
    let options;
    if (isDead) {
      message = `@${handle} was previously marked dead. Revive?`;
      options = ['revive', 'cancel'];
    } else if (!sameType) {
      message = `@${handle} already exists as ${existing.type}. Cannot also add as ${target_type}.`;
      options = ['cancel'];
    } else {
      message = `@${handle} already exists. Last scraped: ${existing.row.last_scraped_at || 'never'}. Status: ${existing.row.outreach_status}.`;
      options = ['force_refresh', 'update_manual_only', 'cancel'];
    }
    return success(res, {
      action: 'requires_decision',
      handle,
      message,
      conflict: {
        existing_type: existing.type,
        existing_id: existing.row.id,
        existing_status: existing.row.outreach_status,
        last_scraped_at: existing.row.last_scraped_at,
        is_dead: isDead,
        options,
      },
    });
  }

  // Handle force actions when existing
  if (existing.found && force_action) {
    if (force_action === 'cancel') {
      return success(res, { action: 'cancelled' });
    }

    if (force_action === 'revive') {
      // Reset status, fire scrape
      const table = existing.type === 'brand' ? 'brand_profiles' : 'creator_profiles';
      const handleCol = existing.type === 'brand' ? 'instagram_handle' : 'ig_handle';
      await db.query(
        `UPDATE ${table} SET outreach_status = 'not_contacted', is_paused = FALSE
          WHERE ${handleCol} = $1`,
        [handle]
      );
      const scrape = await triggerScrape({ handle, target_type: existing.type, scrape_mode: 'refresh' });
      return success(res, {
        action: 'revived',
        target_type: existing.type,
        target_id: existing.row.id,
        handle,
        scrape_triggered: !scrape.skipped && (scrape.ok !== false),
      });
    }

    if (force_action === 'force_refresh') {
      const scrape = await triggerScrape({ handle, target_type: existing.type, scrape_mode: 'refresh' });
      return success(res, {
        action: 'force_refresh',
        target_type: existing.type,
        target_id: existing.row.id,
        handle,
        scrape_triggered: !scrape.skipped && (scrape.ok !== false),
      });
    }

    if (force_action === 'update_manual_only') {
      // Update only manual fields, no scrape
      const updated = await updateManualFields(existing.type, handle, body);
      return success(res, {
        action: 'manual_updated',
        target_type: existing.type,
        target_id: existing.row.id,
        handle,
        fields_updated: updated,
      });
    }

    throw new AppError('INVALID_PAYLOAD', `Unknown force_action "${force_action}"`, 422, 'force_action');
  }

  // No existing row — insert fresh + fire scrape
  const targetId = await insertNewLead(target_type, handle, body);
  const scrape = await triggerScrape({ handle, target_type, scrape_mode: 'deep' });

  return success(res, {
    action: 'created',
    target_type,
    target_id: targetId,
    handle,
    scrape_triggered: !scrape.skipped && (scrape.ok !== false),
    scrape_status: scrape,
  }, 201);
});

/**
 * Insert a new creator_profile or brand_profile row with manual fields
 * from the admin intake form. Returns the new id.
 */
async function insertNewLead(target_type, handle, body) {
  if (target_type === 'influencer') {
    const { rows } = await db.query(
      `INSERT INTO creator_profiles (
         ig_handle, full_name, city, niche, sub_niche,
         manual_phone, manual_email, manual_whatsapp,
         source, notes, outreach_status
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, 'not_contacted'
       )
       RETURNING id`,
      [
        handle,
        body.full_name || null,
        body.city || null,
        body.niche || null,
        body.sub_niche || null,
        body.phone || null,
        body.email || null,
        body.whatsapp || body.phone || null,
        body.source || 'admin_intake',
        body.notes || null,
      ]
    );
    return rows[0].id;
  } else {
    const { rows } = await db.query(
      `INSERT INTO brand_profiles (
         instagram_handle, business_name, city, industry, sub_industry,
         manual_phone, manual_email, manual_whatsapp,
         website, source, notes, outreach_status
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11, 'not_contacted'
       )
       RETURNING id`,
      [
        handle,
        body.business_name || body.full_name || null,
        body.city || null,
        body.industry || null,
        body.sub_industry || null,
        body.phone || null,
        body.email || null,
        body.whatsapp || body.phone || null,
        body.website || null,
        body.source || 'admin_intake',
        body.notes || null,
      ]
    );
    return rows[0].id;
  }
}

/**
 * Update only the manual fields on an existing row. Returns list of fields
 * that were actually updated.
 */
async function updateManualFields(type, handle, body) {
  const candidates = type === 'influencer'
    ? [
        ['full_name',       body.full_name],
        ['city',            body.city],
        ['niche',           body.niche],
        ['sub_niche',       body.sub_niche],
        ['manual_phone',    body.phone],
        ['manual_email',    body.email],
        ['manual_whatsapp', body.whatsapp],
        ['notes',           body.notes],
      ]
    : [
        ['business_name',   body.business_name || body.full_name],
        ['city',            body.city],
        ['industry',        body.industry],
        ['sub_industry',    body.sub_industry],
        ['manual_phone',    body.phone],
        ['manual_email',    body.email],
        ['manual_whatsapp', body.whatsapp],
        ['website',         body.website],
        ['notes',           body.notes],
      ];
  const present = candidates.filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (present.length === 0) return [];

  const table = type === 'brand' ? 'brand_profiles' : 'creator_profiles';
  const handleCol = type === 'brand' ? 'instagram_handle' : 'ig_handle';
  const setSql = present.map(([col], i) => `${col} = $${i + 2}`).join(', ');
  const values = [handle, ...present.map(([, v]) => v)];

  await db.query(`UPDATE ${table} SET ${setSql} WHERE ${handleCol} = $1`, values);
  return present.map(([col]) => col);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/marketing/leads/intake/bulk
// ─────────────────────────────────────────────────────────────────────────────

const intakeLeadBulk = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    throw new AppError('INVALID_PAYLOAD', 'rows must be an array', 422, 'rows');
  }
  if (rows.length > 500) {
    throw new AppError('INVALID_PAYLOAD', 'bulk intake limited to 500 rows per request', 422, 'rows');
  }

  const result = {
    total: rows.length,
    created: 0,
    duplicates_skipped: 0,
    revived: 0,
    invalid: 0,
    errors: [],
    items: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    try {
      const target_type = row.target_type;
      if (!['influencer', 'brand'].includes(target_type)) {
        result.invalid++;
        result.errors.push({ row: i + 1, message: `Invalid target_type` });
        continue;
      }
      const handle = normaliseHandle(row.handle);
      if (!handle) {
        result.invalid++;
        result.errors.push({ row: i + 1, message: `Missing or invalid handle` });
        continue;
      }

      const existing = await findByHandle(handle);
      if (existing.found) {
        if (row.force_action === 'revive' && existing.row.outreach_status === 'dead') {
          const table = existing.type === 'brand' ? 'brand_profiles' : 'creator_profiles';
          const handleCol = existing.type === 'brand' ? 'instagram_handle' : 'ig_handle';
          await db.query(
            `UPDATE ${table} SET outreach_status = 'not_contacted' WHERE ${handleCol} = $1`,
            [handle]
          );
          await triggerScrape({ handle, target_type: existing.type, scrape_mode: 'refresh' });
          result.revived++;
          result.items.push({ row: i + 1, handle, action: 'revived', id: existing.row.id });
        } else {
          result.duplicates_skipped++;
          result.items.push({ row: i + 1, handle, action: 'duplicate_skipped', existing_id: existing.row.id });
        }
        continue;
      }

      const id = await insertNewLead(target_type, handle, row);
      await triggerScrape({ handle, target_type, scrape_mode: 'deep' });
      result.created++;
      result.items.push({ row: i + 1, handle, action: 'created', id });
    } catch (e) {
      result.invalid++;
      result.errors.push({ row: i + 1, message: e.message });
    }
  }

  return success(res, result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/marketing/leads
// Combined list: influencers + brands. Filters: target_type, status,
// min_score, city, niche/industry, has_phone, has_email, search.
// ─────────────────────────────────────────────────────────────────────────────

const listLeads = asyncHandler(async (req, res) => {
  const target_type = req.query.target_type || 'all'; // all | influencer | brand
  const status = req.query.status;
  const min_score = parseFloat(req.query.min_score);
  const city = req.query.city;
  const category = req.query.category;       // niche (inf) / industry (brand)
  const sub_category = req.query.sub_category; // sub_niche (inf) / sub_industry (brand)
  const tier = req.query.tier;
  const search = req.query.search; // searches handle + name
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = (page - 1) * limit;
  const sort = req.query.sort || 'priority_score_desc';

  const orderBy = {
    priority_score_desc: 'priority_score DESC NULLS LAST',
    priority_score_asc:  'priority_score ASC NULLS LAST',
    created_desc:        'created_at DESC',
    last_scraped_desc:   'last_scraped_at DESC NULLS LAST',
  }[sort] || 'priority_score DESC NULLS LAST';

  // Build a unified view via two subqueries unioned together
  const params = [];
  const where = (col, op, val) => {
    if (val === undefined || val === null || val === '') return '';
    params.push(val);
    return `AND ${col} ${op} $${params.length}`;
  };

  const includeInfluencers = target_type === 'all' || target_type === 'influencer';
  const includeBrands      = target_type === 'all' || target_type === 'brand';

  const parts = [];

  if (includeInfluencers) {
    const w = [];
    if (status) {
      params.push(status); w.push(`outreach_status = $${params.length}`);
    }
    if (!Number.isNaN(min_score)) {
      params.push(min_score); w.push(`priority_score >= $${params.length}`);
    }
    if (city) {
      params.push(city); w.push(`COALESCE(city, inferred_city) = $${params.length}`);
    }
    if (category) {
      params.push(category); w.push(`COALESCE(niche, inferred_niche) = $${params.length}`);
    }
    if (sub_category) {
      params.push(sub_category); w.push(`COALESCE(sub_niche, inferred_sub_niche) = $${params.length}`);
    }
    if (tier) {
      params.push(tier); w.push(`follower_tier = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const p = params.length;
      w.push(`(ig_handle ILIKE $${p} OR full_name ILIKE $${p})`);
    }
    const whereClause = w.length ? 'WHERE ' + w.join(' AND ') : '';
    parts.push(`
      SELECT 'influencer' AS target_type, id, ig_handle AS handle,
             full_name AS name,
             COALESCE(city, inferred_city) AS city,
             COALESCE(niche, inferred_niche) AS category,
             COALESCE(sub_niche, inferred_sub_niche) AS sub_category,
             followers_count, follower_tier AS tier,
             priority_score, outreach_status,
             COALESCE(manual_phone, bio_phone) AS phone,
             COALESCE(manual_email, bio_email) AS email,
             COALESCE(manual_whatsapp, bio_whatsapp) AS whatsapp,
             last_scraped_at, last_calculated_at, created_at, is_paused,
             is_onboarded, linked_influencer_id AS linked_id
        FROM creator_profiles
        ${whereClause}
    `);
  }

  if (includeBrands) {
    const w = [];
    if (status) {
      params.push(status); w.push(`outreach_status = $${params.length}`);
    }
    if (!Number.isNaN(min_score)) {
      params.push(min_score); w.push(`priority_score >= $${params.length}`);
    }
    if (city) {
      params.push(city); w.push(`COALESCE(city, inferred_city) = $${params.length}`);
    }
    if (category) {
      params.push(category); w.push(`COALESCE(industry, inferred_industry) = $${params.length}`);
    }
    if (sub_category) {
      params.push(sub_category); w.push(`COALESCE(sub_industry, inferred_sub_industry) = $${params.length}`);
    }
    if (tier) {
      params.push(tier); w.push(`tier = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const p = params.length;
      w.push(`(instagram_handle ILIKE $${p} OR business_name ILIKE $${p})`);
    }
    const whereClause = w.length ? 'WHERE ' + w.join(' AND ') : '';
    parts.push(`
      SELECT 'brand' AS target_type, id, instagram_handle AS handle,
             business_name AS name,
             COALESCE(city, inferred_city) AS city,
             COALESCE(industry, inferred_industry) AS category,
             COALESCE(sub_industry, inferred_sub_industry) AS sub_category,
             followers_count, tier,
             priority_score, outreach_status,
             COALESCE(manual_phone, bio_phone) AS phone,
             COALESCE(manual_email, bio_email) AS email,
             COALESCE(manual_whatsapp, bio_whatsapp) AS whatsapp,
             last_scraped_at, last_calculated_at, created_at, is_paused,
             is_onboarded, linked_brand_id AS linked_id
        FROM brand_profiles
        ${whereClause}
    `);
  }

  if (parts.length === 0) {
    return success(res, [], 200, { page, limit, total: 0 });
  }

  const unioned = parts.join('\nUNION ALL\n');
  const countSql = `SELECT count(*)::int AS n FROM (${unioned}) u`;
  const dataSql = `SELECT * FROM (${unioned}) u ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;

  const [countRes, dataRes] = await Promise.all([
    db.query(countSql, params),
    db.query(dataSql, params),
  ]);

  return success(res, dataRes.rows, 200, {
    page, limit, total: countRes.rows[0].n,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/marketing/leads/:type/:id
// Full detail page: profile + posts (influencer) + collabs + activity timeline.
// ─────────────────────────────────────────────────────────────────────────────

const getLeadDetail = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  if (!['influencer', 'brand'].includes(type)) {
    throw new AppError('INVALID_PAYLOAD', 'type must be "influencer" or "brand"', 422);
  }

  if (type === 'influencer') {
    const { rows: cp } = await db.query(
      `SELECT * FROM creator_profiles WHERE id = $1`, [id]
    );
    if (!cp[0]) throw new AppError('NOT_FOUND', 'Influencer not found', 404);

    const [postsRes, collabsRes, insightsRes, activityRes] = await Promise.all([
      db.query(`SELECT * FROM posts WHERE creator_profile_id = $1 ORDER BY posted_at DESC LIMIT 30`, [id]),
      db.query(`SELECT * FROM collab_map WHERE creator_profile_id = $1 ORDER BY detected_at DESC LIMIT 50`, [id]),
      db.query(`SELECT * FROM insights WHERE creator_profile_id = $1 ORDER BY created_at DESC LIMIT 10`, [id]),
      db.query(`SELECT * FROM outreach_activity WHERE target_type = 'influencer' AND target_id = $1
                ORDER BY logged_at DESC LIMIT 100`, [id]),
    ]);

    return success(res, {
      target_type: 'influencer',
      profile: cp[0],
      posts: postsRes.rows,
      collabs: collabsRes.rows,
      insights: insightsRes.rows,
      activity_timeline: activityRes.rows,
    });
  } else {
    const { rows: bp } = await db.query(
      `SELECT * FROM brand_profiles WHERE id = $1`, [id]
    );
    if (!bp[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);

    const [insightsRes, activityRes] = await Promise.all([
      db.query(`SELECT * FROM insights WHERE brand_profile_id = $1 ORDER BY created_at DESC LIMIT 10`, [id]),
      db.query(`SELECT * FROM outreach_activity WHERE target_type = 'brand' AND target_id = $1
                ORDER BY logged_at DESC LIMIT 100`, [id]),
    ]);

    return success(res, {
      target_type: 'brand',
      profile: bp[0],
      insights: insightsRes.rows,
      activity_timeline: activityRes.rows,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/marketing/leads/:type/:id/activity
// Log an activity row + auto-advance status based on direction.
// ─────────────────────────────────────────────────────────────────────────────

const logActivity = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  if (!['influencer', 'brand'].includes(type)) {
    throw new AppError('INVALID_PAYLOAD', 'type must be "influencer" or "brand"', 422);
  }
  const body = req.body || {};
  const VALID_CHANNELS = ['dm', 'whatsapp', 'email', 'call', 'in_person', 'sms', 'other', 'internal'];
  const VALID_DIRECTIONS = ['outbound', 'inbound', 'internal_note'];

  if (!VALID_CHANNELS.includes(body.channel)) {
    throw new AppError('INVALID_PAYLOAD', `channel must be one of: ${VALID_CHANNELS.join(', ')}`, 422, 'channel');
  }
  if (!VALID_DIRECTIONS.includes(body.direction)) {
    throw new AppError('INVALID_PAYLOAD', `direction must be one of: ${VALID_DIRECTIONS.join(', ')}`, 422, 'direction');
  }

  // Verify the lead exists + grab handle for denormalization
  const table = type === 'brand' ? 'brand_profiles' : 'creator_profiles';
  const handleCol = type === 'brand' ? 'instagram_handle' : 'ig_handle';
  const { rows: lead } = await db.query(
    `SELECT id, ${handleCol} AS handle, outreach_status FROM ${table} WHERE id = $1`,
    [id]
  );
  if (!lead[0]) throw new AppError('NOT_FOUND', 'Lead not found', 404);

  // Decide auto-status-advance
  let nextStatus = lead[0].outreach_status;
  if (body.direction === 'outbound' && nextStatus === 'not_contacted') {
    nextStatus = 'contacted';
  } else if (body.direction === 'inbound' && (nextStatus === 'contacted' || nextStatus === 'not_contacted')) {
    nextStatus = 'replied';
  }

  const metadata = body.metadata
    ? (typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata))
    : '{}';

  const { rows: act } = await db.query(
    `INSERT INTO outreach_activity (
       target_type, target_id, ig_handle, channel, direction,
       message_body, internal_notes, sentiment,
       next_action, next_action_due, metadata, status_after, logged_by
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8,
       $9, $10, $11::jsonb, $12, $13
     ) RETURNING *`,
    [
      type, id, lead[0].handle,
      body.channel, body.direction,
      body.message_body || null,
      body.internal_notes || null,
      body.sentiment || null,
      body.next_action || null,
      body.next_action_due || null,
      metadata,
      nextStatus,
      req.user?.sub || null,
    ]
  );

  // Update lead status if it changed
  if (nextStatus !== lead[0].outreach_status) {
    await db.query(
      `UPDATE ${table} SET outreach_status = $1 WHERE id = $2`,
      [nextStatus, id]
    );
  }

  return success(res, {
    activity: act[0],
    status_changed: nextStatus !== lead[0].outreach_status,
    previous_status: lead[0].outreach_status,
    new_status: nextStatus,
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/marketing/leads/:type/:id/status
// Quick-status button. Validates state machine unless force=true.
// ─────────────────────────────────────────────────────────────────────────────

const updateStatus = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const { new_status, force, reason } = req.body || {};
  if (!['influencer', 'brand'].includes(type)) {
    throw new AppError('INVALID_PAYLOAD', 'type must be "influencer" or "brand"', 422);
  }
  if (!ALLOWED_STATUS.includes(new_status)) {
    throw new AppError('INVALID_PAYLOAD', `new_status must be one of: ${ALLOWED_STATUS.join(', ')}`, 422, 'new_status');
  }

  const table = type === 'brand' ? 'brand_profiles' : 'creator_profiles';
  const handleCol = type === 'brand' ? 'instagram_handle' : 'ig_handle';
  const { rows: lead } = await db.query(
    `SELECT id, ${handleCol} AS handle, outreach_status FROM ${table} WHERE id = $1`,
    [id]
  );
  if (!lead[0]) throw new AppError('NOT_FOUND', 'Lead not found', 404);

  if (!isAllowedTransition(lead[0].outreach_status, new_status, !!force)) {
    throw new AppError(
      'INVALID_TRANSITION',
      `Cannot move from "${lead[0].outreach_status}" to "${new_status}". Use force=true to override.`,
      422
    );
  }

  // Persist
  const updates = ['outreach_status = $2'];
  const values = [id, new_status];
  if (new_status === 'paused') {
    updates.push('is_paused = TRUE', 'paused_at = NOW()');
  } else if (lead[0].outreach_status === 'paused') {
    updates.push('is_paused = FALSE');
  }
  await db.query(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = $1`, values);

  // Also log an internal-note activity row for audit
  await db.query(
    `INSERT INTO outreach_activity (
       target_type, target_id, ig_handle, channel, direction,
       internal_notes, status_after, logged_by
     ) VALUES ($1, $2, $3, 'internal', 'internal_note', $4, $5, $6)`,
    [
      type, id, lead[0].handle,
      reason || `Status changed: ${lead[0].outreach_status} → ${new_status}${force ? ' (forced)' : ''}`,
      new_status,
      req.user?.sub || null,
    ]
  );

  return success(res, {
    target_id: id,
    target_type: type,
    previous_status: lead[0].outreach_status,
    new_status,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/marketing/inbox
// Today's follow-ups: activities with next_action_due ≤ today and not done.
// ─────────────────────────────────────────────────────────────────────────────

const getInbox = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT oa.*,
           CASE
             WHEN oa.target_type = 'influencer' THEN cp.full_name
             ELSE bp.business_name
           END AS target_name,
           CASE
             WHEN oa.target_type = 'influencer' THEN COALESCE(cp.city, cp.inferred_city)
             ELSE COALESCE(bp.city, bp.inferred_city)
           END AS target_city,
           CASE
             WHEN oa.target_type = 'influencer' THEN cp.outreach_status
             ELSE bp.outreach_status
           END AS current_status
      FROM outreach_activity oa
      LEFT JOIN creator_profiles cp ON oa.target_type = 'influencer' AND oa.target_id = cp.id
      LEFT JOIN brand_profiles   bp ON oa.target_type = 'brand'      AND oa.target_id = bp.id
     WHERE oa.next_action_done = FALSE
       AND oa.next_action_due IS NOT NULL
       AND oa.next_action_due <= NOW() + INTERVAL '24 hours'
     ORDER BY oa.next_action_due ASC
     LIMIT 200
  `);
  return success(res, rows);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/marketing/funnel
// Stage counts + conversion rates, segmented by target_type.
// ─────────────────────────────────────────────────────────────────────────────

const getFunnel = asyncHandler(async (req, res) => {
  const [cpRes, bpRes] = await Promise.all([
    db.query(`
      SELECT outreach_status, COUNT(*)::int AS n
        FROM creator_profiles
       GROUP BY outreach_status
    `),
    db.query(`
      SELECT outreach_status, COUNT(*)::int AS n
        FROM brand_profiles
       GROUP BY outreach_status
    `),
  ]);

  const toMap = rows => ALLOWED_STATUS.reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, Object.fromEntries(rows.map(r => [r.outreach_status, r.n])));

  const influencers = toMap(cpRes.rows);
  const brands = toMap(bpRes.rows);

  // Conversion rates (simple: next stage / previous stage)
  const stageOrder = ['not_contacted', 'contacted', 'replied', 'interested', 'negotiating', 'registered'];
  function conversions(counts) {
    const out = {};
    for (let i = 0; i < stageOrder.length - 1; i++) {
      const from = counts[stageOrder[i]] || 0;
      const to = counts[stageOrder[i + 1]] || 0;
      out[`${stageOrder[i]}_to_${stageOrder[i + 1]}`] = from > 0 ? +(to / from * 100).toFixed(1) : 0;
    }
    return out;
  }

  return success(res, {
    influencers: { counts: influencers, conversions: conversions(influencers) },
    brands:      { counts: brands,      conversions: conversions(brands) },
    totals: {
      influencers: Object.values(influencers).reduce((s, n) => s + n, 0),
      brands:      Object.values(brands).reduce((s, n) => s + n, 0),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET / PATCH /admin/marketing/settings
// ─────────────────────────────────────────────────────────────────────────────

const getSettings = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM system_settings WHERE id = 1`);
  return success(res, rows[0] || null);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/marketing/filter-options
// Returns distinct values for filter dropdowns: cities, niches, sub_niches,
// industries, sub_industries, tiers. Pulled from real data so dropdowns
// match what's actually in the DB. Empty/null values are filtered out.
// ─────────────────────────────────────────────────────────────────────────────
const getFilterOptions = asyncHandler(async (req, res) => {
  const [cpCities, bpCities, cpNiches, cpSubNiches, bpIndustries, bpSubIndustries, cpTiers, bpTiers] = await Promise.all([
    db.query(`SELECT DISTINCT COALESCE(city, inferred_city) AS v FROM creator_profiles WHERE COALESCE(city, inferred_city) IS NOT NULL AND COALESCE(city, inferred_city) <> '' ORDER BY v`),
    db.query(`SELECT DISTINCT COALESCE(city, inferred_city) AS v FROM brand_profiles WHERE COALESCE(city, inferred_city) IS NOT NULL AND COALESCE(city, inferred_city) <> '' ORDER BY v`),
    db.query(`SELECT DISTINCT COALESCE(niche, inferred_niche) AS v FROM creator_profiles WHERE COALESCE(niche, inferred_niche) IS NOT NULL AND COALESCE(niche, inferred_niche) <> '' ORDER BY v`),
    db.query(`SELECT DISTINCT COALESCE(sub_niche, inferred_sub_niche) AS v FROM creator_profiles WHERE COALESCE(sub_niche, inferred_sub_niche) IS NOT NULL AND COALESCE(sub_niche, inferred_sub_niche) <> '' ORDER BY v`),
    db.query(`SELECT DISTINCT COALESCE(industry, inferred_industry) AS v FROM brand_profiles WHERE COALESCE(industry, inferred_industry) IS NOT NULL AND COALESCE(industry, inferred_industry) <> '' ORDER BY v`),
    db.query(`SELECT DISTINCT COALESCE(sub_industry, inferred_sub_industry) AS v FROM brand_profiles WHERE COALESCE(sub_industry, inferred_sub_industry) IS NOT NULL AND COALESCE(sub_industry, inferred_sub_industry) <> '' ORDER BY v`),
    db.query(`SELECT DISTINCT follower_tier AS v FROM creator_profiles WHERE follower_tier IS NOT NULL ORDER BY v`),
    db.query(`SELECT DISTINCT tier AS v FROM brand_profiles WHERE tier IS NOT NULL ORDER BY v`),
  ]);

  const dedupSorted = (arrs) => [...new Set(arrs.flat().map(r => r.v).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return success(res, {
    cities:        dedupSorted([cpCities.rows, bpCities.rows]),
    niches:        cpNiches.rows.map(r => r.v),
    sub_niches:    cpSubNiches.rows.map(r => r.v),
    industries:    bpIndustries.rows.map(r => r.v),
    sub_industries: bpSubIndustries.rows.map(r => r.v),
    creator_tiers: cpTiers.rows.map(r => r.v),  // nano/micro/mid/macro/mega/celebrity
    brand_tiers:   bpTiers.rows.map(r => r.v),  // small/mid/large/enterprise
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const allowed = [
    'high_tier_threshold', 'low_tier_threshold',
    'high_refresh_days', 'mid_refresh_days', 'low_refresh_days', 'brand_refresh_days',
    'skip_recent_scrape_hours', 'posts_retention_days', 'brand_posts_retention_days',
    'discovery_enabled',
  ];
  const present = allowed.filter(k => Object.prototype.hasOwnProperty.call(body, k));
  if (present.length === 0) {
    throw new AppError('INVALID_PAYLOAD', 'No allowed fields provided', 422);
  }
  const setSql = present.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = present.map(k => body[k]);
  const { rows } = await db.query(
    `UPDATE system_settings SET ${setSql} WHERE id = 1 RETURNING *`,
    values
  );
  return success(res, rows[0]);
});

module.exports = {
  intakeLead,
  intakeLeadBulk,
  listLeads,
  getLeadDetail,
  logActivity,
  updateStatus,
  getInbox,
  getFunnel,
  getSettings,
  updateSettings,
  getFilterOptions,
};
