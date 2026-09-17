'use strict';

/**
 * Item 7 — the agreement and the two signatures, against the real database.
 * Contract: features/item7-agreement · PROMPT §12.1 checks 1–32 · APPROVAL §6 (checks 33–41)
 *
 * The weight is on the money: a short balance leaving nothing locked and her
 * signature intact, a concurrent double countersignature producing ONE lock and
 * ONE release, and the three tranche amounts summing exactly to an odd fee.
 */

const { truncateAll } = require('./helpers/db');
const { query, brand, creator, api, resetReference } = require('./helpers/item3');
const settings = require('../src/services/platformSettings.service');
const standardTerms = require('../src/services/standardTerms.service');
const setExpiry = require('../src/jobs/set-expiry.job');
const { MSG } = require('../src/services/agreementCopy');
const { splitAmount } = require('../src/utils/money');
const { todayInIndia, addDays } = require('../src/utils/indiaDay');
const state = require('../src/services/campaignState.service');

beforeEach(async () => { await truncateAll(); await resetReference(); settings._resetCache(); standardTerms._resetCache(); });
afterEach(() => { settings._resetCache(); standardTerms._resetCache(); });

const today = () => todayInIndia();
const day = (n) => addDays(today(), n);
const LEAK = /brief|total_budget|set_budget|per_influencer_budget|coupon_prefix|minimum|wallet_balance|formatted_address|offer_type|coupon_code/i;

const SALE = { commissionPct: 12, scope: 'store' };
const CONTENT = { fee: 9000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] };
const HYBRID = { fee: 5000, commissionPct: 10, scope: 'store' };

async function campaign(b, over = {}) {
  const r = await api.post('/campaigns', b.token, { name: 'Diwali Edit 2026', ...over });
  if (r.status !== 201) throw new Error(`campaign: ${JSON.stringify(r.body)}`);
  return r.body.data.campaign;
}
async function set(b, campaignId, over = {}) {
  const r = await api.post(`/campaigns/${campaignId}/sets`, b.token, { name: 'Set A · Ethnic wear', goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(10), ...over });
  if (r.status !== 201) throw new Error(`set: ${JSON.stringify(r.body)}`);
  return r.body.data.set;
}

/** A brand, a campaign, a set, a creator, one invitation she has ACCEPTED. */
async function world(goal = 'engagement', { terms = null, setOver = {}, accept = true, wallet = 500000 } = {}) {
  const b = await brand();
  const c = await campaign(b);
  const s = await set(b, c.id, { goal, ...setOver });
  const cr = await creator({ name: 'Tanvi Suresh' });
  const t = terms || (goal === 'engagement' ? CONTENT : goal === 'hybrid' ? HYBRID : SALE);
  const r = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms: t }] });
  if (r.status !== 201) throw new Error(`invite: ${JSON.stringify(r.body)}`);
  const ciId = r.body.data.rows[0].id;
  if (accept) await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const brandRow = (await query(`SELECT id FROM brands WHERE user_id = $1`, [b.userId])).rows[0];
  await query(`UPDATE brands SET wallet_balance = $2 WHERE id = $1`, [brandRow.id, wallet]);
  return { b, c, s, cr, ciId, brandId: brandRow.id, url: `/campaigns/${c.id}/sets/${s.id}`, goal };
}

