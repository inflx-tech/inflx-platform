# Workflow Definition — Deliverable consolidation

## Actor
Logged-in influencer, approved, with an active campaign that has deliverables.

## Preconditions
Deliverables across states (pending, revision_requested, submitted, approved, live).

## Workflow steps (user-observable)
1. Open a deliverable from **DeliverableList** (in-app) → the unified DeliverableScreen.
2. Open a deliverable from a **content notification** (deep-link, deliverableId) → the
   SAME unified screen (loaded via getDeliverable).
3. The screen shows: status timeline, details/brief, and — for pending/revision — a submit
   section offering **both** media upload (gallery/camera → R2) **and** a URL fallback,
   plus an optional note to the brand; submit is 2-step confirmed.
4. For an approved deliverable: paste + confirm the live URL.
5. For a live deliverable: a **performance stats** panel (likes/comments/saves/shares/
   reach/impressions/ER) with a Refresh action, plus the live celebration.
6. Pull-to-refresh re-fetches the deliverable + stats.

## Success definition
- One screen renders correctly for every deliverable state and is reached identically from
  the in-app list and the notification; media upload + URL submit + notes + timeline +
  live stats all present regardless of entry point; submit/live keep their confirm dialogs.

## Failure / edge workflows
- Invalid id / not found → error state, no crash.
- Upload failure → alert; deliverable stays un-submitted (no partial state).
- No stats yet on a live post → "Refresh to fetch" prompt.
