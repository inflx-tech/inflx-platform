'use strict';

/**
 * The shoot starts where the agreement left it, and finishes when people say so.
 * Contract: features/shoot-starts-where-the-agreement-left-it
 *
 * Founder, 2026-08-28, after counter-signing Asha's contract:
 *   "next logical step is shooting plan... But I am not able to see the shoot plan... without
 *   doing anything from both it is saying shoot plan is done... we designed in stage 4 that if it
 *   is store visit then both will mark it as done...if it is remote then creator mark it as
 *   done...all these are absent... pls check entire stage 4 implementation what happened"
 *
 * HER ACTUAL ROW, READ FROM PRODUCTION
 *   collab_agreements.terms_json->>'mode' = 'visit'      both sides agreed a store visit
 *   contracts.production_mode             =  NULL        never carried across
 *   production_events.mode                = 'remote'     defaulted
 *   production_events.status              = 'completed'  at birth
 *
 * Runs through scripts/run-test-file.js — the test database is still unreachable and these
 * assertions need none.
 */

const fs   = require('fs');
const path = require('path');
const { resolveProductionMode, initialStatusFor, MODES } = require('../src/services/productionMode.model');
const parcel = require('../src/services/parcel.service');

const read = (p) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
/** Comments state intent; only shipped code proves it. Six checks in this repo have passed by
 *  matching their own explanatory comment. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '').replace(/^\s*\/\/.*$/gm, '');

describe('which shoot — the agreement already answered it', () => {
  test('⚠️ Asha\'s exact case: contract says nothing, agreement says visit', () => {
    const r = resolveProductionMode({ contractMode: null, agreementMode: 'visit' });
    expect(r.mode).toBe('visit');
    expect(r.source).toBe('agreement');
  });

  test('the contract wins when it actually says something', () => {
    // A brand may deliberately change the arrangement at Approve & Send. That is a later
    // decision by the same two people, not a contradiction.
    const r = resolveProductionMode({ contractMode: 'shipment', agreementMode: 'visit' });
    expect(r.mode).toBe('shipment');
    expect(r.source).toBe('contract');
  });

  test('nothing anywhere falls back to remote, and SAYS it is a fallback', () => {
    // The old code did the same thing silently, which is how a store visit became a remote
    // shoot without anybody being told.
    const r = resolveProductionMode({});
    expect(r.mode).toBe('remote');
    expect(r.source).toBe('default');
  });

  test('a junk value is not trusted from either side', () => {
    expect(resolveProductionMode({ contractMode: 'teleport', agreementMode: 'visit' }).mode).toBe('visit');
    expect(resolveProductionMode({ contractMode: null, agreementMode: 'teleport' }).mode).toBe('remote');
  });

  test('case is not load-bearing', () => {
    expect(resolveProductionMode({ agreementMode: 'VISIT' }).mode).toBe('visit');
  });

  test('every mode it can return is a mode production understands', () => {
    for (const input of [{}, { agreementMode: 'visit' }, { contractMode: 'shipment' }, { agreementMode: 'x' }]) {
      expect(MODES).toContain(resolveProductionMode(input).mode);
    }
  });
});

describe('⚠️ nothing is born finished', () => {
  test('a remote shoot starts confirmed, NOT completed', () => {
    // The reported symptom. "Nothing to coordinate" is true; "nothing to do" is not.
    expect(initialStatusFor('remote')).toBe('confirmed');
    expect(initialStatusFor('remote')).not.toBe('completed');
  });

  test('a visit and a shipment start in the planning state', () => {
    expect(initialStatusFor('visit')).toBe('proposed');
    expect(initialStatusFor('shipment')).toBe('proposed');
  });

  test('no mode whatsoever starts completed', () => {
    for (const m of [...MODES, null, undefined, 'anything']) {
      expect([String(m), initialStatusFor(m)]).not.toEqual([String(m), 'completed']);
    }
  });

  test('and a remote shoot starts somewhere completeShoot will accept', () => {
    // It refuses anything outside ['confirmed','in_progress']. Starting a remote shoot in a
    // status she cannot complete from would swap one dead end for another.
    const src = code('../src/services/production.service.js');
    expect(src).toContain("if (!['confirmed', 'in_progress'].includes(event.status))");
    expect(['confirmed', 'in_progress']).toContain(initialStatusFor('remote'));
  });
});

describe('who may mark it done, and who must have', () => {
  test('a store visit may be marked by either side', () => {
    expect(parcel.canComplete('visit', 'brand')).toBe(true);
    expect(parcel.canComplete('visit', 'influencer')).toBe(true);
  });

  test('a remote or shipped shoot may be marked ONLY by the creator', () => {
    // The brand cannot see whether she has shot anything, so they are not allowed to assert it.
    for (const m of ['remote', 'shipment']) {
      expect([m, parcel.canComplete(m, 'brand')]).toEqual([m, false]);
      expect([m, parcel.canComplete(m, 'influencer')]).toEqual([m, true]);
    }
  });

  test('⚠️ a store visit is not FINISHED until both have marked it', () => {
    // Stage 4 read "either may mark" as "either closes it", so one side could close a visit the
    // other says never happened.
    const brandOnly = { brand_completed_at: '2026-08-28T10:00:00Z' };
    const infOnly   = { influencer_completed_at: '2026-08-28T10:00:00Z' };
    const both      = { ...brandOnly, ...infOnly };
    expect(parcel.isShootComplete('visit', brandOnly)).toBe(false);
    expect(parcel.isShootComplete('visit', infOnly)).toBe(false);
    expect(parcel.isShootComplete('visit', both)).toBe(true);
  });

  test('a remote or shipped shoot is finished on her mark alone', () => {
    const infOnly = { influencer_completed_at: '2026-08-28T10:00:00Z' };
    for (const m of ['remote', 'shipment']) {
      expect([m, parcel.isShootComplete(m, infOnly)]).toEqual([m, true]);
    }
  });

  test('⚠️ and the brand can never finish one on their own, in any mode', () => {
    // She does the shooting. A shoot closed on the brand's mark alone is the brand reporting
    // her work for her.
    const brandOnly = { brand_completed_at: '2026-08-28T10:00:00Z' };
    for (const m of MODES) {
      expect([m, parcel.isShootComplete(m, brandOnly)]).toEqual([m, false]);
    }
  });

  test('nothing marked is never complete', () => {
    for (const m of MODES) {
      expect([m, parcel.isShootComplete(m, {})]).toEqual([m, false]);
      expect([m, parcel.isShootComplete(m)]).toEqual([m, false]);
    }
  });

  test('the two questions stay two named constants', () => {
    // Collapsing "who may mark" into "who closes it" is exactly the mistake Stage 4 made.
    expect(parcel.MAY_COMPLETE.visit).toEqual(['brand', 'influencer']);
    expect(parcel.REQUIRES_BOTH).toEqual(['visit']);
  });
});

describe('the code actually asks these questions', () => {
  const prod = () => code('../src/services/production.service.js');

  test('autoCreateForContract resolves instead of defaulting', () => {
    const src = prod();
    expect(src).toContain('resolveProductionMode({');
    expect(src).not.toMatch(/const mode = contract\.production_mode \|\| 'remote'/);
  });

  test('it falls back to the AGREEMENT, not straight to remote', () => {
    expect(prod()).toContain('agreementModeFor');
  });

  test('⚠️ the literal string completed is no longer written at creation', () => {
    const src = prod();
    expect(src).toContain('const initialStatus = initialStatusFor(mode);');
    expect(src).not.toMatch(/mode === 'remote' \? 'completed' : 'proposed'/);
  });

  test('⚠️ the remote FLIP no longer auto-completes either', () => {
    // The second place that asserted remote means finished — and the reason fixing one place
    // would not have been enough.
    const src = prod();
    expect(src).toContain("initialStatusFor('remote')");
    expect(src).not.toMatch(/SET mode = 'remote',\s*\n?\s*status = 'completed'/);
  });

  test('completeShoot records a side rather than closing the whole thing', () => {
    const src = prod();
    // ⚠️ This first asserted only that isShootComplete was NAMED, which the logAction line two
    // lines above already satisfies. Replacing the guard with if(false) — closing every shoot on
    // one mark, the exact Stage 4 bug — left it green. Assert the guard itself.
    expect(src).toContain('if (!parcel.isShootComplete(event.mode, marked[0])) {');
    expect(src).toContain("actor.role === 'brand' ? 'brand_completed_at' : 'influencer_completed_at'");
  });

  test('the contract carries the agreed mode from the moment it is created', () => {
    const src = code('../src/services/contract.service.js');
    expect(src).toContain("ag.terms_json->>'mode'");
    expect(src).toContain('production_mode');
    // LEFT — a campaign built with no prior agreement is normal and must still get a contract.
    expect(src).toContain('LEFT JOIN collab_agreements');
  });

  test('the read-time auto-heal covers remote contracts too', () => {
    // It used to skip them, because a remote event was auto-completed and therefore pointless.
    const src = code('../src/controllers/production.controller.js');
    expect(src).not.toMatch(/contract\.production_mode !== 'remote'/);
  });

  test('and the flip notification no longer keys off completion', () => {
    const src = code('../src/controllers/production.controller.js');
    expect(src).not.toMatch(/updated\.status === 'completed'/);
    expect(src).toContain("const isConfirmed = updated.mode === 'remote';");
  });

  test('it stops telling her no shoot is needed', () => {
    expect(read('../src/controllers/production.controller.js')).not.toContain('no shoot needed');
  });
});

describe('migration 164', () => {
  const sql = () => read('../migrations/164_shoot_two_sided_completion.sql');

  test('adds both columns, idempotently', () => {
    const s = sql();
    expect(s).toContain('ADD COLUMN IF NOT EXISTS brand_completed_at');
    expect(s).toContain('ADD COLUMN IF NOT EXISTS influencer_completed_at');
  });

  test('backfills already-completed rows so they do not read as half-marked', () => {
    const s = sql();
    expect(s).toMatch(/UPDATE production_events/);
    expect(s).toMatch(/WHERE status = 'completed'/);
  });

  test('and drops nothing', () => {
    const s = sql().toUpperCase();
    expect(s).not.toContain('DROP ');
    expect(s).not.toContain('DELETE ');
  });
});
