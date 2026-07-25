/* Smoke test — features/collabs-list. Confirms the new IG-clean modules parse
   and their imports resolve under the real jest/babel pipeline, plus the badge
   presentation mapping. */

describe('collabs-list modules load', () => {
  // Note: InfluencerNavigator is intentionally NOT required here — jest does not
  // transform @react-navigation's TSX (transformIgnorePatterns), so requiring it
  // fails on THEIR source, not ours. The navigator is plain JSX validated on-device
  // via the Maestro gate.
  it('theme + components + screen require without throwing', () => {
    expect(() => require('../../../theme/ig')).not.toThrow();
    expect(() => require('../../../components/collabs/StageTabs')).not.toThrow();
    expect(() => require('../../../components/collabs/CollabRow')).not.toThrow();
    expect(() => require('../CollabsListScreen')).not.toThrow();
  });

  it('exports are the expected shapes', () => {
    const { ig, IG_TONE } = require('../../../theme/ig');
    expect(ig.y).toBe('#FFC107');
    expect(IG_TONE.you.dot).toBe('#FFC107');
    expect(typeof require('../CollabsListScreen').default).toBe('function');
    expect(typeof require('../../../components/collabs/StageTabs').default).toBe('function');
  });
});

describe('badgeFor presentation mapping', () => {
  const { badgeFor } = require('../../../components/collabs/CollabRow');
  it('maps stages/turns to label + tone', () => {
    expect(badgeFor({ status: 'invited', stage: 'invites', turn: 'you' })).toEqual({ label: 'New invite', tone: 'you' });
    expect(badgeFor({ status: 'negotiating', stage: 'negotiating', turn: 'you' })).toEqual({ label: 'Your turn', tone: 'nego' });
    expect(badgeFor({ status: 'negotiating', stage: 'negotiating', turn: 'brand' })).toEqual({ label: 'Waiting', tone: 'brand' });
    expect(badgeFor({ status: 'accepted', stage: 'to_sign', turn: 'you' })).toEqual({ label: 'To sign', tone: 'you' });
    expect(badgeFor({ status: 'active', stage: 'tracking', turn: 'none' })).toEqual({ label: 'Tracking', tone: 'done' });
    expect(badgeFor({ status: 'completed', stage: 'completed', turn: 'none' })).toEqual({ label: 'Completed', tone: 'done' });
    expect(badgeFor({ status: 'expired', stage: 'archive' })).toEqual({ label: 'Expired', tone: 'closed' });
  });
});
