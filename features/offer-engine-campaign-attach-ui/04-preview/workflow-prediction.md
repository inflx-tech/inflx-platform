# Workflow Prediction — offer-engine-campaign-attach-ui (Sub-contract C, UI)

Mockup: `04-preview/mockups/03-distribute.html` (locked Screen 03) — the in-wizard
per-influencer attach: prompt → open offer library picker → assign per influencer,
goal-keyed. This contract implements the **conversion/hybrid handpick** slice:

Predicted flow: campaign → conversion set → handpick → pick influencer → Offer
step → "Use a saved offer" dropdown (active library offers) → select → "✓ Using
saved offer" summary → save → invite carries `brand_offer_id` → backend snapshots
+ `allocation='commissioned'`. "Author inline" restores the existing builder.

Deltas vs the full Screen 03 mockup (documented in 06-diff): the goal-toggle +
engagement-promotional column and the per-influencer "different offer each" grid
are represented by the real per-influencer wizard step; the **engagement** column
and **open-group group offers** are deferred (engagement → Sub-contract D).

Visual: native wizard styling (existing `.te`/`.oc-types`/`.inp` classes) +
locked palette; the picker uses the wizard's `.inp`/`.flbl` + a green "using
saved offer" summary.
