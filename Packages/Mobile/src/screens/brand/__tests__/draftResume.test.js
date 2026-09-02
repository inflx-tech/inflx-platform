const fs = require('fs');
const path = require('path');

const { resumeRouteFor } = require('../BrandCampaignListScreen');
const { isRealAgreementId } = require('../../../utils/campaignDraft');

/**
 * A draft resumes; a lapsed creator leaves on her own.
 * Contract: features/draft-resume-and-lapsed-drop
 *
 * Founder, 2026-08-28:
 *   "if that is expired means auto deleted... even he adds set and came after somedays if that
 *    is expired means auto deleted."
 *   "if campaign not fully publish means it is in draft state, when brand come and open this
 *    draft one it has to reach where step stops."
 *
 * Both replace a refusal with the app doing the obvious thing. A lapsed agreement CANNOT be
 * briefed — the server refuses it and there is no judgement for a brand to make — so blocking
 * publish and making them find the creator themselves was the app handing over its own
 * homework. And a draft campaign is not a thing to look at; it is a thing to finish.
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const WIZARD = 'screens/brand/BrandSetWizardScreen.js';

describe('a draft opens where the work stopped', () => {
  it('a draft goes to the builder, not the dashboard', () => {
    const r = resumeRouteFor({ id: 'c1', name: 'Test Campaign 123', status: 'draft' });
    expect(r.route).toBe('BrandCampaignBuilder');
    expect(r.params).toEqual({ campaignId: 'c1', campaignName: 'Test Campaign 123' });
  });

  it('so does one waiting on its wallet — still unfinished', () => {
    expect(resumeRouteFor({ id: 'c1', status: 'pending_wallet' }).route).toBe('BrandCampaignBuilder');
  });

  it.each(['published', 'active', 'live', 'completed', 'cancelled'])(
    'a %s campaign still opens its dashboard', (status) => {
      const r = resumeRouteFor({ id: 'c1', status });
      expect(r.route).toBe('CampaignDetail');
      expect(r.params).toEqual({ campaignId: 'c1' });
    });

  it('an unknown status falls back to the dashboard rather than the wizard', () => {
    // Fail towards looking, not towards editing. Dropping someone into a half-built wizard for
    // a campaign that is actually running is worse than showing them a dashboard.
    expect(resumeRouteFor({ id: 'c1', status: 'something_new' }).route).toBe('CampaignDetail');
    expect(resumeRouteFor({}).route).toBe('CampaignDetail');
    // A null campaign must not throw. A list that has just refreshed can hand this an
    // undefined row for a frame, and a crash there is a blank Campaigns tab.
    expect(resumeRouteFor(null).route).toBe('CampaignDetail');
    expect(resumeRouteFor(null).params).toEqual({ campaignId: undefined });
  });

  it('the list uses it', () => {
    const src = read('screens/brand/BrandCampaignListScreen.js');
    expect(src).toContain('onPress={() => openCampaign(c)}');
    expect(src).toContain('resumeRouteFor(c)');
    // The old unconditional jump is gone.
    expect(src).not.toMatch(/onPress=\{\(\) => navigation\.navigate\('CampaignDetail', \{ campaignId: c\.id \}\)\}/);
  });

  it('both destinations live in the SAME navigator as the list', () => {
    // A cross-stack navigate resolves to nothing at runtime and throws no error — the change
    // class that has crashed or silently no-opped a handset three times in this programme.
    const nav = read('navigation/BrandNavigator.js');
    const blocks = [...nav.matchAll(/<(\w+)\.Navigator[\s\S]*?<\/\1\.Navigator>/g)].map(m => m[0]);
    const home = blocks.find(b => b.includes('name="CampaignList"'));
    expect(home).toBeDefined();
    expect(home).toContain('name="BrandCampaignBuilder"');
    expect(home).toContain('name="CampaignDetail"');
  });
});

describe('DRIFT: nothing can lapse any more, so the auto-drop is gone', () => {
  /**
   * This block used to guard a real safety net: an agreement settled before any campaign
   * ran 90 days, and a set left open longer than that would silently hold a creator who
   * could no longer be briefed. The net removed her and said so.
   *
   * Docs/THE_CUT.md pass 1 removed the pre-agreement pathway entirely, so there are no
   * agreements left to lapse — every creator in a set is reached directly, inside the set.
   * The net now has nothing to protect against, and keeping it would have meant keeping a
   * fetch and a purge whose only possible effect was a false positive (which is exactly
   * what it caused on 2026-09-02: cold invites were purged as 'lapsed').
   *
   * Rewritten rather than deleted, so the coverage states the new fact instead of quietly
   * disappearing.
   */
  const src = read(WIZARD);

  it('the wizard no longer fetches agreements at all', () => {
    expect(src).not.toContain('brandApi.listAgreements');
    expect(src).not.toContain('agreementsLoaded');
  });

  it('and the purge that used to run on them is gone with it', () => {
    expect(src).not.toContain('agreement has lapsed');
    expect(src).not.toContain('was taken out');
  });
});