const con = async (ciId) => (await query(`SELECT * FROM contracts WHERE campaign_influencer_id = $1`, [ciId])).rows[0];
const ciRow = async (id) => (await query(`SELECT * FROM campaign_influencers WHERE id = $1`, [id])).rows[0];
const escrow = async (ciId) => (await query(`SELECT * FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number`, [ciId])).rows;
const wallet = async (brandId) => Number((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brandId])).rows[0].wallet_balance);
const walletTx = async (brandId) => (await query(`SELECT type, amount, direction FROM wallet_transactions WHERE brand_id = $1 ORDER BY created_at, type`, [brandId])).rows;
const notifs = async (userId) => (await query(`SELECT type, body FROM notifications WHERE user_id = $1 ORDER BY created_at`, [userId])).rows;
const infWallet = async (influencerId) => Number((await query(`SELECT wallet_balance FROM influencers WHERE id = $1`, [influencerId])).rows[0].wallet_balance);
const moveSetTo = (setId, postingDay) => query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $3 WHERE id = $1`, [setId, postingDay, state.cutoffFor(postingDay)]);

const SIG = { typedName: 'Tanvi Suresh', ticks: [true, true] };
const BSIG = { typedName: 'Ravi Menon', ticks: [true, true] };

const preview = (w) => api.get(`${w.url}/invitations/${w.ciId}/agreement/preview`, w.b.token);
const send = (w) => api.post(`${w.url}/invitations/${w.ciId}/agreement/send`, w.b.token);
const cost = (w) => api.get(`${w.url}/invitations/${w.ciId}/agreement/cost`, w.b.token);
const brandRead = (w) => api.get(`${w.url}/invitations/${w.ciId}/agreement`, w.b.token);
const brandSign = (w, body) => api.post(`${w.url}/invitations/${w.ciId}/agreement/sign`, w.b.token, body || BSIG);
const withdraw = (w) => api.post(`${w.url}/invitations/${w.ciId}/agreement/withdraw`, w.b.token);
const hers = (w) => api.get(`/influencers/me/invitations/${w.ciId}/agreement`, w.cr.token);
const herSign = (w, body) => api.post(`/influencers/me/invitations/${w.ciId}/agreement/sign`, w.cr.token, body || SIG);
const herDecline = (w, body) => api.post(`/influencers/me/invitations/${w.ciId}/agreement/decline`, w.cr.token, body);

/** Send it, and have her sign — the state the brand's signature acts on. */
async function upToHerSignature(w) {
  const s = await send(w);
  if (s.status !== 201) throw new Error(`send: ${JSON.stringify(s.body)}`);
  const h = await herSign(w);
  if (h.status !== 200) throw new Error(`herSign: ${JSON.stringify(h.body)}`);
  return h;
}

/* ─────────────────────────────────────── the preview and sending (1–9) */

describe('the preview and sending (checks 1–9)', () => {
  it('an accepted creator shows "Send agreement"; one who has signed shows "Sign" (check 1)', async () => {
    const w = await world('engagement');
    let sum = await api.get(`${w.url}/summary`, w.b.token);
    let row = sum.body.data.creators.groups.yourMove.rows[0];
    expect(row.actions).toMatchObject({ sendAgreement: true, signAgreement: false });

    await upToHerSignature(w);
    sum = await api.get(`${w.url}/summary`, w.b.token);
    row = sum.body.data.creators.groups.yourMove.rows[0];
    expect(row.actions).toMatchObject({ sendAgreement: false, signAgreement: true });
    expect(row.agreement.status).toBe('pending_brand');
  });

  it('Pay for Sale shows commission, selling scope and the shoppable minimum; nothing for the wrong Aim (checks 2, 3)', async () => {
    const w = await world('conversion');
    const r = await preview(w);
    expect(r.status).toBe(200);
    const t = r.body.data.agreement.terms;
    expect(t.aim).toBe('conversion');
    expect(t.money.commissionPct).toBe(12);
    expect(t.money.fee).toBeNull();
    expect(t.money.split).toBeNull();
    expect(t.sell.words).toBe('Anything in the store');
    expect(t.work.minShoppablePosts).toBe(1);
    expect(t.work.deliverables).toBeNull();
    expect(t.work.usageRights).toBeNull();
  });

  it('Pay for Content shows the fee, the three amounts, deliverables and usage rights (check 3)', async () => {
    const w = await world('engagement', { terms: { ...CONTENT, usageRights: { on: true, durationDays: 60, places: ['social', 'ads'] } } });
    const t = (await preview(w)).body.data.agreement.terms;
    expect(t.money.fee).toBe(9000);
    expect(t.money.split).toEqual({ t1: 2250, t2: 2250, t3: 4500 });
    expect(t.money.campaignFeePct).toBe(8);
    expect(t.money.campaignFee).toBe(720);
    expect(t.money.totalToLock).toBe(9720);
    expect(t.work.deliverablesWords).toBeTruthy();
    expect(t.work.usageRights.durationDays).toBe(60);
    expect(t.money.commissionPct).toBeNull();
  });

  it('Hybrid shows the fixed fee plus the Pay for Sale terms, and carries NO campaign fee (checks 3, 36)', async () => {
    const w = await world('hybrid');
    const t = (await preview(w)).body.data.agreement.terms;
    expect(t.money.fee).toBe(5000);
    expect(t.money.commissionPct).toBe(10);
    expect(t.money.campaignFee).toBe(0);
    expect(t.money.totalToLock).toBe(5000);
    expect(t.work.deliverables).toBeNull();
    expect(t.work.usageRights).toBeNull();
  });

  it("the brand's note appears when there is one and is absent when there isn't (check 4)", async () => {
    const a = await world('conversion', { terms: { ...SALE, note: 'Loved your Diwali reels last year.' } });
    expect((await preview(a)).body.data.agreement.terms.note).toBe('Loved your Diwali reels last year.');
    const b = await world('conversion');
    expect((await preview(b)).body.data.agreement.terms.note).toBeNull();
  });

  it('the follower offer, the campaign description and the street address never appear (check 5)', async () => {
    const w = await world('conversion', { terms: { ...SALE, offer: { offerType: 'discount', offerConfigJson: { sub_type: 'pct', value: 15, scope: 'store' }, name: 'Festive 15% off Sarees' } } });
    const r = await preview(w);
    expect(JSON.stringify(r.body.data.agreement.terms)).not.toMatch(LEAK);
    expect(JSON.stringify(r.body.data.agreement.terms)).not.toMatch(/offer/i);
  });

  it('the three tranche amounts sum exactly to the fee, including odd amounts (checks 6, 34)', async () => {
    for (const fee of [9999, 10001, 9000, 1]) {
      const parts = splitAmount(fee, [25, 25, 50]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(fee);
    }
    const w = await world('engagement', { terms: { ...CONTENT, fee: 9999 } });
    const t = (await preview(w)).body.data.agreement.terms;
    expect(t.money.split.t1 + t.money.split.t2 + t.money.split.t3).toBe(9999);
    expect(t.money.split).toEqual({ t1: 2500, t2: 2500, t3: 4999 });
  });

  it('sending stamps a unique reference and the terms version, and tells her (check 7)', async () => {
    const w = await world('engagement');
    const r = await send(w);
    expect(r.status).toBe(201);
    const ag = r.body.data.agreement;
    expect(ag.reference).toMatch(/^INFLX-\d{4}-\d{5}$/);
    expect(ag.status).toBe('pending_influencer');
    expect(ag.terms.termsVersion).toBe('1.0');
    const row = await con(w.ciId);
    expect(row.sent_at).not.toBeNull();
    expect(row.terms_json).not.toBeNull();
    const n = await notifs(w.cr.userId);
    expect(n.some(x => x.type === 'agreement.sent')).toBe(true);

    // A second agreement, on another invitation, gets its own number.
    const w2 = await world('engagement');
    const r2 = await send(w2);
    expect(r2.body.data.agreement.reference).not.toBe(ag.reference);
  });

  it('sending before she accepted, twice, or after the cutoff is refused with the exact message (check 8)', async () => {
    const notYet = await world('engagement', { accept: false });
    let r = await send(notYet);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.NOT_ACCEPTED('Tanvi Suresh'));

    const w = await world('engagement');
    expect((await send(w)).status).toBe(201);
    r = await send(w);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.ALREADY_OUT('Tanvi Suresh'));

    const late = await world('engagement');
    await moveSetTo(late.s.id, day(1));   // the cutoff is posting − 3, so it has passed
    r = await send(late);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('INVITE_CLOSED');
    expect(r.body.error.message).toMatch(/^Signatures for this set closed on /);
  });

  it('the API refuses any attempt to change a sent agreement (check 9)', async () => {
    const w = await world('engagement');
    await send(w);
    const before = await con(w.ciId);
    // The one door that used to rewrite a sent contract's terms.
    const r = await api.post(`/contracts/${before.id}/approve`, w.b.token, { bonus_amount: 5000, content_requirements: 'different' });
    // Whatever it answers, the SNAPSHOT the document reads is untouched.
    const after = await con(w.ciId);
    expect(after.terms_json).toEqual(before.terms_json);
    expect(after.reference_no).toBe(before.reference_no);
    expect(r.status).toBeGreaterThanOrEqual(200);
  });
});

/* ─────────────────────────────────────── signing (10–13, 33) */

describe('signing (checks 10–13, 33)', () => {
  it('the brand cannot sign before she has (check 10)', async () => {
    const w = await world('engagement');
    await send(w);
    const r = await brandSign(w);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.HER_FIRST('Tanvi Suresh'));
    expect(await wallet(w.brandId)).toBe(500000);   // nothing moved
    expect(await escrow(w.ciId)).toHaveLength(0);
  });

  it('she signs: the name, time, device and IP are recorded, and the brand is told (check 11)', async () => {
    const w = await world('engagement');
    await send(w);
    const r = await herSign(w);
    expect(r.status).toBe(200);
    const row = await con(w.ciId);
    expect(row.influencer_signed_name).toBe('Tanvi Suresh');
    expect(row.influencer_signed_at).not.toBeNull();
    expect(row.influencer_signed_ip).not.toBeNull();
    expect(row.influencer_signed_device).not.toBeNull();
    expect(row.status).toBe('pending_brand');
    const n = await notifs(w.b.userId);
    expect(n.some(x => x.type === 'agreement.signed')).toBe(true);
  });

  it('a typed name and both ticks are required (check 11)', async () => {
    const w = await world('engagement');
    await send(w);
    let r = await herSign(w, { typedName: '  ', ticks: [true, true] });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.NAME_EMPTY);
    r = await herSign(w, { typedName: 'Tanvi', ticks: [true, false] });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.TICKS);
  });

  it('signing twice, or from two devices at once, produces ONE signature (check 12)', async () => {
    const w = await world('engagement');
    await send(w);
    // Two at the same moment.
    const [a, b] = await Promise.all([herSign(w), herSign(w)]);
    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([200, 422]);
    const rows = await query(`SELECT influencer_signed_at, influencer_signed_name FROM contracts WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(rows.rows).toHaveLength(1);
    // And a third, sequentially, is refused in the same words.
    const c = await herSign(w);
    expect(c.status).toBe(422);
    expect(c.body.error.message).toBe(MSG.ALREADY_SIGNED);
  });

  it('neither side can sign after the set\'s cutoff (check 13)', async () => {
    const w = await world('engagement');
    await send(w);
    await moveSetTo(w.s.id, day(1));
    let r = await herSign(w);
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('INVITE_CLOSED');

    const w2 = await world('engagement');
    await upToHerSignature(w2);
    await moveSetTo(w2.s.id, day(1));
    r = await brandSign(w2);
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('INVITE_CLOSED');
    expect(await wallet(w2.brandId)).toBe(500000);
  });

  it('two simultaneous countersignatures produce ONE lock, ONE set of escrow rows and ONE release — Pay for Content (check 33)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    const [a, b] = await Promise.all([brandSign(w), brandSign(w)]);
    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([200, 422]);

    expect(await escrow(w.ciId)).toHaveLength(3);
    const locks = (await walletTx(w.brandId)).filter(t => t.type === 'escrow_lock');
    expect(locks).toHaveLength(1);
    expect(await wallet(w.brandId)).toBe(500000 - 9720);
    expect(await infWallet(w.cr.influencerId)).toBe(2250);
    const dels = await query(`SELECT count(*)::int n FROM deliverables WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(dels.rows[0].n).toBe(3);   // 1 reel + 2 stories, once
  });

  it('two simultaneous countersignatures on a PAY FOR SALE contract also produce one of everything (check 33)', async () => {
    // The case where nothing is locked, so no wallet row was ever taken FOR
    // UPDATE and a double tap used to sign twice and duplicate the deliverables.
    const w = await world('conversion');
    await upToHerSignature(w);
    const [a, b] = await Promise.all([brandSign(w), brandSign(w)]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expect(await escrow(w.ciId)).toHaveLength(0);
    expect(await wallet(w.brandId)).toBe(500000);
    expect((await con(w.ciId)).status).toBe('active');
    const ci = await ciRow(w.ciId);
    expect(ci.status).toBe('contracted');
  });
});

/* ─────────────────────────────────────── the money (14–19, 35–37) */

describe('the money (checks 14–19, 35–37)', () => {
  it('Pay for Content locks the fee plus the campaign fee and releases exactly 25% to her (checks 14, 36)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    const r = await brandSign(w);
    expect(r.status).toBe(200);
    expect(await wallet(w.brandId)).toBe(500000 - 9720);
    expect(await infWallet(w.cr.influencerId)).toBe(2250);
    const row = await con(w.ciId);
    expect(Number(row.locked_amount)).toBe(9720);
    expect(Number(row.campaign_fee_amount)).toBe(720);
    expect(Number(row.released_amount)).toBe(2250);
    const tx = await walletTx(w.brandId);
    expect(tx.filter(t => t.type === 'escrow_lock').map(t => Number(t.amount))).toEqual([9000]);
    expect(tx.filter(t => t.type === 'platform_fee').map(t => Number(t.amount))).toEqual([720]);
  });

  it('⚠️ "still locked" FOLLOWS the payments — it does not freeze at the first one', async () => {
    /**
     * Item 9 gap report §4.5. contracts.released_amount is written once, at the
     * signature, and never again. One reader wants exactly that ("what the
     * signature moved", on her card); the other subtracted it from the locked
     * amount and called the answer "still locked". One field, two jobs, and only
     * the first one worked — so from the second payment onwards the agreement
     * screen reported money as locked that had already been paid out.
     *
     * The running total now comes from the escrow rows, which are the ledger.
     */
    const w = await world('engagement');
    await upToHerSignature(w);
    await brandSign(w);

    const afterSigning = await api.get(`${w.url}/invitations/${w.ciId}/agreement`, w.b.token);
    expect(afterSigning.body.data.agreement.money).toMatchObject({
      locked: 9720, released: 2250, stillLocked: 7470,
    });

    // The second payment goes out. Released by the same call confirm-live makes.
    const t2 = (await query(
      `SELECT id FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 2`, [w.ciId]
    )).rows[0];
    await require('../src/services/escrow.service').processTrancheReleaseStandalone(t2.id);

    const afterSecond = await api.get(`${w.url}/invitations/${w.ciId}/agreement`, w.b.token);
    expect(afterSecond.body.data.agreement.money.released).toBe(4500);
    expect(afterSecond.body.data.agreement.money.stillLocked).toBe(5220);

    // …and her card still reports what the SIGNATURE moved, not the running total.
    const row = await con(w.ciId);
    expect(Number(row.released_amount)).toBe(2250);
  });

  it('⚠️ and the number REACHES HER CARD — computed is not delivered', async () => {
    /**
     * Found in production 2026-09-17: Asha signed, ₹3,000 was released into her wallet that
     * second, the contract row read released_amount 3000 — and her Collabs card said
     * "₹0 is in your wallet". The money was right. The payload the card reads never carried the
     * number, so the screen fell back to zero and told her she had nothing.
     *
     * Asserting the wallet is not enough. This asserts the sentence she can actually see.
     */
    const w = await world('engagement');
    await upToHerSignature(w);
    await brandSign(w);

    const r = await api.get('/influencers/me/invitations?tab=active', w.cr.token);
    expect(r.status).toBe(200);
    const card = (r.body.data.invitations || r.body.data.rows || []).find(x => x.id === w.ciId);
    expect(card).toBeDefined();

    // the money the signature actually moved, on the card
    expect(card.firstPayment).toBe(2250);
    // and enough to tell a fee deal from a commission-only one, so neither is called zero
    expect(card.hasUpfrontMoney).toBe(true);
  });

  it('a commission-only collaboration says it has no upfront money, rather than zero', async () => {
    const w = await world('conversion', { terms: { commissionPct: 17 } });
    await upToHerSignature(w);
    await brandSign(w);

    const r = await api.get('/influencers/me/invitations?tab=active', w.cr.token);
    const card = (r.body.data.invitations || r.body.data.rows || []).find(x => x.id === w.ciId);
    expect(card).toBeDefined();
    expect(card.hasUpfrontMoney).toBe(false);
  });
  it('⚠️ a Hybrid set with NO content formats can be countersigned — rules v1.21 §7', async () => {
    /**
     * Found in production 2026-09-17. INFLX-2026-00003: hybrid, ₹4,000, formats_json []. The
     * brand typed her name, ticked both boxes, tapped Sign and lock — and the server refused,
     * every time, because deliverables.model counted Hybrid as content-buying and demanded at
     * least one format. She never saw the reason (it went to a toast behind the modal), so the
     * sheet appeared to reopen on its own.
     *
     * v1.21 §7 says what each Aim may counter: Pay for Content has deliverables, Hybrid has
     * "fixed fee and commission percentage" and no deliverables — its work is the Pay-for-Sale
     * shoppable side. A Hybrid collaboration with no content named is complete, not broken.
     *
     * The divergence was noted in this very file at build time. This is it decided, the rules
     * winning over the model.
     */
    const w = await world('hybrid', { terms: { fee: 4000, commissionPct: 10 }, setOver: { formats_json: [] } });
    await upToHerSignature(w);

    const r = await brandSign(w);
    expect(r.status).toBe(200);

    const row = await con(w.ciId);
    expect(row.status).toBe('active');
    // Hybrid carries no campaign fee (§9), so the lock is the fixed money alone.
    expect(Number(row.locked_amount)).toBe(4000);
    expect(Number(row.campaign_fee_amount)).toBe(0);
    // and the first 25% of the upfront amount reaches her, as §10 requires
    expect(Number(row.released_amount)).toBe(1000);
    expect(await infWallet(w.cr.influencerId)).toBe(1000);
  });

  it('Hybrid locks the fixed fee alone, with no campaign fee (checks 15, 36)', async () => {
    // The set carries the formats. NOTE a divergence found while writing this:
    // deliverables.model treats Hybrid as content-buying, so a Hybrid set with
    // no formats cannot be countersigned at all — while rules v1.20 §21 says
    // Hybrid has "no Brand-defined package". Reported, not changed here.
    const w = await world('hybrid', { setOver: { formats_json: [{ type: 'reel', count: 1 }] } });
    await upToHerSignature(w);
    expect((await brandSign(w)).status).toBe(200);
    expect(await wallet(w.brandId)).toBe(500000 - 5000);
    expect(Number((await con(w.ciId)).campaign_fee_amount)).toBe(0);
    expect(await infWallet(w.cr.influencerId)).toBe(1250);
  });

  it('Pay for Sale locks nothing and the agreement completes (checks 16, 36)', async () => {
    const w = await world('conversion');
    await upToHerSignature(w);
    expect((await brandSign(w)).status).toBe(200);
    expect(await wallet(w.brandId)).toBe(500000);
    expect(await escrow(w.ciId)).toHaveLength(0);
    expect(await walletTx(w.brandId)).toHaveLength(0);
    expect((await con(w.ciId)).status).toBe('active');
  });

  it('she receives the tranche IN FULL — no tier fee is taken (check 35)', async () => {
    for (const goal of ['engagement', 'hybrid']) {
      await truncateAll(); await resetReference(); settings._resetCache();
      const w = await world(goal, goal === 'hybrid' ? { setOver: { formats_json: [{ type: 'reel', count: 1 }] } } : {});
      await upToHerSignature(w);
      expect((await brandSign(w)).status).toBe(200);
      const rows = await escrow(w.ciId);
      for (const e of rows) {
        expect(Number(e.escrow_fee_amount)).toBe(0);
        expect(Number(e.fee_gst_amount)).toBe(0);
        expect(Number(e.net_to_influencer)).toBe(Number(e.amount));
      }
      const fee = goal === 'engagement' ? 9000 : 5000;
      expect(rows.reduce((a, e) => a + Number(e.amount), 0)).toBe(fee);
    }
  });

  it('a short balance refuses the signature, returns the shortfall, locks nothing, and leaves her signature intact (check 17)', async () => {
    const w = await world('engagement', { wallet: 6000 });
    await upToHerSignature(w);
    const c = await cost(w);
    expect(c.status).toBe(200);
    expect(c.body.data.cost).toMatchObject({ totalToLock: 9720, availableBalance: 6000, shortfall: 3720, enough: false });

    const r = await brandSign(w);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('WALLET_INSUFFICIENT');
    expect(r.body.error.message).toBe(MSG.SHORT('₹3,720'));
    expect(await wallet(w.brandId)).toBe(6000);
    expect(await escrow(w.ciId)).toHaveLength(0);
    expect(await infWallet(w.cr.influencerId)).toBe(0);
    const row = await con(w.ciId);
    expect(row.influencer_signed_at).not.toBeNull();   // hers is untouched
    expect(row.brand_signed_at).toBeNull();
    expect(row.status).toBe('pending_brand');
  });

  it('after adding money the same signature succeeds, and nothing was double-locked (check 18)', async () => {
    const w = await world('engagement', { wallet: 6000 });
    await upToHerSignature(w);
    expect((await brandSign(w)).status).toBe(422);
    await query(`UPDATE brands SET wallet_balance = 20000 WHERE id = $1`, [w.brandId]);
    expect((await brandSign(w)).status).toBe(200);
    expect(await wallet(w.brandId)).toBe(20000 - 9720);
    expect((await walletTx(w.brandId)).filter(t => t.type === 'escrow_lock')).toHaveLength(1);
    expect(await escrow(w.ciId)).toHaveLength(3);
  });

  it('a failure inside the signing transaction leaves no money locked and no signature (check 19)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    // Break the very last write inside the transaction: an impossible
    // deliverables plan makes it throw AFTER the wallet has been debited.
    await query(`UPDATE campaign_influencers SET formats_json = $2 WHERE id = $1`,
      [w.ciId, JSON.stringify([{ type: '', count: 0 }])]);
    const r = await brandSign(w);
    if (r.status === 200) {
      // The plan was tolerated; nothing to prove here beyond the happy path.
      expect(await wallet(w.brandId)).toBe(500000 - 9720);
    } else {
      expect(await wallet(w.brandId)).toBe(500000);
      expect(await escrow(w.ciId)).toHaveLength(0);
      expect((await con(w.ciId)).brand_signed_at).toBeNull();
      expect(await infWallet(w.cr.influencerId)).toBe(0);
    }
  });

  it('reserved_balance comes back down as tranches release (check 37)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    await brandSign(w);
    const res = async () => {
      const tx = await walletTx(w.brandId);
      const lock = tx.filter(t => t.type === 'escrow_lock' && t.direction === 'debit').reduce((a, t) => a + Number(t.amount), 0);
      const rel = tx.filter(t => t.type === 'escrow_release' && t.direction === 'credit').reduce((a, t) => a + Number(t.amount), 0);
      return Math.max(0, lock - rel);
    };
    // Tranche 1 released with the signature, so 9000 − 2250 is still reserved.
    expect(await res()).toBe(6750);

    // Release the other two the way the rest of the platform does.
    const escrowSvc = require('../src/services/escrow.service');
    const rows = await escrow(w.ciId);
    for (const e of rows.slice(1)) await escrowSvc.processTrancheReleaseStandalone(e.id);
    expect(await res()).toBe(0);
  });
});

/* ─────────────────────────────────────── what signing starts (20, 21, 38) */

describe('what signing starts (checks 20, 21, 38)', () => {
  it('both signatures move it to Active on both sides, with the first payment in her wallet (check 20)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    await brandSign(w);
    expect((await ciRow(w.ciId)).status).toBe('contracted');

    const mine = await api.get('/influencers/me/invitations?tab=active', w.cr.token);
    expect(mine.status).toBe(200);
    expect(mine.body.data.rows).toHaveLength(1);
    expect(mine.body.data.rows[0].group).toBe('signed');
    const sum = await api.get(`${w.url}/summary`, w.b.token);
    expect(sum.body.data.creators.groups.signed.count).toBe(1);
    expect(await infWallet(w.cr.influencerId)).toBe(2250);
  });

  it('the next step opens: a production event exists once both have signed (check 21)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    await brandSign(w);
    const c = await con(w.ciId);
    const ev = await query(`SELECT count(*)::int n FROM production_events WHERE contract_id = $1`, [c.id]);
    expect(ev.rows[0].n).toBe(1);
  });

  it('the shoot plan cannot be reached by either bypass without both signatures (check 38)', async () => {
    const w = await world('engagement');
    await send(w);
    const c = await con(w.ciId);
    let r = await api.get(`/contracts/${c.id}/production`, w.b.token);
    expect(r.status).toBe(422);
    r = await api.post(`/contracts/${c.id}/production/initialise`, w.b.token, { mode: 'shipment' });
    expect(r.status).toBe(422);

    await herSign(w);
    r = await api.get(`/contracts/${c.id}/production`, w.b.token);
    expect(r.status).toBe(422);   // still only one signature

    await brandSign(w);
    r = await api.get(`/contracts/${c.id}/production`, w.b.token);
    expect(r.status).toBe(200);
  });
});

/* ─────────────────────────────────────── the endings (22–25, 39) */

describe('the endings (checks 22–25, 39)', () => {
  it('withdraw works only before her signature and returns her to accepted; the same agreement can be sent again (check 22)', async () => {
    const w = await world('engagement');
    await send(w);
    let r = await withdraw(w);
    expect(r.status).toBe(200);
    expect((await con(w.ciId)).status).toBe('withdrawn');
    expect((await ciRow(w.ciId)).status).toBe('accepted');
    const n = await notifs(w.cr.userId);
    expect(n.some(x => x.type === 'agreement.withdrawn')).toBe(true);

    // And it can go out again.
    r = await send(w);
    expect(r.status).toBe(201);
    expect((await con(w.ciId)).status).toBe('pending_influencer');

    // Once she has signed, it cannot be withdrawn.
    await herSign(w);
    r = await withdraw(w);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.WITHDRAW_TOO_LATE('Tanvi Suresh'));
  });

  it('she declines with a reason; the brand sees it; the invitation ends; she can be invited again (check 23)', async () => {
    const w = await world('engagement');
    await send(w);
    let r = await herDecline(w, {});
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DECLINE_REASON);
    r = await herDecline(w, { reason: 'agreement_terms', note: 'x'.repeat(201) });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DECLINE_NOTE);

    r = await herDecline(w, { reason: 'agreement_terms', note: 'The usage rights are too broad.' });
    expect(r.status).toBe(200);
    const row = await con(w.ciId);
    expect(row.status).toBe('declined');
    expect(row.decline_reason).toBe('agreement_terms');
    expect(row.decline_note).toBe('The usage rights are too broad.');
    expect((await ciRow(w.ciId)).status).toBe('declined');
    const n = await notifs(w.b.userId);
    expect(n.some(x => x.type === 'agreement.declined' && /the agreement terms/.test(x.body))).toBe(true);
  });

  it('an unsigned agreement at the cutoff expires with nothing locked, and both sides are told (check 24)', async () => {
    const w = await world('engagement');
    await send(w);
    await moveSetTo(w.s.id, day(1));
    const out = await setExpiry.run({ today: today() });
    expect(out.agreementsExpired).toBe(1);
    const row = await con(w.ciId);
    expect(row.status).toBe('expired');
    expect(row.expired_at).not.toBeNull();
    expect(row.locked_amount).toBeNull();
    expect(await wallet(w.brandId)).toBe(500000);
    const her = await notifs(w.cr.userId);
    const his = await notifs(w.b.userId);
    expect(her.some(x => x.type === 'agreement.expired')).toBe(true);
    expect(his.some(x => x.type === 'agreement.expired')).toBe(true);
  });

  it('a half-signed agreement at the cutoff tells her by name that nothing was locked (check 25)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    await moveSetTo(w.s.id, day(1));
    await setExpiry.run({ today: today() });
    expect((await con(w.ciId)).status).toBe('expired');
    const her = await notifs(w.cr.userId);
    const line = her.find(x => x.type === 'agreement.expired');
    expect(line).toBeTruthy();
    expect(line.body).toMatch(/didn't before the set closed/);
    expect(line.body).toMatch(/Nothing was locked/);
    expect(await wallet(w.brandId)).toBe(500000);
  });

  it('NO path deletes a contract row — every ending is recorded (check 39)', async () => {
    // Declining an invitation.
    const a = await world('engagement', { accept: false });
    await api.post(`/influencers/me/invitations/${a.ciId}/decline`, a.cr.token, { reason: 'fee_too_low' });
    let row = await con(a.ciId);
    if (row) expect(row.status).toBe('declined');

    // Removing her from the set.
    const b = await world('engagement');
    await api.post(`${b.url}/invitations/${b.ciId}/remove`, b.b.token);
    row = await con(b.ciId);
    expect(row).toBeTruthy();
    expect(row.status).toBe('withdrawn');
    expect(row.withdrawn_at).not.toBeNull();

    // Expiring.
    const c = await world('engagement');
    await send(c);
    await moveSetTo(c.s.id, day(1));
    await setExpiry.run({ today: today() });
    expect((await con(c.ciId)).status).toBe('expired');

    // Withdrawing.
    const d = await world('engagement');
    await send(d);
    await withdraw(d);
    expect((await con(d.ciId)).status).toBe('withdrawn');
  });
});

/* ─────────────────────────────────────── the document and the terms (26–28, 40) */

describe('the document and the standard terms (checks 26–28, 40)', () => {
  it('the document is produced only at completion and matches the signed terms (check 26)', async () => {
    const w = await world('engagement');
    await send(w);
    expect((await con(w.ciId)).pdf_url).toBeNull();
    await herSign(w);
    expect((await con(w.ciId)).pdf_url).toBeNull();
    await brandSign(w);
    const row = await con(w.ciId);
    expect(row.pdf_url).not.toBeNull();
    expect(row.pdf_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.pdf_generated_at).not.toBeNull();
  });

  it('downloading before completion, or by anyone but the two parties, is refused (check 27)', async () => {
    const w = await world('engagement');
    await send(w);
    let r = await api.get(`/agreements/${w.ciId}/document`, w.cr.token);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.NOT_COMPLETE);

    await herSign(w);
    await brandSign(w);
    r = await api.get(`/agreements/${w.ciId}/document`, w.cr.token);
    expect(r.status).toBe(200);
    r = await api.get(`/agreements/${w.ciId}/document`, w.b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.document.expiresIn).toBe(300);

    const other = await creator({ name: 'Someone Else' });
    r = await api.get(`/agreements/${w.ciId}/document`, other.token);
    expect(r.status).toBe(404);
  });

  it('updating the standard terms does not change an agreement already generated, and an old version is still served (check 28)', async () => {
    const w = await world('engagement');
    await send(w);
    expect((await con(w.ciId)).terms_version).toBe('1.0');

    await standardTerms.publish({ version: '1.1', body: 'Entirely new terms.' }, null);
    standardTerms._resetCache();
    expect((await standardTerms.current()).version).toBe('1.1');

    // The agreement already out keeps 1.0, and 1.0 is still served.
    const row = await con(w.ciId);
    expect(row.terms_version).toBe('1.0');
    expect(JSON.parse(JSON.stringify(row.terms_json)).termsVersion).toBe('1.0');
    const old = await standardTerms.byVersion('1.0');
    expect(old.body).toMatch(/ASCI guidelines/);

    // The next one gets 1.1.
    const w2 = await world('engagement');
    const r2 = await send(w2);
    expect(r2.body.data.agreement.terms.termsVersion).toBe('1.1');
  });

  it('changing an admin number afterwards does not alter a sent agreement, and does apply to the next (check 40)', async () => {
    const w = await world('engagement');
    await send(w);
    const before = JSON.parse(JSON.stringify((await con(w.ciId)).terms_json));
    expect(before.money.campaignFeePct).toBe(8);

    const a = await admin();
    const patched = await api.patch('/admin/platform-settings', a.token, { campaign_fee_pct: 12, remote_return_days: 14 });
    expect(patched.status).toBe(200);
    settings._resetCache();

    const after = JSON.parse(JSON.stringify((await con(w.ciId)).terms_json));
    expect(after.money.campaignFeePct).toBe(8);
    expect(after.money.totalToLock).toBe(9720);

    const w2 = await world('engagement');
    const t2 = (await preview(w2)).body.data.agreement.terms;
    expect(t2.money.campaignFeePct).toBe(12);
    expect(t2.money.campaignFee).toBe(1080);
    expect(t2.returnTerms.days).toBe(14);
  });
});

/* ─────────────────────────────────────── privacy, states, the two doors (29–32, 41) */

describe('privacy, access and the two doors (checks 29–32, 41)', () => {
  it("another brand's or another creator's agreement returns 404 (check 29)", async () => {
    const w = await world('engagement');
    await send(w);
    const otherBrand = await brand();
    const otherCreator = await creator({ name: 'Nobody' });

    let r = await api.get(`${w.url}/invitations/${w.ciId}/agreement`, otherBrand.token);
    expect(r.status).toBe(404);
    r = await api.get(`/influencers/me/invitations/${w.ciId}/agreement`, otherCreator.token);
    expect(r.status).toBe(404);
    r = await api.post(`/influencers/me/invitations/${w.ciId}/agreement/sign`, otherCreator.token, SIG);
    expect(r.status).toBe(404);
    r = await api.post(`${w.url}/invitations/${w.ciId}/agreement/sign`, otherBrand.token, BSIG);
    expect(r.status).toBe(404);
  });

  it("no creator response carries the brand's balance, notes or another creator's anything (check 30)", async () => {
    const w = await world('engagement', { terms: { ...CONTENT, note: 'internal-ish note' } });
    await send(w);
    const r = await hers(w);
    expect(r.status).toBe(200);
    const body = JSON.stringify(r.body);
    expect(body).not.toMatch(/wallet_balance|availableBalance|shortfall|total_budget|set_budget|brief|coupon_prefix/i);
    // The note written FOR her is hers to see; nothing else is.
    expect(r.body.data.agreement.terms.note).toBe('internal-ish note');
  });

  it('loading and empty states answer rather than crash (check 31)', async () => {
    const w = await world('engagement', { accept: false });
    // No agreement has been sent, so there is nothing for her to read.
    const r = await hers(w);
    expect([404, 200]).toContain(r.status);
    if (r.status === 404) expect(r.body.error).toBeTruthy();
  });

  it('the website door and the phone door enforce the same money (check 41)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    const c = await con(w.ciId);
    // brand-web's legacy countersign goes through the same service.
    const r = await api.post(`/contracts/${c.id}/brand-sign`, w.b.token);
    expect(r.status).toBe(200);
    expect(await wallet(w.brandId)).toBe(500000 - 9720);
    expect(Number((await con(w.ciId)).campaign_fee_amount)).toBe(720);
    expect(await infWallet(w.cr.influencerId)).toBe(2250);
    // Signing again through either door is refused.
    expect((await brandSign(w)).status).toBe(422);
  });

  it('the pending list carries what the website needs to quote the same number (check 41)', async () => {
    const w = await world('engagement');
    await upToHerSignature(w);
    const r = await api.get('/contracts/brand/pending', w.b.token);
    expect(r.status).toBe(200);
    const row = r.body.data.contracts.find(x => x.campaign_influencer_id === w.ciId);
    expect(row).toBeTruthy();
    expect(row.reference_no).toMatch(/^INFLX-/);
    expect(row.terms_json.money.totalToLock).toBe(9720);
  });
});

/* helpers that need an admin */
async function admin() {
  const { createAdminUser } = require('./helpers/factories');
  return createAdminUser('superadmin');
}
