'use strict';

/**
 * Item 12, Phase 2c — the flow: the package, the review and its rounds, posting and proof,
 * confirming live, and the second 25%.
 * Contract: features/item12-content · checks 1, 2, 4–17, 20, 21, 26, 30, 31, 37–40, 42
 */

const { query, api } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const w12 = require('./helpers/item12');
const { MSG } = require('../src/services/contentCopy');
const platformSettings = require('../src/services/platformSettings.service');

beforeAll(() => w12.startServer());
afterAll(() => w12.stopServer());

const setSetting = async (key, value) => {
  await query(`UPDATE platform_settings SET value = $2 WHERE key = $1`, [key, value]);
  platformSettings._resetCache();
};
afterEach(async () => {
  await setSetting('content_change_rounds', 2);
  await setSetting('content_report_silence_days', 7);
  await setSetting('final_payment_wait_days', 7);
});

const err = (r) => (r.body && r.body.error) || {};

/* ──────────────────────────────────────────── 1. the gate on every route (check 1, 26) */

describe('item 12 · every content route asks the gate (checks 1, 26)', () => {
  const routes = (w) => [
    ['get',  w12.C(w), 'cr'], ['put', `${w12.C(w)}/rows/reel/caption`, 'cr', { caption: 'x' }],
    ['post', `${w12.C(w)}/submit`, 'cr'], ['put', `${w12.C(w)}/proofs/reel/1`, 'cr', { url: 'https://instagram.com/reel/x' }],
    ['post', `${w12.C(w)}/posted`, 'cr'], ['post', `${w12.C(w)}/report`, 'cr', { kind: 'brand_silent' }],
    ['post', `${w12.C(w)}/files/upload-url`, 'cr', { rowKey: 'reel', kind: 'photo', mime: 'image/jpeg', sizeBytes: 10 }],
    ['get',  w12.B(w), 'b'], ['post', `${w12.B(w)}/approve`, 'b'], ['post', `${w12.B(w)}/changes`, 'b', { reason: 'x' }],
    ['post', `${w12.B(w)}/confirm-live`, 'b'], ['post', `${w12.B(w)}/report`, 'b', { kind: 'posted_wrong' }],
  ];
  const hit = (w, [m, p, who, body], token) => (m === 'get' ? api.get(p, token) : m === 'put' ? api.put(p, token, body || {}) : api.post(p, token, body || {}));

  // ASSERTION DRIFT, item 14 (rules v1.30 §12.1): Pay for Sale now uses these routes as its Path 2
  // (item14-sale.test.js proves it). Hybrid stays 404 on every route until item 15.
  // ASSERTION DRIFT, item 15: Hybrid now uses these routes too, as Path 2 (item15-hybrid.test.js).
  // No Aim is refused by the Aim any more; each route still answers for Hybrid through the gate.
  it('Hybrid: no route refuses it for its Aim, for either party (item 15)', async () => {
    const w = await w12.shotDone('hybrid');
    for (const r of routes(w)) {
      const res = await hit(w, r, w[r[2]].token);
      expect(`${r[0]} ${r[1]} → ${err(res).code || 'ok'}`).not.toMatch(/NOT_PAY_FOR_CONTENT$/);
    }
  });

  it('shoot not done: every WRITE refuses with the sentence; the read draws the state', async () => {
    const w = await w10.signedByBoth('engagement');
    for (const r of routes(w)) {
      const res = await hit(w, r, w[r[2]].token);
      if (r[0] === 'get') { expect(res.status).toBe(200); expect(res.body.data.content.stage).toBe('shoot_not_done'); continue; }
      expect(`${r[0]} ${r[1]} → ${err(res).code}`).toBe(`${r[0]} ${r[1]} → SHOOT_NOT_DONE`);
    }
  });

  it('unfunded: every route refuses with item 10\'s sentence', async () => {
    const w = await w12.shotDone('engagement');
    await query(`UPDATE escrow_entries SET status = 'locked', released_at = NULL WHERE campaign_influencer_id = $1 AND tranche_number = 1`, [w.ciId]);
    for (const r of routes(w)) {
      const res = await hit(w, r, w[r[2]].token);
      expect(`${r[1]} → ${err(res).code}`).toBe(`${r[1]} → NOT_FUNDED`);
    }
  });

  it('26 · another brand and another creator meet 404 on every route', async () => {
    const w = await w12.shotDone('engagement');
    const other = await w12.shotDone('engagement');
    for (const r of routes(w)) {
      const res = await hit(w, r, (r[2] === 'cr' ? other.cr : other.b).token);
      expect(`${r[1]} → ${res.status}`).toBe(`${r[1]} → 404`);
    }
  });
});

