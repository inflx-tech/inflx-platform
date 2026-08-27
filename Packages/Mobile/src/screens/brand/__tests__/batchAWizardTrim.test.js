const fs = require('fs');
const path = require('path');

/**
 * Batch A — the campaign wizard, trimmed.
 * Contract: features/stage-2-walkthrough-fixes (03-expected-outputs A-*, N-*)
 *
 * WHAT THIS IS ACTUALLY GUARDING
 * Eight of the nine changes are deletions, and **every one of them sits inside a
 * `selling` / `buyingContent` branch**. Delete a block one level too high and a pay-for-content
 * set silently loses a field it needs. The symptom would not be a crash — it would be a
 * campaign that refuses to publish weeks later, because the wallet check has no budget to
 * check against. That is the worst failure shape this codebase produces, and no layout test
 * can see it. These assertions can.
 *
 * Source-shape assertions, deliberately: the thing being protected is which JSX sits inside
 * which condition, and that is a fact about the file.
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const WIZARD = 'screens/brand/BrandSetWizardScreen.js';
const CREATE = 'screens/brand/BrandCampaignCreateScreen.js';

/** The body of a `{cond && ( … )}` block, so a check can ask what is INSIDE the branch. */
function branchOwning(src, opener, mustContain) {
  let from = 0;
  for (;;) {
    const i = src.indexOf(opener, from);
    if (i < 0) throw new Error(`no ${opener} branch contains ${mustContain}`);
    const body = branchAt(src, i, opener);
    if (body.includes(mustContain)) return body;
    from = i + opener.length;
  }
}

