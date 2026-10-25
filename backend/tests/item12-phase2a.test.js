'use strict';

/**
 * Item 12, Phase 2a — close the money door and the privacy holes.
 * Contract: features/item12-content · approval §3.1, Q2, Q3, Q13, Q14 · checks 1, 32, 34, 35, 42
 *
 * This suite runs BEFORE any content route exists. That is the approval's order: the ungated
 * legacy door that could release tranche 2 is shut, and the one gate every content path will
 * ask is proved as a matrix, before a single feature line of the new flow is written.
 */

const { query, api } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const w12 = require('./helpers/item12');
const { createAdminUser } = require('./helpers/factories');
const contentGate = require('../src/services/contentGate.service');
const { MSG } = require('../src/services/contentCopy');
const { MSG: MSG10 } = require('../src/services/productionCopy');
const { RETIRED } = require('../src/routes/deliverable.routes');

/** Run the gate and return its answer as a short string: 'open' or the error code. */
async function ask(w, scope, opts) {
  try {
    const g = await contentGate.assertContentOpen(w.ciId, scope, undefined, opts);
    return g.shootDone ? 'open' : 'open:shoot_not_done';
  } catch (e) {
    return `${e.statusCode}:${e.code}`;
  }
}

/* ──────────────────────────────────────────── 1. the gate matrix (check 1) */

