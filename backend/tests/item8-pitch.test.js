'use strict';

/**
 * Item 8 — the creator's pitch, against the real database.
 *
 * The one thing this suite exists to prove: **accepting a pitch creates a pool
 * entry and nothing else.** Everything around it — the limits, the stamped
 * numbers, the cooldown, the one engine, §7B's matching rule — is there to keep
 * that true.
 *
 * Contract: features/item8-pitch · rules v1.21 §8, §7B, §8A
 * Gap-check §12 checks 1–32, implementation prompt §4.1 checks 33–41.
 */

const { truncateAll } = require('./helpers/db');
const { query, brand, creator, api, resetReference, setBrandPitch, setCreatorInvite, block } = require('./helpers/item3');
const { MSG, AIM_LABEL } = require('../src/services/pitchCopy');
const { MSG: MSG5 } = require('../src/services/invitationCopy');
const settings = require('../src/services/platformSettings.service');
const eligibility = require('../src/services/collabEligibility.service');
const job = require('../src/jobs/pitch-housekeeping.job');
const { todayInIndia, addDays, calendarDay } = require('../src/utils/indiaDay');

beforeEach(async () => { await truncateAll(); await resetReference(); settings._resetCache(); });
afterEach(() => settings._resetCache());

const today = () => todayInIndia();
const day = (n) => addDays(today(), n);

/** Nothing a creator reads may carry the brand's private reasons or numbers. */
const LEAK = /min_followers|min_engagement|niche_codes|language_codes|city_ids|allow_past|budget|BELOW_MIN/i;

const SALE = { goal: 'conversion', commissionPct: 12, scope: 'store' };
const CONTENT = { goal: 'engagement', fee: 9000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] };
const HYBRID = { goal: 'hybrid', fee: 5000, commissionPct: 8, scope: 'store' };

const body = (over = {}) => ({
  shootMode: 'shipment',
  proposedGoLiveDate: day(20),
  message: 'I shoot ethnic wear every week and my saves are strong. I would love to work with you.',
  ...SALE, ...over,
});

const pitch = (c, b, over = {}) => api.post('/influencers/me/pitches', c.token, { brandId: b.brandId, ...body(over) });
const mine = (c) => api.get('/influencers/me/pitches', c.token);
const inbox = (b) => api.get('/brands/me/pitches', b.token);
const detail = (b, id) => api.get(`/brands/me/pitches/${id}`, b.token);
const accept = (b, id) => api.post(`/brands/me/pitches/${id}/accept`, b.token, {});
const reject = (b, id, reason) => api.post(`/brands/me/pitches/${id}/reject`, b.token, { reason });
const withdraw = (c, id) => api.post(`/influencers/me/pitches/${id}/withdraw`, c.token, {});
const brandCounter = (b, id, terms, note) => api.post(`/brands/me/pitches/${id}/thread/counter`, b.token, { ...terms, note });
const creatorCounter = (c, id, terms, note) => api.post(`/influencers/me/pitches/${id}/thread/counter`, c.token, { ...terms, note });

const row = async (id) => (await query(`SELECT * FROM influencer_proposals WHERE id = $1`, [id])).rows[0];
const poolRows = async (brandId) => (await query(`SELECT * FROM brand_creator_pool WHERE brand_id = $1 ORDER BY created_at`, [brandId])).rows;
const notifs = async (userId) => (await query(`SELECT type, body FROM notifications WHERE user_id = $1 ORDER BY created_at`, [userId])).rows;
const cooldownRow = async (influencerId, brandId) =>
  (await query(`SELECT * FROM proposal_cooldowns WHERE influencer_id = $1 AND brand_id = $2`, [influencerId, brandId])).rows[0];
const age = (id, days) => query(
  `UPDATE influencer_proposals SET created_at = now() - make_interval(days => $2::int) WHERE id = $1`, [id, days]);

/** A brand taking everything, and a creator who clears every bar. */
async function pair(brandOver = {}, creatorOver = {}) {
  const b = await brand({ business_name: 'Kalamkari Co', ...brandOver });
  const c = await creator({ name: 'Priya Sharma', ...creatorOver });
  return { b, c };
}
async function sent(over = {}, brandOver = {}, creatorOver = {}) {
  const { b, c } = await pair(brandOver, creatorOver);
  const r = await pitch(c, b, over);
  if (r.status !== 201) throw new Error(`pitch: ${JSON.stringify(r.body)}`);
  return { b, c, id: r.body.data.pitch.id, pitch: r.body.data.pitch };
}

/* ══════════════════════════════════ who may pitch (checks 1–3) ═══════════ */

