/* Smoke test — features/collabs-list. Confirms the new IG-clean modules parse
   and their imports resolve under the real jest/babel pipeline, plus the badge
   presentation mapping. */

describe('collabs-list modules load', () => {
  // Note: InfluencerNavigator is intentionally NOT required here — jest does not
  // transform @react-navigation's TSX (transformIgnorePatterns), so requiring it
  // fails on THEIR source, not ours. The navigator is plain JSX validated on-device
  // via the Maestro gate.
  it('theme + components + screens require without throwing', () => {
    expect(() => require('../../../theme/ig')).not.toThrow();
    expect(() => require('../../../components/collabs/StageTabs')).not.toThrow();
    expect(() => require('../../../components/collabs/CollabRow')).not.toThrow();
    expect(() => require('../CollabsListScreen')).not.toThrow();
    expect(() => require('../CollabDetailScreen')).not.toThrow();
    expect(() => require('../../../utils/collabDetailModel')).not.toThrow();
  });

  it('exports are the expected shapes', () => {
    const { ig, IG_TONE } = require('../../../theme/ig');
    // De-yellow pass: the 'your turn' signal moved off brand yellow (#FFC107)
    // onto amber. Same token, same role — the asserted value tracks the design.
    expect(ig.y).toBe('#EA580C');
    expect(IG_TONE.you.dot).toBe('#EA580C');
    expect(typeof require('../CollabsListScreen').default).toBe('function');
    expect(typeof require('../CollabDetailScreen').default).toBe('function');
    expect(typeof require('../../../components/collabs/StageTabs').default).toBe('function');
  });
});

describe('badgeFor presentation mapping', () => {
  const { badgeFor } = require('../../../components/collabs/CollabRow');
  const { COLLAB_STAGES } = require('../../../utils/collabStages');

  /**
   * This test used to assert 'invites', 'negotiating', 'tracking', 'completed' and
   * 'archive'. Stage 1 renamed the stages and none of those survived — so the component
   * fell through to its default for EVERY row and rendered "Archived" on unanswered
   * invitations, while this test stayed green by feeding it a vocabulary the app had
   * abandoned.
   *
   * The guard below is the real fix: a stage name used here must be one the app actually
   * produces. Renaming a stage now breaks this test on the spot.
   */
  it('only ever tests stages the app actually produces', () => {
    const used = ['invitations', 'pitches', 'to_sign', 'shoot', 'content', 'done'];
    expect(used.sort()).toEqual([...COLLAB_STAGES].sort());
  });

  it('tells her whose turn it is on an open conversation', () => {
    expect(badgeFor({ status: 'sent', stage: 'invitations', turn: 'you' }))
      .toEqual({ label: 'Your turn', tone: 'you' });
    expect(badgeFor({ status: 'countered', stage: 'invitations', turn: 'brand' }))
      .toEqual({ label: 'Waiting on them', tone: 'brand' });
    expect(badgeFor({ status: 'sent', stage: 'pitches', turn: 'brand' }))
      .toEqual({ label: 'Sent', tone: 'brand' });
  });

  it('marks a settled conversation as agreed, not as waiting', () => {
    expect(badgeFor({ status: 'agreed', stage: 'invitations', turn: 'none' }))
      .toEqual({ label: 'Agreed', tone: 'done' });
    expect(badgeFor({ status: 'accepted', stage: 'pitches', turn: 'none' }))
      .toEqual({ label: 'Accepted', tone: 'done' });
  });

  it('covers the later stages', () => {
    expect(badgeFor({ status: 'contracted', stage: 'to_sign', turn: 'you' }))
      .toEqual({ label: 'To sign', tone: 'you' });
    expect(badgeFor({ status: 'active', stage: 'content', turn: 'you' }))
      .toEqual({ label: 'Your turn', tone: 'you' });
    expect(badgeFor({ status: 'active', stage: 'content', turn: 'brand' }))
      .toEqual({ label: 'With brand', tone: 'brand' });
    expect(badgeFor({ status: 'completed', stage: 'done', turn: 'none' }))
      .toEqual({ label: 'Done', tone: 'done' });
  });

  it('a closed conversation keeps its own words', () => {
    expect(badgeFor({ status: 'expired', stage: 'done' })).toEqual({ label: 'Expired', tone: 'closed' });
    expect(badgeFor({ status: 'declined', stage: 'done' })).toEqual({ label: 'Declined', tone: 'closed' });
  });

  it('never labels an unanswered invitation "Archived"', () => {
    // The exact fault the founder photographed.
    const b = badgeFor({ status: 'viewed', stage: 'invitations', turn: 'you' });
    expect(b.label).not.toBe('Archived');
    expect(b.label).toBe('Your turn');
  });
});
