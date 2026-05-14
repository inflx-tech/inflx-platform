'use strict';

/**
 * Marketing Automation Service
 *
 * Outbound calls from Inflx into the n8n v2 marketing-engine workflows.
 * Every entry point here is best-effort: failures are logged and returned
 * as { ok: false, ... } but never thrown. Callers should treat the n8n
 * fire as fire-and-forget — the user-facing operation must succeed even
 * if n8n is down.
 *
 * Currently exposes one entry point — triggerScrape — used by both
 *   - the admin marketing intake (manual lead add), and
 *   - the influencer signup flow (auto-scrape on first signup with an
 *     IG handle we haven't seen before).
 */

const env = require('../config/env');

const A2_WEBHOOK_PATH = '/webhook/a2-profile-scraper';
const TRIGGER_TIMEOUT_MS = 10000;

/**
 * Fire the n8n A2 v2 profile-scraper webhook for a handle.
 *
 * @param {object}  opts
 * @param {string}  opts.handle               — IG handle, already normalised.
 * @param {'influencer'|'brand'} opts.target_type
 * @param {'deep'|'refresh'}     [opts.scrape_mode='deep']
 * @param {string}  [opts.source]             — provenance tag forwarded to INGEST
 *                                              (e.g. 'signup', 'admin_intake').
 * @param {string}  [opts.signup_user_id]     — UUID of users.id when the scrape
 *                                              was triggered by a signup. Forwarded
 *                                              to INGEST for audit; the actual
 *                                              creator_profiles linkage is already
 *                                              established at signup time.
 * @param {string}  [opts.signup_influencer_id] — UUID of influencers.id, ditto.
 *
 * @returns {Promise<{ok:boolean,status?:number,skipped?:boolean,reason?:string,error?:string}>}
 */
async function triggerScrape({
  handle,
  target_type,
  scrape_mode = 'deep',
  source,
  signup_user_id,
  signup_influencer_id,
}) {
  if (!env.N8N_BASE_URL) {
    console.warn('[marketing-automation] N8N_BASE_URL not configured; skipping scrape trigger');
    return { ok: false, skipped: true, reason: 'n8n_not_configured' };
  }
  if (!handle) {
    return { ok: false, skipped: true, reason: 'missing_handle' };
  }

  const url = env.N8N_BASE_URL.replace(/\/+$/, '') + A2_WEBHOOK_PATH;
  const payload = {
    username: handle,
    target_type: target_type === 'brand' ? 'brand' : 'influencer',
    scrape_mode: scrape_mode === 'refresh' ? 'refresh' : 'deep',
  };
  if (source) payload.source = source;
  if (signup_user_id) payload.signup_user_id = signup_user_id;
  if (signup_influencer_id) payload.signup_influencer_id = signup_influencer_id;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT_MS);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: r.ok, status: r.status };
  } catch (e) {
    console.error('[marketing-automation] A2 webhook trigger failed:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  triggerScrape,
};
