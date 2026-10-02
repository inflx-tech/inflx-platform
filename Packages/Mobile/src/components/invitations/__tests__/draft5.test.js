/**
 * Item 5 — the rule the app checks before the server does (draft5.validateLocal), asserted
 * directly on the rule.
 *
 * ui-walk-fixes (board D · check 13). "You've already added that. Change the count instead." and
 * "Choose between 1 and 20." used to be reached in item5Brand.test.js by tapping a second line's
 * type pill and by typing 21 into the count box. The locked board replaces both controls — a type
 * that already has a line cannot be chosen again, and the count is minus / plus that stops at 20 —
 * so neither sentence can be reached from the screen any more. They are NOT gone: rows also arrive
 * from the server's thread and from the pool, and the rule is the safety net under the controls.
 * The two assertions moved here; nothing was deleted (06-diff/drift/D.md).
 */
const draft = require('../draft5');
const { MSG5, DELIVERABLE_TYPES } = require('../copy5');

const content = (deliverables, more = {}) => ({ ...draft.defaultTerms('engagement'), fee: '8000', deliverables, ...more });

describe('Pay for Content — what she delivers, as the rule sees it (check 13)', () => {
  it('a new invitation starts with one line: Instagram reel, 1 (frame D1)', () => {
    expect(draft.defaultTerms('engagement').deliverables).toEqual([{ type: 'reel', count: 1 }]);
    expect(draft.defaultTerms('conversion').deliverables).toEqual([]);
    expect(draft.defaultTerms('hybrid').deliverables).toEqual([]);
  });

  it('no line at all is refused: "Add at least one thing she delivers." (frame D5)', () => {
    expect(draft.validateLocal('engagement', content([])).deliverables).toBe(MSG5.DELIVERABLES_EMPTY);
    expect(draft.validateLocal('engagement', content(undefined)).deliverables).toBe(MSG5.DELIVERABLES_EMPTY);
  });

  it('the same type twice is refused: "You\'ve already added that. Change the count instead."', () => {
    // Moved from item5Brand.test.js, where a second line was tapped onto "Instagram reel".
    const e = draft.validateLocal('engagement', content([{ type: 'reel', count: 1 }, { type: 'reel', count: 1 }]));
    expect(e.deliverables).toBe(MSG5.DELIVERABLE_DUP);
    expect(MSG5.DELIVERABLE_DUP).toBe("You've already added that. Change the count instead.");
    // …wherever in the list the repeat is.
    expect(draft.validateLocal('engagement', content([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }, { type: 'reel', count: 3 }])).deliverables)
      .toBe(MSG5.DELIVERABLE_DUP);
  });

  it('a count outside 1 to 20 is refused: "Choose between 1 and 20."', () => {
    // Moved from item5Brand.test.js, where 21 was typed into the second line's count box.
    const e = draft.validateLocal('engagement', content([{ type: 'reel', count: 1 }, { type: 'story', count: 21 }]));
    expect(e.deliverables).toBe(MSG5.DELIVERABLE_COUNT);
    expect(MSG5.DELIVERABLE_COUNT).toBe('Choose between 1 and 20.');
    for (const bad of [0, -1, 21, 2.5, '', null, undefined, 'two']) {
      expect(draft.validateLocal('engagement', content([{ type: 'reel', count: bad }])).deliverables).toBe(MSG5.DELIVERABLE_COUNT);
    }
  });

  it('1 and 20 are both allowed, and so is one line of every type (frame D4)', () => {
    expect(draft.validateLocal('engagement', content([{ type: 'reel', count: 1 }, { type: 'story', count: 20 }])).deliverables).toBeUndefined();
    const all = DELIVERABLE_TYPES.map((t, i) => ({ type: t.code, count: i + 1 }));
    expect(all).toHaveLength(5);
    expect(draft.validateLocal('engagement', content(all))).toEqual({});
  });

  it('a type the app does not know is refused', () => {
    expect(draft.validateLocal('engagement', content([{ type: 'facebook_post', count: 1 }])).deliverables).toBe(MSG5.DELIVERABLES_EMPTY);
  });

  it('the count is judged before the repeat, line by line, and the first fault is the one said', () => {
    expect(draft.validateLocal('engagement', content([{ type: 'reel', count: 30 }, { type: 'reel', count: 1 }])).deliverables).toBe(MSG5.DELIVERABLE_COUNT);
    expect(draft.validateLocal('engagement', content([{ type: 'reel', count: 1 }, { type: 'reel', count: 30 }])).deliverables).toBe(MSG5.DELIVERABLE_COUNT);
  });

  it('Pay for Sale and Hybrid carry no deliverables and are never judged on them', () => {
    const sale = { ...draft.defaultTerms('conversion'), commissionPct: '10', sellMode: 'all', sellAllCount: 3, deliverables: [{ type: 'reel', count: 99 }] };
    expect(draft.validateLocal('conversion', sale).deliverables).toBeUndefined();
    const hybrid = { ...sale, fee: '5000' };
    expect(draft.validateLocal('hybrid', hybrid).deliverables).toBeUndefined();
  });
});

describe('what is sent to the server is unchanged: [{ type, count }] (check 14)', () => {
  it('sends each line as its type and a whole number', () => {
    const t = content([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]);
    expect(draft.toServer('engagement', t)).toEqual({ fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] });
  });

  it('a count that arrived as text is sent as a number', () => {
    expect(draft.toServer('engagement', content([{ type: 'post', count: '3' }])).deliverables).toEqual([{ type: 'post', count: 3 }]);
  });

  it('terms agreed in the pool arrive as lines of their own, not shared with the pool entry', () => {
    const agreed = { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] };
    const t = draft.fromPoolTerms('engagement', agreed);
    expect(t.fee).toBe('12000');
    expect(t.deliverables).toEqual(agreed.deliverables);
    expect(t.deliverables[0]).not.toBe(agreed.deliverables[0]);
    // nothing agreed about deliverables → the usual first line
    expect(draft.fromPoolTerms('engagement', { fee: 9000 }).deliverables).toEqual([{ type: 'reel', count: 1 }]);
  });

  it('"Use these terms for everyone" copies the lines to each creator', () => {
    draft.startDraft('sD', { set: { id: 'sD', goal: 'engagement' }, campaignName: 'C', creators: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
    draft.setTerms('sD', 'a', content([{ type: 'youtube_short', count: 3 }]));
    draft.copyTermsToAll('sD', 'a');
    const d = draft.getDraft('sD');
    expect(d.terms.b.deliverables).toEqual([{ type: 'youtube_short', count: 3 }]);
    expect(d.terms.b.deliverables[0]).not.toBe(d.terms.a.deliverables[0]);
    draft.clearDraft('sD'); draft.clearBasket('sD');
  });
});
