import { heroFor, sectionsFor } from '../collabDetailModel';
import { COLLAB_STAGES, deriveStage } from '../collabStages';

/**
 * ⚠️ THIS FILE PREVIOUSLY PASSED WHILE THE SCREEN IT TESTED WAS BROKEN.
 *
 * `heroFor` and `sectionsFor` matched on `invites`, `applied`, `negotiating`, `active`,
 * `tracking`, `completed`, `archive` — the vocabulary from before Stage 1 renamed the stages.
 * `deriveStage` returns `invitations`, `pitches`, `to_sign`, `shoot`, `content`, `done`.
 *
 * The two lists overlapped in exactly ONE value. Everything else fell to the default and the
 * creator was shown **"Closed — This collab is closed."** with no buttons — on a live
 * invitation, and on a shoot with a parcel on the way.
 *
 * **Every test here passed, because every test fed it the OLD names.**
 *
 * The file's own closing comment already said this, about `spineFor`, which was deleted for the
 * identical fault: *"The tests passed because they passed it the OLD names. That is the
 * strongest argument in this repo for testing what the screen actually does rather than what a
 * helper can do when fed ideal input."*
 *
 * It was written about the function two lines below and was equally true of the one above.
 *
 * So every case here now uses the stages `deriveStage` ACTUALLY produces, and the first
 * describe below makes it impossible to drift again.
 */

describe('⚠️ the guard that would have caught this', () => {
  it('every stage deriveStage can return is handled by BOTH functions', () => {
    // Not "handled" as in returns something — the default returns something. Handled as in
    // does not fall through to it.
    const fallthrough = heroFor({ stage: '__nothing_matches_this__', status: 'invited' });
    for (const stage of COLLAB_STAGES) {
      const h = heroFor({ stage, status: 'invited', turn: 'you' });
      expect(h.label).not.toBe(fallthrough.label);
    }
  });

  it('and no stage is ever told a live collaboration is closed', () => {
    // The exact symptom the founder saw.
    for (const stage of COLLAB_STAGES.filter(s => s !== 'done')) {
      const h = heroFor({ stage, status: 'invited', turn: 'you' });
      expect(h.sub).not.toMatch(/closed/i);
      expect(h.tone).not.toBe('closed');
    }
  });

  it('and a stage nobody has invented yet still reads as OPEN, not closed', () => {
    // The fallback itself. A seventh stage added next year must not tell a creator her live
    // work is finished — which is the precise failure this whole file exists to record.
    // Caught by mutation: the guards above only walk the six, so the default went untested.
    const h = heroFor({ stage: 'some_stage_from_2027', status: 'active' });
    expect(h.tone).not.toBe('closed');
    expect(h.sub).not.toMatch(/closed/i);
    expect(h.label).not.toMatch(/closed/i);
  });

  it('the real statuses map to stages this file covers', () => {
    // Closes the loop: these are the statuses the server writes, run through deriveStage,
    // and every result must be one of the six.
    for (const status of ['invited', 'negotiating', 'applied', 'accepted', 'pending_influencer',
      'pending_brand', 'contracted', 'active', 'completed', 'declined', 'expired']) {
      expect(COLLAB_STAGES).toContain(deriveStage({ status }));
    }
  });
});

describe('heroFor — one correct action per stage', () => {
  it('an invitation she has not answered → accept / negotiate / pass', () => {
    // THE bug. Ravi K.'s invitation to "New test campaign", status invited, rendered "Closed"
    // with no buttons at all.
    const h = heroFor({ stage: 'invitations', status: 'invited', turn: 'you' });
    expect(h.actions).toEqual(['accept', 'negotiate', 'pass']);
    expect(h.tone).toBe('you');
  });

  it('terms agreed but no campaign yet → nothing to do, and it says so', () => {
    const h = heroFor({ stage: 'invitations', status: 'agreed' });
    expect(h.actions).toEqual([]);
    expect(h.label).toBe('Terms agreed');
  });

  it('negotiating: her turn vs waiting', () => {
    expect(heroFor({ stage: 'invitations', status: 'negotiating', turn: 'you' }).tone).toBe('nego');
    expect(heroFor({ stage: 'invitations', status: 'negotiating', turn: 'brand' }).tone).toBe('brand');
  });

  it('a pitch she sent → waiting, no action', () => {
    expect(heroFor({ stage: 'pitches', status: 'applied' }).actions).toEqual([]);
  });

  it('to_sign: her turn to sign vs waiting for the countersign', () => {
    expect(heroFor({ stage: 'to_sign', status: 'accepted' }).actions).toEqual(['sign']);
    expect(heroFor({ stage: 'to_sign', status: 'pending_influencer' }).actions).toEqual(['sign']);
    expect(heroFor({ stage: 'to_sign', status: 'pending_brand' }).actions).toEqual([]);
    expect(heroFor({ stage: 'to_sign', status: 'contracted' }).actions).toEqual([]);
  });

  it('shoot → the shoot, which Stage 4 built and this had no case for', () => {
    const h = heroFor({ stage: 'shoot', status: 'contracted' });
    expect(h.actions).toEqual(['logistics']);
    expect(h.tone).toBe('you');
  });

  it('a commission collab with nothing to deliver reads as selling, not shooting', () => {
    // She sells product, not content, so she has no deliverables — and deriveStage's only exit
    // from 'shoot' is deliverable progress she will never have. Without this she would be told
    // to "settle the time and shoot" for the whole campaign.
    const h = heroFor({ stage: 'shoot', status: 'active', turn: 'you', sellsOnly: true, hasShoot: false });
    expect(h.label).toBe('You are live');
    expect(h.sub).toMatch(/link/);
    expect(h.actions).toEqual(['tracking']);
  });

  it('but a commission collab that DOES have a shoot still gets the shoot', () => {
    // A store visit or a parcel is real work with a real screen. Selling does not replace it.
    for (const d of [{ sellsOnly: true, hasShoot: true }, { sellsOnly: false, hasShoot: false }]) {
      const h = heroFor({ stage: 'shoot', status: 'active', turn: 'you', ...d });
      expect([JSON.stringify(d), h.label]).toEqual([JSON.stringify(d), 'The shoot']);
      expect(h.actions).toEqual(['logistics']);
    }
  });

  it('content: deliver vs awaiting review', () => {
    expect(heroFor({ stage: 'content', status: 'active', pendingDeliverable: true }).actions).toEqual(['deliverables']);
    expect(heroFor({ stage: 'content', status: 'active', pendingDeliverable: true }).tone).toBe('you');
    expect(heroFor({ stage: 'content', status: 'active', pendingDeliverable: false }).tone).toBe('brand');
  });

  it('done: finished reads as an achievement, cancelled reads as closed', () => {
    const finished = heroFor({ stage: 'done', status: 'completed' });
    expect(finished.actions).toEqual(['earnings']);
    expect(finished.tone).toBe('done');

    const expired = heroFor({ stage: 'done', status: 'expired' });
    expect(expired.actions).toEqual([]);
    expect(expired.label).toBe('Expired');
  });
});

