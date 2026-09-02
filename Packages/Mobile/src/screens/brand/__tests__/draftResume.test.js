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

describe('a lapsed creator leaves the set on her own', () => {
  const src = read(WIZARD);

  it('the drop runs when the set is opened', () => {
    expect(src).toContain('const gone = sd.creators.filter(c => draft.isRealAgreementId(c.agreement_id) && !live.has(String(c.agreement_id)))');
    expect(src).toContain('draft.setSetDraft(campaignId, setId, { creators: kept })');
  });

  it('⚠️ a cold invite or a deferred-pool pick is never mistaken for a lapsed agreement', () => {
    // Bug found 2026-09-02: this effect used to filter EVERY picked creator against the live
    // agreements list. A cold invite (`cold:<influencer_id>`, from search or a group — stage-a/b)
    // and a deferred-pool pick (`deferred:<old row id>`) never appear in that list, because
    // neither has ever had a real agreement — so both read as "lapsed" the instant this effect
    // ran, and were silently purged from the set before she was ever invited, with the brand
    // told a false "agreement has lapsed" reason. Only a REAL agreement id can lapse.
    //
    // Proven behaviourally against the real exported guard, not just pinned as source text:
    // the same synthetic keys the invite payload already refuses to send as agreement_id
    // (features/stage-a-the-set slice_7/slice_8) must also survive this purge unconditionally,
    // regardless of what the live agreements list contains.
    const live = new Set(); // nothing live — the strictest possible case
    const picked = [
      { agreement_id: 'cold:i9', name: 'Found by search' },
      { agreement_id: 'deferred:77', name: 'From the deferred pool' },
      { agreement_id: 'real-agreement-uuid', name: 'Pre-agreed, and it lapsed' },
    ];
    const gone = picked.filter((c) => isRealAgreementId(c.agreement_id) && !live.has(String(c.agreement_id)));
    expect(gone.map((c) => c.name)).toEqual(['Pre-agreed, and it lapsed']);

    const kept = picked.filter((c) => !isRealAgreementId(c.agreement_id) || live.has(String(c.agreement_id)));
    expect(kept.map((c) => c.name)).toEqual(['Found by search', 'From the deferred pool']);
  });

  it('⚠️ it cannot run before the live list has loaded', () => {
    // Without this guard the check would run against an empty list on every entry and clear
    // every creator the brand had picked — indistinguishable, to them, from the app losing
    // their work.
    expect(src).toContain('agreementsLoaded');
    expect(src).toMatch(/if \(!setId \|\| !agreementsLoaded\) return;/);
    expect(src).toMatch(/setAgreements\(ag\.data\?\.agreements \|\| \[\]\); setAgreementsLoaded\(true\);/);
  });

  it('it never happens silently', () => {
    // A creator who simply vanishes reads as a mis-tap, or goes unnoticed until the campaign
    // is live without her.
    const block = src.slice(src.indexOf('const gone ='), src.indexOf('const gone =') + 1400);
    expect(block).toContain('Alert.alert');
    expect(block).toContain('was taken out');
    expect(block).toMatch(/agreement has lapsed/);
    expect(block).toMatch(/Agree with/);
  });

  it('it keeps everyone who is still live', () => {
    expect(src).toContain('const kept = sd.creators.filter(c => !draft.isRealAgreementId(c.agreement_id) || live.has(String(c.agreement_id)))');
  });

  it('the ids are compared as strings, not by identity', () => {
    // agreement_id arrives as a uuid string from two different fetches. A === between a value
    // from the draft store and one from a fresh response is the kind of thing that works in
    // testing and drops everybody in production.
    expect(src).toContain('new Set(agreements.map(a => String(a.id)))');
  });

  it('and the server list it compares against is genuinely only live agreements', () => {
    // listReadyToBrief: status = 'ready' AND expires_at > now(). If that ever widened, this
    // drop would start keeping creators who cannot be briefed.
    const svc = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/handshake.service.js'), 'utf8');
    expect(svc).toMatch(/status = 'ready' AND a\.expires_at > now\(\)|a\.status = 'ready' AND a\.expires_at > now\(\)/);
  });
});

describe('what this does NOT change', () => {
  it('the publish gate still refuses a dead agreement', () => {
    // The auto-drop handles the set a brand is looking at. The gate is the backstop for
    // anything already invited, which the drop never sees. Removing it would leave the
    // narrow case with no cover at all.
    const gate = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/publishGate.service.js'), 'utf8');
    for (const code of ['AGREEMENT_MISSING', 'AGREEMENT_NOT_LIVE']) {
      const i = gate.indexOf(`'${code}'`);
      expect(i).toBeGreaterThan(-1);
      expect(gate.slice(0, i).lastIndexOf('blockers.push'))
        .toBeGreaterThan(gate.slice(0, i).lastIndexOf('warnings.push'));
    }
  });

  it('the expiring-agreement warning still warns before it happens', () => {
    // 90 days is the window (handshake_settings.agreement_expiry_days), and this fires in the
    // last 14. Being told before is better than being tidied up after.
    expect(read('screens/brand/BrandCampaignReviewScreen.js')).toContain('AGREEMENT_EXPIRING');
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
