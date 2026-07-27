# Before / After — discovery shortlist + working invite (completes discovery)

## 1. Shortlist from a result card
**Before:** Groups existed only as a separate sub-tab; a result row had no save action, so
shortlisting was disconnected from browsing.
**After:** onboarded creators' cards show a **Shortlist** button → a modal listing the
brand's existing groups (tap to add) **or** create a new named list — persisted via the
existing `influencerGroupApi` (`list` / `create` / `addMembers`). Confirmation toast on
success; real API error surfaced on failure. Hidden for scraped creators (no real
influencer id to add) — they keep the invite-to-join path.

## 2. Working invite from the profile
**Before:** the profile's "Invite to Campaign" opened a **dead placeholder** — *"go to your
campaign wizard and use the influencer search in handpick mode"* + a link to /dashboard/
campaigns. No invite happened.
**After:** a real `InviteToCampaignModal` — pick an **active campaign** → pick a **set** →
Send invite → `campaignApi.inviteInfluencer(campaignId, setId, { influencer_id })`, the same
endpoint the campaign wizard uses (verified in campaign.controller.js: `influencer_id` is the
only required field). Success shows "@handle will see it in their offer inbox"; failures show
the real message. Honest empty states: no active campaigns → prompts to create one; campaign
with no sets → says so.

## Changed
- `influencers/page.js` — ShortlistModal + Shortlist card action + state/mount.
- `influencers/[id]/page.js` — placeholder modal replaced by InviteToCampaignModal;
  imports campaignApi.

## Verification
- **`next build` compiled clean** (77 pages; both influencer pages grew as expected).
- Verified in the founder's single end-to-end pass (per feedback_e2e_verification_at_end).

## Known delta / deferred
- **Side-by-side compare** not built (the remaining discovery nice-to-have).
- Content thumbnails + audience demographics = backend batch; city/niche pick-lists need a
  canonical taxonomy.
