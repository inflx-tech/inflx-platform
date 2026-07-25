# Workflow Definition — Collabs list

> Step 3. Each numbered step becomes an assertion in the QA workflow test.

## Actor
Logged-in influencer, account approved.

## Preconditions
Influencer has a spread of engagements across stages — at least one `invited`, one
`negotiating`, one `accepted`/`pending_influencer` (to-sign), one `active`, one
`completed`, and one terminal (`expired` or `declined`). (Seed via direct SQL on the
read path; see `test-harness-tier-cascade` precedent.)

## Workflow steps (user-observable)
1. Open the app → the bottom bar shows **Collabs** where Offers + Campaigns used to
   be (Home · Collabs · Earnings · Profile) → tapping Collabs loads `CollabsListScreen`.
2. The list shows **one row per engagement**, deduped by `campaign_influencer_id` —
   a signed deal that previously showed in both Offers and Campaigns now shows **once**.
3. Each row shows: brand, campaign, a **stage badge**, a **whose-turn** signal
   (yellow dot = your turn / blue = waiting on brand), and a stage-appropriate CTA or
   one-line status (per `collabs-lifecycle.html`).
4. The stage-filter tabs (All · Invites · Applied · Negotiating · To sign · Active ·
   Tracking · Completed · Archive) filter the list; counts reflect the deduped set.
5. Tap a **pre-sign** row (`invited` / `negotiating` / `accepted` / `pending_*`) →
   navigates to the existing **OfferDetail** for that engagement.
6. Tap a **post-sign** row (`contracted` / `active` / `completed`) → navigates to the
   existing **CampaignDetail** for that engagement.
7. Pull-to-refresh → both sources re-fetch, list re-dedupes, no duplicate appears.
8. Tap a notification / Home tile that used to target the Offers or Campaigns tab →
   it resolves correctly (routes via Collabs, no dead-end).

## Success definition
The workflow is SUCCESSFUL only if the final state is:
- **One deduped, stage-filtered Collabs list** where no `campaign_influencer_id`
  appears twice; every row shows the correct stage + whose-turn; each row tap lands on
  the correct existing detail screen; and no previously-working notification/Home
  navigation is broken.

## Failure / edge workflows
- One source call fails → the other still renders + a non-blocking error indicator;
  no crash, no blank screen.
- A filter with no matching engagements → canonical empty state for that stage.
- Terminal engagements never appear in the forward stages — only under **Archive**.
- Offline → last-loaded list from state + the refresh control is available.
