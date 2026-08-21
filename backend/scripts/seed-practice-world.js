'use strict';

/**
 * seed-practice-world.js — a world the founder can actually test in.
 * Contract: features/stage-0-clear-the-decks   Plan: Docs/THE_PLAN.md
 *
 * WHY
 * Production holds 1 contract, 1 shoot stuck at "proposed", 1 post, 0 agreements,
 * 0 groups, 0 diary rows and 0 attributed sales. The founder tests by using the apps.
 * Every screen built from Stage 1 onward would be correct and empty, and an empty
 * screen cannot tell you whether a stage passed.
 *
 * THE TWO RULES THIS SCRIPT OBEYS
 *
 * 1. NOTHING REACHES A REAL PERSON. 462 real followers use this system and 63 joined
 *    this month. Every row is created switched off, using the state the app already
 *    filters on — brands stay `pending`, products stay inactive and unpushed, posts
 *    never reach `approved`. No new hiding logic is introduced, because logic that
 *    hides things is logic that can fail open.
 *
 * 2. EVERYTHING IS REVERSIBLE. Every id is written to practice-world.manifest.json
 *    and remove-practice-world.js deletes exactly that list. Scenery accounts also
 *    carry a reserved phone prefix as a second, independent way to find them.
 *
 * USAGE
 *   node scripts/seed-practice-world.js --env=test          (default — the qa container)
 *   node scripts/seed-practice-world.js --env=prod --brand-phone=… --creator-phone=…
 *
 * Idempotent: run it twice and the second run reports what already exists and adds
 * only what is missing.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(__dirname, 'practice-world.manifest.json');
const SCENERY_PREFIX = '+9179000001';   // reserved; no SIM exists for these

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; })
);

const ENV = args.env || 'test';
if (!['test', 'prod'].includes(ENV)) {
  console.error('--env must be test or prod'); process.exit(1);
}

require('dotenv').config({
  path: path.join(__dirname, ENV === 'prod' ? '../.env.prod-backup' : '../.env'),
});
const CONN = ENV === 'prod' ? process.env.DATABASE_URL : process.env.TEST_DATABASE_URL;
if (!CONN) { console.error(`No connection string for --env=${ENV}`); process.exit(1); }

// ── The cast ─────────────────────────────────────────────────────────────────
// Names and cities chosen to match the agreed boards, so a screen looks like its
// mockup rather than like a fixture dump.

const BRANDS = [
  { key: 'kanchi',  name: 'Kanchi Silks (practice)',   category: 'Fashion', city: 'Vijayawada', state: 'Andhra Pradesh', login: true },
  { key: 'labelfern', name: 'Label Fern (practice)',   category: 'Fashion', city: 'Hyderabad',  state: 'Telangana' },
  { key: 'novafit', name: 'Nova Fit (practice)',       category: 'Fitness', city: 'Bengaluru',  state: 'Karnataka' },
];

const CREATORS = [
  { key: 'asha',    handle: 'asha_practice',    name: 'Asha M. (practice)',    city: 'Vijayawada', state: 'Andhra Pradesh', niche: 'Fashion',   followers: 48200, er: 4.8, login: true },
  { key: 'meera',   handle: 'meera_practice',   name: 'Meera S. (practice)',   city: 'Vijayawada', state: 'Andhra Pradesh', niche: 'Fashion',   followers: 31400, er: 5.2 },
  { key: 'divya',   handle: 'divya_practice',   name: 'Divya T. (practice)',   city: 'Guntur',     state: 'Andhra Pradesh', niche: 'Fashion',   followers: 22100, er: 6.1 },
  { key: 'nisha',   handle: 'nisha_practice',   name: 'Nisha P. (practice)',   city: 'Vijayawada', state: 'Andhra Pradesh', niche: 'Lifestyle', followers: 18900, er: 3.9 },
  { key: 'karthik', handle: 'karthik_practice', name: 'Karthik V. (practice)', city: 'Guntur',     state: 'Andhra Pradesh', niche: 'Fashion',   followers: 15600, er: 4.4 },
  { key: 'ravi',    handle: 'ravi_practice',    name: 'Ravi K. (practice)',    city: 'Nellore',    state: 'Andhra Pradesh', niche: 'Fitness',   followers: 27300, er: 5.5 },
  { key: 'priya',   handle: 'priya_practice',   name: 'Priya N. (practice)',   city: 'Vijayawada', state: 'Andhra Pradesh', niche: 'Fashion',   followers: 41000, er: 4.1 },
  { key: 'sneha',   handle: 'sneha_practice',   name: 'Sneha R. (practice)',   city: 'Visakhapatnam', state: 'Andhra Pradesh', niche: 'Beauty', followers: 36700, er: 5.9 },
  { key: 'lakshmi', handle: 'lakshmi_practice', name: 'Lakshmi D. (practice)', city: 'Nellore',    state: 'Andhra Pradesh', niche: 'Fashion',   followers: 12400, er: 7.2 },
  { key: 'anita',   handle: 'anita_practice',   name: 'Anita B. (practice)',   city: 'Hyderabad',  state: 'Telangana',      niche: 'Fashion',   followers: 52800, er: 3.6 },
  { key: 'rohit',   handle: 'rohit_practice',   name: 'Rohit S. (practice)',   city: 'Hyderabad',  state: 'Telangana',      niche: 'Lifestyle', followers: 29500, er: 4.7, muted: true },
  { key: 'kavya',   handle: 'kavya_practice',   name: 'Kavya J. (practice)',   city: 'Hyderabad',  state: 'Telangana',      niche: 'Fashion',   followers: 19800, er: 5.1 },
  { key: 'tejas',   handle: 'tejas_practice',   name: 'Tejas M. (practice)',   city: 'Warangal',   state: 'Telangana',      niche: 'Fitness',   followers: 8900,  er: 6.8 },
  { key: 'deepa',   handle: 'deepa_practice',   name: 'Deepa K. (practice)',   city: 'Hyderabad',  state: 'Telangana',      niche: 'Fashion',   followers: 63200, er: 3.2, noBulk: true },
  { key: 'arjun',   handle: 'arjun_practice',   name: 'Arjun P. (practice)',   city: 'Bengaluru',  state: 'Karnataka',      niche: 'Fashion',   followers: 44100, er: 4.3 },
  { key: 'nandini', handle: 'nandini_practice', name: 'Nandini G. (practice)', city: 'Bengaluru',  state: 'Karnataka',      niche: 'Beauty',    followers: 33600, er: 5.4 },
  { key: 'vikram',  handle: 'vikram_practice',  name: 'Vikram L. (practice)',  city: 'Chennai',    state: 'Tamil Nadu',     niche: 'Fitness',   followers: 21700, er: 4.9 },
  { key: 'ishita',  handle: 'ishita_practice',  name: 'Ishita C. (practice)',  city: 'Chennai',    state: 'Tamil Nadu',     niche: 'Fashion',   followers: 17300, er: 5.6 },
  { key: 'manoj',   handle: 'manoj_practice',   name: 'Manoj T. (practice)',   city: 'Mumbai',     state: 'Maharashtra',    niche: 'Lifestyle', followers: 58400, er: 3.8 },
  { key: 'pooja',   handle: 'pooja_practice',   name: 'Pooja V. (practice)',   city: 'Mumbai',     state: 'Maharashtra',    niche: 'Fashion',   followers: 39200, er: 4.6 },
  { key: 'rahul',   handle: 'rahul_practice',   name: 'Rahul N. (practice)',   city: 'Delhi',      state: 'Delhi',          niche: 'Fitness',   followers: 25100, er: 5.0 },
  { key: 'sita',    handle: 'sita_practice',    name: 'Sita A. (practice)',    city: 'Delhi',      state: 'Delhi',          niche: 'Fashion',   followers: 47600, er: 4.2 },
];

const PRODUCTS = {
  kanchi: [
    ['Kanjivaram Silk — Maroon', 18500, 'Silk'], ['Banarasi Silk — Gold', 24000, 'Silk'],
    ['Mysore Silk — Teal', 12400, 'Silk'],       ['Tussar — Ivory', 9800, 'Silk'],
    ['Handloom Cotton — Indigo', 4200, 'Cotton'],['Mangalgiri — Rust', 3600, 'Cotton'],
    ['Jamdani — White', 6900, 'Cotton'],         ['Kalamkari — Ochre', 5100, 'Cotton'],
    ['Sequin Party — Rose', 15000, 'Party'],     ['Georgette Party — Wine', 8400, 'Party'],
    ['Bridal Red', 52000, 'Bridal'],
  ],
  labelfern: [
    ['Linen Midi — Sage', 3400, 'Dresses'], ['Wrap Dress — Black', 2900, 'Dresses'],
    ['Cotton Shirt — Ecru', 1800, 'Tops'],  ['Wide Leg — Indigo', 2600, 'Bottoms'],
  ],
  novafit: [
    ['Performance Tee', 1400, 'Tops'], ['Training Shorts', 1600, 'Bottoms'],
    ['Resistance Set', 2200, 'Equipment'],
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const log = (...a) => console.log('[practice]', ...a);
const day = (n) => `now() + interval '${n} days'`;

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return null;
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return null; }
}

async function main() {
  const c = new Client({
    connectionString: CONN,
    ...(ENV === 'prod' ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await c.connect();
  log(`connected — env=${ENV}`);

  const existing = loadManifest();
  if (existing && existing.env === ENV) {
    const { rows } = await c.query(
      `SELECT count(*)::int n FROM users WHERE id = ANY($1::uuid[])`,
      [existing.users || []]
    );
    if (rows[0].n > 0) {
      log(`a practice world already exists here (${rows[0].n} accounts).`);
      log('run remove-practice-world.js first, or delete the manifest to start again.');
      await c.end();
      return;
    }
  }

  const M = {
    env: ENV,
    created_at: new Date().toISOString(),
    contract: 'features/stage-0-clear-the-decks',
    users: [], brands: [], influencers: [], groups: [], requests: [], test_numbers: [],
    agreements: [], campaigns: [], products: [], posts: [], transactions: [],
  };

  const brandLoginPhone   = args['brand-phone']   || `${SCENERY_PREFIX}01`;
  const creatorLoginPhone = args['creator-phone'] || `${SCENERY_PREFIX}02`;

  // Stage 0, job D — every practice number goes on the test allowlist, so the
  // founder can sign in as any of them with the fixed code instead of waiting for
  // an SMS to a handset that does not exist. Real numbers are untouched by this:
  // membership of this table is the only route to a fixed code.
  const allowlist = new Set();
  const registerTestNumber = async (phone, note) => {
    // NEVER allow-list a number that is somebody's real login. The allowlist is per
    // NUMBER, not per account — so adding the founder's number here would hand the
    // fixed code to his SUPERADMIN account too, re-opening the exact hole this stage
    // just closed. A real number keeps getting real codes for every role it holds.
    const { rows: [real] } = await c.query(
      `SELECT 1 AS hit FROM users WHERE phone = $1 AND role = 'admin' LIMIT 1`, [phone]
    );
    if (real) {
      log(`${phone} holds an admin account — NOT allow-listed, real codes kept`);
      return;
    }
    await c.query(
      `INSERT INTO test_phone_numbers (phone, note) VALUES ($1,$2)
        ON CONFLICT (phone) DO UPDATE SET note = EXCLUDED.note`,
      [phone, note]
    );
    allowlist.add(phone);
  };

  await c.query('BEGIN');
  try {
    // ── Brands ───────────────────────────────────────────────────────────────
    // status stays 'pending'. Brand discovery and the follower store both require
    // approved, so a practice brand cannot surface. This is the app's own filter,
    // not a new one.
    const brandIds = {};
    for (const [i, b] of BRANDS.entries()) {
      const phone = b.login ? brandLoginPhone : `${SCENERY_PREFIX}${String(90 + i).padStart(2, '0')}`;
      const { rows: [u] } = await c.query(
        `INSERT INTO users (phone, role, name, status, city, state)
         VALUES ($1,'brand',$2,'pending',$3,$4) RETURNING id`,
        [phone, b.name, b.city, b.state]
      );
      await registerTestNumber(phone, `practice brand — ${b.name}`);
      const { rows: [br] } = await c.query(
        `INSERT INTO brands (user_id, business_name, category, accepts_proposals)
         VALUES ($1,$2,$3,false) RETURNING id`,
        [u.id, b.name, b.category]
      );
      brandIds[b.key] = br.id;
      M.users.push(u.id); M.brands.push(br.id);

      for (const [name, price, cat] of (PRODUCTS[b.key] || [])) {
        // is_active false AND pushed_to_store false — two independent reasons a
        // store query will never return these.
        const { rows: [p] } = await c.query(
          `INSERT INTO brand_products (brand_id, name, price, category_key, super_category,
                                       is_active, pushed_to_store, stock)
           VALUES ($1,$2,$3,$4,$5,false,false,10) RETURNING id`,
          [br.id, name, price, cat, b.category]
        );
        M.products.push(p.id);
      }
    }
    log(`brands: ${BRANDS.length} (all pending, products inactive and unpushed)`);

    // ── Creators ─────────────────────────────────────────────────────────────
    // These ARE approved — a creator must be approved to appear in brand search,
    // and brand search is exactly what Stage 1 needs to exercise. An approved
    // creator is not visible to a follower; only her published posts would be,
    // and none of these have any.
    const infIds = {};
    for (const [i, cr] of CREATORS.entries()) {
      const phone = cr.login ? creatorLoginPhone : `${SCENERY_PREFIX}${String(i + 10).padStart(2, '0')}`;
      const { rows: [u] } = await c.query(
        `INSERT INTO users (phone, role, name, status, city, state)
         VALUES ($1,'influencer',$2,'approved',$3,$4) RETURNING id`,
        [phone, cr.name, cr.city, cr.state]
      );
      await registerTestNumber(phone, `practice creator — ${cr.name}`);
      const { rows: [inf] } = await c.query(
        `INSERT INTO influencers (user_id, instagram_handle, full_name, followers_count,
                                  engagement_rate, niche, city, state, tier, gender,
                                  accepts_brand_requests, include_in_broadcasts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'female',$10,$11) RETURNING id`,
        [u.id, cr.handle, cr.name, cr.followers, cr.er, [cr.niche], cr.city, cr.state,
         cr.followers > 100000 ? 'macro' : cr.followers > 10000 ? 'micro' : 'nano',
         !cr.muted, !cr.noBulk]
      );
      infIds[cr.key] = inf.id;
      M.users.push(u.id); M.influencers.push(inf.id);
    }
    log(`creators: ${CREATORS.length} (1 muted, 1 opted out of bulk — so the reach funnel has something to report)`);

    // ── Groups ───────────────────────────────────────────────────────────────
    const groupSpec = [
      ['AP fashion', ['asha', 'meera', 'divya', 'karthik', 'priya', 'lakshmi']],
      ['Worked with us before', ['asha', 'nisha', 'ravi']],
    ];
    for (const [name, members] of groupSpec) {
      const { rows: [g] } = await c.query(
        `INSERT INTO influencer_groups (brand_id, name) VALUES ($1,$2) RETURNING id`,
        [brandIds.kanchi, name]
      );
      for (const k of members) {
        await c.query(
          `INSERT INTO influencer_group_members (group_id, influencer_id) VALUES ($1,$2)`,
          [g.id, infIds[k]]
        );
      }
      M.groups.push(g.id);
    }
    log(`groups: 2 (6 and 3 members)`);

    // ── Requests, at every state the inbox has to render ──────────────────────
    const terms = (pct, postBy, mode = 'visit') => ({
      aim: 'conversion', mode, time: { post_by: postBy },
      money: { commission_pct: pct }, importance: { mode: 'preference' },
    });
    const reqSpec = [
      ['meera',   'sent',      15, null],
      ['divya',   'viewed',    15, null],
      ['karthik', 'countered', 15, { money: { commission_pct: 22 } }],
      ['priya',   'countered', 18, { money: { commission_pct: 20 } }],
      ['lakshmi', 'declined',  12, null],
    ];
    for (const [k, status, pct, counter] of reqSpec) {
      const { rows: [r] } = await c.query(
        `INSERT INTO brand_collab_requests
           (brand_id, influencer_id, terms_json, message, status, origin,
            counter_terms_json, counter_by, creator_rounds_used, expires_at, viewed_at)
         VALUES ($1,$2,$3,$4,$5,'direct',$6,$7,$8, now() + interval '5 days', $9)
         RETURNING id`,
        [brandIds.kanchi, infIds[k], JSON.stringify(terms(pct, '2026-09-24')),
         'We would love to work with you on the festive range.', status,
         counter ? JSON.stringify(counter) : null, counter ? 'creator' : null,
         counter ? 1 : 0, status === 'sent' ? null : new Date()]
      );
      M.requests.push(r.id);
    }
    log(`requests: ${reqSpec.length} (sent · viewed · 2 countered · declined)`);

    // ── Agreements, including one about to lapse ─────────────────────────────
    const agSpec = [
      ['asha',  18, 88], ['meera', 15, 86], ['divya', 20, 9],
      ['nisha', 16, 74], ['ravi',  18, 61], ['sneha', 22, 45],
    ];
    const agIds = {};
    for (const [k, pct, daysLeft] of agSpec) {
      // Every agreement must carry exactly one source — the schema enforces it
      // (agreement_has_exactly_one_source). That is correct: an agreement is the
      // settled end of a conversation, so a settled conversation has to exist. We
      // create the request that produced it, marked agreed, which also gives the
      // diary and the "how you got here" screen something real to walk back through.
      const { rows: [srcReq] } = await c.query(
        `INSERT INTO brand_collab_requests
           (brand_id, influencer_id, terms_json, message, status, origin,
            expires_at, viewed_at, responded_at)
         VALUES ($1,$2,$3,$4,'agreed','direct', ${day(daysLeft)}, now() - interval '9 days',
                 now() - interval '8 days')
         RETURNING id`,
        [brandIds.kanchi, infIds[k], JSON.stringify(terms(pct, '2026-09-28')),
         'Festive range — would love to have you on this.']
      );
      M.requests.push(srcReq.id);

      const { rows: [a] } = await c.query(
        `INSERT INTO collab_agreements (brand_id, influencer_id, terms_json, status,
                                        source_request_id, expires_at)
         VALUES ($1,$2,$3,'ready',$4, ${day(daysLeft)}) RETURNING id`,
        [brandIds.kanchi, infIds[k], JSON.stringify(terms(pct, '2026-09-28')), srcReq.id]
      );
      agIds[k] = a.id; M.agreements.push(a.id);
    }
    log(`agreements: ${agSpec.length} (one expiring in 9 days, so the warning has something to warn about)`);

    // ── Two campaigns, and creators at different steps ───────────────────────
    const { rows: [camp] } = await c.query(
      `INSERT INTO campaigns (brand_id, name, status, start_date)
       VALUES ($1,'Festive Season 2026 (practice)','active', now()) RETURNING id`,
      [brandIds.kanchi]
    );
    const { rows: [camp2] } = await c.query(
      `INSERT INTO campaigns (brand_id, name, status, start_date)
       VALUES ($1,'Monsoon Cottons (practice)','active', now()) RETURNING id`,
      [brandIds.kanchi]
    );
    M.campaigns.push(camp.id, camp2.id);

    const { rows: [setA] } = await c.query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode)
       VALUES ($1,'Sarees','conversion','handpick') RETURNING id`, [camp.id]);
    const { rows: [setB] } = await c.query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode)
       VALUES ($1,'Reels','engagement','handpick') RETURNING id`, [camp.id]);
    const { rows: [setC] } = await c.query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode)
       VALUES ($1,'Cottons','conversion','handpick') RETURNING id`, [camp2.id]);

    // Each row lands the creator on a different step, so the six-step spine has
    // something at every position the moment its screens land.
    const ciSpec = [
      { set: setA.id, k: 'asha',  status: 'active',    pct: 18, contract: 'active', shoot: 'shipped'   }, // step 3, parcel flagged
      { set: setA.id, k: 'meera', status: 'active',    pct: 15, contract: 'active', shoot: 'completed' }, // step 4
      { set: setB.id, k: 'nisha', status: 'active',    pct: 0,  contract: 'active', shoot: 'completed', fee: 30000, deliverable: 'submitted' }, // step 5
      { set: setB.id, k: 'ravi',  status: 'contracted',pct: 0,  contract: 'pending_brand', fee: 25000 }, // step 2
      { set: setC.id, k: 'divya', status: 'invited',   pct: 20 },                                        // step 2, invite waiting
      { set: setC.id, k: 'sneha', status: 'completed', pct: 22, contract: 'active', shoot: 'completed' }, // step 6
    ];
    const ciIds = {};
    for (const s of ciSpec) {
      const { rows: [ci] } = await c.query(
        `INSERT INTO campaign_influencers (set_id, influencer_id, status, commission_pct,
                                           agreed_fee, agreement_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [s.set, infIds[s.k], s.status, s.pct || null, s.fee || null, agIds[s.k] || null]
      );
      ciIds[s.k] = ci.id;

      if (s.contract) {
        const { rows: [con] } = await c.query(
          `INSERT INTO contracts (campaign_influencer_id, status, influencer_fee,
                                  brand_name, influencer_name, campaign_name, posting_date)
           VALUES ($1,$2,$3,'Kanchi Silks (practice)',$4,'Festive Season 2026 (practice)', now() + interval '20 days')
           RETURNING id`,
          [ci.id, s.contract, s.fee || 0, CREATORS.find(x => x.key === s.k).name]
        );
        if (s.shoot === 'completed') {
          await c.query(
            `INSERT INTO production_events (contract_id, mode, status, visit_completed_at)
             VALUES ($1,'visit','completed', now() - interval '4 days')`, [con.id]);
        } else if (s.shoot === 'shipped') {
          await c.query(
            `INSERT INTO production_events (contract_id, mode, status, shipment_courier,
                                            shipment_awb, shipment_dispatched_at, shipment_delivered_at)
             VALUES ($1,'shipment','confirmed','Delhivery','DL8829174C',
                     now() - interval '6 days', now() - interval '3 days')`, [con.id]);
        }
      }
      if (s.deliverable) {
        await c.query(
          `INSERT INTO deliverables (campaign_influencer_id, type, quantity, status, submitted_at)
           VALUES ($1,'reel',1,$2, now() - interval '2 days')`, [ci.id, s.deliverable]);
      }
    }
    log(`campaigns: 2, sets: 3, creators placed at steps 2 · 3 · 4 · 5 · 6`);

    // ── Posts, in the three states the review flow produces ──────────────────
    // Never 'approved' — an approved post is a live post, and a live post is
    // visible to real followers.
    // A post must hang off exactly one concept or collection (creator_posts_check),
    // so the practice creator gets a concept to hang them on.
    const { rows: [tpl] } = await c.query(
      `SELECT id FROM concept_templates ORDER BY created_at LIMIT 1`);
    let conceptId = null;
    if (tpl) {
      const { rows: [con] } = await c.query(
        `INSERT INTO concepts (template_id) VALUES ($1) RETURNING id`, [tpl.id]);
      conceptId = con.id;
      M.concepts = [con.id];
    }

    // status is one of draft | submitted | approved | rejected. Deliberately never
    // 'approved' — approved means live, and live means a real follower could see it.
    const postSpec = [
      ['asha',  'submitted', 'Three ways to drape a Kanjivaram for the festive season'],
      ['asha',  'rejected',  'Draped three ways — the shaky one'],
      ['meera', 'submitted', 'Cotton handloom, everyday edit'],
    ];
    let postCount = 0;
    if (conceptId) {
      for (const [k, status, caption] of postSpec) {
        const { rows: [p] } = await c.query(
          `INSERT INTO creator_posts (influencer_id, scope, post_type, media_kind, caption,
                                      status, reject_reason, concept_id)
           VALUES ($1,'single','lifestyle','image',$2,$3,$4,$5) RETURNING id`,
          [infIds[k], caption, status,
           status === 'rejected' ? 'Video unusable — shake or motion' : null, conceptId]
        );
        M.posts.push(p.id);
        postCount++;
      }
    }
    log(`posts: ${postCount} (${postCount ? '2 with the review team, 1 sent back' : 'skipped — no concept template exists here'}; none approved, so none can go live)`);

    // ── Sales, stamped so the money screens have arithmetic to do ────────────
    // This is the gap that makes Stage 10 untestable today: production has 6
    // transactions and NOT ONE carries a creator, a campaign or a post.
    const salesFor = [
      { k: 'asha',  set: setA.id, camp: camp.id, pct: 18, amounts: [18500, 18500, 24000, 12400, 4200, 4200, 9800, 15000] },
      { k: 'meera', set: setA.id, camp: camp.id, pct: 15, amounts: [3600, 6900, 5100, 4200, 12400] },
      { k: 'sneha', set: setC.id, camp: camp2.id, pct: 22, amounts: [8400, 15000, 3600] },
    ];
    // A dedicated practice shopper, so practice sales never attach themselves to a
    // real follower's account — including the founder's own.
    const { rows: [fu] } = await c.query(
      `INSERT INTO users (phone, role, name, status, city, state)
       VALUES ($1,'follower','Practice Shopper','approved','Vijayawada','Andhra Pradesh')
       RETURNING id`,
      [`${SCENERY_PREFIX}99`]
    );
    const { rows: [fr] } = await c.query(
      `INSERT INTO followers (user_id, city) VALUES ($1,'Vijayawada') RETURNING id`, [fu.id]);
    M.users.push(fu.id);
    const someFollower = fr.id;

    let txCount = 0;
    for (const s of salesFor) {
      for (const [i, gross] of s.amounts.entries()) {
        const commission = Math.round(gross * s.pct) / 100;
        // Roughly two thirds settled, the rest still inside the 30-day window, so
        // "confirmed vs pending" is a real split rather than a label.
        const confirmed = i % 3 !== 0;
        const { rows: [t] } = await c.query(
          `INSERT INTO follower_transactions
             (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id,
              transaction_type, gross_amount, net_amount, influencer_commission,
              status, created_at, return_window_ends_at, commission_confirmed_at)
           VALUES ($1,$2,$3,$4,$5,'online_order',$6,$6,$7,'completed',
                   now() - interval '${40 - i * 3} days',
                   now() - interval '${10 - i * 3} days',
                   ${confirmed ? `now() - interval '${9 - i * 3} days'` : 'NULL'})
           RETURNING id`,
          [someFollower, brandIds.kanchi, s.camp, s.set, ciIds[s.k], gross, commission]
        );
        M.transactions.push(t.id);
        txCount++;
      }
    }
    log(`sales: ${txCount}, every one stamped with creator + campaign + set`);

    M.test_numbers = [...allowlist];
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('\n[practice] FAILED — nothing was written. Rolled back.');
    console.error(e.message);
    await c.end();
    process.exit(1);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(M, null, 2) + '\n');
  log(`manifest written → ${path.basename(MANIFEST)}`);
  log('done. Remove it all with: node scripts/remove-practice-world.js --env=' + ENV);
  await c.end();
}

main();
