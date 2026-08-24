const { changedTerms, buildCounter } = require('../collabCounter');

/**
 * The fault item 7 exists to remove: a creator who only wanted more money retyped the date
 * slightly differently and moved two terms while meaning to move one.
 *
 * Every control is now pre-filled from the brand's own offer, so these pin the thing that
 * makes that safe — only real differences travel.
 */

const sale = {
  aim: 'conversion',
  money: { commission_pct: 18 },
  time: { post_by: '2026-09-15' },
  mode: 'visit',
};

const paid = {
  aim: 'engagement',
  money: { fee: 25000 },
  time: { post_by: '2026-09-15' },
  mode: 'shipment',
  deliverables: [{ type: 'reel', count: 2 }, { type: 'story', count: 3 }],
};

/** What the screen holds the moment she taps Counter — the brand's offer, unchanged. */
const untouched = (t) => ({
  commission: t.money?.commission_pct != null ? String(t.money.commission_pct) : '',
  fee: t.money?.fee != null ? String(t.money.fee) : '',
  postBy: t.time?.post_by || '',
  place: t.mode === 'visit' ? 'visit' : 'remote',
  shipping: t.mode === 'shipment' ? 'yes' : t.mode === 'remote' ? 'no' : null,
  deliverables: {
    reel: 0, post: 0, story: 0, youtube_video: 0, youtube_short: 0,
    ...Object.fromEntries((t.deliverables || []).map(d => [d.type, d.count])),
  },
});

describe('opening the counter changes nothing by itself', () => {
  it('a sales offer, untouched, reports no changes', () => {
    expect(changedTerms(sale, untouched(sale))).toEqual([]);
  });

  it('a paid offer, untouched, reports no changes', () => {
    expect(changedTerms(paid, untouched(paid))).toEqual([]);
  });

  it('and sends nothing', () => {
    expect(buildCounter(paid, untouched(paid))).toEqual({});
  });
});

describe('only what she moved', () => {
  it('changing the commission is one change, not three', () => {
    const e = { ...untouched(sale), commission: '22' };
    expect(changedTerms(sale, e)).toEqual(['money']);
    expect(buildCounter(sale, e)).toEqual({ money: { commission_pct: 22 } });
  });

  it('the date she was given is not re-sent when she leaves it alone', () => {
    // The old form made her retype it; retyping it differently moved a term she meant
    // to accept. Now an untouched date simply does not travel.
    const e = { ...untouched(sale), commission: '22' };
    expect(buildCounter(sale, e).time).toBeUndefined();
  });

  it('moving the date alone is one change', () => {
    const e = { ...untouched(sale), postBy: '2026-09-30' };
    expect(changedTerms(sale, e)).toEqual(['time']);
    expect(buildCounter(sale, e)).toEqual({ time: { post_by: '2026-09-30' } });
  });

  it('moving money and the date is two', () => {
    const e = { ...untouched(sale), commission: '22', postBy: '2026-09-30' };
    expect(changedTerms(sale, e).sort()).toEqual(['money', 'time']);
  });

  it('switching where she works is one change', () => {
    const e = { ...untouched(sale), place: 'remote', shipping: 'no' };
    expect(changedTerms(sale, e)).toEqual(['mode']);
    expect(buildCounter(sale, e)).toEqual({ mode: 'remote' });
  });

  it('changing her mind back is no change at all', () => {
    // She taps Remote, then Store visit again. She ended where she started.
    const e = { ...untouched(sale), place: 'visit', shipping: null };
    expect(changedTerms(sale, e)).toEqual([]);
  });
});

describe('deliverables, on a paid deal only', () => {
  it('asking for one fewer reel is one change', () => {
    const e = untouched(paid);
    e.deliverables = { ...e.deliverables, reel: 1 };
    expect(changedTerms(paid, e)).toEqual(['deliverables']);
    expect(buildCounter(paid, e).deliverables)
      .toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 3 }]);
  });

  it('countering the fee leaves the agreed deliverables alone', () => {
    const e = { ...untouched(paid), fee: '30000' };
    expect(changedTerms(paid, e)).toEqual(['money']);
    expect(buildCounter(paid, e).deliverables).toBeUndefined();
  });

  it('never counts deliverables on a sales deal', () => {
    const e = untouched(sale);
    e.deliverables = { reel: 5, post: 0, story: 0, youtube_video: 0, youtube_short: 0 };
    expect(changedTerms(sale, e)).toEqual([]);
  });
});

describe('a counter never carries an importance marker', () => {
  it('because the terms model refuses one on either negotiable term', () => {
    const e = { ...untouched(paid), fee: '30000', place: 'visit', shipping: null };
    const c = buildCounter(paid, e);
    expect(c.importance).toBeUndefined();
  });
});

describe('it does not throw on a half-built offer', () => {
  it('handles missing pieces', () => {
    expect(() => changedTerms({}, {})).not.toThrow();
    expect(() => buildCounter(undefined, undefined)).not.toThrow();
    expect(buildCounter({}, {})).toEqual({});
  });
});