describe('item 12 · the content gate — every case (check 1)', () => {
  it('Pay for Content, Store Visit: closed until the shoot is done, open after — for both parties', async () => {
    const w = await w10.signedByBoth('engagement');
    expect(await ask(w, w12.brandScope(w))).toBe(`422:SHOOT_NOT_DONE`);
    expect(await ask(w, w12.creatorScope(w))).toBe(`422:SHOOT_NOT_DONE`);
    await w12.markShootDone(w);
    expect(await ask(w, w12.brandScope(w))).toBe('open');
    expect(await ask(w, w12.creatorScope(w))).toBe('open');
  });

  it('Pay for Content, Remote: the same — item 11 writes the same two things', async () => {
    const w = await w10.signedByBoth('engagement', { mode: 'shipment' });
    expect(await ask(w, w12.creatorScope(w))).toBe(`422:SHOOT_NOT_DONE`);
    await w12.markShootDone(w);
    expect(await ask(w, w12.creatorScope(w))).toBe('open');
    expect(await ask(w, w12.brandScope(w))).toBe('open');
  });

  it('a brand-only legacy mark is NOT a done shoot — status alone decides, never stageOf', async () => {
    const w = await w10.signedByBoth('engagement');
    // The state the retired "Mark visit done" used to leave behind: one side's mark, status unchanged.
    await query(`UPDATE production_events SET brand_completed_at = now() WHERE id = $1`, [w.pe.id]);
    expect(await ask(w, w12.brandScope(w))).toBe(`422:SHOOT_NOT_DONE`);
  });

  // ASSERTION DRIFT, item 14 (rules v1.30 §12.1): a new-terms Pay for Sale collaboration now
  // reaches this step as its Path 2 (the social media post) — proved in item14-sale.test.js.
  // Hybrid stays refused until item 15. Pay for Content's own gate is unchanged.
  // ASSERTION DRIFT, item 15: Hybrid reaches it as Path 2 too (the Pay for Sale arm, with its money).
  it('Pay for Sale (item 14) and Hybrid (item 15) reach it as Path 2', async () => {
    const w = await w12.shotDone('hybrid');
    await expect(contentGate.assertContentOpen(w.ciId, w12.creatorScope(w))).resolves.toMatchObject({ aim: 'sale', hybrid: true });
    const sale = await w12.shotDone('conversion');
    await expect(contentGate.assertContentOpen(sale.ciId, w12.creatorScope(sale))).resolves.toMatchObject({ aim: 'sale' });
  });

  it('unsigned and unfunded are refused with item 10\'s own sentences', async () => {
    const w = await w12.shotDone('engagement');
    await query(`UPDATE escrow_entries SET status = 'locked', released_at = NULL WHERE campaign_influencer_id = $1 AND tranche_number = 1`, [w.ciId]);
    expect(await ask(w, w12.creatorScope(w))).toBe('422:NOT_FUNDED');
    await query(`UPDATE contracts SET brand_signed_at = NULL WHERE id = $1`, [w.con.id]);
    expect(await ask(w, w12.creatorScope(w))).toBe('422:NOT_SIGNED');
    await expect(contentGate.assertContentOpen(w.ciId, w12.creatorScope(w))).rejects.toMatchObject({ message: MSG10.NOT_SIGNED });
  });

  it('26 · another brand, another creator, and the owning brand through the wrong set are all 404', async () => {
    const w = await w12.shotDone('engagement');
    const other = await w12.shotDone('engagement');
    expect(await ask(w, w12.brandScope(other))).toBe('404:NOT_FOUND');
    expect(await ask(w, w12.creatorScope(other))).toBe('404:NOT_FOUND');
    expect(await ask(w, { ...w12.brandScope(w), setId: other.s.id })).toBe('404:NOT_FOUND');
    expect(await ask(w, { ...w12.brandScope(w), campaignId: other.c.id })).toBe('404:NOT_FOUND');
    // A stranger learns nothing — not even that the collaboration is unsigned.
    await query(`UPDATE contracts SET brand_signed_at = NULL WHERE id = $1`, [w.con.id]);
    expect(await ask(w, w12.creatorScope(other))).toBe('404:NOT_FOUND');
  });

  it('the read may draw "Shoot not done yet"; every write refuses', async () => {
    const w = await w10.signedByBoth('engagement');
    expect(await ask(w, w12.creatorScope(w), { allowShootNotDone: true })).toBe('open:shoot_not_done');
    expect(await ask(w, w12.creatorScope(w))).toBe('422:SHOOT_NOT_DONE');
  });

  it('42 · an agreement whose snapshot lists no content refuses the step with Q7\'s sentence', async () => {
    const w = await w12.shotDone('engagement');
    await query(`UPDATE contracts SET terms_json = jsonb_set(terms_json, '{work,deliverables}', '[]'::jsonb) WHERE id = $1`, [w.con.id]);
    await expect(contentGate.assertContentOpen(w.ciId, w12.creatorScope(w)))
      .rejects.toMatchObject({ code: 'NO_ROWS', message: 'This agreement lists no content. INFLX will sort it out.' });
    // …and never falls back to the live terms, which still name content.
    const { rows: [ci] } = await query(`SELECT formats_json FROM campaign_influencers WHERE id = $1`, [w.ciId]);
    expect(Array.isArray(ci.formats_json) && ci.formats_json.length).toBeTruthy();
  });

  it('the rows come from the SIGNED snapshot: type, count, platform, Story flag', async () => {
    const w = await w12.shotDone('engagement');   // item 10's CONTENT terms: reel × 1, story × 2
    const g = await contentGate.assertContentOpen(w.ciId, w12.creatorScope(w));
    expect(g.rows).toEqual([
      { key: 'reel', type: 'reel', count: 1, label: 'Instagram reel', platform: 'instagram', isStory: false },
      { key: 'story', type: 'story', count: 2, label: 'Instagram story', platform: 'instagram', isStory: true },
    ]);
    expect(g.shootDoneAt).toBeTruthy();
  });
});

/* ──────────────────────────────────────────── 2. the eight retired doors (check 32) */

