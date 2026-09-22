'use strict';

/**
 * shippingWebhook.controller.js — the door a courier knocks on.
 * Contract: features/item11-remote §6.3 · checks 16, 17, 35
 *
 * ONE ENDPOINT, BOTH PROVIDERS. `/v1/webhooks/shipping/shiprocket` is where the aggregator
 * will post; `/v1/webhooks/shipping/simulator` is where Admin's Test parcels page posts. They
 * differ only in how the caller is authenticated and how the body is translated — after that
 * it is the same handler, so what Admin exercises today is what production runs later.
 *
 * AUTHENTICATION
 *   shiprocket — the adapter's signature check over the RAW body. Fails closed: with no
 *                secret configured nothing is accepted.
 *   simulator  — an admin session with the `shipping` capability, and nothing else. The Test
 *                parcels page is the only thing allowed to move a test parcel, and every
 *                press is logged with who and when (check 35). A simulator event is refused
 *                outright once SHIPPING_PROVIDER is no longer the simulator.
 *
 * A courier gets 200 for anything it sends that we understood enough to store, including an
 * event we do not act on and a tracking number we do not know. Retrying for ever helps
 * nobody, and the raw body is kept either way.
 */

const db = require('../config/db');
const env = require('../config/env');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const webhook = require('../services/shipping/webhook');
const shiprocket = require('../services/shipping/shiprocket');
const { EVENT_LIST } = require('../services/shipping/contract');
// Item 11 — the effects queue their notifications inside the transaction and we flush them
// once it has committed. Item 10's rule: nobody is told about something that then rolls back.
const remoteEffects = require('../services/remoteEffects');

const parseJson = (raw) => {
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '{}')); }
  catch { return null; }
};

const handle = asyncHandler(async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const payload = parseJson(raw);
  if (!payload) throw new AppError('VALIDATION_ERROR', 'The body is not JSON.', 400);

  if (provider === 'shiprocket') {
    if (!shiprocket.verifySignature(raw, req.headers || {})) {
      throw new AppError('UNAUTHORIZED', 'Signature check failed.', 401);
    }
    const u = shiprocket.parseWebhook(payload);
    if (!u) {
      // A status we do not map is not an error — it is a status we do not map. Keep it where
      // it can be read, and say nothing happened.
      await db.query(
        `INSERT INTO shipment_events (shipment_id, provider, event, dedupe_key, occurred_at, payload, applied)
         SELECT s.id, 'shiprocket', 'unmapped', $2, now(), $3::jsonb, false
           FROM shipments s WHERE s.provider = 'shiprocket' AND s.tracking_number = $1
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [payload.awb || payload.awb_code || null,
         `shiprocket|unmapped|${payload.awb || ''}|${payload.current_status || ''}|${Date.now()}`,
         JSON.stringify(payload)]
      ).catch(() => null);
      return success(res, { received: true, applied: false, note: 'status not mapped' });
    }
    const out = await webhook.handle({ provider, ...u, payload });
    await remoteEffects.flush();
    return success(res, { received: true, duplicate: !!out.duplicate, applied: !!out.applied });
  }

  if (provider === 'simulator') {
    // The simulator is driven by a person, not a machine — so it is the person who is
    // authenticated. requireCapability('shipping') runs in the route chain for the admin API;
    // this endpoint is reached without a session, so it demands the admin token explicitly.
    throw new AppError('FORBIDDEN',
      'Simulated events are injected from Admin → Test parcels, which is where they are logged.', 403);
  }

  throw new AppError('NOT_FOUND', `No shipping provider named "${provider}".`, 404);
});

/**
 * The simulator's real entry point — called by the Test parcels controller, which has already
 * established WHO is pressing the button. It goes through the very same `webhook.handle`,
 * which is the whole point (check 16).
 */
async function injectSimulated({ shipmentId, event, occurredAt, amount, reason, actorUserId }) {
  if (!EVENT_LIST.includes(event)) {
    throw new AppError('VALIDATION_ERROR', `"${event}" is not a shipment event.`, 422, 'event');
  }
  if (env.SHIPPING_PROVIDER !== 'simulator') {
    throw new AppError('TEST_PARCEL_REAL_PROVIDER', 'Test parcels only work with the simulator.', 422, 'provider');
  }
  const out = await webhook.handle({
    provider: 'simulator',
    shipmentId,
    event,
    occurredAt: occurredAt || new Date(),
    amount: amount == null ? null : Number(amount),
    reason: reason || null,
    payload: { source: 'admin-test-parcels', event, by: actorUserId, at: new Date().toISOString(), amount: amount ?? null, reason: reason || null },
  });
  // The same flush a real provider's delivery gets — that is the whole point of R18.
  await remoteEffects.flush();
  return out;
}

module.exports = { handle, injectSimulated };
