# Workflow Definition — offer-engine-campaign-attach-ui (Sub-contract C, UI)

## Actor
Logged-in approved **brand** with ≥1 **active** library offer and ≥1 influencer,
creating/editing a campaign with a conversion (or hybrid) handpick set.

## Preconditions
- C-backend live (invite/update accept `brand_offer_id`).
- B live (`/dashboard/offers` exists; brand has saved an active offer).

## Workflow steps (user-observable)
1. Brand creates a campaign → conversion set → handpick → picks an influencer →
   reaches the per-influencer **Offer** step.
2. A **"Use a saved offer"** dropdown lists the brand's active library offers.
3. Brand selects one → the inline builder is replaced by a **"✓ Using saved
   offer: <name>"** summary; the offer requirement is satisfied (no validation
   error).
4. Brand finishes the set and saves/publishes → the influencer is invited with
   `brand_offer_id` → backend snapshots the library offer onto the assignment,
   `allocation='commissioned'`.
5. Alternatively the brand picks **"— Author inline below —"** → the existing
   offer-type chips + config builder render exactly as today (coexist).
6. Re-opening the draft shows the saved offer still selected (hydrated from
   `campaign_influencers.brand_offer_id`).

## Success definition
A brand can attach a saved library offer to a handpick influencer in the wizard;
the assignment persists with `brand_offer_id` + snapshotted config + commissioned
allocation; the inline authoring path is unchanged; the page matches the locked
mockup (`03-distribute.html`).

## Failure / edge workflows
- No active offers → picker hidden, inline builder shows as today.
- Cross-brand/archived `brand_offer_id` → backend 404/422 surfaced via the
  wizard's error banner (cannot occur from the UI, which only lists own active
  offers — defense in depth).
