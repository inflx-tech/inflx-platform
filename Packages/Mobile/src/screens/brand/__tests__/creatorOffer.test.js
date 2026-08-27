const fs = require('fs');
const path = require('path');

const { invitePayload } = require('../../../utils/campaignDraft');

/**
 * Batch B — the offer belongs to a creator.
 * Contract: features/stage-2-offers-parity (P5, C-1…C-5)
 *
 * The wizard asked for an offer once, for the whole set. `campaign_sets` has **no offer columns
 * at all** — checked against production — while `campaign_influencers` has carried
 * `brand_offer_id`, `offer_type`, `offer_config_json` and `offer_valid_until` the whole time,
 * with zero rows using any of them.
 *
 * So this is not a new model. It is the screen catching up with the schema.
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const SET = { goal: 'conversion' };
const CONTENT_SET = { goal: 'engagement' };
const CREATOR = {
  influencer_id: 'i1',
  agreement_id: 'a1',
  name: 'Asha M.',
  terms: { money: { commission_pct: 14 }, time: { post_by: '2026-09-30' } },
  alloc: { alloc_scope: 'store' },
};

describe('C-1 C-2 · the offer rides on the creator, in one shape or the other', () => {
  it('a library pick sends brand_offer_id and nothing else', () => {
    const body = invitePayload({ ...CREATOR, offer: { brand_offer_id: 'o1', name: 'Yoy' } }, SET, null);
    expect(body.brand_offer_id).toBe('o1');
    // Never both. With an id AND a config present, nobody could say which one a shopper got —
    // and the server snapshots a library offer's config at attach time precisely so a later
    // edit to the library cannot change a deal already struck.
    expect(body.offer_type).toBeUndefined();
    expect(body.offer_config_json).toBeUndefined();
  });

  it('a bespoke offer sends the type and config and no id', () => {
    const body = invitePayload({
      ...CREATOR,
      offer: { offer_type: 'discount', offer_config_json: { sub_type: 'pct', value: 20, scope: 'store' } },
    }, SET, null);
    expect(body.offer_type).toBe('discount');
    expect(body.offer_config_json).toEqual({ sub_type: 'pct', value: 20, scope: 'store' });
    expect(body.brand_offer_id).toBeUndefined();
  });

  it("her offer beats the set's", () => {
    const body = invitePayload(
      { ...CREATOR, offer: { brand_offer_id: 'hers' } },
      SET,
      { brand_offer_id: 'the-sets' },
    );
    expect(body.brand_offer_id).toBe('hers');
  });

  it("a draft saved before this change still sends the set's offer", () => {
    // Backwards compatibility, not decoration: a half-built set left open across the OTA would
    // otherwise lose the offer the brand had already chosen.
    const body = invitePayload(CREATOR, SET, { brand_offer_id: 'the-sets' });
    expect(body.brand_offer_id).toBe('the-sets');
  });
});

describe('C-3 · an offer is optional, everywhere', () => {
  it('a creator with none sends no offer fields at all', () => {
    const body = invitePayload(CREATOR, SET, null);
    for (const k of ['brand_offer_id', 'offer_type', 'offer_config_json', 'offer_valid_from', 'offer_valid_until']) {
      expect(body[k]).toBeUndefined();
    }
    // And the rest of the deal is untouched — she is still contracted, still allocated.
    expect(body.commission_pct).toBe(14);
    expect(body.alloc_scope).toBe('store');
  });

  it('a content set never carries an offer, however it is passed', () => {
    // "You are buying posts, not selling through her — there is no basket for an offer to
    // apply to." The server refuses one on an engagement set; sending it would be sending a
    // refusal.
    const body = invitePayload(
      { ...CREATOR, offer: { brand_offer_id: 'o1', valid_until: '2026-09-30' } },
      CONTENT_SET, null,
    );
    expect(body.brand_offer_id).toBeUndefined();
    expect(body.offer_valid_until).toBeUndefined();
  });
});

describe('C-5 · her own window — the founder\'s reason, in the payload', () => {
  it('both dates ride along', () => {
    const body = invitePayload({
      ...CREATOR,
      offer: { brand_offer_id: 'o1', valid_from: '2026-09-01T12:00:00.000Z', valid_until: '2026-09-30T12:00:00.000Z' },
    }, SET, null);
    expect(body.offer_valid_from).toBe('2026-09-01T12:00:00.000Z');
    expect(body.offer_valid_until).toBe('2026-09-30T12:00:00.000Z');
  });

  it('either end may be absent, and absent means no limit', () => {
    const only = invitePayload({ ...CREATOR, offer: { brand_offer_id: 'o1', valid_until: '2026-09-30' } }, SET, null);
    expect(only.offer_valid_from).toBeUndefined();
    expect(only.offer_valid_until).toBe('2026-09-30');
  });

  it('the migration this depends on exists and is additive', () => {
    const sql = fs.readFileSync(
      path.resolve(SRC, '../../../backend/migrations/162_creator_offer_valid_from.sql'), 'utf8');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS offer_valid_from timestamptz/);
    expect(sql).not.toMatch(/NOT NULL/);
  });
});

describe('P5 · the screens are wired, and reachable', () => {
  const wizard = read('screens/brand/BrandSetWizardScreen.js');

  it('the pieces parse', () => {
    for (const f of ['components/brand/CreatorOfferSheet.js', 'components/brand/CategoryPickerModal.js']) {
      expect(() => require(path.join(SRC, f))).not.toThrow();
    }
  });

  it('every creator row can be given an offer', () => {
    expect(wizard).toContain("from '../../components/brand/CreatorOfferSheet'");
    expect(wizard).toContain('onGiveOffer');
    expect(wizard).toContain('Give her an offer');
    expect(wizard).toContain('Change her offer');
    expect(wizard).toContain('<CreatorOfferSheet');
  });

  it('C-4 · saving writes onto THAT creator and nobody else', () => {
    // Keyed by agreement_id. A map that wrote to every row would give one creator's offer to
    // the whole set — which is the exact thing this batch exists to stop.
    expect(wizard).toMatch(/c\.agreement_id === id \? \{ \.\.\.c, offer: next \}/);
  });

  it('the row says what she gives, without opening anything', () => {
    expect(wizard).toContain('Her shoppers get');
    expect(wizard).toContain('function offerLine');
  });

  it('the sheet offers exactly the two routes the founder described', () => {
    const sheet = read('components/brand/CreatorOfferSheet.js');
    expect(sheet).toContain('From your library');
    expect(sheet).toContain('Build a new offer');
    expect(sheet).toContain('She gets no offer');
  });

  it('a bespoke offer does NOT create a library row', () => {
    // "dedicatedly for that campaign, set, influencer". The builder is reused in `inline` mode,
    // which runs every check and hands back the config instead of POSTing it.
    const sheet = read('components/brand/CreatorOfferSheet.js');
    expect(sheet).toMatch(/<OfferBuilderSheet[\s\S]*?inline/);
    expect(sheet).not.toMatch(/<OfferBuilderSheet[\s\S]*?activateByDefault/);

    const builder = read('components/brand/OfferBuilderSheet.js');
    expect(builder).toMatch(/if \(inline\) \{/);
    // The inline branch must sit AFTER validation, or it would be a way to skip it.
    expect(builder.indexOf('if (inline) {')).toBeGreaterThan(builder.indexOf('if (!built.ok)'));
    expect(builder.indexOf('if (inline) {')).toBeLessThan(builder.indexOf('brandApi.createOffer'));
  });
});

describe('M-10 · tokens and helpers still resolve', () => {
  const ig = require(path.join(SRC, 'theme/ig.js')).ig;

  it.each([
    'components/brand/CreatorOfferSheet.js',
    'components/brand/CategoryPickerModal.js',
  ])('%s uses no ig.* token that is missing', (rel) => {
    const used = [...read(rel).matchAll(/\big\.(\w+)/g)].map(m => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const t of new Set(used)) {
      expect(Object.prototype.hasOwnProperty.call(ig, t)).toBe(true);
    }
  });

  it.each([
    'components/brand/CreatorOfferSheet.js',
    'components/brand/CategoryPickerModal.js',
    'components/brand/OfferBuilderSheet.js',
  ])('%s calls only API helpers that exist', (rel) => {
    const api = read('services/api.js');
    const used = [...read(rel).matchAll(/brandApi\.(\w+)\(/g)].map(m => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const name of new Set(used)) {
      expect(api).toMatch(new RegExp(`^\\s+${name}:`, 'm'));
    }
  });

  it('the category picker reads the key the server actually sends', () => {
    // `tree` — the same key BrandCategoryPickerScreen and BrandAllocationScreen read. A guessed
    // fallback key would have hidden a rename instead of failing on it.
    expect(read('components/brand/CategoryPickerModal.js')).toContain('res.data?.tree');
  });
});
