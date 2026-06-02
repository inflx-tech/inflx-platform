'use strict';

/**
 * tracking.js — build the canonical 4-ID attribution block for a feed item.
 *
 * Every actionable item the section engine returns carries the same attribution
 * chain that share links use: inflx.in/s/{handle}?cid&sid&oid&iid. A follower
 * tap inherits the 4 IDs (campaign/set/offer/influencer) → commission attributes
 * exactly like a /s/ share-link click. No change to follower_transactions.
 *
 * SHARE_BASE mirrors the tracking.controller redirect convention:
 * FOLLOWER_APP_URL when set (prod), else the governance-canonical inflx.in.
 */

const SHARE_BASE = process.env.SHARE_BASE_URL || 'https://inflx.in';

/**
 * @param {object} a
 * @param {string} a.handle  influencer handle (instagram_handle)
 * @param {string} [a.cid]   campaign_id
 * @param {string} [a.sid]   set_id
 * @param {string} [a.oid]   offer_id
 * @param {string} [a.iid]   influencer_id
 * @returns {{cid,sid,oid,iid,url}|null} null when no handle (no attributable link)
 */
function buildTracking({ handle, cid, sid, oid, iid } = {}) {
  if (!handle) return null;
  const params = new URLSearchParams();
  if (cid) params.set('cid', cid);
  if (sid) params.set('sid', sid);
  if (oid) params.set('oid', oid);
  if (iid) params.set('iid', iid);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return {
    cid: cid || null,
    sid: sid || null,
    oid: oid || null,
    iid: iid || null,
    url: `${SHARE_BASE}/s/${encodeURIComponent(handle)}${qs}`,
  };
}

module.exports = { buildTracking };
