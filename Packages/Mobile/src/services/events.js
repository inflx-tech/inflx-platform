/**
 * events.js — the follower behaviour queue.
 * Contract: features/follower-event-log/ (Slice 0)
 *
 * Records what a follower is shown and what they do with it, so the feed can
 * eventually rank on real behaviour instead of "newest first", creators can be
 * shown sales per post, and the stats surfaces have something to count.
 *
 * Three rules this file exists to enforce:
 *   1. NEVER block or break the UI. Every call is fire-and-forget; a failed
 *      flush drops its batch and says nothing. Losing analytics is acceptable,
 *      a follower seeing an error because a log call failed is not.
 *   2. NEVER one request per impression. Events buffer and go in batches.
 *   3. NEVER lose the tail. Backgrounding the app flushes what is buffered,
 *      otherwise the most interesting part of a session dies in memory.
 */
import { AppState } from 'react-native';
import { followerApi } from './api';
import { getDeviceId, getSessionId, newSession } from './deviceId';

const FLUSH_AT_COUNT = 20;     // batch size that triggers a send
const FLUSH_EVERY_MS = 10000;  // …or this long, whichever comes first
const MAX_QUEUE      = 100;    // server cap; never send more than it accepts

let queue = [];
let timer = null;
let started = false;

/** Attaches the foreground/background hook exactly once, lazily. */
function ensureStarted() {
  if (started) return;
  started = true;
  try {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') { newSession(); return; }
      // background / inactive — get the tail out before the app is frozen
      flush();
    });
  } catch {
    // AppState unavailable (tests, headless) — batching still works.
  }
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_EVERY_MS);
}

/**
 * Queue one event.
 * @param {string} eventType  impression | view | complete | tap_shop |
 *                            tap_product | share | save | unsave | like |
 *                            unlike | add_to_bag
 * @param {string} postId
 * @param {string} surface    discover | posts_tab | videos_tab | concept |
 *                            creator_store | wishlist | search | share_link
 * @param {object} [extra]    { position, product_id, dwell_ms, meta }
 */
export function track(eventType, postId, surface, extra = {}) {
  if (!postId || !eventType || !surface) return;
  ensureStarted();

  queue.push({
    post_id: postId,
    event_type: eventType,
    surface,
    position: extra.position != null ? extra.position : null,
    product_id: extra.product_id || null,
    dwell_ms: extra.dwell_ms != null ? Math.max(0, Math.round(extra.dwell_ms)) : null,
    meta: extra.meta || {},
  });

  // Drop the OLDEST on overflow: recent behaviour is the more useful signal,
  // and an unbounded queue on a long session is a memory leak.
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);

  if (queue.length >= FLUSH_AT_COUNT) flush();
  else scheduleFlush();
}

/** Sends whatever is buffered. Safe to call at any time; never throws. */
export async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (queue.length === 0) return;

  // Take the batch BEFORE awaiting, so events queued during the request are
  // not swallowed by the clear.
  const batch = queue;
  queue = [];

  try {
    const device_id = await getDeviceId();
    await followerApi.postEvents({ device_id, session_id: getSessionId(), events: batch });
  } catch {
    // Deliberately silent and deliberately not re-queued: a retry loop against
    // a failing server would grow without bound and still show the follower
    // nothing. The batch is gone; the app is unaffected.
  }
}

/** Impressions arrive in bursts from viewability — de-dupe per screen mount. */
export function makeImpressionTracker(surface) {
  const seen = new Set();
  return (postId, position) => {
    if (!postId || seen.has(postId)) return;
    seen.add(postId);
    track('impression', postId, surface, { position });
  };
}

export default { track, flush, makeImpressionTracker };