function branchAt(src, i, opener) {
  let depth = 0;
  for (let j = i + opener.length - 1; j < src.length; j += 1) {
    if (src[j] === '(') depth += 1;
    else if (src[j] === ')') { depth -= 1; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error(`unbalanced branch: ${opener}`);
}

describe('Batch A · the pieces still load', () => {
  it.each([WIZARD, CREATE])('%s parses', (rel) => {
    expect(() => require(path.join(SRC, rel))).not.toThrow();
  });
});

describe('Batch A · A-1 · the campaign-create screen', () => {
  const src = read(CREATE);

  it('the lock note is gone', () => {
    expect(src).not.toContain('No end date and no budget here');
  });

  it('the start date is a calendar, not a text box', () => {
    expect(src).toContain("from '../../components/DateField'");
    expect(src).toContain('<DateField');
    expect(src).not.toContain('placeholder="YYYY-MM-DD"');
  });

  it('the date is still validated before the button unlocks', () => {
    // DateField emits 'YYYY-MM-DD', the same string the text box produced, so the existing
    // guard still holds. Removing the field must not have removed the check with it.
    expect(src).toContain('isISODate(start)');
    expect(src).toMatch(/const canGo = [^;]*isISODate\(start\)/);
  });
});

describe('Batch A · A-2 A-3 A-4 · a sales set is short', () => {
  const src = read(WIZARD);

  it('no date anywhere in the wizard is typed', () => {
    expect(src).not.toContain('placeholder="YYYY-MM-DD"');
    expect(src).toContain("from '../../components/DateField'");
  });

  it('the greyed "Ends · Never" is gone', () => {
    expect(src).not.toMatch(/calcT}>Never</);
  });

  it('the sales-set end-date note is gone', () => {
    expect(src).not.toContain('No end date on a sales set');
  });

  it('the "no who posts?" note is gone', () => {
    expect(src).not.toContain('who posts?');
  });

  it('the minimum-channels selector is gone, with its guidance', () => {
    expect(src).not.toContain('Minimum channels');
    expect(src).not.toContain('minChannels');
    expect(src).not.toContain('it does not block anyone you have already agreed with');
  });

  it('A-4 · exactly Instagram and YouTube are offered', () => {
    const list = src.slice(src.indexOf('const CHANNELS = ['), src.indexOf('const FORMATS'));
    const keys = [...list.matchAll(/key: '(\w+)'/g)].map(m => m[1]);
    expect(keys).toEqual(['instagram', 'youtube']);
  });
});

describe('Batch A · A-5 N-2 · a pay-for-content set keeps everything', () => {
  const src = read(WIZARD);

  it('the Budget block survives, and is now content-only', () => {
    // The figure the wallet must cover before the campaign can publish. This is THE assertion
    // that stops a removal leaking across the branch.
    // There are four {buyingContent && (…)} branches in this file. Find the one that owns the
    // Budget heading rather than assuming it is the first — an assertion that silently tests a
    // different branch is worse than no assertion.
    const b = branchOwning(src, '{buyingContent && (', '<Text style={s.dh}>Budget</Text>');
    expect(b).toContain('derivedBudget');
    expect(b).toContain('Your wallet must cover it');
  });

  it('"What you are buying" survives', () => {
    expect(src).toContain('What you are buying');
    expect(src).toContain('FORMATS.map');
  });

  it('the posting window keeps BOTH halves on a content set', () => {
    const both = src.slice(src.indexOf('{buyingContent ? ('), src.indexOf(') : ('));
    expect(both).toContain('Posting window from');
    expect(both).toContain('label="To"');
    expect(both).toContain('windowEnd');
  });

  it('a sales set gets one date and no end', () => {
    const after = src.slice(src.indexOf(') : ('), src.indexOf(') : (') + 400);
    expect(after).toContain('label="Starts"');
    expect(after).not.toContain('windowEnd');
  });

  it('windowEnd is still wired, so a content set can still set one', () => {
    expect(src).toContain('setWindowEnd');
    expect(src).toContain('window_end');
  });
});

describe('Batch A · A-6 A-7 N-3 · the creators step', () => {
  const src = read(WIZARD);

  it('the hidden — wrong aim chip is gone, and nothing replaces it', () => {
    expect(src).not.toContain('hidden — wrong aim');
    expect(src).not.toContain('wrongAim');
    // Founder, 2026-08-27: the explanation is not necessary either. No sentence stands in.
    expect(src).not.toContain('agreed a different kind of deal');
  });

  it('N-3 · the wrong-aim agreements are STILL filtered out', () => {
    // Only the explanation went. If the filter went with it, a brand could put a
    // pay-for-content agreement into a commission set, and the terms would not mean the same
    // thing on either side.
    expect(src).toContain('const matching = useMemo');
    expect(src).toMatch(/aim !== goal/);
  });

  it('"Go and ask someone new" is gone, and so is its handler', () => {
    expect(src).not.toContain('Go and ask someone new');
    expect(src).not.toContain('onGoAsk');
  });
});

describe('Batch A · A-8 A-9 A-10 N-4 N-6 · the offer stops blocking', () => {
  const src = read(WIZARD);

  it('A-8 · canFinish no longer requires an offer', () => {
    expect(src).toMatch(/const canFinish = picked\.length > 0 && everyoneAllocated;/);
    // Narrow on purpose: chosenOffer is still used to RENDER the picked offer, which is
    // correct. What must be gone is the gate, and that is the line above.
    const line = (src.match(/const canFinish = .*/) || [''])[0];
    expect(line).not.toContain('chosenOffer');
  });

  it('A-8 · the red blocker line no longer mentions an offer', () => {
    expect(src).not.toContain('Choose a shopper offer');
  });

  it('N-4 · allocation is STILL compulsory on a selling set', () => {
    // A different rule, and a real one: a contracted creator with no allocation is contracted
    // and invisible in the shopping app. Batch A must not have relaxed this by accident.
    expect(src).toContain('everyoneAllocated');
    expect(src).toMatch(/!selling \|\| picked\.every\(c => c\.alloc\?\.alloc_scope\)/);
    expect(src).toContain('must have something to sell');
  });

  it('A-9 A-10 · both routes to an offer survive, and so does the preview', () => {
    expect(src).toContain('onChooseOffer');
    expect(src).toContain('Make a new one');
    // N-6 — the founder asked for this to go, then withdrew it the same day once told the
    // button is the only navigate() into BrandBasketPreview. Keeping it is the decision.
    expect(src).toContain('See what a shopper pays');
    expect(src).toContain("navigate('BrandBasketPreview'");
  });
});

describe('Batch A · N-1 · the server call keeps its shape', () => {
  const src = read(WIZARD);

  it('channels_json still carries allowed, and no longer invents a minimum', () => {
    // The brand can no longer choose a minimum, so sending one would be guidance we made up.
    // The server treats it as optional and describeChannels renders the list without it —
    // both checked in backend/src/services/campaignChannels.js before this was changed.
    expect(src).toMatch(/channels_json: selling && channels\.length \? \{ allowed: channels \} : null/);
    expect(src).not.toContain('minimum:');
  });

  it('the server still accepts more channels than the phone now offers', () => {
    // Narrowing the picker must not narrow the platform. Sets created before today keep
    // whatever they were given, and Stage 7 gives the other five their own tracked links.
    const svc = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/campaignChannels.js'), 'utf8');
    for (const ch of ['instagram', 'youtube', 'whatsapp', 'inflx_shop']) {
      expect(svc).toContain(`'${ch}'`);
    }
  });

  it('nothing else about the save changed', () => {
    for (const field of ['window_start', 'window_end', 'formats_json', 'goal', 'name']) {
      expect(src).toContain(field);
    }
  });
});

describe('Batch A · N-5 · the draft is still unpersisted', () => {
  it('abandoning the wizard still consumes no agreement', () => {
    // Ledger #77. If this ever becomes a server write, walking away half-way would burn an
    // agreement that was never used.
    expect(read(WIZARD)).toContain("from '../../utils/campaignDraft'");
  });
});

describe('Batch A · M-10 · every token and helper still resolves', () => {
  const ig = require(path.join(SRC, 'theme/ig.js')).ig;

  it.each([WIZARD, CREATE])('%s uses no ig.* token that is missing', (rel) => {
    // Removing blocks can orphan a style; using one that no longer exists is `undefined` in a
    // StyleSheet — silent on some props, black-on-black on others.
    const used = [...read(rel).matchAll(/\big\.(\w+)/g)].map(m => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const t of new Set(used)) {
      expect(Object.prototype.hasOwnProperty.call(ig, t)).toBe(true);
    }
  });

  it.each([WIZARD, CREATE])('%s references no style key it does not define', (rel) => {
    const src = read(rel);
    const defined = new Set(
      [...src.slice(src.lastIndexOf('StyleSheet.create')).matchAll(/^\s{2}(\w+):/gm)].map(m => m[1])
    );
    const used = new Set([...src.matchAll(/\bs\.(\w+)\b/g)].map(m => m[1]));
    const missing = [...used].filter(k => !defined.has(k));
    expect(missing).toEqual([]);
  });
});
