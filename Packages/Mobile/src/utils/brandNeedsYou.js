import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { brandApi } from '../services/api';

/**
 * brandNeedsYou.js — the one place the brand app holds "what needs you".
 * Contract: features/stage-3-watch-the-work-happen (slice 2)
 * Board: 04-preview/mockups/stage3-screens.html panels ① and ②
 *
 * WHAT WAS HAPPENING BEFORE
 * `GET /brands/me/inbox-summary` has carried the whole needs-you tree since Stage 0 —
 * campaigns → sets → creators, each with what is owed at that level and what is owed
 * beneath it. Two screens called that endpoint. **Neither read the tree.** Grep the app for
 * `needs_you` before this file existed: zero hits. Computed on every call, discarded every
 * time.
 *
 * WHY A SHARED STORE AND NOT THREE FETCHES
 * The tab badge, the campaign list, the drill-down and Home all want the same answer. Four
 * independent fetches means four answers that can differ by a few seconds, and a badge that
 * disagrees with the screen underneath it is the exact failure the whole spine exists to
 * prevent. One fetch, one cache, everyone subscribes.
 *
 * WHY IT REFRESHES ON FOREGROUND AND NOT ON A TIMER
 * Same reasoning the creator's navigator already uses: a brand who has just dealt with
 * something should not keep seeing a badge for it, and a poll spends battery to say nothing.
 *
 * NEVER FAKES A ZERO. If the call fails the last known tree is kept and `failed` is set.
 * A badge of 0 must mean "nothing is owed", never "we could not ask" — a brand who is told
 * zero stops looking.
 */

let cache = null;        // the last successful tree
let failed = false;
let inflight = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });
}

/** Fetch once; concurrent callers share the same request. */
export async function refreshNeedsYou() {
  if (inflight) return inflight;
  inflight = brandApi.getInboxSummary()
    .then((res) => {
      if (res?.success) {
        cache = res.data?.needs_you || null;
        failed = false;
      } else {
        failed = true;
      }
      return cache;
    })
    .catch(() => { failed = true; return cache; })
    .finally(() => { inflight = null; emit(); });
  return inflight;
}

export const getNeedsYou = () => cache;
export const lastFetchFailed = () => failed;

/** Forget everything — on sign-out, so the next brand never sees the last one's numbers. */
export function clearNeedsYou() {
  cache = null; failed = false; emit();
}

/**
 * The whole tree, refreshed on mount and whenever the app comes back to the foreground.
 * Returns { tree, total, failed, refresh }.
 */
export function useNeedsYou() {
  const [, bump] = useState(0);

  const refresh = useCallback(() => refreshNeedsYou(), []);

  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    refresh();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => { listeners.delete(fn); sub.remove(); };
  }, [refresh]);

  return {
    tree: cache,
    total: Number(cache?.total || 0),
    failed,
    refresh,
  };
}

/* ── Reading the tree ──────────────────────────────────────────────────────── */

/** One campaign's node, or null. */
export function campaignNode(tree, campaignId) {
  return (tree?.campaigns || []).find(c => String(c.campaign_id) === String(campaignId)) || null;
}

/** One set's node, searched across every campaign. */
export function setNode(tree, setId) {
  for (const c of tree?.campaigns || []) {
    const s = (c.sets || []).find(x => String(x.set_id) === String(setId));
    if (s) return s;
  }
  return null;
}

/** One creator's node inside a set. */
export function creatorNode(tree, campaignInfluencerId) {
  for (const c of tree?.campaigns || []) {
    for (const s of c.sets || []) {
      const cr = (s.creators || []).find(x => String(x.campaign_influencer_id) === String(campaignInfluencerId));
      if (cr) return cr;
    }
  }
  return null;
}

/**
 * The badge for a node. Undefined rather than 0 — a zero draws an empty circle and reads
 * as a state; an absence reads as calm. Ended campaigns never reach here because the
 * server excludes them.
 */
export const badgeFor = (node) => (Number(node?.total || 0) > 0 ? Number(node.total) : undefined);

/**
 * Everything owed, flattened, newest problem first — Home's list.
 * Each row carries where it came from, so a tap can go straight to it.
 */
export function flatten(tree) {
  const rows = [];
  for (const c of tree?.campaigns || []) {
    (c.items || []).forEach(i => rows.push({
      ...i, level: 'campaign', campaign_id: c.campaign_id, campaign_name: c.name,
    }));
    for (const s of c.sets || []) {
      (s.items || []).forEach(i => rows.push({
        ...i, level: 'set', campaign_id: c.campaign_id, campaign_name: c.name,
        set_id: s.set_id, set_name: s.name,
      }));
      for (const cr of s.creators || []) {
        if (Number(cr.own || 0) > 0) {
          rows.push({
            code: 'CREATOR_TURN',
            message: `${cr.name} is waiting on you at step ${cr.step}.`,
            level: 'creator',
            campaign_id: c.campaign_id, campaign_name: c.name,
            set_id: s.set_id, set_name: s.name,
            campaign_influencer_id: cr.campaign_influencer_id,
            influencer_id: cr.influencer_id,
            name: cr.name, step: cr.step, turn: cr.turn,
          });
        }
      }
    }
  }
  return rows;
}