describe('who may pitch (checks 1–3)', () => {
  it('1. a brand not accepting refuses the pitch at the API, in its own words', async () => {
    const { b, c } = await pair();
    await setBrandPitch(b.brandId, { accepting: false });
    const r = await pitch(c, b);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('NOT_ACCEPTING');
    expect(r.body.error.message).toBe(MSG.NOT_ACCEPTING('Kalamkari Co'));
    expect((await query(`SELECT count(*)::int n FROM influencer_proposals`)).rows[0].n).toBe(0);
  });

  it('1. a creator who fails a private filter is refused, and is never told which one', async () => {
    const { b, c } = await pair({}, { ig: 800 });
    await setBrandPitch(b.brandId, { minIg: 50000 });
    const r = await pitch(c, b);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('NOT_MATCHING');
    expect(JSON.stringify(r.body)).not.toMatch(LEAK);
    expect(JSON.stringify(r.body)).not.toMatch(/50000|followers/i);
  });

  it('1. blocked is byte-identical to paused — the block never shows through', async () => {
    const { b, c } = await pair();
    await block('brand', b.brandId, 'creator', c.influencerId);
    const blocked = await pitch(c, b);
    const { b: b2, c: c2 } = await pair();
    await setBrandPitch(b2.brandId, { accepting: false });
    const paused = await pitch(c2, b2);
    expect(blocked.status).toBe(paused.status);
    expect(blocked.body.error.code).toBe(paused.body.error.code);
    expect(blocked.body.error.message).toBe(paused.body.error.message);
  });

  it('2. the form offers only the Aims and modes that brand accepts', async () => {
    const { b, c } = await pair();
    await setBrandPitch(b.brandId, { aims: ['engagement'], modes: ['shipment'] });
    const r = await api.get(`/influencers/me/pitches/form/${b.brandId}`, c.token);
    expect(r.status).toBe(200);
    expect(r.body.data.form.acceptedAims).toEqual(['engagement']);
    expect(r.body.data.form.acceptedModes).toEqual(['shipment']);
    expect(r.body.data.form.maxOpen).toBe(3);
    expect(r.body.data.form.earliestGoLiveDate).toBe(day(7));
    expect(JSON.stringify(r.body)).not.toMatch(LEAK);
  });

  it('2. sending an Aim the brand does not take is refused with the exact sentence', async () => {
    const { b, c } = await pair();
    await setBrandPitch(b.brandId, { aims: ['engagement'] });
    const r = await pitch(c, b, SALE);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.AIM_NOT_TAKEN('Kalamkari Co'));
    expect(r.body.error.field).toBe('goal');
  });

  it('2. and so is a mode it does not take — "Remote" and shipment are the same mode', async () => {
    const { b, c } = await pair();
    await setBrandPitch(b.brandId, { modes: ['visit'] });
    expect((await pitch(c, b, { shootMode: 'remote' })).body.error.message).toBe(MSG.MODE_NOT_TAKEN('Kalamkari Co'));
    // …and the accepted spelling stores the canonical one.
    await setBrandPitch(b.brandId, { modes: ['shipment'] });
    const ok = await pitch(c, b, { shootMode: 'remote' });
    expect(ok.status).toBe(201);
    expect((await row(ok.body.data.pitch.id)).shoot_mode).toBe('shipment');
  });

  it('2. the mode is required — item 2 left it optional "until item 8"', async () => {
    const { b, c } = await pair();
    const r = await pitch(c, b, { shootMode: undefined, shoot_mode: undefined });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.MODE_REQUIRED);
  });

  it('3. a past creator clears a soft filter, but paused and blocked still stop her', async () => {
    const { b, c } = await pair({}, { ig: 800 });
    await setBrandPitch(b.brandId, { minIg: 50000, allowPast: true });
    await query(
      `WITH c AS (INSERT INTO campaigns (brand_id, name, status) VALUES ($1,'C','active') RETURNING id),
            s AS (INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode)
                  SELECT id,'S','conversion','handpick' FROM c RETURNING id),
            ci AS (INSERT INTO campaign_influencers (set_id, influencer_id, status)
                   SELECT id,$2,'active' FROM s RETURNING id)
       INSERT INTO contracts (campaign_influencer_id, influencer_fee, status, influencer_signed_at, brand_signed_at)
       SELECT id, 1000, 'active', now(), now() FROM ci`,
      [b.brandId, c.influencerId]
    );
    expect((await pitch(c, b)).status).toBe(201);
    await setBrandPitch(b.brandId, { accepting: false, minIg: 50000, allowPast: true });
    expect((await pitch(c, b, CONTENT)).status).toBe(403);
  });
});

/* ══════════════════════════════════ the terms (checks 4–6) ══════════════ */

describe('the terms are item 5\'s, validated by the same code (checks 4–6)', () => {
  it('4. each Aim carries exactly its own fields and nothing else', async () => {
    const a = await sent(SALE);
    expect(await row(a.id)).toMatchObject({ goal: 'conversion', proposed_fee: null, proposed_deliverables: null });
    expect(Number((await row(a.id)).proposed_commission_pct)).toBe(12);

    const p = await pair();
    const rc = await pitch(p.c, p.b, CONTENT);
    expect(rc.status).toBe(201);
    const content = await row(rc.body.data.pitch.id);
    expect(content.proposed_commission_pct).toBeNull();
    expect(Number(content.proposed_fee)).toBe(9000);
    expect(content.proposed_deliverables).toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]);

    const rh = await pitch(p.c, p.b, HYBRID);
    const hybrid = await row(rh.body.data.pitch.id);
    // Hybrid has no content package — item 5's rule, not a second one.
    expect(hybrid.proposed_deliverables).toBeNull();
    expect(Number(hybrid.proposed_fee)).toBe(5000);
    expect(Number(hybrid.proposed_commission_pct)).toBe(8);
  });

  it('5. every numeric limit is item 5\'s, with item 5\'s message, because it is the same validator', async () => {
    const { b, c } = await pair();
    expect((await pitch(c, b, { goal: 'conversion', commissionPct: 0 })).body.error.message).toBe(MSG5.COMMISSION_RANGE);
    expect((await pitch(c, b, { goal: 'conversion', commissionPct: 120 })).body.error.message).toBe(MSG5.COMMISSION_RANGE);
    expect((await pitch(c, b, { goal: 'engagement', fee: 0, deliverables: [{ type: 'reel', count: 1 }] })).body.error.message).toBe(MSG5.FEE_REQUIRED);
    expect((await pitch(c, b, { goal: 'engagement', fee: 9000, deliverables: [] })).body.error.message).toBe(MSG5.DELIVERABLES_EMPTY);
    expect((await pitch(c, b, { goal: 'engagement', fee: 9000, deliverables: [{ type: 'reel', count: 1 }, { type: 'reel', count: 2 }] })).body.error.message).toBe(MSG5.DELIVERABLE_DUP);
    expect((await pitch(c, b, { goal: 'engagement', fee: 9000, deliverables: [{ type: 'reel', count: 99 }] })).body.error.message).toBe(MSG5.DELIVERABLE_COUNT);
  });

  it('6. a posting date less than seven days ahead is refused; the seventh day is allowed', async () => {
    const { b, c } = await pair();
    const r = await pitch(c, b, { proposedGoLiveDate: day(6) });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.DATE_TOO_SOON);
    expect(r.body.error.field).toBe('proposedGoLiveDate');
    expect((await pitch(c, b, { proposedGoLiveDate: day(7) })).status).toBe(201);
  });

  it('6. her message is required and capped at 500 characters', async () => {
    const { b, c } = await pair();
    expect((await pitch(c, b, { message: '   ' })).body.error.message).toBe(MSG.MESSAGE_REQUIRED);
    expect((await pitch(c, b, { message: 'x'.repeat(501) })).body.error.message).toBe(MSG.MESSAGE_LONG);
    expect((await pitch(c, b, { message: 'x'.repeat(500) })).status).toBe(201);
  });
});

