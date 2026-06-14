# 01-spec — Bugfix: influencer "Publish to store" gate is redundant after auto-allocation

## Problem (prod, founder-reported 2026-06-14)
On the influencer **Campaign Products** screen, each allocated product shows a
"PUBLISH TO MY STORE" button and a "Published / Pending" gate. But since Phase 2b
the creator store **auto-fills from live-campaign allocations** — the product is
already live in the store whether or not the influencer "publishes". Worse,
"REMOVE FROM STORE" only deletes the note; the product stays live. The gate is an
illusion and contradicts the auto-allocation model.

## Founder direction
Keep the personal recommendation (note); drop the publish gate; products are
automatically published (live) while the campaign is live.

## Fix
Reframe `CampaignProductsScreen.js`:
- Permanent **LIVE** badge on every product (it's allocated by a live campaign).
- Only action = optional recommendation: add / edit / **remove note** (note only,
  product stays live).
- Stats: *Products / Live in store / With note* (was Products/Published/Pending).
- Banner explains products are auto-live while the campaign runs.
- Copy: "SAVE RECOMMENDATION" / "UPDATE NOTE" / "+ ADD RECOMMENDATION";
  alerts "Recommendation saved/removed" (removal clarifies product stays live).

Backend `upsertProductNote` / `deleteProductNote` UNCHANGED — the note is now an
annotation, not a visibility gate (matches 2b: `influencer_product_notes` =
optional annotations).

## Scope
Mobile only (`Packages/Mobile/src/screens/influencer/CampaignProductsScreen.js`).
No backend, no migration. UI-governed path.

## Governance
Copy/logic change to one screen; deployed via **GOVERNANCE_OVERRIDE** (genuine
prod UX bugfix, founder-chosen) — same path as the brandApi.delete (182ba77) and
campaign-wizard (5a44efa) prod bugfixes. HTML mockups + 06-diff intentionally
skipped for a copy/logic change.
