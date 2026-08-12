import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: W3, W4, W6, W8, W9, W11, W12, W14 — the handshake service rules.
 * Contract: features/collab-part2-precampaign-handshake.
 *
 * db.query is intercepted per test, so these assert the RULES and the SQL the service
 * builds, without needing a database. The highest-value targets:
 *
 *  · every limit is read from handshake_settings, never a constant (founder's call)
 *  · a creator's mute and their own bar are honoured, and the brand is TOLD why
 *  · counter rounds are capped per side and a counter answers the LATEST terms
 *  · acceptance creates an AGREEMENT and NOT a campaign — the biggest behaviour change
 *    in the contract, and the thing most likely to be quietly re-broken later
 *  · a broadcast reports reached-vs-matched rather than letting a brand assume
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../../backend/src/config/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const settings = require('../../backend/src/services/handshakeSettings.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const H = require('../../backend/src/services/handshake.service');

const SALES_TERMS = { aim: 'conversion', money: { commission_pct: 12 }, time: { post_by: '2026-09-15' } };

type Handler = (sql: string, params: any[]) => any;

/** Route each query by a fragment of its SQL; anything unmatched returns no rows. */
function stub(routes: Array<[string, any]>, onCall?: (sql: string, p: any[]) => void) {
  const original = db.query;
  const calls: Array<{ sql: string; params: any[] }> = [];
  db.query = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    if (onCall) onCall(sql, params);
    for (const [frag, rows] of routes) {
      if (sql.includes(frag)) return { rows: typeof rows === 'function' ? (rows as Handler)(sql, params) : rows };
    }
    return { rows: [] };
  };
  return { calls, restore: () => { db.query = original; } };
}

const APPROVED_CREATOR = [{
  id: 'INF1', accepts_brand_requests: true, min_commission_pct: null,
  min_fee: null, accepted_aims: null, user_status: 'approved',
}];
const NO_COUNTS = [{ active: 0, today: 0, this_week: 0 }];

test.beforeEach(() => settings.invalidate());

test.describe('WORKFLOW: limits come from settings, not constants (W4)', () => {
  test('H1 — a brand over its active cap is refused, with the limit named', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1, brand_max_active: 3 }]],
      ['FROM influencers i JOIN users u', APPROVED_CREATOR],
      ['brand_collab_requests WHERE brand_id', [{ active: 3, today: 0, this_week: 0 }]],
    ]);
    try {
      const r = await H.brandRequestEligibility('B1', 'INF1', SALES_TERMS);
      expect(r.eligible).toBe(false);
      expect(r.reason).toContain('3 open requests');
    } finally { s.restore(); }
  });

  test('H2 — an admin raising the cap takes effect without a deploy', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1, brand_max_active: 99 }]],
      ['FROM influencers i JOIN users u', APPROVED_CREATOR],
      ['brand_collab_requests WHERE brand_id', [{ active: 3, today: 0, this_week: 0 }]],
    ]);
    try {
      expect((await H.brandRequestEligibility('B1', 'INF1', SALES_TERMS)).eligible).toBe(true);
    } finally { s.restore(); }
  });

  test('H3 — a missing settings row falls back to today\'s values rather than failing', async () => {
    // A settings table that can take the feature down would be worse than a hardcoded one.
    const s = stub([['handshake_settings', () => { throw new Error('relation does not exist'); }]]);
    try {
      const cfg = await settings.get({ fresh: true });
      expect(cfg.creator_max_active).toBe(settings.DEFAULTS.creator_max_active);
      expect(cfg.brand_max_active).toBe(settings.DEFAULTS.brand_max_active);
    } finally { s.restore(); }
  });
});

