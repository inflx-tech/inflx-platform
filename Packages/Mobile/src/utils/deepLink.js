import { navigateWhenReady } from '../navigation/navRef';

/**
 * INFLX links opened in the shopper app (post-links-codes · rules v1.7 §4.14):
 *   inflx.in/p/<code>[/<ch>]    a post       → Post (by code; the ending is the channel)
 *   inflx.in/s/<handle>[/<ch>]  her store    → Creator store (an old handle still works)
 *   inflx.in/c/<code>           a collection → Collection
 * The channel only says where the visit came from; every ending opens the same thing. The post
 * link's visit is counted by the server when the post is fetched; store and collection links are
 * counted here, like the website does.
 *
 * Opening links from outside the app needs the next Play Store build for /c/ (the /p/ and /s/
 * link filters are already in the app); the parsing and routing here are ready for both.
 */
const CHANNELS = ['ig', 'yt', 'wa', 'fb', 'o'];

export function parseDeepLink(url) {
  if (typeof url !== 'string' || !url) return null;
  const cleaned = url
    .replace(/^https?:\/\/(www\.)?inflx\.in/i, '')
    .replace(/^inflx:\/\//i, '/');
  const m = cleaned.match(/^\/?([psc])\/([^/?#]+)(?:\/([^/?#]+))?/i);
  if (!m) return null;
  const [, typeLetter, rawId, rawCh] = m;
  const ch = String(rawCh || '').toLowerCase();
  return {
    type: typeLetter.toLowerCase(),
    id: decodeURIComponent(rawId),
    channel: CHANNELS.includes(ch) ? ch : 'o',
  };
}

export function handleDeepLink(url) {
  const t = parseDeepLink(url);
  if (!t) return;
  const { followerApi } = require('../services/api');
  switch (t.type) {
    case 'p':
      navigateWhenReady('Post', { code: t.id.toUpperCase(), ch: t.channel });
      break;
    case 's':
      followerApi.linkVisitStore(t.id, t.channel).catch(() => {});
      navigateWhenReady('CreatorStore', { id: t.id.replace(/^@/, '').toLowerCase() });
      break;
    case 'c':
      followerApi.linkVisitCollection(t.id).catch(() => {});
      navigateWhenReady('Collection', { id: t.id.toUpperCase() });
      break;
    default:
      break;
  }
}
