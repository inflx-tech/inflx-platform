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
// stage-a — CreatorTermsScreen (SB-30) is new; it gets the same M-10 token/style check as
// the other two screens below, not a separate one.
const TERMS = 'screens/brand/CreatorTermsScreen.js';

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

/**
 * Prose explaining why a phrase was removed usually quotes the phrase. A check that cannot
 * tell a comment from rendered copy only ever punishes a file for documenting its own change
 * — the trap the Stage 4 shot-list assertion fell into first time round.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
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
  // require() cannot load a React Native screen outside Metro — it hits the first JSX tag
  // and throws "Unexpected token '<'". So this pair failed on EVERY run, for every file,
  // whatever the code said. A test that always fails is not a guard; it is noise that hides
  // the real failures underneath it. (Verified: it failed identically on the untouched file
  // before this contract changed anything.)
  //
  // @babel/parser is already a dependency of this package, so the file can be genuinely
  // syntax-checked instead. Stage A found this while needing an actual parse check on a
  // large JSX edit.
  const parser = require('@babel/parser');
  it.each([WIZARD, CREATE, TERMS])('%s parses', (rel) => {
    expect(() => parser.parse(read(rel), { sourceType: 'module', plugins: ['jsx'] })).not.toThrow();
  });
});

describe('Batch A · A-1 · the campaign-create screen', () => {
  const src = read(CREATE);

  it('the lock note is gone', () => {
    expect(src).not.toContain('No end date and no budget here');
  });

  it('SUPERSEDED BY STAGE A · there is no date on this screen at all any more', () => {
    // Batch A put a calendar here (DateField, replacing a YYYY-MM-DD text box). Stage A,
    // 2026-09-01, removed the question entirely — a set is "one aim, one go-live day, one
    // way of shooting", and that day now lives on the SET (SB-26), not once on the campaign
    // above it. SB-23 is genuinely two fields: a name, and an optional note.
    expect(src).not.toContain("from '../../components/DateField'");
    expect(src).not.toContain('<DateField');
    expect(src).not.toContain('placeholder="YYYY-MM-DD"');
  });

  it('canGo needs only the name — no date left to validate', () => {
    // SUPERSEDED BY STAGE A — isISODate(start) guarded a field that no longer exists.
    expect(src).not.toContain('isISODate');
    expect(src).toMatch(/const canGo = name\.trim\(\)\.length > 0;/);
  });

  it('the optional note reaches the server as `brief`, the column that already existed', () => {
    expect(src).toContain("brief: note.trim() || null");
    expect(src).toContain('What is it for');
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
    // SUPERSEDED BY STAGE A — CHANNELS moved from the wizard to CreatorTermsScreen.js
    // (SB-30), per creator rather than per set. The policy this guards — Instagram and
    // YouTube only — is unchanged; only where it lives moved.
    const sb30 = read('screens/brand/CreatorTermsScreen.js');
    const list = sb30.slice(sb30.indexOf('const CHANNELS = ['), sb30.indexOf('const FORMATS'));
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

  it('"What you are buying" moved to CreatorTermsScreen (SB-30), not deleted', () => {
    // SUPERSEDED BY STAGE A — founder, 2026-09-01, choosing the harder of two options on
    // purpose (asked directly, since it touches what the wallet must cover and what
    // signing requires): formats move from a once-per-set ask to per creator, with no
    // set-level default standing in for a creator nobody has asked yet. The wizard no
    // longer asks this at all; CreatorTermsScreen does, one creator at a time.
    expect(src).not.toContain('What you are buying');
    const sb30 = read('screens/brand/CreatorTermsScreen.js');
    expect(sb30).toContain('What she makes');
    expect(sb30).toContain('FORMATS.map');
  });

  /**
   * SUPERSEDED BY STAGE A — business-rule drift, not a regression.
   *
   * Batch A gave a CONTENT set two date boxes (a posting window) and a SALES set one start
   * date. The locked set-first design replaces both with a single GO-LIVE DAY for every aim.
   * The founder, 2026-08-29:
   *
   *   "post by date is one where all social posts of creators in that set go live on that
   *    date.....so all commission,content and both go live in that date"
   *
   * It is not a deadline she can beat and not one she can miss. A window cannot express
   * that, so the two boxes became one and the aim no longer changes the question.
   *
   * The cases below are REWRITTEN rather than deleted: what they were guarding — that the
   * date fields differ correctly by aim — still needs guarding, and the new answer is that
   * they DO NOT differ at all.
   *
   * Contract: features/stage-a-the-set. Design: features/screen-atlas SB-26.
   */
  it('every aim now gets ONE go-live day, not a window', () => {
    expect(src).toContain('label="Everyone goes live on"');
    expect(src).toContain('goLiveDate');
    // the two-box window is gone from the wizard entirely
    expect(src).not.toContain('Posting window from');
    expect(src).not.toContain('label="Starts"');
  });

  it('the day is not asked differently by aim — that is the whole point', () => {
    // it must NOT sit inside a buyingContent branch any more
    const field = src.slice(src.indexOf('label="Everyone goes live on"') - 600,
                            src.indexOf('label="Everyone goes live on"'));
    expect(field).not.toContain('buyingContent ? (');
  });

  it('the picker cannot offer a day the server would refuse', () => {
    // minDate comes from the shared rule, not a literal
    expect(src).toContain('setShape.earliestGoLiveDay()');
    expect(src).toMatch(/minDate=\{earliest\}/);
  });

  it('the save guard asks for what the set actually needs, not the retired window', () => {
    // This guard used to demand windowStart && windowEnd on a content set. Once the wizard
    // stopped writing a window it would have blocked every NEW content set from saving,
    // while still letting an EDITED old one through — hydrate() fills the window from the
    // stored row. Found by grepping for dangling references after the field was removed.
    const save = src.slice(src.indexOf('async function saveSetAndContinue'), src.indexOf('const body = {'));
    expect(save).not.toContain('windowStart');
    expect(save).not.toContain('windowEnd');
    expect(save).toContain('setShape.validateSetShape');
    expect(save).toContain('setShape.basicsReady');
    // ...and it must ACT on both answers. Asserting only that the call is present let a
    // mutation that deleted the `if (!shape.ok)` line pass — the call was still there,
    // doing nothing. That is the same "two things doing one job" fault wearing a third
    // coat: a check whose result nobody reads is not a check.
    expect(save).toMatch(/if \(!shape\.ok\)/);
    expect(save).toMatch(/if \(!setShape\.basicsReady\(/);
    // both must stop the save, not merely warn
    expect((save.match(/return;/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('the wizard no longer WRITES a window, but older drafts keep theirs', () => {
    // state is retained so hydrating an old set does not silently drop what it had...
    expect(src).toContain('setWindowEnd');
    // ...but the wizard stopped sending window_start / window_end when it saves. A set
    // created before set-first still resolves its day through goLiveDayOf()'s fallback.
    const body = src.slice(src.indexOf('const body = {'), src.indexOf('setSaving(true)'));
    expect(body).not.toContain('window_end:');
    expect(body).toContain('go_live_date:');
    expect(body).toContain('shoot_mode:');
    expect(body).toContain('invites_close_at:');
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
    // SUPERSEDED BY STAGE A, then again by stage A/B — canFinish gained everyoneHasFormats
    // (2026-09-01) and then everyoneHasMoney (2026-09-02, when a cold-invited creator
    // found by search became possible and needs a stated opening offer). Not a reopening
    // of A-8: an OFFER (what her shoppers get) is still never required — MONEY (what she
    // is paid) always was, for an agreement-sourced creator via the agreement itself and
    // now via this gate for one found by search.
    expect(src).toMatch(/const canFinish = picked\.length > 0 && everyoneAllocated && everyoneHasFormats && everyoneHasMoney;/);
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

  it('A-9 A-10 · both routes to an offer survive — in ONE place, on her row', () => {
    // REWRITTEN, not deleted. This asserted the set-level picker and the preview button live
    // on the wizard. They have moved to the creator's own sheet, because leaving both was two
    // controls doing one job — and the publish gate only ever read the set-level one, so an
    // offer given on a creator's row could not satisfy it at all.
    // Contract: features/publish-gate-offer-consistency
    const sheet = read('components/brand/CreatorOfferSheet.js');
    expect(sheet).toContain('From your library');
    expect(sheet).toContain('Build a new offer');

    // N-6 — the founder asked for the preview to go, then withdrew it the same day once told
    // the button is the only route into BrandBasketPreview. It is kept, in its better home:
    // at set level it could only guess whose basket it was pricing.
    expect(sheet).toContain('See what a shopper pays');
    expect(src).toContain("navigate('BrandBasketPreview'");

    // And exactly one way in from the wizard: her row.
    expect(src).toContain('Give her an offer');
    expect(src).not.toContain('onChooseOffer');
  });
});

describe('Batch A · N-1 · the server call keeps its shape', () => {
  const src = read(WIZARD);

  it('channels_json still carries allowed, and no longer invents a minimum', () => {
    // SUPERSEDED BY STAGE A — this shape is sent from CreatorTermsScreen (SB-30) now, per
    // creator, not from the wizard's set-level save body. The rule itself — allowed only,
    // no invented minimum — is unchanged.
    // The brand can no longer choose a minimum, so sending one would be guidance we made up.
    // The server treats it as optional and describeChannels renders the list without it —
    // both checked in backend/src/services/campaignChannels.js before this was changed.
    const sb30 = read('screens/brand/CreatorTermsScreen.js');
    expect(sb30).toMatch(/channels_json: selling && channels\.length \? \{ allowed: channels \} : null/);
    expect(sb30).not.toContain('minimum:');
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
    // formats_json dropped from this list — SUPERSEDED BY STAGE A, see the describe block
    // above. It is no longer part of the set's save body at all; CreatorTermsScreen sends
    // it per creator.
    for (const field of ['window_start', 'window_end', 'goal', 'name']) {
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

  it.each([WIZARD, CREATE, TERMS])('%s uses no ig.* token that is missing', (rel) => {
    // Removing blocks can orphan a style; using one that no longer exists is `undefined` in a
    // StyleSheet — silent on some props, black-on-black on others.
    const used = [...read(rel).matchAll(/\big\.(\w+)/g)].map(m => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const t of new Set(used)) {
      expect(Object.prototype.hasOwnProperty.call(ig, t)).toBe(true);
    }
  });

  it.each([WIZARD, CREATE, TERMS])('%s references no style key it does not define', (rel) => {
    const src = read(rel);
    const defined = new Set(
      [...src.slice(src.lastIndexOf('StyleSheet.create')).matchAll(/^\s{2}(\w+):/gm)].map(m => m[1])
    );
    const used = new Set([...src.matchAll(/\bs\.(\w+)\b/g)].map(m => m[1]));
    const missing = [...used].filter(k => !defined.has(k));
    expect(missing).toEqual([]);
  });
});

describe('Batch A · the THIRD deal type — "Both" — keeps everything either half needs', () => {
  const src = read(WIZARD);

  /**
   * FOUNDER, 2026-08-27: "same will not apply for pay for content and Both one... you should
   * ensure this."
   *
   * He was right to ask. Batch A's removals are guarded by `selling` and `buyingContent`, and
   * a set can be BOTH. Nothing in the contract named hybrid, and no check covered it — the
   * behaviour happened to be correct because of how those two flags are derived, not because
   * anyone had verified it. "Correct by luck" is one refactor away from "wrong and silent".
   *
   * The three goals, and what each resolves to:
   *
   *   goal          selling  buyingContent   what it means
   *   conversion    yes      no              Pay per sale  — commission only
   *   engagement    no       yes             Pay for content — a fee for named deliverables
   *   hybrid        YES      YES             Both — a smaller fee AND commission
   *
   * So a hybrid set must keep the CONTENT half's budget, posting window and deliverable
   * counts, AND the SALES half's channels and compulsory allocation. It is the only set type
   * that a mistake in either branch can break.
   */
  const RESOLVE = { conversion: [true, false], engagement: [false, true], hybrid: [true, true] };
  const selling = g => RESOLVE[g][0];
  const buyingContent = g => RESOLVE[g][1];

  it('the derivation is exactly what this table models', () => {
    // If these two lines ever change, every assertion below becomes a fiction.
    expect(src).toContain("const selling = goal === 'conversion' || goal === 'hybrid';");
    expect(src).toContain("const buyingContent = goal === 'engagement' || goal === 'hybrid';");
  });

  it('"Both" is offered as a real third choice, not a variant of the other two', () => {
    const card = src.slice(src.indexOf("goal: 'hybrid'"), src.indexOf("goal: 'hybrid'") + 220);
    expect(card).toContain("title: 'Both'");
    expect(card).toContain('FEE + COMMISSION');
  });

  it.each([
    ['conversion', 'Pay per sale'],
    ['engagement', 'Pay for content'],
    ['hybrid', 'Both'],
  ])('%s (%s) — Budget shows exactly when a fee is owed', (goal) => {
    // Budget is the figure the wallet must cover before publishing. A hybrid set owes a fee,
    // so it MUST keep the block. Batch A moved Budget behind `buyingContent`, which is true
    // for hybrid — this asserts that is deliberate rather than incidental.
    const guarded = branchOwning(src, '{buyingContent && (', '<Text style={s.dh}>Budget</Text>');
    expect(guarded).toContain('derivedBudget');
    expect(buyingContent(goal)).toBe(goal !== 'conversion');
  });

  // SUPERSEDED BY STAGE A — see the note above. The three aims used to be asked for dates
  // differently; they are now asked identically, because they all launch on the same day.
  it.each(['engagement', 'hybrid', 'conversion'])('%s is asked for the same one day', (goal) => {
    expect(['engagement', 'hybrid', 'conversion']).toContain(goal);
    expect(src).toContain('label="Everyone goes live on"');
    // exactly one launch-day field in the whole wizard, for every aim
    expect(src.split('label="Everyone goes live on"').length - 1).toBe(1);
  });

  it('and every aim is asked how they shoot', () => {
    expect(src).toContain('How they shoot');
    expect(src).toContain('setShape.SHOOT_MODES_OFFERED.map');
    // two options offered, never the third
    expect(src).not.toMatch(/SHOOT_MODES\.map/);
  });

  it.each(['engagement', 'hybrid'])('%s still ends up asked what she makes', (goal) => {
    // SUPERSEDED BY STAGE A — the question moved from the wizard (once, per set) to
    // CreatorTermsScreen (SB-30, per creator), and buyingContent now gates it there too.
    expect(buyingContent(goal)).toBe(true);
    const sb30 = read('screens/brand/CreatorTermsScreen.js');
    const formats = branchOwning(sb30, '{buyingContent && (', 'What she makes');
    expect(formats).toContain('FORMATS.map');
  });

  it.each(['conversion', 'hybrid'])('%s still ends up asked the channels question', (goal) => {
    // SUPERSEDED BY STAGE A — same move as above. A hybrid set sells, so asking which
    // channels drive traffic is still a real question — just per creator now.
    expect(selling(goal)).toBe(true);
    const sb30 = read('screens/brand/CreatorTermsScreen.js');
    const ch = branchOwning(sb30, '{selling && (', 'Where she posts');
    expect(ch).toContain('CHANNELS.map');
  });

  it('a content-only set is never asked about channels', () => {
    // The server refuses channels_json on an engagement set outright — asking would be a
    // category error: nothing is being sold, so there is no traffic to drive.
    expect(selling('engagement')).toBe(false);
    const svc = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/campaignChannels.js'), 'utf8');
    expect(svc).toContain('channels_json does not apply to a content set');
  });

  it.each(['conversion', 'hybrid'])('%s still requires allocation for every creator', (goal) => {
    // The rule Batch A must NOT have relaxed. A hybrid creator sells, so she needs to know
    // what she may sell — otherwise she is contracted and invisible in the shopping app.
    expect(selling(goal)).toBe(true);
    expect(src).toContain('const everyoneAllocated = !selling || picked.every(c => c.alloc?.alloc_scope);');
  });

  it('the removals that hit every set were meant to hit every set', () => {
    // These four sat outside both branches, or inside `selling` where hybrid also lives.
    // Listed explicitly so a later reader can see the blast radius was considered.
    for (const gone of [
      'who posts?',                  // outside both — every set
      'Minimum channels',            // inside `selling` — conversion AND hybrid
      'Choose a shopper offer',      // the gate, every set
      'Go and ask someone new',      // outside both — every set
    ]) {
      expect(src).not.toContain(gone);
    }
  });

  it('the sentence that was WRONG on a hybrid set is gone', () => {
    // "You are not buying posts here — so we ask what reach they bring, not what they must
    // publish." That sat inside `selling`, so a hybrid set saw it — and on a hybrid set you
    // ARE buying posts. Removing it fixed a small lie nobody had noticed.
    expect(src).not.toContain('You are not buying posts here');
  });

  it('no card promises a shopper offer now that one is optional', () => {
    // The hybrid card used to end "...and set a shopper offer", which read as a requirement.
    // After Batch A it is not one, on any set type.
    // The constant is AIM_CARDS. My first version looked for 'const AIMS', which does not
    // exist — indexOf returned -1, the slice came back empty, and the assertion passed while
    // testing nothing. Caught by asking why a check I expected to FAIL was green.
    const from = src.indexOf('const AIM_CARDS');
    // SUPERSEDED BY STAGE A — CHANNELS moved out of this file entirely (CreatorTermsScreen,
    // SB-30), so the slice's end boundary moved to the next thing after AIM_CARDS instead.
    const to = src.indexOf('export default function BrandSetWizardScreen');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    // Comments stripped: the note explaining WHY the phrase was removed quotes the phrase,
    // and a check that cannot tell those apart only ever punishes the file for documenting
    // its own change. Same trap the Stage 4 shot-list check fell into.
    const cards = stripComments(src.slice(from, to));
    expect(cards).toContain("title: 'Both'");   // the slice really does hold the cards
    expect(cards).not.toMatch(/set a shopper offer/);
    // The Sales card was worse: it said an offer IS REQUIRED, which after Batch A is flatly
    // false — the card was contradicting the button three taps later.
    expect(cards).not.toMatch(/shopper offer is required/);
    expect(cards).toContain("A shopper offer is optional");
  });
});
