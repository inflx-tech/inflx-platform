'use strict';

/**
 * Item 12 — shared fixtures for the content-step suites.
 * Contract: features/item12-content
 *
 * Built on item 10's worlds (real API: invite → accept → send → both sign; money locked and
 * tranche 1 out for real). The shoot is then marked done the way items 10 and 11 write it —
 * `status = 'completed'` plus the moments — straight into the row, because the shoot flows are
 * items 10 and 11's to prove and item 12 only READS their answer.
 */

const { query } = require('./item3');
const w10 = require('./item10');

/** Mark the shoot done exactly as item 10 (visit confirm) or item 11 (Remote shoot done) writes it. */
async function markShootDone(w, { at = null } = {}) {
  const ts = at || new Date().toISOString();
  if (w.mode === 'visit') {
    await query(
      `UPDATE production_events
          SET status = 'completed', influencer_completed_at = $2, brand_completed_at = $2,
              visit_completed_at = $2, time_agreed_at = COALESCE(time_agreed_at, $2)
        WHERE id = $1`, [w.pe.id, ts]);
  } else {
    await query(
      `UPDATE production_events SET status = 'completed', influencer_completed_at = $2 WHERE id = $1`,
      [w.pe.id, ts]);
  }
  w.pe = (await query(`SELECT * FROM production_events WHERE id = $1`, [w.pe.id])).rows[0];
  return w;
}

/** Signed by both, funded, and the shoot done — the state the content step opens on. */
async function shotDone(goal = 'engagement', opts = {}) {
  const w = await w10.signedByBoth(goal, opts);
  if (!w.pe) throw new Error('shotDone: no production_events row was born at the signature');
  return markShootDone(w);
}

/** The scopes the content service takes, for each party of a world. */
const brandScope = (w) => ({ side: 'brand', userId: w.b.userId, campaignId: w.c.id, setId: w.s.id });
const creatorScope = (w) => ({ side: 'creator', userId: w.cr.userId });

/** Base paths (item 10/11 naming). */
const B = (w) => `${w.url}/invitations/${w.ciId}/content`;
const C = (w) => `/influencers/me/invitations/${w.ciId}/content`;

module.exports = { markShootDone, shotDone, brandScope, creatorScope, B, C };