describe('what this does NOT change', () => {
  it('the SERVER still refuses a dead agreement — pass 1 only removed screens', () => {
    // Deliberately still asserted. Docs/THE_CUT.md pass 1 hides; it does not disconnect
    // the server (pass 3) or erase data (pass 4). Until then the backend gate stays, and
    // is the backstop for anything already invited before the cut. When pass 3 removes
    // it, this assertion is the one that must be rewritten — not quietly dropped.
    const gate = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/publishGate.service.js'), 'utf8');
    for (const code of ['AGREEMENT_MISSING', 'AGREEMENT_NOT_LIVE']) {
      const i = gate.indexOf(`'${code}'`);
      expect(i).toBeGreaterThan(-1);
      expect(gate.slice(0, i).lastIndexOf('blockers.push'))
        .toBeGreaterThan(gate.slice(0, i).lastIndexOf('warnings.push'));
    }
  });

  it('DRIFT: the phone no longer warns about an expiring agreement', () => {
    // It used to, and it was right to: 90 days was the window and this fired in the last
    // 14, so a brand was told before rather than tidied up after. With the pathway gone
    // there is nothing to expire, and the warning went with the blocker beside it.
    expect(read('screens/brand/BrandCampaignReviewScreen.js')).not.toContain('AGREEMENT_EXPIRING');
  });
});

describe('the builder does not say "another" when there is not one yet', () => {
  /**
   * Founder, 2026-08-28: "this is wrong if that campaign has never created, never added sets...
   * means ask to add your first set."
   *
   * He created a campaign and landed on a screen headed "No sets yet" whose only button read
   * "+ Add another set" — in an outline style, beneath a black "Review and publish" that was
   * greyed out and unusable. The one thing to do looked secondary to the thing he could not do.
   */
  const src = read('screens/brand/BrandCampaignBuilderScreen.js');

  it('the label depends on whether a set exists', () => {
    expect(src).toMatch(/sets\.length === 0 \? 'Add your first set' : '\+ Add another set'/);
  });

  it('and it is the primary action while the campaign is empty', () => {
    // It is the only move on the screen. An outline button under a black disabled one inverts
    // what the brand should reach for.
    expect(src).toMatch(/sets\.length === 0 \? s\.btnPri : s\.btnSec/);
    expect(src).toMatch(/sets\.length === 0 \? s\.btnPriT : s\.btnSecT/);
  });

  it('the two-sets note waits until there is a set', () => {
    // Telling someone with none that they may have TWO answers a question they have not
    // reached, and pushes the one thing to do further down.
    const i = src.indexOf('A campaign can hold a sales set and a content set together');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(0, i)).toMatch(/\{sets\.length > 0 && \(\s*$/m);
  });

  it('Review and publish stays, and stays disabled while empty', () => {
    // It says what comes next. Removing it would hide the shape of the job.
    expect(src).toContain('Review and publish');
    expect(src).toMatch(/disabled=\{sets\.length === 0\}/);
  });

  it('the empty state itself already read correctly, and is untouched', () => {
    expect(src).toContain('No sets yet');
    expect(src).toContain('A set is one aim, one group of creators, one offer. Add the first one.');
  });
});
