import { campaignPrimeAction } from '../campaignPrime';

const fs = require('fs');
const path = require('path');

/**
 * The one thing a brand should do next on a campaign.
 * Contract: features/retire-old-campaign-stage-rail
 *
 * REWRITTEN FROM campaignStages.test.js, not deleted.
 *
 * That file tested two things: `deriveCampaignStage`, whose prime-action half is still the
 * whole point of this module, and `stageTrack`, which drove the six-stage strip the founder
 * asked to remove. The first moves across intact. The second tests something that no longer
 * exists, so it is replaced by checks that the vocabulary is GONE rather than merely unused —
 * a dead idea left lying about gets rebuilt by somebody in six months.
 */

const SRC = path.resolve(__dirname, '../..');

describe('the prime action — every status still answers', () => {
  it('draft / pending_wallet → Fund & Publish, the gap mobile closed', () => {
    expect(campaignPrimeAction('draft')).toEqual({ prime: { label: 'Fund wallet & publish', kind: 'publish' } });
    expect(campaignPrimeAction('pending_wallet').prime.kind).toBe('publish');
  });

  it('applications waiting', () => {
    expect(campaignPrimeAction('published', { applicationsCount: 3 }).prime)
      .toEqual({ label: 'Review 3 applications', kind: 'applications' });
  });

  it('singular and plural read like English', () => {
    expect(campaignPrimeAction('published', { applicationsCount: 1 }).prime.label).toBe('Review 1 application');
    expect(campaignPrimeAction('active', { reviewsCount: 1 }).prime.label).toBe('Review 1 deliverable');
    expect(campaignPrimeAction('active', { liveConfirmCount: 1 }).prime.label).toBe('Confirm 1 live URL');
  });

  it('negotiations', () => {
    expect(campaignPrimeAction('active', { negotiatingCount: 2 }).prime.kind).toBe('negotiations');
  });

  it('live-confirm outranks pending reviews — money that is owed moves first', () => {
    // A confirmed live URL releases Tranche 2. A queue of deliverables does not move money.
    expect(campaignPrimeAction('live', { reviewsCount: 5, liveConfirmCount: 1 }).prime.kind).toBe('live');
  });

  it('completed → payouts', () => {
    expect(campaignPrimeAction('completed')).toEqual({ prime: { label: 'View payouts', kind: 'payout' } });
  });

  it('cancelled → nothing to do', () => {
    expect(campaignPrimeAction('cancelled').prime.kind).toBe('none');
  });

  it('nothing pending → all caught up', () => {
    expect(campaignPrimeAction('published').prime).toEqual({ label: 'All caught up', kind: 'none' });
    expect(campaignPrimeAction('live').prime.kind).toBe('none');
    expect(campaignPrimeAction('active').prime.kind).toBe('none');
  });

  it('R-5 · every status returns a usable action, none of them undefined', () => {
    // The one real risk in removing the rail: the stage half and the action half shared a
    // function. Taking the wrong half would have left a draft campaign with no
    // "Fund wallet & publish" button — the only thing this screen gained on mobile.
    for (const st of ['draft', 'pending_wallet', 'published', 'active', 'live', 'completed', 'cancelled']) {
      const r = campaignPrimeAction(st);
      expect(typeof r.prime.label).toBe('string');
      expect(r.prime.label.length).toBeGreaterThan(0);
      expect(typeof r.prime.kind).toBe('string');
    }
  });
});

describe('R-2 R-3 R-4 · the competing six is gone, not hidden', () => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('the old module and component no longer exist', () => {
    expect(fs.existsSync(path.join(SRC, 'utils/campaignStages.js'))).toBe(false);
    expect(fs.existsSync(path.join(SRC, 'components/brand/CampaignStageRail.js'))).toBe(false);
  });

  it('no stage vocabulary survives in the module', () => {
    // Comments stripped: the note explaining what was removed names what was removed.
    const code = strip(read('utils/campaignPrime.js'));
    for (const gone of ['CAMPAIGN_STAGES', 'stageIndex', 'stageTrack', 'stageKey']) {
      expect(code).not.toContain(gone);
    }
  });

  it('the prime bar no longer ships a rail', () => {
    const m = require(path.join(SRC, 'components/brand/CampaignPrimeBar.js'));
    expect(typeof m.PrimeBar).toBe('function');
    expect(m.StageRail).toBeUndefined();
  });

  it('R-1 · the campaign screen draws no six-stage strip', () => {
    const code = strip(read('screens/brand/BrandCampaignDetailScreen.js'));
    expect(code).not.toContain('StageRail');
    expect(code).not.toContain('stageKey');
  });

  it('R-9 · nothing anywhere still imports the old names', () => {
    const walk = (dir, out = []) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.js')) out.push(p);
      }
      return out;
    };
    // This file is skipped: it contains the very strings it searches for, in the pattern
    // below. A check that flags itself proves nothing and hides everything after it.
    const offenders = walk(SRC).filter((p) => {
      if (p === __filename) return false;
      const code = strip(fs.readFileSync(p, 'utf8'));
      return /from '.*campaignStages'|from '.*CampaignStageRail'|deriveCampaignStage/.test(code);
    });
    expect(offenders.map(p => path.relative(SRC, p))).toEqual([]);
  });

  it('R-6 · Stage 3\'s six is untouched, and is now the only six', () => {
    // The creator spine. Different words, different subject, decided on the server.
    const labels = require(path.join(SRC, 'components/brand/NeedsYou.js')).STEP_LABELS;
    expect(Object.keys(labels)).toHaveLength(6);
  });
});