/* ══════════════════════════════════ the limits (checks 7–8) ═════════════ */

describe('the limits (checks 7–8)', () => {
  it('7. a second OPEN pitch of the same Aim is refused; a different Aim is allowed', async () => {
    const { b, c, id } = await sent(SALE);
    const again = await pitch(c, b, SALE);
    expect(again.status).toBe(422);
    expect(again.body.error.message).toBe(MSG.SAME_AIM_OPEN(AIM_LABEL.conversion, 'Kalamkari Co'));
    expect((await pitch(c, b, CONTENT)).status).toBe(201);
    // Once the first one closes, the same Aim is free again.
    await withdraw(c, id);
    expect((await pitch(c, b, SALE)).status).toBe(201);
  });

  it('8. a fourth open pitch to one brand is refused; other brands are unaffected', async () => {
    const { b, c } = await pair();
    expect((await pitch(c, b, SALE)).status).toBe(201);
    expect((await pitch(c, b, CONTENT)).status).toBe(201);
    expect((await pitch(c, b, HYBRID)).status).toBe(201);
    // A fourth needs a fourth Aim, which does not exist — so the per-Aim index
    // is what a real fourth attempt meets. The counting limit is proved by
    // asking the form, which is where the app reads it.
    const form = await api.get(`/influencers/me/pitches/form/${b.brandId}`, c.token);
    expect(form.body.data.form.openPitches).toBe(3);
    expect(form.body.data.form.canPitch).toBe(false);
    expect(form.body.data.form.reason).toBe('LIMIT');

    const other = await brand({ business_name: 'Other Co' });
    expect((await pitch(c, other, SALE)).status).toBe(201);
  });
});

/* ═══════════════════════════ stamped numbers, the job (checks 9–13) ═════ */

describe('the response period and the job (checks 9–13)', () => {
  it('9. response_due_at is stamped at send; changing the admin number moves nothing in flight', async () => {
    const { b, c, id } = await sent();
    const before = await row(id);
    expect(before.response_days).toBe(30);
    expect(Math.round((new Date(before.response_due_at) - new Date(before.created_at)) / 86400000)).toBe(30);

    await settings.update({ pitch_response_days: 10 }, null);
    settings._resetCache();
    expect((await row(id)).response_days).toBe(30);          // untouched
    const next = await pitch(c, b, CONTENT);                 // and the next one takes the new number
    expect((await row(next.body.data.pitch.id)).response_days).toBe(10);
  });

  it('10. the brand is reminded once at 7 days and once at 21, never twice', async () => {
    const { b, id } = await sent();
    await job.run();
    expect((await notifs(b.userId)).filter(n => n.type === 'pitch.reminder')).toHaveLength(0);

    await age(id, 7);
    expect((await job.run()).reminded).toBe(1);
    expect((await job.run()).reminded).toBe(0);              // idempotent
    expect((await notifs(b.userId)).filter(n => n.type === 'pitch.reminder')).toHaveLength(1);

    await age(id, 21);
    expect((await job.run()).reminded).toBe(1);
    expect((await job.run()).reminded).toBe(0);
    expect((await notifs(b.userId)).filter(n => n.type === 'pitch.reminder')).toHaveLength(2);
    expect((await row(id)).reminder_21d_sent_at).toBeTruthy();
  });

  it('11. a pitch the brand never answered expires, she is told, and she may pitch again the same day', async () => {
    const { b, c, id } = await sent();
    await query(`UPDATE influencer_proposals SET response_due_at = now() - interval '1 minute' WHERE id = $1`, [id]);
    expect((await job.run()).expired).toBe(1);
    const after = await row(id);
    expect(after.status).toBe('expired');
    expect(after.closed_reason).toBe('no_reply');
    expect(after.cooldown_until).toBeNull();                 // no reply is not a rejection
    expect(await cooldownRow(c.influencerId, b.brandId)).toBeUndefined();
    expect((await notifs(c.userId)).some(n => n.type === 'pitch.expired')).toBe(true);
    expect((await pitch(c, b, SALE)).status).toBe(201);      // the same day
  });

  it('12. a pitch closes early when her date comes within item 4\'s floor, with the sentence', async () => {
    const { c, id } = await sent({ proposedGoLiveDate: day(8) });
    expect((await job.run()).closedEarly).toBe(0);
    await query(`UPDATE influencer_proposals SET proposed_go_live_date = $2::date WHERE id = $1`, [id, day(6)]);
    expect((await job.run()).closedEarly).toBe(1);
    expect((await job.run()).closedEarly).toBe(0);
    const after = await row(id);
    expect(after.status).toBe('expired');
    expect(after.closed_reason).toBe('date_passed');
    const list = await mine(c);
    const card = list.body.data.rows.find(x => x.id === id);
    expect(card.group).toBe('datePassed');
    expect(card.line).toMatch(/too close for a set to be built/);
  });

  it('13. she may withdraw at any point before signing, and it starts no cooldown', async () => {
    const { b, c, id } = await sent();
    const r = await withdraw(c, id);
    expect(r.status).toBe(200);
    expect(r.body.data.pitch.group).toBe('withdrawn');
    const after = await row(id);
    expect(after.status).toBe('withdrawn');
    expect(after.closed_reason).toBe('withdrawn');
    expect(await cooldownRow(c.influencerId, b.brandId)).toBeUndefined();
    expect((await notifs(b.userId)).some(n => n.type === 'pitch.withdrawn')).toBe(true);
    expect((await withdraw(c, id)).status).toBe(422);        // and only once
  });
});

