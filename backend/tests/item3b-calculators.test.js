'use strict';

/**
 * Item 3b — the calculators (prompt §3.6, §8.1), on the probe fixtures and hand-made cases.
 * Pure functions: no database. Contract: features/item3b-social-numbers
 */

const calc = require('../src/services/socialCalc.service');
const apify = require('../src/services/apifyRuns.service');

const now = new Date('2026-09-11T12:00:00Z');
const start = new Date(now.getTime() - 90 * 86400000);
const d = (daysAgo) => new Date(now.getTime() - daysAgo * 86400000);

describe('handles (§3.3)', () => {
  it('Instagram: strips @ and URLs, lower-cases, 1–30 of letters/digits/./_', () => {
    expect(calc.normaliseInstagramHandle('@Priya.Styles')).toBe('priya.styles');
    expect(calc.normaliseInstagramHandle('https://www.instagram.com/_akshayareddyyy/')).toBe('_akshayareddyyy');
    expect(calc.normaliseInstagramHandle('priya styles!')).toBeNull();
    expect(calc.normaliseInstagramHandle('x'.repeat(31))).toBeNull();
    expect(calc.normaliseInstagramHandle('')).toBeNull();
  });
  it('YouTube: @handle, youtube.com/@handle, m.youtube.com, /channel/UC…, /c/…', () => {
    expect(calc.normaliseYoutubeRef('@lakkireddyakshayareddy-30')).toEqual({ handle: 'lakkireddyakshayareddy-30', channelId: null, channelUrl: 'https://www.youtube.com/@lakkireddyakshayareddy-30' });
    expect(calc.normaliseYoutubeRef('https://m.youtube.com/@PriyaStyles?si=x')).toEqual({ handle: 'priyastyles', channelId: null, channelUrl: 'https://www.youtube.com/@priyastyles' });
    expect(calc.normaliseYoutubeRef('https://www.youtube.com/channel/UCLbs1qmAgK6p6_jIgj0gSlg')).toEqual({ handle: null, channelId: 'UCLbs1qmAgK6p6_jIgj0gSlg', channelUrl: 'https://www.youtube.com/channel/UCLbs1qmAgK6p6_jIgj0gSlg' });
    expect(calc.normaliseYoutubeRef('youtube.com/c/PriyaStyles').handle).toBe('priyastyles');
    expect(calc.normaliseYoutubeRef('priya styles')).toBeNull();
  });
});