test.describe('WORKFLOW: the creator\'s own controls (W11, W12)', () => {
  test('H4 — a muted creator cannot be reached, and the brand is told', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1 }]],
      ['FROM influencers i JOIN users u', [{ ...APPROVED_CREATOR[0], accepts_brand_requests: false }]],
    ]);
    try {
      const r = await H.brandRequestEligibility('B1', 'INF1', SALES_TERMS);
      expect(r.eligible).toBe(false);
      expect(r.reason).toContain('not accepting collaboration requests');
    } finally { s.restore(); }
  });

  test('H5 — a request below the creator\'s minimum commission is refused', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1 }]],
      ['FROM influencers i JOIN users u', [{ ...APPROVED_CREATOR[0], min_commission_pct: 15 }]],
    ]);
    try {
      const r = await H.brandRequestEligibility('B1', 'INF1', SALES_TERMS);   // offers 12%
      expect(r.eligible).toBe(false);
      expect(r.reason).toContain('minimum commission is 15%');
      expect(r.field).toBe('terms.money.commission_pct');
    } finally { s.restore(); }
  });

  test('H6 — a creator who does not take this aim is not asked', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1 }]],
      ['FROM influencers i JOIN users u', [{ ...APPROVED_CREATOR[0], accepted_aims: ['engagement'] }]],
    ]);
    try {
      const r = await H.brandRequestEligibility('B1', 'INF1', SALES_TERMS);
      expect(r.eligible).toBe(false);
      expect(r.field).toBe('terms.aim');
    } finally { s.restore(); }
  });
});

test.describe('WORKFLOW: one conversation at a time', () => {
  test('H7 — an open request blocks a second one', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1 }]],
      ['FROM influencers i JOIN users u', APPROVED_CREATOR],
      ['SELECT 1 FROM brand_collab_requests', [{ '1': 1 }]],
    ]);
    try {
      const r = await H.brandRequestEligibility('B1', 'INF1', SALES_TERMS);
      expect(r.eligible).toBe(false);
      expect(r.reason).toContain('already have an open request');
    } finally { s.restore(); }
  });

  test('H8 — an existing agreement says brief them instead', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1 }]],
      ['FROM influencers i JOIN users u', APPROVED_CREATOR],
      ['FROM collab_agreements', [{ '1': 1 }]],
    ]);
    try {
      const r = await H.brandRequestEligibility('B1', 'INF1', SALES_TERMS);
      expect(r.eligible).toBe(false);
      expect(r.reason).toContain('brief them into a campaign');
    } finally { s.restore(); }
  });

  test('H9 — a cooldown after a decline blocks re-asking (W9)', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1 }]],
      ['FROM influencers i JOIN users u', APPROVED_CREATOR],
      ['brand_request_cooldowns', [{ cooldown_until: '2099-01-01T00:00:00Z' }]],
    ]);
    try {
      const r = await H.brandRequestEligibility('B1', 'INF1', SALES_TERMS);
      expect(r.eligible).toBe(false);
      expect(r.reason).toContain('declined recently');
    } finally { s.restore(); }
  });
});

test.describe('WORKFLOW: invalid terms are refused before limits are consulted', () => {
  test('H10 — a malformed payload fails on the terms, not on a quota', async () => {
    // Otherwise a brand is told "you are over your limit" about a request that was
    // never valid — a confusing and wrong explanation.
    const s = stub([['handshake_settings', [{ id: 1 }]]]);
    try {
      await expect(H.createBrandRequest({
        brandId: 'B1', influencerId: 'INF1',
        termsJson: { aim: 'conversion', money: { commission_pct: 12 } },     // no time
      })).rejects.toThrow(/time is required/);
    } finally { s.restore(); }
  });
});