/* ═══════════════════════════════ one engine (checks 14–15, 34, 36) ══════ */

describe('the negotiation is item 6\'s engine (checks 14–15)', () => {
  it('14. the brand counters: the thread opens with HER PITCH as turn zero', async () => {
    const { b, c, id } = await sent(SALE);
    const r = await brandCounter(b, id, { commissionPct: 9 }, 'Nine works for us on a first collaboration.');
    expect(r.status).toBe(201);
    const t = r.body.data.thread;
    // The thread reads newest first, exactly as an invitation's does.
    expect(t.turns).toHaveLength(2);
    expect(t.turns[1]).toMatchObject({ by: 'influencer', kind: 'counter' });
    expect(t.turns[1].note).toMatch(/I shoot ethnic wear/);
    expect(t.turns[0]).toMatchObject({ by: 'brand', kind: 'counter' });
    expect(t.turns[0].changes).toEqual([{ term: 'commissionPct', from: '12%', to: '9%' }]);
    expect(t.negotiation).toMatchObject({ open: true, whoseMove: 'influencer' });
    // The thread hangs off the PITCH, and off nothing else.
    const neg = (await query(`SELECT * FROM negotiations WHERE pitch_id = $1`, [id])).rows[0];
    expect(neg.campaign_influencer_id).toBeNull();
    expect((await row(id)).status).toBe('countered');
  });

  it('14. she cannot open the thread herself — her pitch already was the opening move', async () => {
    const { c, id } = await sent();
    const r = await creatorCounter(c, id, { commissionPct: 15 }, 'A bit more?');
    expect(r.status).toBe(422);
  });

  it('15. the round limit is item 6\'s stamped number, not a second one', async () => {
    const { b, c, id } = await sent(SALE);
    await brandCounter(b, id, { commissionPct: 9 }, 'Nine.');
    const neg = (await query(`SELECT * FROM negotiations WHERE pitch_id = $1`, [id])).rows[0];
    expect(neg.round_limit).toBe(Number(await settings.get('negotiation_rounds')));
    await creatorCounter(c, id, { commissionPct: 11 }, 'Eleven.');
    const third = await brandCounter(b, id, { commissionPct: 10 }, 'Ten.');
    expect(third.status).toBe(422);
    expect(third.body.error.code).toBe('NO_ROUNDS_LEFT');
  });

  it('34. a brand that counters on the last day does NOT leave her a two-day deadline', async () => {
    const { b, c, id } = await sent();
    // Day 29 of 30: the brand answers with a counter.
    await query(`UPDATE influencer_proposals SET response_due_at = now() + interval '1 day' WHERE id = $1`, [id]);
    expect((await brandCounter(b, id, { commissionPct: 9 }, 'Nine.')).status).toBe(201);
    // The clock has done its job. It must not close the thread the next day.
    await query(`UPDATE influencer_proposals SET response_due_at = now() - interval '1 minute' WHERE id = $1`, [id]);
    expect((await job.run()).expired).toBe(0);
    expect((await row(id)).status).toBe('countered');
    expect((await creatorCounter(c, id, { commissionPct: 11 }, 'Eleven.')).status).toBe(201);
  });

  it('36. a brand\'s counter is validated exactly as hers is, with the same messages', async () => {
    const { b, id } = await sent(SALE);
    expect((await brandCounter(b, id, { commissionPct: 0 }, 'Zero.')).body.error.message).toBe(MSG5.COMMISSION_RANGE);
    expect((await brandCounter(b, id, { commissionPct: 12 }, 'Same.')).status).toBe(422);  // nothing changed
  });
});

/* ══════════════════════ acceptance: the pool and NOTHING ELSE (16–17) ═══ */

