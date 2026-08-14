import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: the follower app starts remembering what happened.
 * Contracts: features/follower-event-log (slice 0),
 *            features/follower-profile-repairs (slice 1).
 *
 * Slice 0 exists because three committed features are unbuildable without a
 * behaviour log: per-post sales for own-store creators, the 4-signal feed
 * ranker, and every stats surface. The failure mode that matters here is not a
 * crash — it is SILENCE. Recording that quietly drops events looks exactly like
 * recording that works, and the damage (months of history that can never be
 * recovered) only becomes visible when someone finally asks for the numbers.
 *
 * So these tests target the ways this can fail silently:
 *   · a vocabulary that drifts from the CHECK constraint — validation passes,
 *     the INSERT explodes, the client discards the batch and nobody notices
 *   · a field whitelist that silently drops post_id on the way to the database
 *   · Express route order that turns /posts/saved into /posts/:id
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const BACKEND = path.join(__dirname, '../../backend');
const src = (rel: string) => fs.readFileSync(path.join(BACKEND, 'src', rel), 'utf8');
const migration = (name: string) => fs.readFileSync(path.join(BACKEND, 'migrations', name), 'utf8');

// The real service — not a copy, not a mock.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const postEvents = require(path.join(BACKEND, 'src/services/postEvents.service.js'));

const POST = '11111111-1111-4111-8111-111111111111';
const ev = (over: Record<string, unknown> = {}) =>
  ({ post_id: POST, event_type: 'impression', surface: 'posts_tab', ...over });

test.describe('WORKFLOW: a valid batch is accepted and a malformed one is refused whole', () => {
  test('a well-formed batch validates and normalises', () => {
    const out = postEvents.validateBatch({
      device_id: 'device-abc', session_id: 'sess-1',
      events: [ev({ position: 3 }), ev({ event_type: 'view', dwell_ms: 12000.6 })],
    });
    expect(out.deviceId).toBe('device-abc');
    expect(out.events).toHaveLength(2);
    expect(out.events[0].position).toBe(3);
    // dwell is rounded to whole ms — the column is an integer
    expect(out.events[1].dwell_ms).toBe(12001);
    // meta always present so the INSERT never sees undefined
    expect(out.events[0].meta).toEqual({});
  });

  test('an unknown event_type is refused loudly rather than dropped', () => {
    // The dangerous alternative is skipping the bad event and accepting the
    // rest: the client then believes it logged something it never logged.
    let err: any = null;
    try { postEvents.validateBatch({ device_id: 'd', events: [ev({ event_type: 'scrolled' })] }); }
    catch (e) { err = e; }
    expect(err).not.toBeNull();
    expect(err.field).toBe('event_type');
  });

  test('an unknown surface is refused', () => {
    let err: any = null;
    try { postEvents.validateBatch({ device_id: 'd', events: [ev({ surface: 'nowhere' })] }); }
    catch (e) { err = e; }
    expect(err?.field).toBe('surface');
  });

  test('one bad event poisons the whole batch — no partial writes', () => {
    let err: any = null;
    try {
      postEvents.validateBatch({
        device_id: 'd',
        events: [ev(), ev({ event_type: 'nonsense' }), ev()],
      });
    } catch (e) { err = e; }
    expect(err).not.toBeNull();
    expect(err.field).toBe('event_type');
  });

  test('device_id is mandatory — it is the guest identity', () => {
    let err: any = null;
    try { postEvents.validateBatch({ events: [ev()] }); } catch (e) { err = e; }
    expect(err?.field).toBe('device_id');
  });

  test('the batch cap is enforced by the server, not trusted from the client', () => {
    const over = Array.from({ length: postEvents.MAX_BATCH + 1 }, () => ev());
    let err: any = null;
    try { postEvents.validateBatch({ device_id: 'd', events: over }); } catch (e) { err = e; }
    expect(err?.field).toBe('events');

    // exactly at the cap is fine — an off-by-one here would drop real batches
    const atCap = Array.from({ length: postEvents.MAX_BATCH }, () => ev());
    expect(postEvents.validateBatch({ device_id: 'd', events: atCap }).events).toHaveLength(postEvents.MAX_BATCH);
  });

  test('malformed ids and negative dwell are refused', () => {
    const fails = (body: any) => {
      try { postEvents.validateBatch(body); return null; } catch (e: any) { return e.field; }
    };
    expect(fails({ device_id: 'd', events: [ev({ post_id: 'not-a-uuid' })] })).toBe('post_id');
    expect(fails({ device_id: 'd', events: [ev({ product_id: 'nope' })] })).toBe('product_id');
    expect(fails({ device_id: 'd', events: [ev({ dwell_ms: -1 })] })).toBe('dwell_ms');
    expect(fails({ device_id: 'd', events: [ev({ position: -1 })] })).toBe('position');
    expect(fails({ device_id: 'd', events: [] })).toBe('events');
  });
});

