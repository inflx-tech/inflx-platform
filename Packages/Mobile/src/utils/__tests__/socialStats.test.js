import { aggregateSocialStats } from '../socialStats';

describe('aggregateSocialStats', () => {
  it('empty → zeros, null ER, 0 posts', () => {
    const a = aggregateSocialStats([]);
    expect(a).toEqual({ postCount: 0, likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, impressions: 0, avgEngagementRate: null });
  });

  it('sums counts and averages ER over posts that report it', () => {
    const a = aggregateSocialStats([
      { likes: 100, comments: 10, saves: 5, shares: 2, reach: 1000, impressions: 1500, engagement_rate: 4 },
      { likes: 200, comments: 20, saves: 15, shares: 8, reach: 3000, impressions: 4000, engagement_rate: 6 },
    ]);
    expect(a.postCount).toBe(2);
    expect(a.likes).toBe(300);
    expect(a.comments).toBe(30);
    expect(a.reach).toBe(4000);
    expect(a.impressions).toBe(5500);
    expect(a.avgEngagementRate).toBe(5);
  });

  it('averages ER only over posts that have it', () => {
    const a = aggregateSocialStats([
      { likes: 10, engagement_rate: 8 },
      { likes: 20 }, // no ER
    ]);
    expect(a.likes).toBe(30);
    expect(a.avgEngagementRate).toBe(8); // only the first counts
  });

  it('skips null rows and non-numeric fields safely', () => {
    const a = aggregateSocialStats([null, { likes: '50', reach: 'x' }, undefined]);
    expect(a.postCount).toBe(1);
    expect(a.likes).toBe(50);   // numeric string coerced
    expect(a.reach).toBe(0);    // NaN ignored
  });
});
