# Feature Spec — Home restyle + "Your turn (N)" tile (influencer · Wave-1 screen 4)

> Step 2. Brings the app's entry screen onto the Instagram-clean system and
> collapses the three scattered attention tiles into one.

## Problem / goal
Home still uses the old ink+yellow palette (ink header, `[LOGO]` placeholder) and
three attention tiles that point at three different tabs. Restyle Home to IG-clean and
replace the three tiles with **one "Your turn (N)" tile** that opens Collabs — where N
is the same "whose turn = you" count the Collabs list shows.

## Scope
**In scope**
- Restyle `HomeScreen` to the IG-clean kit (`theme/ig`): white header + greeting (+
  handle) + bell; hairline rows; yellow only on the "your turn" signal. Remove the ink
  header + `[LOGO]` placeholder + yellow accent rule.
- Replace the 3 `ActionTile`s with **one "Your turn (N)" tile** → `navigate('Collabs')`.
  N = count of merged collabs with `turn === 'you'` (reuse `utils/collabStages`
  `mergeCollabs`/`whoseTurn`). N=0 → calm "all caught up" state.
- Restyle the standing sections: **Active collabs** glance (top 3, stage active/tracking)
  → open `CollabDetail` via the Collabs tab; **Recent activity** (top unread
  notifications) → Notifications; **Wallet** strip → Earnings.
- Data: load `getEarnings`, `getOffers(null)`, `getMyCampaigns('all')`, `getNotifications`;
  merge collabs client-side for the count + active glance (drops the separate
  `getMyCampaigns('active')` call).

**Explicitly out of scope**
- No change to Notifications/Earnings/Collabs screens themselves.
- Any backend/DB change.

## Surfaces touched
- App(s): **mobile (influencer) only.** No web, no backend.
- Roles: influencer.

## Data / contracts
- New/changed tables / endpoints: **NONE.** Reuses existing reads.
- Money/units/attribution/status: none touched (read-only).

## Non-functional
- Auth/role gates: influencer as today.
- Failure modes: any source read failing degrades gracefully (section hides / empty),
  no crash; N defaults to 0 (calm state) if collabs can't load.

## Design reference
`04-preview/mockups/home-restyle.html` — before/after; the restyled Home column.