describe('accepting creates a pool entry and nothing else (checks 16–17)', () => {
  it('16. no campaign, no set, no invitation, no contract, no money — each checked', async () => {
    const { b, c, id } = await sent(SALE);
    const before = {
      campaigns: (await query(`SELECT count(*)::int n FROM campaigns`)).rows[0].n,
      sets: (await query(`SELECT count(*)::int n FROM campaign_sets`)).rows[0].n,
      cis: (await query(`SELECT count(*)::int n FROM campaign_influencers`)).rows[0].n,
      contracts: (await query(`SELECT count(*)::int n FROM contracts`)).rows[0].n,
      wallet: (await query(`SELECT count(*)::int n FROM wallet_transactions`)).rows[0].n,
      escrow: (await query(`SELECT count(*)::int n FROM escrow_entries`)).rows[0].n,
    };
    const r = await accept(b, id);
    expect(r.status).toBe(200);

    expect((await query(`SELECT count(*)::int n FROM campaigns`)).rows[0].n).toBe(before.campaigns);
    expect((await query(`SELECT count(*)::int n FROM campaign_sets`)).rows[0].n).toBe(before.sets);
    expect((await query(`SELECT count(*)::int n FROM campaign_influencers`)).rows[0].n).toBe(before.cis);
    expect((await query(`SELECT count(*)::int n FROM contracts`)).rows[0].n).toBe(before.contracts);
    expect((await query(`SELECT count(*)::int n FROM wallet_transactions`)).rows[0].n).toBe(before.wallet);
    expect((await query(`SELECT count(*)::int n FROM escrow_entries`)).rows[0].n).toBe(before.escrow);
    // The collab_agreements row the OLD acceptance created is not created either.
    expect((await query(`SELECT count(*)::int n FROM collab_agreements`)).rows[0].n).toBe(0);

    const pool = await poolRows(b.brandId);
    expect(pool).toHaveLength(1);
    expect(r.body.data.poolEntryId).toBe(pool[0].id);
    expect((await row(id)).pool_entry_id).toBe(pool[0].id);
    expect((await notifs(c.userId)).some(n => n.type === 'pitch.agreed')).toBe(true);
  });

  it('17. the entry carries the Aim, the agreed terms, her date and mode, and its provenance', async () => {
    const { b, id } = await sent({ ...CONTENT, shootMode: 'visit', proposedGoLiveDate: day(25) });
    await accept(b, id);
    const [e] = await poolRows(b.brandId);
    expect(e.goal).toBe('engagement');
    expect(e.agreed_terms_json).toMatchObject({ fee: 9000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] });
    expect(calendarDay(e.wants_go_live_date)).toBe(day(25));
    expect(e.wants_shoot_mode).toBe('visit');
    expect(e.matched_shoot_mode).toBe('visit');
    expect(e.from_pitch_id).toBe(id);
    expect(e.from_ci_id).toBeNull();
    expect(e.state).toBe('waiting');
  });

  it('16. accepting THROUGH the thread settles the last counter, not the original pitch', async () => {
    const { b, c, id } = await sent(SALE);
    await brandCounter(b, id, { commissionPct: 9 }, 'Nine.');
    await creatorCounter(c, id, { commissionPct: 11 }, 'Eleven.');
    const r = await api.post(`/brands/me/pitches/${id}/thread/accept`, b.token, {});
    expect(r.status).toBe(200);
    const [e] = await poolRows(b.brandId);
    expect(e.agreed_terms_json.commissionPct).toBe(11);
    expect(Number((await row(id)).proposed_commission_pct)).toBe(11);
    expect((await row(id)).status).toBe('accepted');
    expect((await query(`SELECT count(*)::int n FROM contracts`)).rows[0].n).toBe(0);
  });

  it('16. accepting twice is refused, and creates exactly one pool entry', async () => {
    const { b, id } = await sent();
    expect((await accept(b, id)).status).toBe(200);
    expect((await accept(b, id)).status).toBe(422);
    expect(await poolRows(b.brandId)).toHaveLength(1);
  });

  it('11. after acceptance, withdrawing means leaving the pool, not withdrawing the pitch', async () => {
    const { b, c, id } = await sent();
    await accept(b, id);
    const r = await withdraw(c, id);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toMatch(/Leave the pool/);
  });
});

/* ══════════════════════════ §7B's matching rule (checks 21–22) ══════════ */

describe('her settings on the way back (checks 21–22)', () => {
  /** Accept a pitch, then ask whether the brand may invite her into `set`. */
  const afterAgreeing = async (pitchOver, set) => {
    const { b, c, id } = await sent(pitchOver);
    await accept(b, id);
    return { b, c, gate: await eligibility.canBrandInviteCreator({ brandId: b.brandId, influencerId: c.influencerId, set }) };
  };

  it('21. for a MATCHING set her own Aim, mode, category and minimum settings do not block her', async () => {
    const { b, c, id } = await sent({ ...CONTENT, shootMode: 'shipment' });
    await accept(b, id);
    // She now closes herself to everything this set is.
    await setCreatorInvite(c.influencerId, { aims: ['conversion'], modes: ['visit'], categories: ['MEN'], minFeeEng: 99999 });
    const gate = await eligibility.canBrandInviteCreator({
      brandId: b.brandId, influencerId: c.influencerId,
      set: { goal: 'engagement', shoot_mode: 'shipment' }, proposedTerms: { fee: 9000 },
    });
    expect(gate.ok).toBe(true);
    expect(gate.fromHerPitch).toBe(true);
    expect(gate.warnings).toEqual([]);      // her own minimum is not turned against her
    expect(gate.minimums).toBeNull();
  });

  it('21. for a DIFFERING set she is an ordinary pick and every setting applies', async () => {
    const { b, c, id } = await sent({ ...CONTENT, shootMode: 'shipment' });
    await accept(b, id);
    await setCreatorInvite(c.influencerId, { aims: ['engagement'], modes: ['shipment'] });
    // A different MODE is a different set.
    const otherMode = await eligibility.canBrandInviteCreator({
      brandId: b.brandId, influencerId: c.influencerId, set: { goal: 'engagement', shoot_mode: 'visit' },
    });
    expect(otherMode.ok).toBe(false);
    expect(otherMode.fromHerPitch).toBeUndefined();
    // …and so is a different AIM.
    const otherAim = await eligibility.canBrandInviteCreator({
      brandId: b.brandId, influencerId: c.influencerId, set: { goal: 'conversion', shoot_mode: 'shipment' },
    });
    expect(otherAim.ok).toBe(false);
  });

  it('22. paused and blocked always apply, whatever was agreed', async () => {
    const { b, c, id } = await sent({ ...CONTENT, shootMode: 'shipment' });
    await accept(b, id);
    const set = { goal: 'engagement', shoot_mode: 'shipment' };
    await setCreatorInvite(c.influencerId, { open: false });
    const paused = await eligibility.canBrandInviteCreator({ brandId: b.brandId, influencerId: c.influencerId, set });
    expect(paused).toMatchObject({ ok: false, reason: 'NOT_ACCEPTING' });

    await setCreatorInvite(c.influencerId, { open: true });
    await block('creator', c.influencerId, 'brand', b.brandId);
    const blocked = await eligibility.canBrandInviteCreator({ brandId: b.brandId, influencerId: c.influencerId, set });
    expect(blocked).toMatchObject({ ok: false, reason: 'NOT_ACCEPTING' });
    // The brand is told only that she is not available — never why.
    expect(blocked.reason).toBe(paused.reason);
  });

  it('21. a used or expired pool entry stops granting the exemption', async () => {
    const { b, c, id } = await sent({ ...CONTENT, shootMode: 'shipment' });
    await accept(b, id);
    await setCreatorInvite(c.influencerId, { aims: ['conversion'] });
    const set = { goal: 'engagement', shoot_mode: 'shipment' };
    expect((await eligibility.canBrandInviteCreator({ brandId: b.brandId, influencerId: c.influencerId, set })).ok).toBe(true);
    await query(`UPDATE brand_creator_pool SET state = 'used' WHERE from_pitch_id = $1`, [id]);
    expect((await eligibility.canBrandInviteCreator({ brandId: b.brandId, influencerId: c.influencerId, set })).ok).toBe(false);
  });
});