/* ──────────────────────────────────────────── 2. the rows (check 2) */

describe('item 12 · what she owes comes from the agreement and nowhere else (check 2)', () => {
  it('the rows are the snapshot; changing the live terms changes nothing; no route edits a row', async () => {
    const w = await w12.shotDone('engagement');
    const before = (await w12.state(w, 'creator')).rows.map((r) => [r.key, r.count, r.platform, r.isStory]);
    expect(before).toEqual([['reel', 1, 'instagram', false], ['story', 2, 'instagram', true]]);
    await query(`UPDATE campaign_influencers SET formats_json = '[{"type":"post","count":9}]'::jsonb WHERE id = $1`, [w.ciId]);
    expect((await w12.state(w, 'creator')).rows.map((r) => [r.key, r.count, r.platform, r.isStory])).toEqual(before);
    const r = await api.put(`${w12.C(w)}/rows/post/caption`, w.cr.token, { caption: 'x' });
    expect(err(r)).toMatchObject({ code: 'UNKNOWN_ROW', message: MSG.UNKNOWN_ROW });
    const src = require('fs').readFileSync(require.resolve('../src/routes/item12.routes.js'), 'utf8');
    expect(src).not.toMatch(/rows['`]?\s*,\s*\.\.\.(creator|brand),\s*ctrl\.(add|remove|edit)Row/);
    expect(src.match(/\/rows\//g)).toHaveLength(1);   // the caption, and nothing else, hangs off a row
  });
});

/* ──────────────────────────────────────────── 3. the package (checks 4, 5, 20) */

describe('item 12 · one complete package, locked while reviewed (checks 4, 5, 20)', () => {
  it('4 · nothing, or part, cannot be sent; the whole package can', async () => {
    const w = await w12.shotDone('engagement');
    let r = await w12.submit(w);
    expect(err(r)).toMatchObject({ code: 'PACKAGE_INCOMPLETE', message: MSG.PACKAGE_INCOMPLETE });
    await w12.upload(w, 'reel', 'video');
    await w12.upload(w, 'story');
    const s = await w12.state(w, 'creator');
    expect(s.missing).toEqual([{ key: 'story', label: 'Instagram story', need: 2, have: 1, short: 1 }]);
    expect(s.can.submit).toBe(false);
    r = await w12.submit(w);
    expect(err(r).code).toBe('PACKAGE_INCOMPLETE');
    await w12.upload(w, 'story');
    await api.put(`${w12.C(w)}/rows/reel/caption`, w.cr.token, { caption: 'Diwali in the new linen co-ord.' });
    r = await w12.submit(w);
    expect(r.status).toBe(200);
    expect(r.body.data.content).toMatchObject({ stage: 'in_review', round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true } });
  });

  it('5 · while it is with the brand she cannot add, remove or re-caption; the brand sees what was sent', async () => {
    const w = await w12.shotDone('engagement');
    const files = await w12.fillPackage(w);
    await w12.submit(w);
    const locked = MSG.PACKAGE_LOCKED(w.b.name);
    for (const r of [
      await api.post(`${w12.C(w)}/files/upload-url`, w.cr.token, { rowKey: 'story', kind: 'photo', mime: 'image/jpeg', sizeBytes: 10 }),
      await api.del(`${w12.C(w)}/files/${files[0].id}`, w.cr.token),
      await api.put(`${w12.C(w)}/rows/reel/caption`, w.cr.token, { caption: 'new' }),
    ]) expect(err(r)).toMatchObject({ code: 'PACKAGE_LOCKED', message: locked });
    const b = await w12.state(w, 'brand');
    expect(b.rows.map((r) => r.files.length)).toEqual([1, 2]);
    expect(b.can).toMatchObject({ approve: true, askChanges: true, confirmLive: false });
  });

  it('3 · a caption is optional and at most 500 characters, on the server', async () => {
    const w = await w12.shotDone('engagement');
    const long = await api.put(`${w12.C(w)}/rows/reel/caption`, w.cr.token, { caption: 'x'.repeat(501) });
    expect(err(long)).toMatchObject({ code: 'CAPTION_TOO_LONG', message: MSG.CAPTION_TOO_LONG });
    const ok = await api.put(`${w12.C(w)}/rows/reel/caption`, w.cr.token, { caption: 'x'.repeat(500) });
    expect(ok.status).toBe(200);
    expect(ok.body.data.content.rows[0].caption).toHaveLength(500);
    const cleared = await api.put(`${w12.C(w)}/rows/reel/caption`, w.cr.token, { caption: '' });
    expect(cleared.body.data.content.rows[0].caption).toBe('');
  });

  it('20 · two taps, two devices: one submission', async () => {
    const w = await w12.shotDone('engagement');
    await w12.fillPackage(w);
    const [a, b] = await Promise.all([
      api.post(`${w12.C(w)}/submit`, w.cr.token, { round: 1 }),
      api.post(`${w12.C(w)}/submit`, w.cr.token, { round: 1 }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expect(err(a.status === 422 ? a : b)).toMatchObject({ code: 'ALREADY_SUBMITTED', message: MSG.ALREADY_SUBMITTED(w.b.name) });
    const { rows } = await query(`SELECT count(*)::int n FROM content_rounds r JOIN collab_content c ON c.id = r.content_id WHERE c.campaign_influencer_id = $1`, [w.ciId]);
    expect(rows[0].n).toBe(1);
  });
});

/* ──────────────────────────────────────────── 4. the review and the rounds (checks 6–11, 37) */

describe('item 12 · one verdict, the rounds, and the history (checks 6–11, 37)', () => {
  it('6 · approve with no rounds used — who and when recorded; twice is refused', async () => {
    const w = await w12.shotDone('engagement');
    await w12.fillPackage(w); await w12.submit(w);
    const r = await w12.approve(w);
    expect(r.status).toBe(200);
    const { rows: [cc] } = await query(`SELECT approved_at, approved_by, approved_round FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(cc).toMatchObject({ approved_by: w.b.userId, approved_round: 1 });
    expect(cc.approved_at).toBeTruthy();
    const again = await api.post(`${w12.B(w)}/approve`, w.b.token, { round: 1 });
    expect(err(again)).toMatchObject({ code: 'ALREADY_APPROVED', message: MSG.ALREADY_APPROVED });
  });

  it('7 · a change request needs a reason; with one it reopens the package and keeps the round', async () => {
    const w = await w12.shotDone('engagement');
    const files = await w12.fillPackage(w); await w12.submit(w);
    for (const reason of ['', '   ', null]) {
      const r = await api.post(`${w12.B(w)}/changes`, w.b.token, { round: 1, reason });
      expect(err(r)).toMatchObject({ code: 'REASON_REQUIRED', message: MSG.REASON_REQUIRED });
    }
    expect(err(await api.post(`${w12.B(w)}/changes`, w.b.token, { round: 1, reason: 'x'.repeat(501) }))).toMatchObject({ code: 'REASON_TOO_LONG' });
    expect(err(await w12.changes(w, 'ok', [{ fileId: files[0].id, note: 'y'.repeat(301) }]))).toMatchObject({ code: 'NOTE_TOO_LONG' });
    const r = await w12.changes(w, 'The second reel is too dark at the end.', [{ fileId: files[0].id, note: 'Replace this one — too dark at the end.' }]);
    expect(r.status).toBe(200);
    const s = await w12.state(w, 'creator');
    expect(s.stage).toBe('changes');
    expect(s.round).toMatchObject({ current: 2, allowed: 2, isLast: true });
    expect(s.rows[0].files[0]).toMatchObject({ id: files[0].id, pinnedNote: 'Replace this one — too dark at the end.' });
    expect(s.can.upload).toBe(true);
    // She replaces the reel: the old file is taken OUT of round 2 but kept for round 1's history.
    expect((await api.del(`${w12.C(w)}/files/${files[0].id}`, w.cr.token)).status).toBe(200);
    const { rows: [old] } = await query(`SELECT removed_round, deleted_at FROM content_files WHERE id = $1`, [files[0].id]);
    expect(old).toEqual({ removed_round: 2, deleted_at: null });
  });

  it('8, 9, 10, 37 · the stamped limit, the last-round warning, no third round, and the history on both sides', async () => {
    const w = await w12.shotDone('engagement');
    await w12.fillPackage(w); await w12.submit(w);
    await setSetting('content_change_rounds', 5);                           // after the stamp: moves nothing (8)
    expect((await w12.state(w, 'brand')).round).toMatchObject({ current: 1, allowed: 2, isLast: false });
    await w12.changes(w, 'Round one reason');
    await w12.submit(w);
    const b2 = await w12.state(w, 'brand');
    expect(b2.round).toMatchObject({ current: 2, allowed: 2, isLast: true, used: false });   // 9: the warning's cue
    expect(b2.can.askChanges).toBe(true);
    await w12.changes(w, 'Round two reason');
    await w12.submit(w);
    const b3 = await w12.state(w, 'brand');
    expect(b3.round).toMatchObject({ current: 3, allowed: 2, used: true });
    expect(b3.can).toMatchObject({ approve: true, askChanges: false, reportRoundsUsed: true });
    const third = await w12.changes(w, 'Round three reason');
    expect(err(third)).toMatchObject({ code: 'ROUNDS_USED', message: "You've used both rounds. Approve this, or report it to INFLX." });
    // 37 — every round, both sides, with reasons, verdicts and file ids.
    for (const side of ['creator', 'brand']) {
      const s = await w12.state(w, side);
      expect(s.rounds.map((r) => [r.no, r.verdict, r.reason])).toEqual([[1, 'changes', 'Round one reason'], [2, 'changes', 'Round two reason'], [3, null, null]]);
      for (const rd of s.rounds) expect(rd.rows.every((x) => x.fileIds.length > 0)).toBe(true);
    }
    // 6 · approving after the last round works.
    expect((await w12.approve(w)).status).toBe(200);
  });

  it('10 · the rounds wording follows the stamped number ("all 3 rounds")', async () => {
    await setSetting('content_change_rounds', 3);
    const w = await w12.shotDone('engagement');
    await w12.fillPackage(w);
    for (let i = 0; i < 3; i += 1) { await w12.submit(w); await w12.changes(w, `r${i}`); }
    await w12.submit(w);
    expect(err(await w12.changes(w, 'again')).message).toBe("You've used all 3 rounds. Approve this, or report it to INFLX.");
  });

  it('11 · approval locks the content: no file or caption can change afterwards', async () => {
    const w = await w12.shotDone('engagement');
    const files = await w12.fillPackage(w); await w12.submit(w); await w12.approve(w);
    for (const r of [
      await api.post(`${w12.C(w)}/files/upload-url`, w.cr.token, { rowKey: 'reel', kind: 'photo', mime: 'image/jpeg', sizeBytes: 10 }),
      await api.del(`${w12.C(w)}/files/${files[0].id}`, w.cr.token),
      await api.put(`${w12.C(w)}/rows/reel/caption`, w.cr.token, { caption: 'new' }),
      await api.post(`${w12.C(w)}/submit`, w.cr.token, {}),
    ]) expect(err(r).code).toBe('ALREADY_APPROVED');
  });

  it('20 · two devices approving: one verdict', async () => {
    const w = await w12.shotDone('engagement');
    await w12.fillPackage(w); await w12.submit(w);
    const [a, b] = await Promise.all([api.post(`${w12.B(w)}/approve`, w.b.token, { round: 1 }), api.post(`${w12.B(w)}/approve`, w.b.token, { round: 1 })]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    const { rows } = await query(`SELECT count(*)::int n FROM content_rounds r JOIN collab_content c ON c.id = r.content_id WHERE c.campaign_influencer_id = $1 AND verdict = 'approved'`, [w.ciId]);
    expect(rows[0].n).toBe(1);
  });
});

/* ──────────────────────────────────────────── 5. posting and proof (checks 12, 13, 38) */

describe('item 12 · a proof per slot, then "posted" (checks 12, 13, 38)', () => {
  it('links are checked for shape and platform; a Story takes a screenshot; every slot before "posted"', async () => {
    const w = await w12.shotDone('engagement');
    await w12.fillPackage(w); await w12.submit(w);
    expect(err(await api.put(`${w12.C(w)}/proofs/reel/1`, w.cr.token, { url: 'https://instagram.com/reel/x' }))).toMatchObject({ code: 'NOT_APPROVED' });
    await w12.approve(w);
    for (const bad of ['instagram.com/reel/x', 'http://instagram.com/reel/x', 'https://youtube.com/watch?v=1', 'https://instagram.com/', 'not a link', 'https://evil.com/instagram.com/reel/x']) {
      const r = await api.put(`${w12.C(w)}/proofs/reel/1`, w.cr.token, { url: bad });
      expect(`${bad} → ${err(r).code}`).toBe(`${bad} → LINK_INVALID`);
      expect(err(r).message).toBe(MSG.LINK_INVALID);
    }
    expect(err(await api.put(`${w12.C(w)}/proofs/reel/2`, w.cr.token, { url: 'https://instagram.com/reel/x' })).code).toBe('UNKNOWN_SLOT');
    expect(err(await api.put(`${w12.C(w)}/proofs/story/1`, w.cr.token, { url: 'https://instagram.com/stories/x' }))).toMatchObject({ code: 'SCREENSHOT_ONLY' });
    for (const ok of ['https://www.instagram.com/reel/C8xK2', 'https://m.instagram.com/p/C8xN4/']) {
      expect((await api.put(`${w12.C(w)}/proofs/reel/1`, w.cr.token, { url: ok })).status).toBe(200);
    }
    // 13 · the brand cannot confirm before she says she posted.
    expect(err(await w12.confirmLive(w))).toMatchObject({ code: 'NOT_POSTED', message: MSG.NOT_POSTED('Tanvi') });
    // 38 · a row of two needs two.
    const shot = await w12.upload(w, 'story', 'photo', { purpose: 'story_proof', mime: 'image/png' });
    await api.put(`${w12.C(w)}/proofs/story/1`, w.cr.token, { screenshotFileId: shot.id });
    expect(err(await w12.posted(w))).toMatchObject({ code: 'PROOF_INCOMPLETE', message: MSG.PROOF_INCOMPLETE });
    const shot2 = await w12.upload(w, 'story', 'photo', { purpose: 'story_proof', mime: 'image/png' });
    expect(err(await api.put(`${w12.C(w)}/proofs/story/2`, w.cr.token, { screenshotFileId: shot.id })).code).toBe('FILE_NOT_FOUND');  // one shot, one slot
    await api.put(`${w12.C(w)}/proofs/story/2`, w.cr.token, { screenshotFileId: shot2.id });
    const p = await w12.posted(w);
    expect(p.status).toBe(200);
    expect(p.body.data.content.stage).toBe('posted');
    expect(err(await w12.posted(w)).code).toBe('ALREADY_POSTED');
    const b = await w12.state(w, 'brand');
    expect(b.rows[1].proofs.map((x) => !!x.screenshotFileId)).toEqual([true, true]);
    expect(b.can).toMatchObject({ confirmLive: true, reportPostedWrong: true });
  });
});

/* ──────────────────────────────────────────── 6. the money (checks 14, 20, 21, 30, 31) */

describe('item 12 · confirming live releases the second 25% of her fee, and nothing else (checks 14, 20, 30, 31)', () => {
  it('₹12,000: releases exactly ₹3,000, stamps the waiting period, and still-locked follows the escrow rows', async () => {
    const w = await w12.shotDone('engagement', { terms: w12.FEE_12000 });
    await w12.toPosted(w);
    const b = await w12.state(w, 'brand');
    expect(b.money).toMatchObject({ fee: 12000, t1: { amount: 3000, status: 'released' }, t2: { amount: 3000, status: 'locked' }, t3: { amount: 6000, status: 'locked' }, stillLocked: 9000, campaignFee: 960 });
    const c0 = await w12.state(w, 'creator');
    expect(c0.money).not.toHaveProperty('campaignFee');                                  // 30: never on her card
    expect(JSON.stringify(c0.money)).not.toMatch(/960/);

    const iBefore = (await query(`SELECT wallet_balance, total_earned FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0];
    const brandBefore = (await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [w.brandId])).rows[0];

    expect(err(await w12.confirmLive(w, 3240))).toMatchObject({ code: 'AMOUNT_CHANGED' });  // the old, wrong split
    const r = await w12.confirmLive(w);
    expect(r.status).toBe(200);
    const s = r.body.data.content;
    expect(s.stage).toBe('live');
    expect(s.money).toMatchObject({ t2: { amount: 3000, status: 'released' }, t3: { amount: 6000, status: 'queued' }, stillLocked: 6000 });

    const iAfter = (await query(`SELECT wallet_balance, total_earned FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0];
    expect(Number(iAfter.wallet_balance) - Number(iBefore.wallet_balance)).toBe(3000);   // nothing deducted
    expect(Number(iAfter.total_earned) - Number(iBefore.total_earned)).toBe(3000);
    expect((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [w.brandId])).rows[0]).toEqual(brandBefore);
    const { rows: ledger } = await query(`SELECT amount, note FROM influencer_ledger WHERE influencer_id = $1 ORDER BY created_at`, [w.cr.influencerId]);
    expect(ledger.map((l) => [Number(l.amount), l.note])).toEqual([[3000, 'Tranche 1 released'], [3000, 'Tranche 2 released']]);

    // The stamp: the IST day of the confirmation + 7, at 03:00 IST.
    const { rows: [t3] } = await query(`SELECT release_due_at FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 3`, [w.ciId]);
    const { rows: [cc] } = await query(`SELECT live_confirmed_at, final_wait_days, final_due_at, t2_released_at FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    const { istDayOf, addDays } = require('../src/utils/indiaDay');
    expect(new Date(t3.release_due_at).toISOString()).toBe(new Date(`${addDays(istDayOf(cc.live_confirmed_at), 7)}T03:00:00+05:30`).toISOString());
    expect(cc.final_wait_days).toBe(7);
    expect(new Date(cc.final_due_at).getTime()).toBe(new Date(t3.release_due_at).getTime());

    expect(err(await w12.confirmLive(w))).toMatchObject({ code: 'ALREADY_CONFIRMED', message: MSG.ALREADY_CONFIRMED });
  });

  it('20 · two devices confirming: one confirmation, one release', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w);
    const amount = (await w12.state(w, 'brand')).money.t2.amount;
    const res = await Promise.all([1, 2, 3].map(() => api.post(`${w12.B(w)}/confirm-live`, w.b.token, { amount })));
    expect(res.map((r) => r.status).sort()).toEqual([200, 422, 422]);
    const { rows } = await query(`SELECT count(*)::int n FROM influencer_ledger WHERE influencer_id = $1 AND note = 'Tranche 2 released'`, [w.cr.influencerId]);
    expect(rows[0].n).toBe(1);
  });

  it('a collaboration that has ended cannot be confirmed', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w);
    await query(`UPDATE campaigns SET status = 'cancelled' WHERE id = $1`, [w.c.id]);
    expect(err(await w12.confirmLive(w))).toMatchObject({ code: 'COLLAB_ENDED' });
    expect((await w10.escrow(w.ciId))[1].status).toBe('locked');
  });
});

/* ──────────────────────────────────────────── 7. reports (checks 16, 17, 39, 40) */

describe('item 12 · reports: recorded, the brand\'s freezes, hers does not (checks 16, 17, 39, 40)', () => {
  it('17, 39 · posted_wrong records a dispute, moves no money, and freezes every write with one sentence', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w);
    const before = await w10.moneySnapshot(w);
    const r = await api.post(`${w12.B(w)}/report`, w.b.token, { kind: 'posted_wrong', note: 'The second story is missing.' });
    expect(r.status).toBe(200);
    expect(r.body.data.content).toMatchObject({ frozen: true, reported: { brand: { kind: 'posted_wrong' } } });
    expect(await w10.moneySnapshot(w)).toBe(before);
    for (const x of [await w12.confirmLive(w), await api.post(`${w12.C(w)}/report`, w.cr.token, { kind: 'brand_silent' })]) {
      expect(err(x)).toMatchObject({ code: 'REPORTED_HOLD', message: 'INFLX is looking at this. Nothing can change until they get back to you.' });
    }
    expect(err(await api.post(`${w12.B(w)}/report`, w.b.token, { kind: 'posted_wrong' })).code).toBe('ALREADY_REPORTED');
    const { rows: n } = await query(`SELECT type FROM notifications WHERE type = 'content.reported'`);
    expect(n.length).toBeGreaterThanOrEqual(2);                                        // both sides told
  });

  it('rounds_used is open only once the rounds are used', async () => {
    const w = await w12.shotDone('engagement');
    await w12.fillPackage(w); await w12.submit(w);
    expect(err(await api.post(`${w12.B(w)}/report`, w.b.token, { kind: 'rounds_used' })).code).toBe('REPORT_NOT_OPEN');
    await w12.changes(w, 'one'); await w12.submit(w); await w12.changes(w, 'two'); await w12.submit(w);
    expect((await api.post(`${w12.B(w)}/report`, w.b.token, { kind: 'rounds_used' })).status).toBe(200);
    expect(err(await w12.approve(w)).code).toBe('REPORTED_HOLD');
  });

  it('16, 39, 40 · brand_silent: refused before the stamped date with it; after, recorded, the brand told — and the brand can still confirm and pay', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w);
    const early = await api.post(`${w12.C(w)}/report`, w.cr.token, { kind: 'brand_silent' });
    const { rows: [cc] } = await query(`SELECT report_after_at, report_silence_days FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(cc.report_silence_days).toBe(7);
    const { shortDay } = require('../src/services/productionCopy');
    expect(err(early)).toMatchObject({ code: 'REPORT_TOO_EARLY', message: MSG.REPORT_TOO_EARLY(shortDay(cc.report_after_at)) });
    await query(`UPDATE collab_content SET report_after_at = now() - interval '1 minute' WHERE campaign_influencer_id = $1`, [w.ciId]);
    const r = await api.post(`${w12.C(w)}/report`, w.cr.token, { kind: 'brand_silent' });
    expect(r.status).toBe(200);
    expect(r.body.data.content).toMatchObject({ frozen: false, reported: { creator: expect.any(Object) } });
    const { rows: told } = await query(`SELECT user_id, body FROM notifications WHERE type = 'content.reported' AND user_id = $1`, [w.b.userId]);
    expect(told).toHaveLength(1);
    expect(told[0].body).toBe(MSG.REPORTED_BY_CREATOR('Tanvi'));
    expect((await w12.confirmLive(w)).status).toBe(200);                                 // freezes nothing
    expect(err(await api.post(`${w12.C(w)}/report`, w.cr.token, { kind: 'brand_silent' })).code).toBe('REPORT_NOT_OPEN');
  });
});

/* ──────────────────────────────────────────── 8. no auto-confirm (check 15) */

describe('item 12 · nothing confirms "live" on its own (check 15)', () => {
  it('only the brand\'s own confirmation ever writes live_confirmed_at', () => {
    const fs = require('fs'); const path = require('path');
    const hits = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && /live_confirmed_at\s*=/.test(fs.readFileSync(p, 'utf8'))) hits.push(path.basename(p)); } };
    walk(path.join(__dirname, '../src'));
    // ASSERTION DRIFT, item 14 (decision D3): Pay for Sale confirms itself after the stamped Admin
    // days — saleLive.autoConfirmDue, which selects goal = 'conversion' only and moves no money.
    // Pay for Content still has no automatic confirmation: the next test runs every job on one.
    expect(hits.sort()).toEqual(['contentFlow.service.js', 'saleLive.service.js']);
    expect(require('fs').readFileSync(path.join(__dirname, '../src/services/saleLive.service.js'), 'utf8'))
      .toMatch(/WHERE cs.goal = 'conversion' AND cc.posted_at IS NOT NULL AND cc.live_confirmed_at IS NULL/);
  });

  it('and every job, run long after she posted, leaves it unconfirmed', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w);
    await query(`UPDATE collab_content SET posted_at = now() - interval '60 days', report_after_at = now() - interval '53 days' WHERE campaign_influencer_id = $1`, [w.ciId]);
    await require('../src/jobs/collab-delayed.job').run();
    await require('../src/jobs/shoot-reminders.job').run({ now: new Date(Date.now() + 90 * 86400000) });
    await require('../src/jobs/tranche-3-release.job').run({ now: new Date(Date.now() + 90 * 86400000) });
    const { rows: [cc] } = await query(`SELECT live_confirmed_at FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(cc.live_confirmed_at).toBeNull();
    expect((await w10.escrow(w.ciId))[1].status).toBe('locked');
  });
});
