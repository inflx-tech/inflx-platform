# Workflow Prediction — Collabs list

> What the locked mockups predict the built screen will do, step by step.
> Compared against the real build in `06-diff/` after implementation.

Mockups: `mockups/collabs-ia.html` (tab bar + list), `mockups/collabs-lifecycle.html`
(stage spine + the row in every state).

## Predicted observable behaviour
1. Bottom bar shows **Home · Collabs · Create · Earnings · Profile** — but for THIS
   contract only the **Collabs** swap ships; Create arrives in a later contract, so the
   shipped bar this slice is **Home · Collabs · Earnings · Profile**. (Mockup shows the
   end-state 5-tab bar; the diff will note Create as not-yet-built.)
2. Collabs opens on the **All** filter, feed-style rows, one per engagement.
3. A signed deal that used to appear in both Offers and Campaigns appears **once**.
4. Each row's badge + CTA/one-liner match the lifecycle mockup's state for that status
   (e.g. `accepted` → "To sign" + black "Review & sign"; `active` w/ pending
   deliverable → "Active" + "Upload →"; `negotiating` → purple "Negotiating" +
   "Open chat →").
5. Stage-filter tabs filter the list; counts match the deduped set.
6. Row taps route to the existing OfferDetail (pre-sign) or CampaignDetail (post-sign).
7. Yellow dot/rail marks "your turn"; blue marks "waiting on brand".

## Known mockup-vs-build deltas (expected, not defects)
- Create tab present in the mockup bar, not in this build (separate contract).
- Row taps land on the OLD detail screens, not the (not-yet-built) `CollabDetail`.
- The Tracking stage filter shows, but Tracking *detail* is a later contract; tapping a
  tracking-stage row routes to CampaignDetail for now.