test.describe('WORKFLOW: counter rounds (W6, W8)', () => {
  test('H11 — a side that used both rounds cannot counter again', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1, counter_rounds_per_side: 2 }]],
      ['FROM brand_collab_requests WHERE id', [{
        id: 'R1', status: 'countered', terms_json: SALES_TERMS,
        counter_terms_json: null, brand_rounds_used: 0, creator_rounds_used: 2,
      }]],
    ]);
    try {
      await expect(H.counterRequest({
        requestId: 'R1', side: 'creator', counterTerms: { money: { commission_pct: 18 } },
      })).rejects.toThrow(/used both of your 2 counters/);
    } finally { s.restore(); }
  });

  test('H12 — a counter answers the LATEST terms, not the opening offer', async () => {
    // Round two must respond to round one. Validating against the original would let a
    // second counter silently re-open something already conceded.
    let updateSql = '';
    const s = stub([
      ['handshake_settings', [{ id: 1, counter_rounds_per_side: 2 }]],
      ['FROM brand_collab_requests WHERE id', [{
        id: 'R1', status: 'countered',
        terms_json: { ...SALES_TERMS, mode: 'visit', importance: { mode: 'preference' } },
        counter_terms_json: { money: { commission_pct: 15 } },
        brand_rounds_used: 0, creator_rounds_used: 1,
      }]],
      ['UPDATE brand_collab_requests', [{ id: 'R1', status: 'countered' }]],
    ], (sql) => { if (sql.includes('UPDATE brand_collab_requests')) updateSql = sql; });
    try {
      const out = await H.counterRequest({
        requestId: 'R1', side: 'brand', counterTerms: { money: { commission_pct: 13 } },
      });
      expect(out.id).toBe('R1');
      expect(updateSql).toContain('brand_rounds_used = brand_rounds_used + 1');
    } finally { s.restore(); }
  });

  test('H13 — a requirement still cannot be countered here', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1, counter_rounds_per_side: 2 }]],
      ['FROM brand_collab_requests WHERE id', [{
        id: 'R1', status: 'sent',
        terms_json: { ...SALES_TERMS, scope: { level: 'category', category: 'Ethnic' }, importance: { scope: 'requirement' } },
        counter_terms_json: null, brand_rounds_used: 0, creator_rounds_used: 0,
      }]],
    ]);
    try {
      await expect(H.counterRequest({
        requestId: 'R1', side: 'creator', counterTerms: { scope: { level: 'store' } },
      })).rejects.toThrow(/cannot be countered/);
    } finally { s.restore(); }
  });
});

test.describe('WORKFLOW: acceptance produces an AGREEMENT, not a campaign (W14)', () => {
  test('H14 — no campaign, set, assignment or contract is created', async () => {
    // THE headline change. The old path fabricated all four because it had nowhere else
    // to put the result, which is why one-person dateless campaigns exist in production.
    const seen: string[] = [];
    const originalTx = db.withTransaction;
    const originalQ = db.query;
    db.query = async (sql: string) => {
      seen.push(sql);
      if (sql.includes('handshake_settings')) return { rows: [{ id: 1, agreement_expiry_days: 90 }] };
      return { rows: [] };
    };
    db.withTransaction = async (fn: any) => fn({
      query: async (sql: string) => {
        seen.push(sql);
        return { rows: [{ id: 'AGR1', status: 'ready' }] };
      },
    });
    try {
      const agr = await H.acceptIntoAgreement({
        source: 'request', sourceId: 'R1', brandId: 'B1', influencerId: 'INF1',
        settledTerms: SALES_TERMS,
      });
      expect(agr.id).toBe('AGR1');

      const all = seen.join(' ').toLowerCase();
      expect(all).toContain('insert into collab_agreements');
      expect(all).not.toContain('insert into campaigns');
      expect(all).not.toContain('insert into campaign_sets');
      expect(all).not.toContain('insert into campaign_influencers');
      expect(all).not.toContain('insert into contracts');
    } finally { db.query = originalQ; db.withTransaction = originalTx; }
  });

  test('H15 — an agreement records which record it came from', async () => {
    // The table has a CHECK that exactly one source is set. An agreement that loses
    // track of its origin is where a subtle bug would live.
    let insertParams: any[] = [];
    const originalTx = db.withTransaction;
    const originalQ = db.query;
    db.query = async () => ({ rows: [{ id: 1, agreement_expiry_days: 90 }] });
    db.withTransaction = async (fn: any) => fn({
      query: async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO collab_agreements')) insertParams = params;
        return { rows: [{ id: 'AGR1' }] };
      },
    });
    try {
      await H.acceptIntoAgreement({ source: 'proposal', sourceId: 'P9', brandId: 'B1', influencerId: 'INF1', settledTerms: SALES_TERMS });
      // [brand, influencer, terms, source_request_id, source_proposal_id, expires]
      expect(insertParams[3]).toBeNull();      // not a request
      expect(insertParams[4]).toBe('P9');      // it was a proposal
    } finally { db.query = originalQ; db.withTransaction = originalTx; }
  });

  test('H16 — invalid settled terms never become an agreement', async () => {
    const s = stub([['handshake_settings', [{ id: 1 }]]]);
    try {
      await expect(H.acceptIntoAgreement({
        source: 'request', sourceId: 'R1', brandId: 'B1', influencerId: 'INF1',
        settledTerms: { aim: 'conversion', money: { commission_pct: 12 }, time: {} },
      })).rejects.toThrow(/post-by date is required/);
    } finally { s.restore(); }
  });
});