describe('item 12 · the eight /deliverables doors refuse for every Aim (check 32)', () => {
  it('a loop over every route, one case per Aim, and not one rupee moves', async () => {
    expect(RETIRED).toHaveLength(8);
    for (const goal of ['engagement', 'conversion', 'hybrid']) {
      const w = await w12.shotDone(goal);
      const before = await w10.moneySnapshot(w);
      // A real legacy row to aim at — the contract birth writes them where the aim buys content.
      const { rows: [d] } = await query(
        `INSERT INTO deliverables (campaign_influencer_id, type, quantity, status, live_url)
         VALUES ($1, 'reel', 1, 'approved', 'https://instagram.com/reel/x') RETURNING id`, [w.ciId]);
      for (const [method, path, code, message] of RETIRED) {
        const p = `/deliverables${path.replace(':id', d.id)}`;
        for (const token of [w.b.token, w.cr.token]) {
          const r = method === 'get' ? await api.get(p, token) : await api.post(p, token, {});
          expect(`${goal} ${method} ${path} → ${r.status} ${r.body.error && r.body.error.code}`)
            .toBe(`${goal} ${method} ${path} → 422 ${code}`);
          expect(r.body.error.message).toBe(message);
        }
      }
      expect(await w10.moneySnapshot(w)).toBe(before);
      const { rows: [after] } = await query(`SELECT status FROM deliverables WHERE id = $1`, [d.id]);
      expect(after.status).toBe('approved');   // data kept, untouched
    }
  });

  it('confirm-live no longer releases tranche 2 — the finding, re-proved directly', async () => {
    const w = await w12.shotDone('engagement');
    await query(`UPDATE deliverables SET status = 'approved', live_url = 'https://instagram.com/p/x' WHERE campaign_influencer_id = $1`, [w.ciId]);
    const { rows } = await query(`SELECT id FROM deliverables WHERE campaign_influencer_id = $1`, [w.ciId]);
    for (const d of rows) {
      const r = await api.post(`/deliverables/${d.id}/confirm-live`, w.b.token, {});
      expect(r.body.error.code).toBe('RETIRED_12_CONFIRM_LIVE');
    }
    const t2 = (await w10.escrow(w.ciId)).find((e) => e.tranche_number === 2);
    expect(t2.status).toBe('locked');
  });

  // post-performance-v2 (P11, E25): the stats refresh went with deliverable_stats — the numbers now come
  // from the links she hands in at the content step. The door is gone, not retired with a sentence.
  it('the stats refresh is gone too (post-performance-v2): the route file no longer mounts it', () => {
    const src = require('fs').readFileSync(require.resolve('../src/routes/deliverable.routes.js'), 'utf8');
    expect(src).not.toMatch(/refresh-stats',/);
    expect(src).not.toMatch(/refreshDeliverableStats/);
  });
});

/* ──────────────────────────────────────────── 3. complete, Store Visit (approval Q3) */

describe('item 12 · POST /production-events/:id/complete is retired for a Store Visit too (Q3)', () => {
  it('both parties meet the sentence; the row is untouched', async () => {
    const w = await w10.signedByBoth('engagement');
    expect(w.pe.mode).toBe('visit');
    for (const token of [w.b.token, w.cr.token]) {
      const r = await api.post(`/production-events/${w.pe.id}/complete`, token, {});
      expect(r.status).toBe(422);
      expect(r.body.error).toMatchObject({ code: 'RETIRED_12_COMPLETE_VISIT', message: MSG.RETIRED_12_COMPLETE_VISIT });
    }
    const pe = await w10.pe(w.con.id);
    expect(pe.brand_completed_at).toBeNull();
    expect(pe.influencer_completed_at).toBeNull();
    expect(pe.status).toBe(w.pe.status);
  });

  it('Remote keeps item 11\'s own sentence', async () => {
    const w = await w10.signedByBoth('engagement', { mode: 'shipment' });
    const r = await api.post(`/production-events/${w.pe.id}/complete`, w.cr.token, {});
    expect(r.body.error.code).toBe('RETIRED_COMPLETE_REMOTE');
  });

  it('the gate still answers first — an unfunded collaboration hears NOT_FUNDED, not the retirement', async () => {
    const w = await w10.signedByBoth('engagement');
    await query(`UPDATE escrow_entries SET status = 'locked', released_at = NULL WHERE campaign_influencer_id = $1 AND tranche_number = 1`, [w.ciId]);
    const r = await api.post(`/production-events/${w.pe.id}/complete`, w.b.token, {});
    expect(r.body.error.code).toBe('NOT_FUNDED');
  });
});

/* ──────────────────────────────────────────── 4. the manual release (check 35) */

describe('item 12 · the manual admin release (check 35)', () => {
  const release = (admin, id, reason) => api.post(`/admin/escrow/${id}/release`, admin.token, reason === undefined ? {} : { override_reason: reason });

  it('refuses disputed and refunded rows, and moves nothing', async () => {
    const w = await w12.shotDone('engagement');
    const admin = await createAdminUser('superadmin');
    const t2 = (await w10.escrow(w.ciId)).find((e) => e.tranche_number === 2);
    for (const status of ['disputed', 'refunded']) {
      await query(`UPDATE escrow_entries SET status = $2 WHERE id = $1`, [t2.id, status]);
      const before = await w10.moneySnapshot(w);
      const r = await release(admin, t2.id, 'Dispute settled for the creator');
      expect(`${status} ${r.status} ${r.body.error && r.body.error.code}`).toBe(`${status} 422 RELEASE_NOT_ALLOWED`);
      expect(r.body.error.message).toBe(MSG.RELEASE_NOT_ALLOWED(status));
      expect(await w10.moneySnapshot(w)).toBe(before);
    }
    const { rows: [n] } = await query(`SELECT count(*)::int AS n FROM escrow_manual_releases WHERE escrow_entry_id = $1`, [t2.id]);
    expect(n.n).toBe(0);
  });

  it('requires a reason, and a release writes the audit row in the database with it', async () => {
    const w = await w12.shotDone('engagement');
    const admin = await createAdminUser('superadmin');
    const t2 = (await w10.escrow(w.ciId)).find((e) => e.tranche_number === 2);

    for (const reason of [undefined, '', '  ', 'no']) {
      const r = await release(admin, t2.id, reason);
      expect(r.status).toBe(422);
      expect(r.body.error.message).toBe(MSG.RELEASE_REASON_REQUIRED);
    }
    expect((await w10.escrow(w.ciId)).find((e) => e.tranche_number === 2).status).toBe('locked');

    const r = await release(admin, t2.id, '  Settled by INFLX after a call with both  ');
    expect(r.status).toBe(200);
    expect(r.body.data.escrow_entry.status).toBe('released');
    const { rows } = await query(`SELECT * FROM escrow_manual_releases WHERE escrow_entry_id = $1`, [t2.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ escrow_entry_id: t2.id, tranche_number: 2, admin_user_id: admin.user.id, reason: 'Settled by INFLX after a call with both' });
    expect(Number(rows[0].amount)).toBe(Number(t2.amount));
  });
});

/* ──────────────────────────────────────────── 5. the cancel guard (check 34) */

describe('item 12 · a queued tranche cannot be cancelled away (check 34)', () => {
  it('the campaign-cancel path refuses while a tranche is queued, and says why', async () => {
    const w = await w12.shotDone('engagement');
    await query(`UPDATE escrow_entries SET status = 'queued', triggered_at = now() WHERE campaign_influencer_id = $1 AND tranche_number = 3`, [w.ciId]);
    const before = await w10.moneySnapshot(w);
    const r = await api.post(`/campaigns/${w.c.id}/cancel`, w.b.token, {});
    expect(r.status).toBe(422);
    // ASSERTION DRIFT — item 17 (features/item17-wallet; master rules v1.31 §17A, decision W1; 1 Oct 2026).
    // Item 12 refused this cancel only while a payment was QUEUED ("a guard, not the fix"). Item 17 is the
    // fix: a campaign with ANY collaboration signed by both can never be cancelled, queued or not, so the
    // refusal now carries that reason. What the test protects is unchanged: no money moves, nothing is cancelled.
    expect(r.body.error).toMatchObject({ code: 'SIGNED_NO_CANCEL' });
    expect(r.body.error.message).toMatch(/signed collaboration/);
    expect(await w10.moneySnapshot(w)).toBe(before);
    const { rows: [c] } = await query(`SELECT status FROM campaigns WHERE id = $1`, [w.c.id]);
    expect(c.status).not.toBe('cancelled');
  });
});
