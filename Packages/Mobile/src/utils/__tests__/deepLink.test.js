/**
 * INFLX links opened in the shopper app (post-links-codes · follower-app-v2 · rules v1.7 §4.14).
 * The old ?cid&sid&oid&iid tracking links and /b/ brand links went with the old shopper app
 * (29 Sep 2026): a post link's code, a store link's handle, a collection's code, and the channel
 * ending are what a link carries now.
 */
jest.mock('../../navigation/navRef', () => ({ navigateWhenReady: jest.fn() }));
jest.mock('../../services/api', () => ({
  followerApi: { linkVisitStore: jest.fn(() => Promise.resolve({})), linkVisitCollection: jest.fn(() => Promise.resolve({})) },
}));

import { parseDeepLink, handleDeepLink } from '../deepLink';
import { navigateWhenReady } from '../../navigation/navRef';
import { followerApi } from '../../services/api';

beforeEach(() => jest.clearAllMocks());

test('a post link: the code and its channel ending', () => {
  expect(parseDeepLink('https://inflx.in/p/K7M2F9/ig')).toEqual({ type: 'p', id: 'K7M2F9', channel: 'ig' });
  expect(parseDeepLink('https://www.inflx.in/p/k7m2f9/wa?utm=x')).toEqual({ type: 'p', id: 'k7m2f9', channel: 'wa' });
});

test('no ending, or one INFLX does not know, counts as Other', () => {
  expect(parseDeepLink('https://inflx.in/p/K7M2F9').channel).toBe('o');
  expect(parseDeepLink('https://inflx.in/p/K7M2F9/tiktok').channel).toBe('o');
});

test('a store link, a collection link, the inflx:// scheme', () => {
  expect(parseDeepLink('https://inflx.in/s/priya/yt')).toEqual({ type: 's', id: 'priya', channel: 'yt' });
  expect(parseDeepLink('https://inflx.in/c/DSR4K2')).toEqual({ type: 'c', id: 'DSR4K2', channel: 'o' });
  expect(parseDeepLink('inflx://p/K7M2F9/fb')).toEqual({ type: 'p', id: 'K7M2F9', channel: 'fb' });
});

test('the retired links and junk open nothing', () => {
  expect(parseDeepLink('https://inflx.in/b/brand-123')).toBeNull();
  expect(parseDeepLink('https://inflx.in/o/offer-1')).toBeNull();
  expect(parseDeepLink('https://example.com/p/K7M2F9')).toBeNull();
  expect(parseDeepLink('garbage')).toBeNull();
  expect(parseDeepLink('')).toBeNull();
  expect(parseDeepLink(null)).toBeNull();
});

test('opening: a post by its code (visit counted when it loads), her store and a collection counted here', () => {
  handleDeepLink('https://inflx.in/p/k7m2f9/ig');
  expect(navigateWhenReady).toHaveBeenLastCalledWith('Post', { code: 'K7M2F9', ch: 'ig' });
  handleDeepLink('https://inflx.in/s/@Priya/wa');
  expect(followerApi.linkVisitStore).toHaveBeenCalledWith('@Priya', 'wa');
  expect(navigateWhenReady).toHaveBeenLastCalledWith('CreatorStore', { id: 'priya' });
  handleDeepLink('https://inflx.in/c/dsr4k2');
  expect(followerApi.linkVisitCollection).toHaveBeenCalledWith('dsr4k2');
  expect(navigateWhenReady).toHaveBeenLastCalledWith('Collection', { id: 'DSR4K2' });
});