test.describe('WORKFLOW: consuming an agreement', () => {
  test('H17 — briefing the same agreement twice is refused loudly', async () => {
    // Better a clear error than the same agreement quietly briefed into two campaigns.
    const s = stub([['UPDATE collab_agreements', []]]);   // no row matched status='ready'
    try {
      await expect(H.consumeAgreement({ agreementId: 'AGR1', campaignId: 'C1', ciId: 'CI1' }))
        .rejects.toThrow(/no longer available to brief/);
    } finally { s.restore(); }
  });
});

test.describe('WORKFLOW: broadcast reports the truth (W3)', () => {
  test('H18 — reached vs matched is reported, not assumed', async () => {
    const s = stub([
      ['handshake_settings', [{ id: 1, broadcast_max_recipients: 2 }]],
      ['count(*)::int AS n', [{ n: 34 }]],
      ['SELECT i.id, i.instagram_handle', [{ id: 'a' }, { id: 'b' }]],
    ]);
    try {
      const r = await H.previewBroadcast('B1', { tiers: ['micro'] });
      expect(r.matched).toBe(34);
      expect(r.reachable).toBe(2);
      expect(r.capped).toBe(true);
      expect(r.cap).toBe(2);
    } finally { s.restore(); }
  });

  test('H19 — muted and opted-out creators are excluded from a broadcast', async () => {
    let listSql = '';
    const s = stub([
      ['handshake_settings', [{ id: 1 }]],
      ['count(*)::int AS n', [{ n: 5 }]],
      ['SELECT i.id, i.instagram_handle', []],
    ], (sql) => { if (sql.includes('SELECT i.id, i.instagram_handle')) listSql = sql; });
    try {
      await H.previewBroadcast('B1', { tiers: ['micro'] });
      expect(listSql).toContain('i.accepts_brand_requests = true');
      expect(listSql).toContain('i.include_in_broadcasts  = true');
      expect(listSql).toContain('brand_request_cooldowns');
    } finally { s.restore(); }
  });

  test('H20 — secondary niche is matched, like the existing open-group matcher', async () => {
    let sql = '';
    const s = stub([
      ['handshake_settings', [{ id: 1 }]],
      ['count(*)::int AS n', [{ n: 1 }]],
      ['SELECT i.id, i.instagram_handle', []],
    ], (q) => { if (q.includes('count(*)::int AS n')) sql = q; });
    try {
      await H.previewBroadcast('B1', { niches: ['Ethnic'] });
      expect(sql).toContain('i.secondary_niche');
    } finally { s.restore(); }
  });
});
