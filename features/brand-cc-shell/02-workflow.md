# Workflow Definition — Brand CC shell (A1)

## Actor
Logged-in brand, campaign created.

## Preconditions
Campaigns across statuses (draft/pending_wallet/published/active/live/completed).

## Workflow steps (user-observable)
1. Open a campaign → a **stage rail** shows Fund & Publish → Roster → Contracts →
   Production → Review → Payout, with the current stage highlighted (from status+counts).
2. A **primary action bar** shows the one next step for the current stage.
3. A **fresh (draft/pending_wallet)** campaign shows **"Fund wallet & publish"** — the
   step that had no button before.
4. Tapping it calls publish; if the wallet lacks the budget → routed to /dashboard/wallet
   with a clear message; otherwise the campaign publishes and the rail advances.
5. The existing hierarchy/tabs/analytics remain below the rail (unchanged this contract).

## Success definition
- The rail + prime bar render for every status; the current stage + CTA are correct; a
  fresh campaign can Fund & Publish (or is routed to wallet when underfunded); no existing
  page function regresses.

## Failure / edge workflows
- publish → WALLET_INSUFFICIENT → route to wallet, no crash.
- publish → other error → toast, campaign unchanged.
