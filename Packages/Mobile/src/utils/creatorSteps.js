import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { influencerApi } from '../services/api';

/**
 * creatorSteps.js — where each of her collaborations has got to, from the server.
 * Contract: features/stage-3-watch-the-work-happen (slice 6)
 * Board: 04-preview/mockups/stage3-screens.html panel ⑤, right-hand phone
 *
 * WHAT THIS REPLACES, AND WHY IT IS A DELETION
 * Her collaboration screen drew its own spine — Invite · Nego · Sign · Active · Track ·
 * Done — from `collabDetailModel.SPINE`. Two problems, and the second is worse:
 *
 *   1. Those are not the agreed six steps. The server's are Agree · Sign · Shoot ·
 *      Shop posts · Go live · Complete, and three of the old words are not steps at all.
 *   2. `spineFor` matched on STAGE NAMES that Stage 1 renamed. It expected
 *      invites/applied/negotiating/to_sign/active/tracking/completed; `deriveStage` now
 *      emits invitations/pitches/to_sign/shoot/content/done. The two lists overlap in
 *      EXACTLY ONE value. So `findIndex` returned -1 for almost everything and every node
 *      rendered "todo" — her spine highlighted NOTHING. Same shape as Stage 1 bug #9.
 *
 * Repairing it would mean keeping two derivations in step forever, which is the fault this
 * programme has now fixed five times. So it is deleted, and she reads the same number the
 * brand does — from `GET /influencers/me/needs-you`, which has shipped since Stage 0 and
 * whose `collaborations` array nobody has ever used.
 *
 * ONE FETCH, SHARED. Her navigator already calls this endpoint for the tab badge. Rather
 * than a second call from the detail screen, both read this cache. A screen and a badge
 * disagreeing about the same collaboration is the exact failure the spine exists to prevent.
 *
 * NEVER BLANKS. If the call fails the last answer is kept. Her old spine at least drew six
 * labels; the replacement must not be worse when the network is.
 */

let cache = null;          // { total, items, collaborations }
let failed = false;
let inflight = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });

export async function refreshSteps() {
  if (inflight) return inflight;
  inflight = influencerApi.getNeedsYou()
    .then((res) => {
      if (res?.success) { cache = res.data || null; failed = false; }
      else failed = true;
      return cache;
    })
    .catch(() => { failed = true; return cache; })
    .finally(() => { inflight = null; emit(); });
  return inflight;
}

export const getSteps = () => cache;
export const lastFetchFailed = () => failed;
export function clearSteps() { cache = null; failed = false; emit(); }

/** Her total — the tab badge. */
export const totalFor = (d) => Number(d?.total || 0);

/**
 * One collaboration's step and turn, by campaign_influencer id.
 * Returns null when the server has not been asked yet, or does not know — which the screen
 * must render as "we can't say", never as step 1.
 */
export function stepFor(data, campaignInfluencerId) {
  const list = data?.collaborations || [];
  const row = list.find(c => String(c.campaign_influencer_id) === String(campaignInfluencerId));
  if (!row || !row.step) return null;
  return { step: Number(row.step), turn: row.turn || 'nobody', state: row.state || null };
}

/** The whole set, refreshed on mount and when the app returns to the foreground. */
export function useCreatorSteps() {
  const [, bump] = useState(0);
  const refresh = useCallback(() => refreshSteps(), []);

  useEffect(() => {
    const fn = () => bump(n => n + 1);
    listeners.add(fn);
    refresh();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => { listeners.delete(fn); sub.remove(); };
  }, [refresh]);

  return { data: cache, failed, refresh };
}
