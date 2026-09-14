'use strict';

/**
 * The brief goes straight to signing, and the contract carries the whole deal.
 * Contract: features/brief-straight-to-signing
 *
 * Founder, 2026-08-28: *"when i send detailed campaign to one creator, it is sitting in collab
 * tab instead going for signing tab... it should contain all details of campaign clearly."*
 *
 * Runs through scripts/run-test-file.js. The test database has been unreachable since 22 Aug;
 * every assertion here needs none.
 */

const fs   = require('fs');
const path = require('path');
const { describeAllocation } = require('../src/services/allocation.model');

const read = (p) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
/** Comments state intent; only shipped code proves it. Three checks in this repo have already
 *  passed by matching their own explanatory comment. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '').replace(/^\s*\/\/.*$/gm, '');

describe('describeAllocation — what she may sell, in words', () => {
  test('the whole store', () => {
    const r = describeAllocation({ alloc_scope: 'store' });
    expect(r.label).toMatch(/Everything/);
    expect(r.detail).toMatch(/Any product/);
  });

  test('one category names it, and says what does NOT count', () => {
    const r = describeAllocation({ alloc_scope: 'category', alloc_category: 'Sarees' });
    expect(r.label).toBe('Sarees');
    expect(r.detail).toMatch(/Only Sarees/);
    // The half she loses money on if nobody tells her.
    expect(r.detail).toMatch(/anything else do not/);
  });

  test('a category with no name does not invent one', () => {
    const r = describeAllocation({ alloc_scope: 'category', alloc_category: null });
    expect(r.label).toBe('One category');
    expect(r.detail).toMatch(/Ask the brand/);
  });

  test('chosen products are counted', () => {
    expect(describeAllocation({ alloc_scope: 'products', alloc_product_ids: ['a'] }).label).toBe('1 chosen product');
    expect(describeAllocation({ alloc_scope: 'products', alloc_product_ids: ['a', 'b', 'c'] }).label).toBe('3 chosen products');
  });

  test('⚠️ an EMPTY product list is called out, not printed as a number', () => {
    // 'products' scope with nothing in it earns her exactly nothing. Rendering "0 chosen
    // products" and letting her sign it would be the platform hiding a defect behind a count.
    const r = describeAllocation({ alloc_scope: 'products', alloc_product_ids: [] });
    expect(r.label).not.toMatch(/^0 /);
    expect(r.detail).toMatch(/before you sign/);
  });

  test('nothing set says nothing set, and offers no detail to pad it', () => {
    expect(describeAllocation({}).label).toBe('Not set yet');
    expect(describeAllocation({}).detail).toBeNull();
    expect(describeAllocation(null).label).toBe('Not set yet');
  });

  test('every scope returns a usable label — no undefined reaches a screen', () => {
    for (const alloc of [
      { alloc_scope: 'store' },
      { alloc_scope: 'category', alloc_category: 'Kurtas' },
      { alloc_scope: 'products', alloc_product_ids: ['x'] },
      { alloc_scope: 'products', alloc_product_ids: [] },
      { alloc_scope: 'something_from_2027' },
      {},
    ]) {
      const r = describeAllocation(alloc);
      expect(typeof r.label).toBe('string');
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

describe('the contract endpoint carries what she needs to decide', () => {
  const ctl = () => code('../src/controllers/contract.controller.js');

  test('it selects the allocation columns', () => {
    const src = ctl();
    // ⚠️ Matched on 'ci.alloc_category' at first, which the LONGER 'ci.alloc_category_node_id'
    // line satisfies on its own. Deleting the category column left the check green. Anchor to
    // the end of the column so one cannot stand in for the other.
    for (const col of ['ci.alloc_scope,', 'ci.alloc_category,', 'ci.alloc_category_node_id,', 'ci.alloc_product_ids,']) {
      expect([col, src.includes(col)]).toEqual([col, true]);
    }
  });

  test('it selects her offer and its valid window', () => {
    const src = ctl();
    for (const col of ['ci.brand_offer_id', 'ci.offer_valid_from', 'ci.offer_valid_until', 'ci.commission_pct']) {
      expect(src).toContain(col);
    }
    // Named, not just referenced by id — an id on screen tells her nothing.
    expect(src).toContain('bo.name');
    expect(src).toContain('LEFT JOIN brand_offers');
  });

  test('it reads the usage term off the agreement', () => {
    expect(ctl()).toContain("ag.terms_json->'usage'");
  });

  test('and returns BOTH descriptions, computed here rather than on the phone', () => {
    const src = ctl();
    expect(src).toContain('describeAllocation');
    expect(src).toContain('describeUsage');
    expect(src).toContain('usage_text');
    expect(src).toMatch(/sell,/);
  });

  test('a campaign built with no agreement still returns — the join must stay LEFT', () => {
    // A brand can build a campaign without a prior handshake. An INNER join here would 404 the
    // contract screen for every one of them.
    expect(ctl()).toContain('LEFT JOIN collab_agreements');
    expect(ctl()).not.toMatch(/\n\s+JOIN collab_agreements/);
    expect(ctl()).not.toMatch(/\n\s+JOIN brand_offers/);
  });
});

describe('briefing creates a contract she can sign immediately', () => {
  // Item 5 moved the brief door into services/invitationSend.service.js (one service for every
  // invitation row); the rules below are unchanged and now read from there.
  const camp = () => code('../src/services/invitationSend.service.js');

  test('the brief creates the contract ready, not as a draft', () => {
    // The whole bug: she was briefed, landed in Invitations, and had nothing to open.
    expect(camp()).toContain("autoCreate(ci.id, { ready: true })");
  });

  test('and moves her row to accepted so she appears under To sign', () => {
    expect(camp()).toMatch(/UPDATE campaign_influencers SET status = 'accepted'/);
  });

  test('but ONLY when the agreement is clean — a drifted one still asks her first', () => {
    // agreement_warnings already said "they will have to agree again". Skipping straight to a
    // contract on a drifted agreement would make her sign terms she never saw.
    expect(camp()).toContain('if (!plan.agreement || plan.agreement_warnings.length) return false;');
  });

  test('and a failure falls back instead of losing the brief', () => {
    const src = camp();
    expect(src).toMatch(/catch \(err\)/);
    expect(src).toMatch(/falling back to accept-first/);
  });
});

describe('declining after briefing', () => {
  // Item 5: accept and decline live in services/invitationAnswer.service.js, shared by the legacy
  // /offers door and /influencers/me/invitations.
  const off = () => code('../src/services/invitationAnswer.service.js');

  test('she may decline from accepted, which is where briefing now puts her', () => {
    expect(off()).toContain("'accepted'");
  });

  test('her own words are stored', () => {
    expect(off()).toContain('declined_note');
  });

  test('the unsigned contract is MARKED declined, never deleted and never given an invalid status', () => {
    // Item 7 (approval Q8) changed the answer here. It used to be deleted, so
    // that a declined invitation could not sit next to a contract that looked
    // live. Now nothing deletes a contract row — an agreement that once
    // existed is a record, and P15 has to name its ending months later.
    //
    // 'cancelled' is still not a member of contract_status
    // (draft|pending_influencer|pending_brand|active|disputed|withdrawn|declined|expired),
    // so writing one would still throw at the database.
    const src = off();
    expect(src).not.toMatch(/UPDATE contracts SET status = 'cancelled'/);
    expect(src).not.toMatch(/DELETE FROM contracts/);
    expect(src).toMatch(/UPDATE contracts SET status = 'declined'/);
    expect(src).toMatch(/declined_at = now\(\)/);
  });
});
