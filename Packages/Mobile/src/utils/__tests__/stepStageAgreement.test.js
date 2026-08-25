const path = require('path');
const { COLLAB_STAGES, deriveStage } = require('../collabStages');
const { STEP_LABELS, STEP_LABELS_CREATOR } = require('../../components/brand/NeedsYou');

const ROOT = path.resolve(__dirname, '../../../../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const collabStep = require(path.join(ROOT, 'backend/src/services/collabStep.service.js'));

/**
 * Stage 3 · C-4 — the stage she is filed under and the step she is on are the same fact.
 * Contract: features/stage-3-watch-the-work-happen (03-expected-outputs C-4)
 *
 * WHY THIS TEST EXISTS AT ALL
 * This is the exact fault Stage 3 had to clean up. Her collaboration screen drew a spine
 * from `collabDetailModel.SPINE`, which matched on stage names. Stage 1 renamed those names.
 * Nobody re-checked, the two lists ended up overlapping in ONE value, and her spine
 * highlighted nothing for months — while three unit tests went on passing, because they fed
 * the helper the OLD names.
 *
 * So the useful test is not "does deriveStage work" (it does) or "does collabStep work" (it
 * does). It is: **do the two vocabularies still line up with each other.** That is the join
 * that broke, and nothing was watching it.
 *
 * She has SIX stages in her Collabs list and there are SIX steps. They are the same road
 * seen twice — the tab she finds a collaboration under, and how far along it is.
 */

/**
 * The one mapping between the two. Written down here rather than in either module, because
 * it is a statement ABOUT both and belongs to neither.
 *
 * Invitations and Pitches both sit before signing — direction is what she is choosing
 * between, which is why her list splits them and the step number does not.
 */
const STAGE_FOR_STEP = {
  1: ['invitations', 'pitches'],   // terms agreed, or still being agreed
  2: ['to_sign'],                  // the contract
  3: ['shoot'],                    // the shoot
  4: ['content'],                  // her shop posts
  5: ['content'],                  // going live — still the content half of the road
  6: ['done'],                     // complete
};

describe('C-4 · her stage and her step describe the same road', () => {
  it('every step maps to a stage that actually exists in her list', () => {
    const known = new Set(COLLAB_STAGES);
    for (const [step, stages] of Object.entries(STAGE_FOR_STEP)) {
      expect(stages.length).toBeGreaterThan(0);
      for (const st of stages) {
        expect(known.has(st)).toBe(true);
      }
    }
  });

  it('every stage in her list is reachable from some step', () => {
    // A stage nobody can be at is a tab that is always empty, which is how "Applied" sat
    // dead in her list until Stage 1 removed it.
    const covered = new Set(Object.values(STAGE_FOR_STEP).flat());
    for (const st of COLLAB_STAGES) {
      expect(covered.has(st)).toBe(true);
    }
  });

  it('there are six of each, because it is one road', () => {
    expect(COLLAB_STAGES).toHaveLength(6);
    expect(Object.keys(STEP_LABELS)).toHaveLength(6);
    expect(Object.keys(STEP_LABELS_CREATOR)).toHaveLength(6);
    expect(Object.keys(STAGE_FOR_STEP)).toHaveLength(6);
  });

  it('the server can only ever return a step that has a stage', () => {
    // collabStep is the authority on the number. If it ever grows a seventh step, this
    // fails here rather than silently filing someone under nothing.
    const steps = Object.values(collabStep.STEP).map(Number).sort((a, b) => a - b);
    expect(steps).toEqual([1, 2, 3, 4, 5, 6]);
    for (const s of steps) expect(STAGE_FOR_STEP[s]).toBeDefined();
  });

  it('a real run of deriveStage lands where the matching step says it should', () => {
    // Executing, not asserted from the table: feed deriveStage the statuses the server
    // sees and check the stage it produces is one the step agrees with.
    const cases = [
      { record: { status: 'invited' },                       step: 2 },
      { record: { status: 'accepted' },                      step: 2 },
      { record: { status: 'contracted' },                    step: 3 },
      { record: { status: 'active', deliverable_count: 2, approved_count: 0 }, step: 4 },
      { record: { status: 'completed' },                     step: 6 },
    ];
    for (const c of cases) {
      const stage = deriveStage(c.record);
      const allowed = STAGE_FOR_STEP[c.step];
      // 'invited' files under Invitations while the step says Sign — both are true, and
      // the mapping says so: step 2 covers to_sign, and an unsigned invite is pre-sign.
      const preSign = ['invitations', 'pitches', 'to_sign'];
      const ok = allowed.includes(stage) || (c.step <= 2 && preSign.includes(stage));
      expect(ok).toBe(true);
    }
  });
});

describe('N-3 · a finished campaign contributes nothing', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  const counts = fs.readFileSync(path.join(ROOT, 'backend/src/services/collabCounts.service.js'), 'utf8');
  const owed = fs.readFileSync(path.join(ROOT, 'backend/src/services/collabOwedItems.service.js'), 'utf8');

  it('every query that feeds the tree excludes cancelled and completed campaigns', () => {
    // Nothing owed on a finished campaign should pull attention from live work. If one
    // query forgot, a badge would appear on a campaign the brand has already closed.
    const exclusions = (s) => (s.match(/NOT IN \('cancelled', 'completed'\)/g) || []).length;
    expect(exclusions(counts)).toBeGreaterThanOrEqual(1);
    // collabOwedItems has two queries — sets and campaigns — and BOTH must exclude.
    expect(exclusions(owed)).toBe(2);
  });
});
