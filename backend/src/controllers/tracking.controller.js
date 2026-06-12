'use strict';

/**
 * tracking.controller.js
 *
 * Handles the influencer share-link redirect:
 *   GET /s/:influencer_handle?cid={campaign_id}&sid={set_id}&oid={offer_id}&iid={influencer_id}
 *
 * Logs the click (non-blocking) then redirects to the follower store.
 * The redirect target is configurable via FOLLOWER_APP_URL in .env.
 * Falls back to the API store endpoint for local dev.
 */

const db = require('../config/db');

const FOLLOWER_APP_URL = process.env.FOLLOWER_APP_URL || '';

async function trackClick(req, res) {
  const { influencer_handle } = req.params;
  const { cid, sid, oid, iid } = req.query;

  // Fire-and-forget — never block the redirect on a DB write
  db.query(
    `INSERT INTO link_clicks
       (influencer_handle, campaign_id, set_id, offer_id, influencer_id,
        ip_address, user_agent, referer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      influencer_handle,
      cid  || null,
      sid  || null,
      oid  || null,
      iid  || null,
      req.ip   || null,
      (req.headers['user-agent'] || '').slice(0, 500) || null,
      (req.headers['referer']    || '').slice(0, 500) || null,
    ]
  ).catch(err => console.error('[TRACKING] Click log error:', err.message));

  // Build redirect URL, preserving the 4 attribution IDs so the follower
  // app can pre-select the right campaign/offer context.
  const params = new URLSearchParams();
  if (cid) params.set('cid', cid);
  if (sid) params.set('sid', sid);
  if (oid) params.set('oid', oid);
  if (iid) params.set('iid', iid);

  const qs = params.toString() ? `?${params.toString()}` : '';

  let redirectUrl;
  if (FOLLOWER_APP_URL) {
    // Production: e.g. https://inflx.in/store/johndoe?cid=...
    redirectUrl = `${FOLLOWER_APP_URL}/store/${encodeURIComponent(influencer_handle)}${qs}`;
  } else {
    // Dev fallback: hit the API store endpoint directly
    redirectUrl = `${req.protocol}://${req.get('host')}/v1/store/${encodeURIComponent(influencer_handle)}${qs}`;
  }

  return res.redirect(302, redirectUrl);
}

// Universal share targets (contract: universal-share-links). Brand store,
// product and offer share links mirror /s/ — log the click (best-effort, into
// the existing link_clicks columns) then redirect to the follower-app deep path.
// In-app OPENING of these links lands with the native intent-filter round; until
// then they resolve via FOLLOWER_APP_URL like /s/ does today.
function _share(kind, deepPath) {
  return async function (req, res) {
    const id = req.params.id;
    const { cid, sid, oid, iid } = req.query;
    db.query(
      `INSERT INTO link_clicks
         (influencer_handle, campaign_id, set_id, offer_id, influencer_id, ip_address, user_agent, referer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [null, cid || null, sid || null, kind === 'offer' ? id : (oid || null), iid || null,
       req.ip || null, (req.headers['user-agent'] || '').slice(0, 500) || null, (req.headers['referer'] || '').slice(0, 500) || null]
    ).catch(err => console.error('[TRACKING] Share click log error:', err.message));

    const params = new URLSearchParams();
    if (cid) params.set('cid', cid);
    if (sid) params.set('sid', sid);
    if (oid) params.set('oid', oid);
    if (iid) params.set('iid', iid);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const base = FOLLOWER_APP_URL || `${req.protocol}://${req.get('host')}/v1`;
    return res.redirect(302, `${base}${deepPath(id)}${qs}`);
  };
}

const trackBrand   = _share('business', (id) => `/business/${encodeURIComponent(id)}`);
const trackProduct = _share('product',  (id) => `/product/${encodeURIComponent(id)}`);
const trackOffer   = _share('offer',    (id) => `/offer/${encodeURIComponent(id)}`);

module.exports = { trackClick, trackBrand, trackProduct, trackOffer };