describe('Instagram (§3.6)', () => {
  it('maps the probe fixture: reels/photos/carousels, hidden likes as null, disabled comments as null, plays as views', () => {
    const posts = apify.loadFixture('instagram-posts.json').map(calc.instagramItemToPost);
    const kinds = posts.reduce((a, p) => ({ ...a, [p.kind]: (a[p.kind] || 0) + 1 }), {});
    expect(kinds.carousel).toBeGreaterThan(0); expect(kinds.photo).toBeGreaterThan(0); expect(kinds.reel).toBeGreaterThan(0);
    expect(posts.filter(p => p.likes === null).length).toBe(2);           // the two -1 posts
    expect(posts.some(p => p.comments === null)).toBe(true);              // isCommentsDisabled
    const reel = posts.find(p => p.kind === 'reel' && p.views != null);
    expect(reel.views).toBeGreaterThan(0);
  });

  it('hand case: averages, hidden-likes count, engagement on reel views, per-week over the measured span', () => {
    const posts = [
      { platform_post_id: 'a', kind: 'reel', published_at: d(3), likes: 100, comments: 10, views: 1000 },
      { platform_post_id: 'b', kind: 'photo', published_at: d(10), likes: 200, comments: 30, views: null },
      { platform_post_id: 'c', kind: 'carousel', published_at: d(20), likes: null, comments: 20, views: null },
      { platform_post_id: 'd', kind: 'reel', published_at: d(120), likes: 999, comments: 999, views: 99999 }, // outside the window
    ];
    const m = calc.instagramMetrics({ posts, followers: 10000, windowStart: start, windowEnd: now });
    expect(m.posts_90d).toBe(3);
    expect(m.posts_per_week).toBe(1.2);                                     // 3 posts over a 17-day span
    expect(m).toMatchObject({ reels: 1, photos: 1, carousels: 1, avg_likes: 150, hidden_likes_count: 1, avg_comments: 20, avg_reel_views: 1000 });
    expect(m.engagement).toBe(11);                                          // (100 + 10) / 1000 × 100, the one reel
    expect(m.engagement_basis).toBe('views');
    expect(m.last_post_at.getTime()).toBe(d(3).getTime());
    expect(m.measured_from.getTime()).toBe(d(20).getTime());
    expect(m.measured_to.getTime()).toBe(d(3).getTime());
    expect(m.capped).toBe(false); expect(m.posts_seen).toBe(3);
  });

  it('no reels in the measured set → engagement falls back to followers and says so', () => {
    const posts = [
      { platform_post_id: 'b', kind: 'photo', published_at: d(10), likes: 200, comments: 30, views: null },
      { platform_post_id: 'c', kind: 'carousel', published_at: d(20), likes: null, comments: 20, views: null },
    ];
    const m = calc.instagramMetrics({ posts, followers: 10000, windowStart: start, windowEnd: now });
    expect(m.engagement).toBe(2.3);                                         // (200 + 25) / 10000 × 100
    expect(m.engagement_basis).toBe('followers');
  });

  it('only the newest 30 posts are measured; the rest are reported as seen but not counted', () => {
    // 40 reels, newest first has the biggest view count. The 10 oldest must not reach the numbers.
    const posts = Array.from({ length: 40 }, (_, i) => ({
      platform_post_id: `p${i}`, kind: 'reel', published_at: d(i + 1),
      likes: i < 30 ? 100 : 100000, comments: 0, views: 1000,
    }));
    const m = calc.instagramMetrics({ posts, followers: 10000, windowStart: start, windowEnd: now });
    expect(m.posts_90d).toBe(30);
    expect(m.posts_seen).toBe(40);
    expect(m.capped).toBe(true);
    expect(m.avg_likes).toBe(100);                                          // the 100000-like tail is excluded
    expect(m.engagement).toBe(10);                                          // 30 × 100 / (30 × 1000) × 100
    expect(m.measured_from.getTime()).toBe(d(30).getTime());
    expect(m.measured_to.getTime()).toBe(d(1).getTime());
    // The cap is a maximum, not a target: a creator with fewer posts is measured on all of them.
    expect(calc.instagramMetrics({ posts: posts.slice(0, 5), followers: 10000, windowStart: start, windowEnd: now }).capped).toBe(false);
  });

  it('every post hides likes → engagement "—" (null), not a comments-only rate (founder Q14)', () => {
    const posts = apify.loadFixture('instagram-posts-all-hidden-likes.json').map(calc.instagramItemToPost);
    const m = calc.instagramMetrics({ posts, followers: 10000, windowStart: start, windowEnd: now });
    expect(m.posts_90d).toBe(2); expect(m.avg_likes).toBeNull(); expect(m.hidden_likes_count).toBe(2); expect(m.engagement).toBeNull(); expect(m.avg_comments).toBe(24);
  });

  it('0 posts → count 0, every average null, engagement null; no reels → avg reel views null; followers 0 → engagement null', () => {
    const empty = calc.instagramMetrics({ posts: [], followers: 5000, windowStart: start, windowEnd: now });
    expect(empty).toMatchObject({ posts_90d: 0, posts_per_week: 0, avg_likes: null, avg_comments: null, avg_reel_views: null, engagement: null, last_post_at: null });
    const noReels = calc.instagramMetrics({ posts: [{ platform_post_id: 'p', kind: 'photo', published_at: d(1), likes: 10, comments: 1 }], followers: 100, windowStart: start, windowEnd: now });
    expect(noReels.avg_reel_views).toBeNull(); expect(noReels.engagement).toBe(11);
    expect(calc.instagramMetrics({ posts: noReels ? [{ platform_post_id: 'p', kind: 'photo', published_at: d(1), likes: 10, comments: 1 }] : [], followers: 0, windowStart: start, windowEnd: now }).engagement).toBeNull();
  });

  it('profile: found → numbers; error item → not_found; private flag → private', () => {
    const [found, notFound] = apify.loadFixture('instagram-profile.json');
    expect(calc.instagramProfile(found)).toMatchObject({ followers: 192011, following: 327, total_posts: 238, verified: true, account_type: 'creator' });
    expect(calc.instagramProfile(notFound)).toEqual({ error: 'not_found' });
    expect(calc.instagramProfile(apify.loadFixture('instagram-profile-private.json')[0]).error).toBe('private');
  });
});

