# Workflow Definition — Home restyle + "Your turn (N)" tile

## Actor
Logged-in influencer, approved.

## Preconditions
Influencer with a spread of collabs (some `turn=you`), some notifications, a wallet
balance.

## Workflow steps (user-observable)
1. Open the app → Home tab shows an IG-clean **white header** (greeting + handle +
   bell), no ink block / no `[LOGO]`.
2. A single **"Your turn (N)" tile** shows the count of collabs needing the influencer;
   tapping it opens the **Collabs** tab.
3. When nothing needs the influencer (N=0) the tile is calm/grey ("You're all caught up").
4. **Active collabs** glance lists up to 3 active/tracking collabs; tapping one opens its
   **CollabDetail**; "View all" opens Collabs.
5. **Recent activity** shows top unread notifications; "View all" → Notifications.
6. **Wallet** strip shows available-to-withdraw; tapping → Earnings.

## Success definition
- Home renders IG-clean; the single Your-turn tile shows the correct `turn=you` count and
  routes to Collabs; the active glance opens CollabDetail; wallet + activity route
  correctly; no old ink header / 3-tile layout remains; no crash if a source read fails.

## Failure / edge workflows
- A source read fails → its section hides/empties; Home still renders; N falls back to 0.
- No collabs / no notifications → calm tile + empty sections, no error.
