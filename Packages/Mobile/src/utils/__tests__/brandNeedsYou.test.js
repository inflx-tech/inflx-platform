const {
  campaignNode, setNode, creatorNode, badgeFor, flatten,
} = require('../brandNeedsYou');

/**
 * Stage 3 — reading the needs-you tree.
 * Contract: features/stage-3-watch-the-work-happen (03-expected-outputs B-1, B-2, B-10, B-11)
 *
 * The tree has shipped on every inbox call since Stage 0 and the brand app read NONE of it —
 * grep for `needs_you` before slice 2 returned zero hits. These pin the reading rules, so
 * the badge on a row and the list underneath it can never come from different places.
 *
 * The fixture below is the REAL shape, taken from collabCounts.forBrand run against
 * production on 2026-08-26.
 */

const TREE = {
  total: 8,
  creators_tab: 3,
  campaigns: [
    {
      campaign_id: 'camp-fs', name: 'Festive Season 2026', own: 0, items: [], total: 3,
      sets: [
        {
          set_id: 'set-sarees', name: 'Sarees', own: 2, total: 2,
          items: [
            { code: 'NO_ALLOCATION', message: '2 creators have nothing to sell — they are contracted and invisible in the shopping app.', count: 2 },
            { code: 'NOTHING_TO_BUY', message: 'Nothing in your store is live and in stock, so traffic from this set lands nowhere.' },
          ],
          creators: [
            { campaign_influencer_id: 'ci-asha', influencer_id: 'i-asha', name: 'Asha M.', step: 3, turn: 'nobody', own: 0 },
            { campaign_influencer_id: 'ci-meera', influencer_id: 'i-meera', name: 'Meera S.', step: 4, turn: 'creator', own: 0 },
          ],
        },
        {
          set_id: 'set-reels', name: 'Reels', own: 0, total: 1, items: [],
          creators: [
            { campaign_influencer_id: 'ci-nisha', influencer_id: 'i-nisha', name: 'Nisha P.', step: 4, turn: 'brand', own: 1 },
            { campaign_influencer_id: 'ci-ravi', influencer_id: 'i-ravi', name: 'Ravi K.', step: 3, turn: 'nobody', own: 0 },
          ],
        },
      ],
    },
    {
      campaign_id: 'camp-mc', name: 'Monsoon Cottons', own: 0, items: [], total: 2,
      sets: [
        {
          set_id: 'set-cottons', name: 'Cottons', own: 2, total: 2,
          items: [
            { code: 'NO_ALLOCATION', message: '2 creators have nothing to sell.', count: 2 },
            { code: 'NOTHING_TO_BUY', message: 'Nothing in your store is live and in stock.' },
          ],
          creators: [
            { campaign_influencer_id: 'ci-divya', influencer_id: 'i-divya', name: 'Divya T.', step: 2, turn: 'creator', own: 0 },
            { campaign_influencer_id: 'ci-sneha', influencer_id: 'i-sneha', name: 'Sneha R.', step: 6, turn: 'nobody', own: 0 },
          ],
        },
      ],
    },
  ],
};

describe('Stage 3 · the tree reconciles, and the app reads it that way', () => {
  it('every set total equals its own plus its creators', () => {
    for (const c of TREE.campaigns) {
      for (const s of c.sets) {
        const beneath = s.creators.reduce((n, cr) => n + cr.own, 0);
        expect(s.total).toBe(s.own + beneath);
      }
    }
  });

  it('every campaign total equals its own plus its sets', () => {
    for (const c of TREE.campaigns) {
      const beneath = c.sets.reduce((n, s) => n + s.total, 0);
      expect(c.total).toBe(c.own + beneath);
    }
  });

  it('the tab total equals the campaigns plus the Creators tab', () => {
    const sum = TREE.campaigns.reduce((n, c) => n + c.total, 0) + TREE.creators_tab;
    expect(TREE.total).toBe(sum);
  });

  it("a set's own equals the number of items it can show", () => {
    // The badge and the list it decomposes into are the same fact. A badge that is bigger
    // than the things beneath it is a badge you cannot walk down.
    for (const c of TREE.campaigns) {
      for (const s of c.sets) expect(s.own).toBe(s.items.length);
    }
  });
});

describe('Stage 3 · finding a node', () => {
  it('finds a campaign, a set anywhere, and a creator anywhere', () => {
    expect(campaignNode(TREE, 'camp-fs').name).toBe('Festive Season 2026');
    expect(setNode(TREE, 'set-cottons').name).toBe('Cottons');
    expect(creatorNode(TREE, 'ci-nisha').step).toBe(4);
  });

  it('returns null rather than throwing for something that is not there', () => {
    expect(campaignNode(TREE, 'nope')).toBeNull();
    expect(setNode(TREE, 'nope')).toBeNull();
    expect(creatorNode(TREE, 'nope')).toBeNull();
    expect(campaignNode(null, 'camp-fs')).toBeNull();
  });
});

describe('Stage 3 · the badge', () => {
  it('is the total, when there is one', () => {
    expect(badgeFor(campaignNode(TREE, 'camp-fs'))).toBe(3);
    expect(badgeFor(setNode(TREE, 'set-reels'))).toBe(1);
  });

  it('is UNDEFINED and not 0 when nothing is owed', () => {
    // A zero draws an empty circle and reads as a state; an absence reads as calm.
    expect(badgeFor({ total: 0 })).toBeUndefined();
    expect(badgeFor(null)).toBeUndefined();
    expect(badgeFor(undefined)).toBeUndefined();
  });
});

describe('Stage 3 · flattening for Home', () => {
  const rows = flatten(TREE);

  it('produces one row per owed thing, and they add up to the campaigns total', () => {
    const campaignsTotal = TREE.campaigns.reduce((n, c) => n + c.total, 0);
    expect(rows).toHaveLength(campaignsTotal);
  });

  it('every row carries enough to navigate straight to it', () => {
    for (const r of rows) {
      expect(r.campaign_id).toBeTruthy();
      expect(r.message.length).toBeGreaterThan(10);
      expect(['campaign', 'set', 'creator']).toContain(r.level);
      if (r.level !== 'campaign') expect(r.set_id).toBeTruthy();
      if (r.level === 'creator') expect(r.campaign_influencer_id).toBeTruthy();
    }
  });

  it('a creator only appears when SHE is what is owed', () => {
    const creators = rows.filter(r => r.level === 'creator').map(r => r.name);
    // Nisha's reel waits on the brand. Nobody else owes the brand anything right now.
    expect(creators).toEqual(['Nisha P.']);
    expect(rows.find(r => r.name === 'Nisha P.').message).toContain('step 4');
  });

  it('set-level items name the set they belong to', () => {
    const setRows = rows.filter(r => r.level === 'set');
    expect(setRows).toHaveLength(4);
    expect(setRows.every(r => !!r.set_name)).toBe(true);
  });

  it('an empty tree flattens to nothing rather than throwing', () => {
    expect(flatten(null)).toEqual([]);
    expect(flatten({ campaigns: [] })).toEqual([]);
  });
});