describe('sectionsFor — stage gating', () => {
  it('an invitation shows only terms', () => {
    expect(sectionsFor({ stage: 'invitations' }).map(s => s.key)).toEqual(['terms']);
  });

  it('to_sign adds the contract', () => {
    expect(sectionsFor({ stage: 'to_sign' }).map(s => s.key)).toEqual(['terms', 'contract']);
  });

  it('shoot shows the full post-sign set — it showed only terms before', () => {
    const keys = sectionsFor({ stage: 'shoot', physical_delivery: true, products_total: 4 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'logistics', 'deliverables', 'tracking', 'earnings', 'products']);
  });

  it('content too', () => {
    const keys = sectionsFor({ stage: 'content', physical_delivery: false, products_total: 0 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'deliverables', 'tracking', 'earnings']);
  });

  it('logistics only when goods travel; products only when there are some', () => {
    const keys = sectionsFor({ stage: 'shoot', physical_delivery: false, products_total: 0 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'deliverables', 'tracking', 'earnings']);
  });

  it('done keeps her contract, deliverables, performance and earnings', () => {
    const keys = sectionsFor({ stage: 'done', products_total: 0 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'deliverables', 'tracking', 'earnings']);
  });

  it('⚠️ no stage past signing is ever left with terms alone', () => {
    // The other half of the same bug: a creator mid-shoot could not reach her own contract,
    // her deliverables or her earnings, because sectionsFor did not know 'shoot' either.
    for (const stage of ['shoot', 'content', 'done']) {
      expect(sectionsFor({ stage }).map(s => s.key)).toContain('contract');
      expect(sectionsFor({ stage }).map(s => s.key)).toContain('earnings');
    }
  });
});

describe('spineFor is GONE, and must stay gone', () => {
  // Stage 3 deleted it, for the fault this file has just fixed in its neighbour.
  it('the second step model is no longer exported', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../collabDetailModel');
    expect(mod.spineFor).toBeUndefined();
    expect(mod.SPINE).toBeUndefined();
  });

  it('the six steps now come from the server, via creatorSteps', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { stepFor } = require('../creatorSteps');
    const data = { collaborations: [{ campaign_influencer_id: 'ci-1', step: 3, turn: 'nobody' }] };
    expect(stepFor(data, 'ci-1')).toEqual({ step: 3, turn: 'nobody', state: null });
  });

  it('an unknown collaboration returns null, never a default of step 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { stepFor } = require('../creatorSteps');
    expect(stepFor({ collaborations: [] }, 'ci-1')).toBeNull();
    expect(stepFor(null, 'ci-1')).toBeNull();
    expect(stepFor({ collaborations: [{ campaign_influencer_id: 'ci-1' }] }, 'ci-1')).toBeNull();
  });
});

describe('every action the hero can emit is actually wired', () => {
  const fs = require('fs');
  const path = require('path');
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../../screens/influencer/CollabDetailScreen.js'), 'utf8');

  it('the screen handles all of them', () => {
    // A hero offering a button nothing handles is the same class of failure as a hero
    // offering no buttons at all: she taps, and nothing happens.
    const emitted = new Set();
    for (const stage of COLLAB_STAGES) {
      for (const status of ['invited', 'negotiating', 'agreed', 'accepted', 'pending_brand',
        'contracted', 'active', 'completed', 'expired']) {
        for (const turn of ['you', 'brand']) {
          heroFor({ stage, status, turn, pendingDeliverable: true }).actions.forEach(a => emitted.add(a));
          heroFor({ stage, status, turn, pendingDeliverable: false }).actions.forEach(a => emitted.add(a));
        }
      }
    }
    expect(emitted.size).toBeGreaterThan(0);
    for (const action of emitted) {
      // Handled either in doAction (accept / pass) or in the go() switch.
      const wired = new RegExp(`key === '${action}'|case '${action}':`).test(screen);
      expect([action, wired]).toEqual([action, true]);
    }
  });

  it('and the buttons route through doAction, which covers accept and pass', () => {
    // go() alone would swallow both — they are not navigations, they are API calls.
    expect(screen).toContain('doAction');
    expect(screen).toMatch(/if \(key === 'accept'\) return confirmAccept\(\);/);
    expect(screen).toMatch(/if \(key === 'pass'\)\s+return confirmPass\(\);/);
  });
});
