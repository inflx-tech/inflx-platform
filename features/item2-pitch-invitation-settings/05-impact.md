# item2-pitch-invitation-settings — impact

**Verdict: production-impacting on four surfaces. Explicit go required before `git push`.**

| Surface | Change | Deploys via |
|---|---|---|
| Database | migrations 168 (reference lists + `brands.sub_categories`, `influencers.city_id`) and 169 (4 new tables, `influencer_proposals.shoot_mode`). Additive, no backfill, no drop. | `node backend/scripts/run-168-169.js --dry` then `--apply` (prod) |
| Backend | new routes (settings, blocks, reference), eligibility service, pitch-create + invite-create enforce settings, `/brands/:id/public` + `/influencers/:id` gain summaries, `proposal-criteria` stops leaking, brand register requires sub-categories, creator profile requires one niche | Render auto-deploy on push |
| Brand website | old "who can pitch us" panel replaced by a notice; sub-categories at registration and in Business details | Vercel auto-deploy on push |
| Phones | brand + creator apps: new screens, profile rows, register chips, niche single-select | OTA brand + influencer after push |

## Behaviour that changes for existing users
- Every brand and creator is **fully open** to pitches/invitations (rules default). Brands that switched the
  old toggle off on the website are open again (founder Q7).
- A brand registering from now on must pick ≥1 sub-category. Existing brands have none until they set them in
  Business details; until then a creator who filters by category will not match them (founder Q5c).
- A creator saving Content preferences must choose exactly one niche. Existing multi-niche values are kept in
  the database; the profile shows the first matching one.
- An invitation to a creator who is paused, has blocked the brand, or is not open to the set's Aim/mode/category/
  city is now refused with a coarse 403 — including from the brand website's existing Invite modal (it shows
  the server message).

## Rollback
- Backend/web: revert the commit and push. The new tables can stay (unread) — no data loss.
- Phones: publish the previous OTA bundle.

## Regression risk
- Backend test suite: baseline 474 failed / 521 passed (98 suites) before; see `06-diff/notes.md` for after.
  474 of the baseline failures are the pre-existing `registerBrand` factory using `category:'restaurant'`,
  rejected since the fashion-only cut — unrelated to this item and left alone.
- The invite path gains one read-only check before any write; defaults are all-open so existing invite tests
  are unaffected.