describe('YouTube (§3.6)', () => {
  it('splits by tab, drops streams, parses durations, reads channel totals; not-found and no-streams answers', () => {
    const videos = apify.loadFixture('youtube-videos.json').map(i => calc.youtubeItemToUpload(i, 'videos'));
    const shorts = apify.loadFixture('youtube-shorts.json').map(i => calc.youtubeItemToUpload(i, 'shorts'));
    expect(videos.every(v => v.kind === 'long' && v.tab_source === 'tab')).toBe(true);
    expect(shorts.every(v => v.kind === 'short' && v.tab_source === 'tab')).toBe(true);
    expect(videos[0].duration_secs).toBe(21 * 60 + 14);
    expect(calc.youtubeItemToUpload({ id: 's1', type: 'stream', date: '2026-06-27T03:49:54.000Z', duration: '03:53:44', viewCount: 1 }, null)).toBeNull();
    expect(calc.youtubeChannel(apify.loadFixture('youtube-videos.json'))).toMatchObject({ subscribers: 52000, total_videos: 7, total_channel_views: 3672726, channel_id: 'UCLbs1qmAgK6p6_jIgj0gSlg' });
    expect(calc.youtubeChannel(apify.loadFixture('youtube-notfound.json'))).toEqual({ error: 'not_found' });
    expect(calc.youtubeChannel(apify.loadFixture('youtube-streams-none.json'))).toMatchObject({ error: null, empty: true });
  });

  it('duration fallback only when the tab is unknown: ≤180 s short, else long', () => {
    expect(calc.youtubeItemToUpload({ id: 'a', date: '2026-09-01T00:00:00Z', duration: '02:59' }, null)).toMatchObject({ kind: 'short', tab_source: 'duration_fallback' });
    expect(calc.youtubeItemToUpload({ id: 'b', date: '2026-09-01T00:00:00Z', duration: '03:01' }, null)).toMatchObject({ kind: 'long', tab_source: 'duration_fallback' });
    expect(calc.youtubeItemToUpload({ id: 'c', date: '2026-09-01T00:00:00Z', duration: '02:59' }, 'videos')).toMatchObject({ kind: 'long', tab_source: 'tab' });
  });

  it('hand case: engagement on views per type, disabled comments count as 0, views 0 excluded, a type with 0 uploads is null', () => {
    const uploads = [
      { platform_post_id: 'l1', kind: 'long', published_at: d(5), likes: 100, comments: 20, views: 2000 },
      { platform_post_id: 'l2', kind: 'long', published_at: d(6), likes: 50, comments: null, views: 1000 },   // comments disabled → 0 in engagement
      { platform_post_id: 'l3', kind: 'long', published_at: d(7), likes: 10, comments: 5, views: 0 },        // views 0 → not in engagement
      { platform_post_id: 'l4', kind: 'long', published_at: d(200), likes: 1, comments: 1, views: 1 },       // outside
    ];
    const m = calc.youtubeMetrics({ uploads, windowStart: start, windowEnd: now });
    expect(m.uploads_90d).toBe(3);
    expect(m.uploads_per_week).toBe(3);                  // 3 uploads inside a 2-day span, floored at a week
    expect(m.long.count).toBe(3);
    expect(m.long.avg_views).toBe(1000);                 // (2000 + 1000 + 0) / 3
    expect(m.long.avg_likes).toBe(53.3);
    expect(m.long.avg_comments).toBe(12.5);              // (20 + 5) / 2
    expect(m.long.engagement).toBe(5.7);                 // (100+20 + 50+0) / (2000+1000) × 100
    expect(m.short).toMatchObject({ count: 0, avg_views: null, avg_likes: null, avg_comments: null, engagement: null });
  });

  it('the probe channel: 3 long videos and 4 shorts inside the window, both engagements on views', () => {
    const uploads = apify.loadFixture('youtube-videos.json').map(i => calc.youtubeItemToUpload(i, 'videos'))
      .concat(apify.loadFixture('youtube-shorts.json').map(i => calc.youtubeItemToUpload(i, 'shorts')));
    const m = calc.youtubeMetrics({ uploads, windowStart: new Date('2026-06-13T00:00:00Z'), windowEnd: new Date('2026-09-11T00:00:00Z') });
    expect(m.long.count).toBe(3); expect(m.short.count).toBe(4); expect(m.uploads_90d).toBe(7);
    const sum = (xs, k) => xs.reduce((a, x) => a + x[k], 0);
    const longs = uploads.filter(u => u.kind === 'long');
    expect(m.long.engagement).toBe(Math.round(((sum(longs, 'likes') + sum(longs, 'comments')) / sum(longs, 'views')) * 1000) / 10);
  });
});
