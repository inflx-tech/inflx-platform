import { navigateWhenReady } from '../navigation/navRef';

/**
 * follower-creator-attribution Slice 3 — parse a universal INFLX link into a
 * navigation target + creator tracking. Mirrors utils/shareUrl.js:
 *   /s/:handle  → creator store   (Way 1: the creator's social link)
 *   /b/:brand_id→ brand store
 *   /p/:product_id, /o/:offer_id  → recognised, routed best-effort
 * Query: cid=campaign_id · sid=set_id · oid=offer_id · iid=campaign_influencer_id.
 */
export function parseDeepLink(url) {
  if (typeof url !== 'string' || !url) return null;
  // Strip the host (https://inflx.in, www, or the inflx:// custom scheme).
  const cleaned = url
    .replace(/^https?:\/\/(www\.)?inflx\.in/i, '')
    .replace(/^inflx:\/\//i, '/');
  const m = cleaned.match(/^\/?([sbpo])\/([^/?#]+)(?:\?([^#]*))?/i);
  if (!m) return null;
  const [, typeLetter, rawId, qs] = m;

  const q = {};
  if (qs) {
    for (const pair of qs.split('&')) {
      const [k, v] = pair.split('=');
      if (k) q[k] = decodeURIComponent((v || '').replace(/\+/g, ' '));
    }
  }
  const tracking = (q.cid || q.iid) ? {
    campaign_id: q.cid || null,
    set_id: q.sid || null,
    offer_id: q.oid || null,
    campaign_influencer_id: q.iid || null,
    source: 'link',
  } : null;

  return { type: typeLetter.toLowerCase(), id: decodeURIComponent(rawId), tracking };
}

// Route an incoming link into the follower app (no-op on other flavors — the
// route simply won't exist and navigateWhenReady swallows it).
export function handleDeepLink(url) {
  const t = parseDeepLink(url);
  if (!t) return;
  switch (t.type) {
    case 's':
      navigateWhenReady('InfluencerStore', { handle: t.id, tracking: t.tracking, trackingParams: t.tracking });
      break;
    case 'b':
      navigateWhenReady('BrandStore', { brandId: t.id, tracking: t.tracking });
      break;
    case 'p':
      navigateWhenReady('ProductDetail', { selectedProductId: t.id, tracking: t.tracking });
      break;
    // 'o' (offer) deep link → deferred (needs the offer-detail param shape).
    default:
      break;
  }
}
