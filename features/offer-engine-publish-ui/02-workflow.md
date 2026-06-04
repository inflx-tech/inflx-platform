# Workflow Definition — offer-engine-publish-ui

## Actor
Logged-in brand on `/dashboard/offers` with ≥1 active offer.

## Workflow steps (user-observable)
1. On an **active** offer row, a **"◧ Publish to store"** button shows. Click it →
   toast "Published to store"; the row gains an **"◧ In store"** badge and the
   button becomes **"◧ In store ✓"**.
2. Click again → toast "Removed from store"; badge disappears.
3. Open **Edit** (or **New offer**) → a **"Publish to store"** section shows a
   toggle; turning it on reveals optional **Start/End date** inputs. Save persists
   the publish state (new offers: publish takes effect once Active — noted inline).
4. An offer attached to influencers in a campaign shows a **"★ N influencers"**
   badge (N = attachments).
5. Page subtitle no longer says "(soon)".

## Success definition
A brand can publish/unpublish any active offer to its store in one click (and via
the dialog with optional dates), and each row clearly shows its distribution
("In store" and/or "N influencers"). Published+active offers surface in the store
feed (already wired in D1); unpublishing removes them.

## Failure / edge workflows
- Publish on a draft → allowed in the dialog but no store effect until Active
  (UI note); the row-level quick toggle is shown only for active offers.
- Unpublish → offer removed from `store_offers` on next store fetch.