test.describe('WORKFLOW: the vocabulary the service accepts is the vocabulary the database allows', () => {
  // If these two lists drift, validation says yes and the INSERT says no. The
  // client fires and forgets, so the batch vanishes with no error anywhere.
  const sql: string = migration('150_post_event_log.sql');

  const checkList = (column: string): string[] => {
    const m = sql.match(new RegExp(`${column}\\s+text NOT NULL CHECK \\(${column} IN \\(([^)]*)\\)`, 's'));
    if (!m) throw new Error(`no CHECK constraint found for ${column} in migration 150`);
    return (m[1].match(/'([a-z_]+)'/g) || []).map(s => s.replace(/'/g, ''));
  };

  test('every event_type the service accepts is permitted by the CHECK constraint', () => {
    expect([...postEvents.EVENT_TYPES].sort()).toEqual(checkList('event_type').sort());
  });

  test('every surface the service accepts is permitted by the CHECK constraint', () => {
    expect([...postEvents.SURFACES].sort()).toEqual(checkList('surface').sort());
  });

  test('guests can be logged — follower_id is nullable, device_id is not', () => {
    expect(sql).toMatch(/follower_id uuid REFERENCES followers\(id\)/);
    expect(sql).not.toMatch(/follower_id uuid NOT NULL/);
    expect(sql).toMatch(/device_id\s+text NOT NULL/);
  });

  test('the post→sale link exists and cannot take the money row down with it', () => {
    // ON DELETE SET NULL, not CASCADE: deleting a post must never delete a sale.
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS via_post_id uuid REFERENCES creator_posts\(id\) ON DELETE SET NULL/);
  });
});

test.describe('WORKFLOW: post_id survives every whitelist between the tap and the database', () => {
  // The trap this guards: follower_orders.items_json is built by an EXPLICIT
  // field map. A post_id sent by the app that is not named in that map is
  // silently discarded — the feature ships, the tests pass, and the column
  // stays empty forever.
  const tx: string = src('controllers/transaction.controller.js');

  test('the sanitiser carries post_id off the request', () => {
    expect(tx).toMatch(/post_id:\s*safePostId\(i\.post_id\)/);
  });

  test('the items_json snapshot carries post_id into the order', () => {
    expect(tx).toMatch(/post_id:\s*i\.post_id \|\| null/);
  });

  test('the transaction row is written with via_post_id', () => {
    expect(tx).toMatch(/via_post_id\)/);
    expect(tx).toMatch(/primaryPostId \|\| null/);
  });

  test('a stale post id cannot fail a checkout', () => {
    // Existence is confirmed before the value reaches an FK column: a post
    // deleted mid-checkout must leave the order unlinked, never rejected.
    expect(tx).toMatch(/SELECT id FROM creator_posts WHERE id = \$1/);
  });
});

test.describe('WORKFLOW: saved posts are reachable — route order edition', () => {
  // '/posts/saved' registered after '/posts/:id' is matched as id='saved'. The
  // endpoint would 404 (or worse, 500) with nothing obviously wrong in the code.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const router = require(path.join(BACKEND, 'src/routes/follower.routes.js'));

  const paths: string[] = router.stack
    .filter((l: any) => l.route)
    .map((l: any) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);

  test('GET /posts/saved is registered before GET /posts/:id', () => {
    const saved = paths.indexOf('GET /posts/saved');
    const detail = paths.indexOf('GET /posts/:id');
    expect(saved, 'GET /posts/saved must be registered').toBeGreaterThan(-1);
    expect(detail, 'GET /posts/:id must be registered').toBeGreaterThan(-1);
    expect(saved).toBeLessThan(detail);
  });

  test('the slice-1 repair routes exist at all', () => {
    expect(paths).toContain('PATCH /me');
    expect(paths).toContain('DELETE /addresses/:id');
    expect(paths).toContain('POST /events');
  });
});

test.describe('WORKFLOW: deleting an address does not rewrite where a parcel went', () => {
  const controller: string = src('controllers/follower.controller.js');
  const sql: string = migration('151_follower_address_soft_delete.sql');

  test('the delete is soft', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS deleted_at timestamptz/);
    expect(controller).toMatch(/UPDATE follower_addresses SET deleted_at = now\(\)/);
    // A hard delete would either fail on follower_orders.address_id or destroy
    // a past order's shipping address.
    expect(controller).not.toMatch(/DELETE FROM follower_addresses/);
  });

  test('every address read path hides deleted rows', () => {
    // Three read paths: getMe, listAddresses, updateAddress. If any one forgets
    // the filter, a deleted address reappears at checkout.
    const reads = controller.match(/FROM follower_addresses[\s\S]{0,160}?WHERE[\s\S]{0,160}?(?=\n\s*(\[|`))/g) || [];
    expect(reads.length).toBeGreaterThanOrEqual(3);
    for (const r of reads) expect(r).toMatch(/deleted_at IS NULL/);
  });

  test('the follower is never left pointing at a deleted default', () => {
    expect(controller).toMatch(/UPDATE followers SET default_address_id = \$1 WHERE id = \$2/);
  });
});

test.describe('WORKFLOW: a follower can finally correct their own name', () => {
  const controller: string = src('controllers/follower.controller.js');

  test('name and email are edited on users, where they actually live', () => {
    // followers holds only id / user_id / default_address_id.
    expect(controller).toMatch(/UPDATE users SET[\s\S]{0,200}name\s+= COALESCE/);
  });

  test('a duplicate email is a field error, never a 500', () => {
    expect(controller).toMatch(/e\.code === '23505'/);
    expect(controller).toMatch(/That email is already in use/);
  });

  test('phone is never editable — it is the login identity', () => {
    const fn = controller.slice(controller.indexOf('const updateMe'), controller.indexOf('const updateMe') + 2600);
    expect(fn).not.toMatch(/SET[\s\S]{0,200}phone\s*=/);
  });
});
