'use strict';

/**
 * Ingest endpoints — push from external Marketing Automation system.
 *
 * Notes on test setup
 * -------------------
 * tests/setup.js applies migration 001 only. The creator_profiles and
 * posts tables come from migrations 024 / 025, which we apply here in
 * beforeAll so this test file is self-sufficient.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const app = require('../src/app');
const env = require('../src/config/env');
const { query, pool } = require('./helpers/db');

const TOKEN = env.INFLX_INGEST_TOKEN; // 'dev-ingest-token' in test env

beforeAll(async () => {
  // Apply migrations 024 + 025 (idempotent — uses IF NOT EXISTS)
  for (const file of ['024_creator_profiles.sql', '025_posts.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', file), 'utf8');
    await pool.query(sql);
  }
});

beforeEach(async () => {
  await pool.query('TRUNCATE posts, creator_profiles RESTART IDENTITY CASCADE');
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

describe('ingest auth', () => {
  it('401 TOKEN_REJECTED when X-Ingest-Token header missing', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .send({ ig_handle: 'zomato' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REJECTED');
  });

  it('401 TOKEN_REJECTED on wrong token', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', 'definitely-wrong')
      .send({ ig_handle: 'zomato' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REJECTED');
  });

  it('401 TOKEN_REJECTED on length-mismatched token (timing-safe path)', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', 'short')
      .send({ ig_handle: 'zomato' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/creator-metrics
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/internal/ingest/creator-metrics', () => {
  const validPayload = () => ({
    ig_handle: 'zomato',
    ig_user_id: '987654321',
    full_name: 'Zomato',
    bio: 'Food delivery',
    profile_pic_url: 'https://example.com/zomato.jpg',
    followers_count: 2_000_000,
    following_count: 50,
    is_verified: true,
    is_business: true,
    city: 'Gurgaon',
    niche: 'food',
    sub_niche: 'delivery',
    languages: ['en', 'hi'],
    bio_email: 'press@zomato.com',
    avg_likes: 12000,
    avg_comments: 800,
    avg_views: 500000,
    follower_based_er: 0.64,
    view_based_er: 2.56,
    follower_tier: 'celebrity',
    is_active_creator: true,
    activity_status: 'active',
    growth_potential_score: 78,
    rank_score: 91.5,
    estimated_min_rate: 150000,
    estimated_max_rate: 400000,
    top_brand_partners: [{ handle: 'swiggy', collabs: 3 }],
    related_handles: ['swiggy', 'dunzo'],
    last_calculated_at: new Date().toISOString(),
  });

  it('201 created on first push, returns action="created"', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send(validPayload());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.ig_handle).toBe('zomato');
    expect(res.body.data.action).toBe('created');
    expect(res.body.data.is_onboarded).toBe(false);
    expect(res.body.data.linked_to_user).toBe(false);

    const { rows } = await query(
      `SELECT followers_count, view_based_er, top_brand_partners, languages
       FROM creator_profiles WHERE ig_handle = $1`,
      ['zomato']
    );
    expect(rows[0].followers_count).toBe(2_000_000);
    expect(parseFloat(rows[0].view_based_er)).toBeCloseTo(2.56);
    expect(rows[0].top_brand_partners).toEqual([{ handle: 'swiggy', collabs: 3 }]);
    expect(rows[0].languages).toEqual(['en', 'hi']);
  });

  it('200 updated on second push (idempotent upsert)', async () => {
    await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send(validPayload());

    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({ ...validPayload(), followers_count: 2_100_000 });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('updated');

    const { rows } = await query(
      `SELECT COUNT(*)::int AS c, MAX(followers_count) AS f FROM creator_profiles WHERE ig_handle = $1`,
      ['zomato']
    );
    expect(rows[0].c).toBe(1);
    expect(rows[0].f).toBe(2_100_000);
  });

  it('normalises ig_handle: trims, lowercases, strips leading @', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({ ...validPayload(), ig_handle: '  @ZOMATO ' });
    expect(res.status).toBe(201);
    expect(res.body.data.ig_handle).toBe('zomato');
  });

  it('400 IGNORED_BRAND_TYPE when target_type = brand', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({ ...validPayload(), target_type: 'brand' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IGNORED_BRAND_TYPE');
  });

  it('accepts target_type=influencer (explicit)', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({ ...validPayload(), target_type: 'influencer' });
    expect(res.status).toBe(201);
  });

  it('422 INVALID_PAYLOAD when ig_handle missing', async () => {
    const payload = validPayload();
    delete payload.ig_handle;
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send(payload);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_PAYLOAD');
  });

  it('422 INVALID_PAYLOAD when ig_handle is empty string', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({ ...validPayload(), ig_handle: '   ' });
    expect(res.status).toBe(422);
  });

  it('preserves is_onboarded and linked_influencer_id across updates', async () => {
    // Seed a creator and manually flip the onboarding flag (simulating that
    // an influencer has signed up since the last push)
    await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send(validPayload());

    await query(
      `UPDATE creator_profiles
         SET is_onboarded = TRUE
       WHERE ig_handle = $1`,
      ['zomato']
    );

    // A subsequent metrics push must NOT clear that flag (the ingest
    // controller's allow-list excludes is_onboarded / linked_influencer_id).
    await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({ ...validPayload(), followers_count: 3_000_000 });

    const { rows } = await query(
      `SELECT is_onboarded, followers_count FROM creator_profiles WHERE ig_handle = $1`,
      ['zomato']
    );
    expect(rows[0].is_onboarded).toBe(true);
    expect(rows[0].followers_count).toBe(3_000_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/internal/ingest/posts
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/internal/ingest/posts', () => {
  async function seedCreator(handle = 'zomato') {
    await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({ ig_handle: handle });
  }

  const samplePost = (i) => ({
    ig_post_id: `pid_${i}`,
    type: 'reel',
    posted_at: new Date(Date.UTC(2026, 3, i + 1)).toISOString(),
    caption: `Post number ${i}`,
    media_url: `https://cdn.example.com/${i}.jpg`,
    likes_count: 1000 + i,
    comments_count: 50 + i,
    views_count: 10000 + i * 100,
    brand_tags: [{ handle: 'swiggy' }],
    has_commercial_intent: i % 2 === 0,
  });

  it('200 upserts a batch of posts', async () => {
    await seedCreator();
    const res = await request(app)
      .post('/v1/internal/ingest/posts')
      .set('X-Ingest-Token', TOKEN)
      .send({ ig_handle: 'zomato', posts: [samplePost(1), samplePost(2), samplePost(3)] });
    expect(res.status).toBe(200);
    expect(res.body.data.posts_upserted).toBe(3);
    expect(res.body.data.posts_skipped).toBe(0);

    const { rows } = await query(`SELECT COUNT(*)::int AS c FROM posts`);
    expect(rows[0].c).toBe(3);
  });

  it('idempotent — second push of same posts overwrites in place', async () => {
    await seedCreator();
    await request(app)
      .post('/v1/internal/ingest/posts')
      .set('X-Ingest-Token', TOKEN)
      .send({ ig_handle: 'zomato', posts: [samplePost(1)] });

    await request(app)
      .post('/v1/internal/ingest/posts')
      .set('X-Ingest-Token', TOKEN)
      .send({ ig_handle: 'zomato', posts: [{ ...samplePost(1), likes_count: 9999 }] });

    const { rows } = await query(`SELECT COUNT(*)::int AS c, MAX(likes_count) AS l FROM posts`);
    expect(rows[0].c).toBe(1);
    expect(rows[0].l).toBe(9999);
  });

  it('skips posts missing ig_post_id', async () => {
    await seedCreator();
    const res = await request(app)
      .post('/v1/internal/ingest/posts')
      .set('X-Ingest-Token', TOKEN)
      .send({
        ig_handle: 'zomato',
        posts: [samplePost(1), { caption: 'no id' }, { ig_post_id: '' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.posts_upserted).toBe(1);
    expect(res.body.data.posts_skipped).toBe(2);
  });

  it('422 when ig_handle has no creator_profile yet', async () => {
    const res = await request(app)
      .post('/v1/internal/ingest/posts')
      .set('X-Ingest-Token', TOKEN)
      .send({ ig_handle: 'never_seen', posts: [samplePost(1)] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_PAYLOAD');
  });

  it('422 when posts is not an array', async () => {
    await seedCreator();
    const res = await request(app)
      .post('/v1/internal/ingest/posts')
      .set('X-Ingest-Token', TOKEN)
      .send({ ig_handle: 'zomato', posts: 'oops' });
    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/internal/ingest/health
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/internal/ingest/health', () => {
  it('returns 200 with summary counters', async () => {
    // Seed one fresh + one stale (>48h)
    await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({ ig_handle: 'fresh', last_calculated_at: new Date().toISOString() });
    await request(app)
      .post('/v1/internal/ingest/creator-metrics')
      .set('X-Ingest-Token', TOKEN)
      .send({
        ig_handle: 'stale',
        last_calculated_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      });

    const res = await request(app)
      .get('/v1/internal/ingest/health')
      .set('X-Ingest-Token', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.total_creators).toBe(2);
    expect(res.body.data.total_stale_48h).toBeGreaterThanOrEqual(1);
    expect(res.body.data.last_ingest_at).toBeTruthy();
  });

  it('rejects unauthenticated calls', async () => {
    const res = await request(app).get('/v1/internal/ingest/health');
    expect(res.status).toBe(401);
  });
});
