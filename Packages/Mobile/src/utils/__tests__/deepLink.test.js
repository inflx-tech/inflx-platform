/**
 * follower-creator-attribution Slice 3 — parseDeepLink unit tests. Guards the
 * universal-link parser that powers the "link door" (Way 1).
 */
jest.mock('../../navigation/navRef', () => ({ navigateWhenReady: jest.fn() }));

import { parseDeepLink } from '../deepLink';

test('creator link with full tracking → handle + 4-id tracking', () => {
  const t = parseDeepLink('https://inflx.in/s/sana_styles?cid=c1&sid=s1&oid=o1&iid=i1');
  expect(t).toEqual({
    type: 's',
    id: 'sana_styles',
    tracking: { campaign_id: 'c1', set_id: 's1', offer_id: 'o1', campaign_influencer_id: 'i1', source: 'link' },
  });
});

test('creator link with no query → tracking null', () => {
  const t = parseDeepLink('https://inflx.in/s/rohit');
  expect(t).toEqual({ type: 's', id: 'rohit', tracking: null });
});

test('custom scheme inflx:// is parsed', () => {
  const t = parseDeepLink('inflx://s/meera?iid=ci9');
  expect(t.type).toBe('s');
  expect(t.id).toBe('meera');
  expect(t.tracking.campaign_influencer_id).toBe('ci9');
});

test('brand link → type b', () => {
  expect(parseDeepLink('https://inflx.in/b/brand-123').type).toBe('b');
});

test('non-INFLX or junk url → null', () => {
  expect(parseDeepLink('https://example.com/s/x')).toBeNull();
  expect(parseDeepLink('garbage')).toBeNull();
  expect(parseDeepLink('')).toBeNull();
  expect(parseDeepLink(null)).toBeNull();
});