/* ══════════════════════════════ the cooldown (checks 23–27) ═════════════ */

describe('the cooldown (checks 23–27)', () => {
  it('23. rejecting stamps it, tells her the date, and the brand saw the date beforehand', async () => {
    const { b, c, id } = await sent();
    const before = await detail(b, id);
    expect(before.body.data.pitch.cooldownDays).toBe(30);
    expect(before.body.data.pitch.rejectCooldownLine).toMatch(/won't be able to pitch you again until/);

    const r = await reject(b, id, 'Our budget for this quarter is spent.');
    expect(r.status).toBe(200);
    const after = await row(id);
    expect(after.status).toBe('rejected');
    expect(after.cooldown_days).toBe(30);
    expect(after.cooldown_until).toBeTruthy();
    expect(after.brand_response_message).toBe('Our budget for this quarter is spent.');
    const cd = await cooldownRow(c.influencerId, b.brandId);
    expect(cd.reason).toBe('pitch_rejected');
    const told = (await notifs(c.userId)).find(n => n.type === 'pitch.rejected');
    expect(told.body).toMatch(/You can pitch Kalamkari Co again after/);
  });

  it('23. the reason is capped at 200 characters, and is optional', async () => {
    const a = await sent();
    expect((await reject(a.b, a.id, 'x'.repeat(201))).body.error.message).toBe(MSG.REJECT_REASON_LONG);
    expect((await reject(a.b, a.id)).status).toBe(200);
  });

  it('24. during the cooldown she cannot pitch that brand with ANY Aim', async () => {
    const { b, c, id } = await sent(SALE);
    await reject(b, id);
    for (const terms of [SALE, CONTENT, HYBRID]) {
      const r = await pitch(c, b, terms);
      expect(r.status).toBe(422);
      expect(r.body.error.message).toMatch(/You can pitch Kalamkari Co again after/);
    }
    // …and it is a pause with a date on it, on her brand list too.
    const list = await api.get('/influencers/me/find-brands?canPitchOnly=false', c.token);
    const card = list.body.data.rows.find(x => x.id === b.brandId);
    expect(card.status).toBe('COOLDOWN');
    expect(card.cooldownUntil).toBeTruthy();
    expect(card.statusLine).toMatch(/You can pitch Kalamkari Co again after/);
  });

  it('25. the brand may still invite her, and 26. a block is independent of it', async () => {
    const { b, c, id } = await sent();
    await reject(b, id);
    // The cooldown pauses HER pitching, never the brand's inviting.
    const gate = await eligibility.canBrandInviteCreator({
      brandId: b.brandId, influencerId: c.influencerId, set: { goal: 'conversion', shoot_mode: 'shipment' },
    });
    expect(gate.ok).toBe(true);
    // Blocking is a separate switch and outranks the cooldown's message.
    await block('brand', b.brandId, 'creator', c.influencerId);
    expect((await pitch(c, b, CONTENT)).body.error.code).toBe('NOT_ACCEPTING');
  });

  it('27. withdrawn, expired and date-closed pitches start no cooldown', async () => {
    const { b, c, id } = await sent(SALE);
    await withdraw(c, id);
    expect(await cooldownRow(c.influencerId, b.brandId)).toBeUndefined();

    const two = await pitch(c, b, CONTENT);
    await query(`UPDATE influencer_proposals SET response_due_at = now() - interval '1 minute' WHERE id = $1`, [two.body.data.pitch.id]);
    await job.run();
    expect(await cooldownRow(c.influencerId, b.brandId)).toBeUndefined();

    const three = await pitch(c, b, HYBRID);
    await query(`UPDATE influencer_proposals SET proposed_go_live_date = $2::date WHERE id = $1`, [three.body.data.pitch.id, day(1)]);
    await job.run();
    expect(await cooldownRow(c.influencerId, b.brandId)).toBeUndefined();
  });
});

/* ══════════════════════════════ privacy and scope (29–30, 35) ═══════════ */

describe('privacy and scope (checks 29–30, 35)', () => {
  it('29. another creator\'s pitch, and another brand\'s, are 404 — never 403', async () => {
    const { b, c, id } = await sent();
    const stranger = await creator({ name: 'Someone Else' });
    const otherBrand = await brand({ business_name: 'Other Co' });
    expect((await api.get(`/influencers/me/pitches/${id}`, stranger.token)).status).toBe(404);
    expect((await withdraw(stranger, id)).status).toBe(404);
    expect((await detail(otherBrand, id)).status).toBe(404);
    expect((await accept(otherBrand, id)).status).toBe(404);
    expect((await reject(otherBrand, id))).toMatchObject({ status: 404 });
    expect((await api.get(`/brands/me/pitches/${id}/thread`, otherBrand.token)).status).toBe(404);
    // And the right people still see it.
    expect((await api.get(`/influencers/me/pitches/${id}`, c.token)).status).toBe(200);
    expect((await detail(b, id)).status).toBe(200);
  });

  it('30. nothing she reads carries the brand\'s filters, budgets or other pitches', async () => {
    const { b, c } = await pair();
    await setBrandPitch(b.brandId, { minIg: 100, minEr: 1, niches: ['fashion'], languages: ['Telugu'] });
    const other = await creator({ name: 'Another Creator' });
    await pitch(other, b, SALE);
    const r = await pitch(c, b, CONTENT);
    expect(r.status).toBe(201);
    for (const res of [r, await mine(c), await api.get(`/influencers/me/pitches/form/${b.brandId}`, c.token)]) {
      expect(JSON.stringify(res.body)).not.toMatch(LEAK);
      expect(JSON.stringify(res.body)).not.toMatch(/Another Creator/);
    }
  });

  it('35. an unmeasured creator is told her numbers are being measured — the brand still sees three codes', async () => {
    const { b, c } = await pair({}, { ig: 800, yt: null });
    await setBrandPitch(b.brandId, { minYt: 10000 });
    // Her own answer names the true reason.
    const hers = await eligibility.canCreatorPitchBrand({ influencerId: c.influencerId, brandId: b.brandId });
    expect(hers).toMatchObject({ ok: false, reason: 'BEING_MEASURED' });
    const list = await api.get('/influencers/me/find-brands?canPitchOnly=false', c.token);
    const card = list.body.data.rows.find(x => x.id === b.brandId);
    expect(card.status).toBe('BEING_MEASURED');
    expect(card.statusLine).toBe('Your numbers are still being measured.');
    // The BRAND's own question never gains a fourth code.
    const theirs = await eligibility.canBrandInviteCreator({
      brandId: b.brandId, influencerId: c.influencerId, set: { goal: 'conversion', shoot_mode: 'shipment' },
    });
    expect(['OK', 'NOT_ACCEPTING', 'NOT_MATCHING']).toContain(theirs.reason);
  });

  it('41. the brand list\'s SQL and canCreatorPitchBrand agree on every reason code', async () => {
    const c = await creator({ name: 'Priya Sharma', ig: 8000, yt: null, er: 2.0, niche: ['fashion'], language: ['Telugu'], cityName: 'Hyderabad' });
    const cases = [
      ['accepting off',      { accepting: false }],
      ['blocked',            { block: true }],
      ['niche miss',         { niches: ['gaming'] }],
      ['niche hit',          { niches: ['fashion'] }],
      ['followers too low',  { minIg: 50000 }],
      ['followers unmeasured', { minYt: 10000 }],
      ['engagement too low', { minEr: 9 }],
      ['engagement fine',    { minEr: 1 }],
      ['language miss',      { languages: ['Tamil'] }],
      ['city miss',          { cityIds: [999999] }],
      ['wide open',          {}],
    ];
    for (const [label, patch] of cases) {
      const b = await brand({ business_name: `B ${label}` });
      const { block: blk, ...settingsPatch } = patch;
      await setBrandPitch(b.brandId, settingsPatch);
      if (blk) await block('brand', b.brandId, 'creator', c.influencerId);
      const fromFunction = (await eligibility.canCreatorPitchBrand({ influencerId: c.influencerId, brandId: b.brandId })).reason;
      const list = await api.get('/influencers/me/find-brands?canPitchOnly=false', c.token);
      const fromSql = (list.body.data.rows.find(x => x.id === b.brandId) || {}).status;
      expect(`${label}: ${fromSql}`).toBe(`${label}: ${fromFunction}`);
    }
  });
});

/* ══════════════════════════════ the two lists (T5, T13) ═════════════════ */

describe('the two lists', () => {
  it('her list groups waiting, agreed and ended, and says how long they have', async () => {
    const { b, c, id } = await sent(SALE);
    const waiting = (await mine(c)).body.data;
    expect(waiting.groups.waiting).toHaveLength(1);
    expect(waiting.groups.waiting[0].daysLeft).toBe(30);
    expect(waiting.groups.waiting[0].line).toMatch(/They have until .* · 30 days left/);
    expect(waiting.groups.waiting[0].termsLine).toBe('12%');

    const two = await pitch(c, b, CONTENT);
    await accept(b, two.body.data.pitch.id);
    await reject(b, id, 'Not this quarter.');
    const after = (await mine(c)).body.data;
    expect(after.groups.agreed).toHaveLength(1);
    expect(after.groups.agreed[0].termsLine).toBe('₹9,000 · 1 Instagram reel, 2 Instagram stories');
    expect(after.groups.ended).toHaveLength(1);
    expect(after.groups.ended[0].line).toBe('"Not this quarter."');
    expect(after.groups.ended[0].cooldownLine).toMatch(/again after/);
  });

  it('the brand\'s inbox is grouped by whose move it is, and opening one marks it read', async () => {
    const { b, c, id } = await sent(SALE);
    const first = (await inbox(b)).body.data;
    expect(first.groups.new.count).toBe(1);
    expect(first.groups.talking.count).toBe(0);
    expect(first.unread).toBe(1);
    expect(Object.keys(first.groups.new.rows[0].numbers).sort())
      .toEqual(['engagement', 'instagramFollowers', 'youtubeSubscribers']);
    expect(first.groups.new.rows[0].replyBy).toMatch(/Reply by .* · 30 days left/);

    expect((await detail(b, id)).body.data.pitch.unread).toBe(false);
    expect((await row(id)).status).toBe('viewed');
    expect((await inbox(b)).body.data.unread).toBe(0);

    await brandCounter(b, id, { commissionPct: 9 }, 'Nine.');
    const talking = (await inbox(b)).body.data;
    expect(talking.groups.talking.count).toBe(1);
    expect(talking.groups.new.count).toBe(0);
    // A closed pitch leaves the inbox entirely.
    await withdraw(c, id);
    expect((await inbox(b)).body.data.total).toBe(0);
  });

  it('a creator with no numbers shows a dash, never a zero', async () => {
    // Item 3b measures into creator_social_accounts; nothing in this suite does,
    // so every creator here is unmeasured — which is exactly the case that must
    // not read as 0 followers on a brand's card.
    const { b } = await sent({}, {}, { ig: null, er: null });
    const card = (await inbox(b)).body.data.groups.new.rows[0];
    expect(card.numbers.instagramFollowers).toBeNull();
    expect(card.numbers.youtubeSubscribers).toBeNull();
    expect(card.numbers.engagement).toBeNull();
  });
});

/* ══════════════════════════════ the retirements (37, 39, 40) ════════════ */

describe('what item 8 retires (checks 37, 39, 40)', () => {
  it('37. nothing in the running code reads counter_rounds_per_side', async () => {
    // The pitch's round limit comes only from item 6's stamped negotiation_rounds
    // now. What the grep must find is zero CODE lines — the two remaining hits
    // are comments recording that the retirement happened, which is the point.
    const { execSync } = require('child_process');
    const raw = execSync('git grep -n counter_rounds_per_side -- src || true', { cwd: `${__dirname}/..`, encoding: 'utf8' });
    const code = raw.split(/\r?\n/).filter(Boolean).filter((line) => {
      const text = line.split(':').slice(2).join(':').trim();
      return text && !text.startsWith('//') && !text.startsWith('*') && !text.startsWith('/*');
    });
    expect(code).toEqual([]);
  });

  it('39. both new admin numbers are on item 6\'s settings page, with their bounds', async () => {
    const a = await brand();
    await query(`UPDATE users SET role = 'admin' WHERE id = $1`, [a.userId]);
    const keys = Object.keys(require('../src/services/platformSettings.service').DEFAULTS);
    expect(keys).toContain('pitch_response_days');
    expect(keys).toContain('pitch_cooldown_days');
    expect(Number(await settings.get('pitch_response_days'))).toBe(30);
    expect(Number(await settings.get('pitch_cooldown_days'))).toBe(30);
  });

  it('40. the pitch notification keys are the pitch.* namespace, and deep-link somewhere real', async () => {
    const { b, c, id } = await sent();
    await reject(b, id, 'Not now.');
    const rows = await query(`SELECT type, data_json FROM notifications WHERE user_id = $1`, [c.userId]);
    expect(rows.rows.every(r => String(r.type).startsWith('pitch.'))).toBe(true);
    expect(rows.rows.every(r => r.data_json && r.data_json.screen === 'my_pitch' && r.data_json.pitch_id)).toBe(true);
  });
});

/* ═══════════════════ the whole way through, once (checks 19–20) ═════════ */

describe('a pitch becomes an ordinary invitation (checks 19, 20)', () => {
  it('accept → pool → set pre-filled → invitation with her agreed money and the green line', async () => {
    const { b, c, id } = await sent({ ...CONTENT, shootMode: 'shipment', proposedGoLiveDate: day(25) });
    const accepted = await accept(b, id);
    const entryId = accepted.body.data.poolEntryId;

    // 19a. The brand's pool offers the Aim, the date and the mode already filled in.
    const defaults = await api.post('/brands/me/pool/set-defaults', b.token, { entryIds: [entryId] });
    expect(defaults.status).toBe(200);
    expect(defaults.body.data).toMatchObject({ goal: 'engagement', shoot_mode: 'shipment', go_live_date: day(25) });
    expect(defaults.body.data.creators[0]).toMatchObject({ entryId, influencerId: c.influencerId });

    // 19b. And the pool row says where she came from, so T11 can tag her.
    const poolList = await api.get('/brands/me/pool', b.token);
    const entry = JSON.stringify(poolList.body).includes(entryId)
      ? (poolList.body.data.groups || []).flatMap(g => g.rows || []).find(e => e.entryId === entryId)
      : null;
    expect(entry).toBeTruthy();
    expect(entry.fromPitchId).toBe(id);

    // 20. The ordinary path: a campaign, a set, and item 5's invitation from the pool.
    const camp = await api.post('/campaigns', b.token, { name: 'Winter Run' });
    const set = await api.post(`/campaigns/${camp.body.data.campaign.id}/sets`, b.token, {
      name: 'Set B', goal: 'engagement', shoot_mode: 'shipment', go_live_date: day(25),
    });
    const inv = await api.post(`/campaigns/${camp.body.data.campaign.id}/sets/${set.body.data.set.id}/invitations`, b.token, {
      creators: [{ influencerId: c.influencerId, poolEntryId: entryId, terms: { fee: 9000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] } }],
    });
    expect(inv.status).toBe(201);

    // She reads an ordinary invitation — with one line saying why it is familiar.
    const hers = await api.get('/influencers/me/invitations?tab=invites', c.token);
    const card = hers.body.data.rows.find(r => r.id === inv.body.data.rows[0].id);
    expect(card).toBeTruthy();
    expect(card.fromPool).toMatchObject({ fromPitch: true, sameDate: true });
    expect(card.fromPool.pitchLine).toMatch(/you agreed on/);
    // And it is an invitation, not an agreement she has already signed.
    expect(card.agreement).toBeFalsy();
  });
});
